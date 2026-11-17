# JobStrider

> Autonomous, zero-operating-cost AI job pipeline and control room for scanning, evaluating, and tailoring applications for early-career software engineering roles.

[![CI](https://github.com/anshuldeoli04/JobStrider/actions/workflows/ci.yml/badge.svg)](https://github.com/anshuldeoli04/JobStrider/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org)

---

## ⚡ End-to-End Pipeline Workflow

```mermaid
flowchart TD
    subgraph S1["1. Multi-Board Discovery"]
        CLI["💻 CLI or Web UI<br/><code>jobstrider</code> / Web Dashboard"] --> SCAN["🔍 Scanner Engine<br/><code>scanner.mjs</code>"]
        BOARDS[("🌐 Public Job Boards<br/>Greenhouse • Lever • Ashby • Careers Pages")] --> SCAN
    end

    subgraph S2["2. Smart Pre-Filtering & Pre-Ranking"]
        SCAN --> FILTER{"⚡ Fast Filter<br/>Title stoplist • Slug regex • Experience fit"}
        FILTER -- "Pass" --> RANK["📊 Batch Pre-Ranker<br/>Deterministic keyword & title scoring"]
        FILTER -- "Reject" --> DROP1["❌ Drop (Zero API Cost)"]
    end

    subgraph S3["3. AI Candidate Fit Evaluation"]
        RANK --> GEMINI["🤖 Google Gemini 2.5 Flash<br/>Fit Score • Grade A/B/C/D • Strengths & Gaps"]
        GEMINI -- "Daily Limit / 429" --> PAUSE["⏸️ Rate Limit / Cooldown<br/>Pauses or stops at daily quota limit"]
        GEMINI -- "Grade C/D/F" --> DROP2["💾 Save to Scan Cache (Skip Resume)"]
    end

    subgraph S4["4. Resume Tailoring"]
        GEMINI -- "Grade A/B Match" --> TAILOR["📝 Resume Tailor<br/><code>resume-builder.mjs</code><br/>Targeted summary • Skill alignment • CV-grounded"]
    end

    subgraph S5["5. PDF Generation & Application Tracking"]
        TAILOR --> PDF["📄 Playwright Engine<br/><code>generate-pdf.mjs</code><br/>Pixel-perfect ATS PDF"]
        PDF --> DATA[("📁 Local JSON Storage<br/><code>data/applications.json</code>")]
        DATA --> TRACKER["🎯 Interactive Tracker & Web UI<br/>Terminal & React Dashboard"]
    end

    classDef primary fill:#1e293b,stroke:#3b82f6,stroke-width:2px,color:#f8fafc;
    classDef ai fill:#1e1b4b,stroke:#8b5cf6,stroke-width:2px,color:#f8fafc;
    classDef success fill:#064e3b,stroke:#10b981,stroke-width:2px,color:#f8fafc;
    classDef drop fill:#3f1818,stroke:#ef4444,stroke-width:1px,color:#fca5a5;

    class CLI,SCAN,FILTER,RANK primary;
    class GEMINI,PAUSE ai;
    class TAILOR,PDF,DATA,TRACKER success;
    class DROP1,DROP2 drop;
```

---

## 📌 Architecture & Design Principles

JobStrider is designed around three strict operational constraints:
1. **Zero Operating Cost**: Built to run entirely on free-tier APIs and local hardware. No subscriptions, hosted proxies, or paid vector databases required.
2. **Bring Your Own Key (BYOK)**: Your API keys stay on your machine (`.env`). Your CV and job descriptions are sent to the LLM provider you configure (Google Gemini, optionally Groq) for scoring and tailoring. See Disclaimers.
3. **Autonomous CLI Architecture**:
   - Standalone command-line workflow backed by atomic JSON disk storage (`data/`). Requires zero database configuration, zero background services, and runs entirely in your terminal.

---

## 🔍 Supported Sources & Health Monitoring

The scanner queries 7 distinct channels, each classified using a dedicated fetch-health state machine (`HEALTHY`, `DEGRADED`, `EMPTY`, `SELECTOR_BROKEN`, `BLOCKED`, `THROTTLED_TIMEOUT`, `ERROR`):

| Source | Method | Authentication | Default State |
|---|---|---|---|
| **Greenhouse** | Public Boards API (`/v1/boards/<slug>/jobs`) | None | Active (Default) |
| **Lever** | Public Postings API (`/v0/postings/<slug>`) | None | Active (Default) |
| **Ashby** | Public Posting API (`/posting-api/job-board/<slug>`) | None | Active (Default) |
| **Careers Pages** | Headless Playwright + JSON-LD Extraction | None | Active (Default) |
| **Internshala** | Stealth Browser (India freshers/interns) | None | Opt-in (`disabled_sources`) |
| **Naukri** | Stealth Browser + Next.js hydration wait | None | Opt-in (`disabled_sources`) |
| **Wellfound** | Stealth Browser (AngelList startups) | None | Opt-in (`disabled_sources`) |

> [!NOTE]
> Fast API sources run by default without browser overhead. To enable browser sources, see [Enabling Browser Sources](#enabling-browser-sources). All health states are recorded in `data/health-log.jsonl`.

---

## 🚀 Quick Start (CLI Mode - 5 Minutes)

### 1. Installation & Guided Setup

**Recommended: Interactive Onboarding Wizard**
```bash
npm install
npm run setup
node setup-check.mjs
```

Or configure manually:
```bash
npm install
npx playwright install chromium
cp config.example.json config.local.json
cp env.example .env
cp cv.example.md cv.md
node setup-check.mjs
```

### 2. Configure Your API Key
1. Get a free Gemini key from [Google AI Studio](https://aistudio.google.com/apikey).
2. Open `.env` and set:
   ```env
   GEMINI_API_KEY=your_actual_key_here
   ```
3. Update [`cv.md`](./cv.md) with your real technical background, skills, and projects.

### 3. Launch & Run

#### Option A: One-Click Web Cockpit (Recommended for All Users)
```bash
npm run ui
```
Opens the interactive **JobStrider Dashboard** (`http://localhost:3000`) with zero database installation required (embedded SQLite + JSON synchronization).

#### Option B: Terminal CLI Mode
```bash
# Full automated pipeline (Scan -> Calibrate -> Tailor)
node autoflow.mjs

# Or individual pipeline stages:
node scanner.mjs                  # Scan enabled sources
node scan-evaluate.mjs --mode=auto # Evaluate discovered jobs
node tracker.mjs                  # Terminal application tracker
```

---

## 🛠️ Core CLI Workflows

### 1. End-to-End Pipeline (`autoflow.mjs`)
The primary driver for hands-free or interactive job hunting:
```bash
node autoflow.mjs
```
- **Step 1**: Discovers new jobs across enabled sources (Greenhouse, Lever, Ashby, and verified career pages by default; Internshala and Naukri are opt-in).
- **Step 2**: Prompts for confirmation and batch-evaluates matching candidates using Gemini 2.5 Flash.
- **Step 3**: Renders a ranked candidate matrix and generates tailored resumes for selected matches (or automatically via `--auto-tailor` / `--yes`, bounded by `--tailor-top=N`).

#### Autoflow Exit Codes
- `0`: Pipeline completed successfully.
- `1`: Execution error encountered.
- `2`: Daily quota limit reached or user aborted.

### 2. Live Job Scanner (`scanner.mjs`)
Scans all enabled sources without modifying existing application records:
```bash
# Scan all enabled channels
node scanner.mjs

# Scan specific sources with keyword overrides
node scanner.mjs --sources=ashby,greenhouse,reach_linkedin,freehire --keywords="software engineer"
```

#### Multi-Platform Discovery (Agent Reach & FreeHire)
JobStrider supports multi-platform retrieval:
- **FreeHire Remote**: Fast REST scraper for global remote software engineering roles (`--sources=freehire`).
- **Agent Reach (LinkedIn)**: Headless-free, credential-free LinkedIn job discovery via the Agent Reach CLI (`--sources=reach_linkedin`).

#### Enabling Browser Sources (Naukri, Internshala, Wellfound)
Official public APIs (Greenhouse, Lever, Ashby, FreeHire) and Agent Reach are fast and lightweight. Stealth browser-based sources require Playwright Chromium and are opt-in.
To enable browser sources:
1. Ensure Playwright Chromium is installed: `npx playwright install chromium`
2. In `config.local.json` (or `config.json`), remove them from `disabled_sources`:
   ```json
   {
     "disabled_sources": []
   }
   ```
3. Or invoke a targeted run directly via `--sources`:
   ```bash
   node scanner.mjs --sources=naukri,internshala
   ```

### 3. Deep Fit Evaluator (`evaluate.mjs`)
Paste any job description from LinkedIn, Indeed, or company websites to get an instant candidate fit assessment:
```bash
node evaluate.mjs

# Or evaluate directly from a URL via Agent Reach deep reader:
node evaluate.mjs --url=https://www.linkedin.com/jobs/view/123456789/
```
Generates fit score (1-10), calibrated letter grade (A+ through F), key strengths, honest skill gaps, and custom interview prep questions.

### 4. Intelligent Resume Tailoring & ATS Verifier (`resume-builder.mjs`)
Generates tailored, high-ATS-yield PDF and HTML resumes aligned directly with target job requirements:
```bash
# Interactive selection from evaluated jobs
node resume-builder.mjs

# Directly target a specific tracked application
node resume-builder.mjs --job-id=<application_id>
```
Post-rendering, the built-in **ATS Verifier** (`atsVerifier.mjs`) parses the binary PDF stream, computes an ATS readability score (0-100 pts), validates contact details, verifies section headings, and flags orphan lines spilling onto page 2.

### 5. Interview Preparation Copilot (`interview-prep.mjs`)
Generates role-specific interview preparation dossiers grounded in your actual CV experience:
```bash
node interview-prep.mjs
```
Produces structured STAR behavioral stories, technical Q&A topics, honest skill gap bridges, and strategic questions for the interviewer, saving reports to `reports/interview-prep/`.

### 6. Application Tracker & Outreach Copilot (`tracker.mjs`)
An interactive terminal dashboard for reviewing evaluated jobs, generating follow-up outreach drafts for stale applications (pending >= 10 days), and tracking your application lifecycle:
```bash
node tracker.mjs
```

---

## 🛡️ Security & Privacy Architecture

- **Adversarial Posting Guard**: All incoming job descriptions and scraped postings are sanitized through `postingGuard.mjs` before being passed to LLM prompts, stripping invisible zero-width Unicode characters, hidden HTML comments, script tags, prompt-injection patterns, and cross-script homoglyphs.
- **Subprocess Environment Sanitization**: Subprocesses launched by the CLI runner inherit a strictly allow-listed environment (`sanitizeChildEnv`). System secrets, database passwords, and master keys are systematically scrubbed before executing child scripts.
- **Zero Cloud Storage / 100% Local**: All scan results, application histories, tailored resumes, and evaluation reports are stored locally on your machine in atomic JSON and Markdown files under `data/`, `output/`, and `reports/`.
- **Bring Your Own Key (BYOK)**: All LLM evaluations and resume tailoring run directly against your personal Gemini or Groq API keys with zero telemetry or middleman servers.

---

## ⚖️ Disclaimers & Legal Notice

- **Third-Party Platform Terms**: Users are solely responsible for complying with each job platform's terms of service, robots.txt directives, and applicable local laws. The maintainers do not endorse or encourage circumventing technical access controls or terms of service. This software is provided strictly for personal, non-commercial developer job-seeking automation.
- **LLM Data Privacy**: Candidate resumes and job descriptions are sent to Google Gemini and Groq APIs for scoring and text tailoring. Please review [Google AI Studio Terms of Service](https://ai.google.dev/terms) and [Groq Terms](https://groq.com) regarding data logging on free-tier plans.
- **Single Key BYOK & Free-Tier Quotas**: The system uses a Bring-Your-Own-Key model. Pacing and circuit breakers prevent API hammering, but daily free-tier quotas are governed strictly by the upstream providers.

---

## 📄 License & Community

- **License**: [MIT](./LICENSE)
- **Security Policy**: [SECURITY.md](./SECURITY.md)
- **Contributing Guidelines**: [CONTRIBUTING.md](./CONTRIBUTING.md)
- **Code of Conduct**: [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
