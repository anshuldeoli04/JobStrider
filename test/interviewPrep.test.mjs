import test from "node:test";
import assert from "node:assert/strict";
import {
  buildInterviewPrepPrompt,
  renderInterviewPrepMarkdown,
} from "../src/services/interviewPrepService.mjs";

test("Interview Prep: buildInterviewPrepPrompt formats prompt with sanitized job and CV", () => {
  const job = {
    id: "job-123",
    company: "PhonePe",
    role: "Backend Engineer",
    location: "Bengaluru",
    content: "Building high throughput payment microservices using Java and Node.js.",
    strengths: ["Strong backend fundamentals", "Fast learner"],
    gaps: ["No direct payment gateway experience"],
  };
  const cv = "CANDIDATE: Arjun Verma\nSKILLS: JavaScript, Node.js, Python, PostgreSQL, Docker";

  const prompt = buildInterviewPrepPrompt(job, cv);
  assert.ok(prompt.includes("PhonePe"));
  assert.ok(prompt.includes("Backend Engineer"));
  assert.ok(prompt.includes("Arjun Verma"));
  assert.ok(prompt.includes("STAR story"));
  assert.ok(prompt.includes("gapBridges"));
});

test("Interview Prep: renderInterviewPrepMarkdown produces complete markdown dossier", () => {
  const prepData = {
    company: "Swiggy",
    role: "Frontend Engineer",
    company_overview: "Leading on-demand food delivery platform.",
    role_mission: "Build low-latency web interfaces for consumer ordering.",
    behavioral_questions: [
      {
        question: "Describe a project where you solved a performance bottleneck.",
        target_competency: "Performance Engineering",
        star_story: {
          situation: "During development of a React dashboard with 5000 items.",
          task: "Reduce initial page render delay from 1.8s to under 300ms.",
          action: "Implemented windowing with react-window and memoized expensive filters.",
          result: "Render time dropped to 180ms with 60fps scrolling.",
        },
      },
    ],
    technical_questions: [
      {
        topic: "React Rendering & Reconciliation",
        question: "How does React Fiber handle state updates and interruptible rendering?",
        key_talking_points: ["Double buffering tree", "Priority lanes", "Concurrency"],
      },
    ],
    gap_bridges: [
      {
        missing_skill: "GraphQL",
        suggested_bridge: "While I primarily used REST APIs in my projects, I have studied GraphQL schemas and resolvers...",
      },
    ],
    questions_for_interviewer: [
      "What are the biggest scalability challenges your frontend team is solving this quarter?",
    ],
  };

  const md = renderInterviewPrepMarkdown(prepData, { company: "Swiggy", role: "Frontend Engineer" }, "Arjun Verma");
  assert.ok(md.includes("# Interview Preparation Pack: Swiggy — Frontend Engineer"));
  assert.ok(md.includes("Arjun Verma"));
  assert.ok(md.includes("Performance Engineering"));
  assert.ok(md.includes("Render time dropped to 180ms"));
  assert.ok(md.includes("React Rendering & Reconciliation"));
  assert.ok(md.includes("GraphQL"));
  assert.ok(md.includes("What are the biggest scalability challenges"));
});
