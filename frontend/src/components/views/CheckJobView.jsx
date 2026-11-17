import { useId, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Download,
  ExternalLink,
  Eye,
  Loader2,
  Sparkles
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { getGradeLabel, isSafeUrl } from '../../utils/jobHelpers';

export default function CheckJobView() {
  const config = useAppStore((state) => state.config);
  const scanResults = useAppStore((state) => state.scanResults);
  const activeEvaluation = useAppStore((state) => state.activeEvaluation);
  const runEvaluate = useAppStore((state) => state.runEvaluate);
  const runResume = useAppStore((state) => state.runResume);
  const tailoringId = useAppStore((state) => state.tailoringId);
  const openResumeModal = useAppStore((state) => state.openResumeModal);
  const openByokModal = useAppStore((state) => state.openByokModal);
  const openResumePreview = useAppStore((state) => state.openResumePreview);
  const pushToast = useAppStore((state) => state.pushToast);

  const [jdText, setJdText] = useState('');
  const [jobUrl, setJobUrl] = useState('');
  const [pickedUrl, setPickedUrl] = useState('');

  const jdId = useId();
  const urlId = useId();
  const pickId = useId();

  const hasCv = Boolean(config?.has_cv);
  const hasKey = Boolean(config?.has_key);
  const isEvaluating = activeEvaluation?.status === 'running';
  const result = activeEvaluation?.result;
  const isTailoring = Boolean(result && tailoringId === result.id);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!hasCv) {
      openResumeModal();
      return;
    }
    if (!hasKey) {
      openByokModal();
      return;
    }
    const hasValidUrl = isSafeUrl(jobUrl.trim());
    if (jdText.trim().length < 50 && !hasValidUrl) {
      pushToast({
        type: 'warning',
        title: 'Provide a Job Link or Description',
        message: 'Paste a valid job URL for auto-reading, or paste at least 50 characters of the job description.'
      });
      return;
    }
    await runEvaluate({ mode: 'single', jd: jdText.trim(), url: jobUrl.trim() });
  };

  const handleLoadDiscovered = (selectedUrl) => {
    setPickedUrl(selectedUrl);
    const match = scanResults.find((item) => item.url === selectedUrl);
    if (!match) return;
    setJobUrl(match.url || '');
    setJdText(
      [
        `Company: ${match.company || 'Company'}`,
        `Role: ${match.role || 'Role'}`,
        `Location: ${match.location || 'Remote'}`,
        match.experience ? `Experience: ${match.experience}` : '',
        match.salary ? `Salary: ${match.salary}` : '',
        match.content || match.description || 'Evaluate fit based on role title, company, and location.'
      ]
        .filter(Boolean)
        .join('\n')
    );
  };

  return (
    <div className="split-2">
      {/* Left: Paste Job Form */}
      <section className="card">
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: '1.15rem', fontWeight: 700 }}>Check Any Job Posting</h2>
          <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-soft)' }}>
            Copy and paste a job description from LinkedIn, Naukri, company websites, or messages.
          </p>
        </div>

        {(!hasCv || !hasKey) && (
          <div
            style={{
              marginBottom: 16,
              padding: 14,
              borderRadius: 12,
              background: 'var(--warning-bg)',
              border: '1px solid var(--warning-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10
            }}
          >
            <strong style={{ fontSize: '0.88rem', color: 'var(--warning)' }}>
              Before checking a job, make sure these are ready:
            </strong>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {!hasCv && (
                <button type="button" className="btn btn-primary btn-sm" onClick={openResumeModal}>
                  1. Upload Resume
                </button>
              )}
              {!hasKey && (
                <button type="button" className="btn btn-primary btn-sm" onClick={openByokModal}>
                  2. Connect Free AI Key
                </button>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {scanResults.length > 0 && (
            <div className="field-group">
              <label htmlFor={pickId} className="field-label">
                Quick-fill from Discovered Jobs (Optional)
              </label>
              <select
                id={pickId}
                className="select"
                value={pickedUrl}
                onChange={(e) => handleLoadDiscovered(e.target.value)}
              >
                <option value="">-- Choose a recently discovered job --</option>
                {scanResults.slice(0, 60).map((item, idx) => (
                  <option key={`${item.url}-${idx}`} value={item.url}>
                    {item.company} — {item.role}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="field-group">
            <label htmlFor={jdId} className="field-label">
              Job Description {jobUrl.trim() ? '(Optional if Job Link is provided)' : <span aria-hidden="true">*</span>}
            </label>
            <textarea
              id={jdId}
              name="job_description"
              className="textarea"
              rows={10}
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              placeholder="Paste the job title, responsibilities, required skills... (Or enter a Job Link below for 1-click AI auto-read)"
            />
          </div>

          <div className="field-group">
            <label htmlFor={urlId} className="field-label">
              Job Link (Optional)
            </label>
            <input
              id={urlId}
              name="job_url"
              type="url"
              className="input"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              value={jobUrl}
              onChange={(e) => setJobUrl(e.target.value)}
              placeholder="https://company.com/careers/role"
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={isEvaluating}>
            {isEvaluating ? <Loader2 size={16} className="spin-animation" /> : <ClipboardCheck size={16} />}
            <span>{isEvaluating ? 'Analyzing Your Fit...' : 'Check My Match Score'}</span>
          </button>
        </form>
      </section>

      {/* Right: Fit Report */}
      <section className="card" aria-live="polite">
        {isEvaluating ? (
          <div style={{ textAlign: 'center', padding: '56px 20px' }}>
            <Loader2 size={36} className="spin-animation" style={{ color: 'var(--accent)', marginBottom: 14 }} />
            <h3 style={{ margin: '0 0 8px', fontSize: '1.08rem', fontWeight: 700 }}>Comparing job with your resume...</h3>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-soft)' }}>
              Checking skills, experience level, gaps, and likely interview questions (usually 10–15 seconds).
            </p>
          </div>
        ) : result ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className={`grade-badge grade-${(result.grade || 'C').toLowerCase()}`}>
                    {result.grade}
                  </span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>{result.company}</h3>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-soft)' }}>
                      {result.role} • {result.location || 'Remote'}
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'end' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                  {Number(result.score || 0).toFixed(1)}/10
                </div>
                <span className="pill pill-accent" style={{ cursor: 'default' }}>
                  {result.verdict || getGradeLabel(result.grade)}
                </span>
              </div>
            </div>

            {result.salary_estimate && (
              <div className="pill" style={{ cursor: 'default', alignSelf: 'flex-start' }}>
                Estimated Pay: {result.salary_estimate}
              </div>
            )}

            <div>
              <h4 style={{ margin: '0 0 6px', fontSize: '0.92rem', fontWeight: 700 }}>Overall Assessment</h4>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-soft)', lineHeight: 1.6 }}>
                {result.fit_summary}
              </p>
            </div>

            {Array.isArray(result.strengths) && result.strengths.length > 0 && (
              <div>
                <h4 style={{ margin: '0 0 8px', fontSize: '0.9rem', fontWeight: 700, color: 'var(--success)' }}>
                  Where You Match Well
                </h4>
                <div className="chip-list">
                  {result.strengths.map((s, idx) => (
                    <span key={idx} className="pill pill-success" style={{ cursor: 'default' }}>
                      <CheckCircle2 size={13} /> {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {Array.isArray(result.gaps) && result.gaps.length > 0 && (
              <div>
                <h4 style={{ margin: '0 0 8px', fontSize: '0.9rem', fontWeight: 700, color: 'var(--warning)' }}>
                  Gaps to Watch Out For
                </h4>
                <div className="chip-list">
                  {result.gaps.map((g, idx) => (
                    <span key={idx} className="pill pill-warning" style={{ cursor: 'default' }}>
                      <AlertTriangle size={13} /> {g}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {Array.isArray(result.interview_prep) && result.interview_prep.length > 0 && (
              <div>
                <h4 style={{ margin: '0 0 8px', fontSize: '0.9rem', fontWeight: 700 }}>Interview Questions to Practice</h4>
                <ol style={{ margin: 0, paddingInlineStart: 20, display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.86rem', color: 'var(--text-soft)' }}>
                  {result.interview_prep.map((q, idx) => (
                    <li key={idx}>{q}</li>
                  ))}
                </ol>
              </div>
            )}

            {/* Action Footer */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', paddingTop: 14, borderTop: '1px solid var(--border)' }}>
              {result.resume_html ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() =>
                    openResumePreview({
                      title: `${result.company} — ${result.role} Resume`,
                      htmlUrl: result.resume_html,
                      pdfUrl: result.resume_pdf
                    })
                  }
                >
                  <Eye size={15} />
                  <span>Preview Tailored Resume</span>
                </button>
              ) : null}

              {result.resume_pdf ? (
                <a href={result.resume_pdf} download className="btn btn-success">
                  <Download size={15} />
                  <span>Download Tailored PDF</span>
                </a>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={isTailoring}
                  onClick={() => runResume({ applicationId: result.id })}
                >
                  {isTailoring ? <Loader2 size={15} className="spin-animation" /> : <Sparkles size={15} />}
                  <span>{isTailoring ? 'Creating Resume...' : 'Create Tailored Resume for This Job'}</span>
                </button>
              )}

              {isSafeUrl(result.apply_url || result.url) && (
                <a href={result.apply_url || result.url} target="_blank" rel="noreferrer" className="btn btn-ghost">
                  <span>Open Job Post</span>
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
          </div>
        ) : (
          <div style={{ padding: '32px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: 'var(--accent-soft)',
                color: 'var(--accent)',
                display: 'grid',
                placeItems: 'center'
              }}
            >
              <Sparkles size={22} />
            </div>
            <div>
              <h3 style={{ margin: '0 0 6px', fontSize: '1.08rem', fontWeight: 700 }}>
                What you&apos;ll get in ~15 seconds
              </h3>
              <ul style={{ margin: 0, paddingInlineStart: 20, color: 'var(--text-soft)', fontSize: '0.9rem', lineHeight: 1.8 }}>
                <li>Honest <strong>1–10 Fit Score &amp; Grade</strong> (so you don&apos;t waste time on mismatched jobs)</li>
                <li>Exact <strong>matching skills</strong> and <strong>missing requirements</strong></li>
                <li>Likely <strong>interview questions</strong> &amp; salary guidance</li>
                <li>1-click <strong>Tailored Resume PDF</strong> optimized for that exact posting</li>
              </ul>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
