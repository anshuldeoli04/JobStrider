import { Download, Eye, FileText, Loader2, RefreshCw, Sparkles, Upload } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

export default function ResumesView() {
  const config = useAppStore((state) => state.config);
  const applications = useAppStore((state) => state.applications);
  const openResumeModal = useAppStore((state) => state.openResumeModal);
  const openResumePreview = useAppStore((state) => state.openResumePreview);
  const runResume = useAppStore((state) => state.runResume);
  const tailoringId = useAppStore((state) => state.tailoringId);
  const setCurrentView = useAppStore((state) => state.setCurrentView);

  const hasCv = Boolean(config?.has_cv);
  const tailoredApps = applications.filter((a) => a.resume_pdf || a.resume_html);
  const untailoredGoodApps = applications
    .filter((a) => !a.resume_pdf && !a.resume_html && ['A', 'B'].includes(String(a.grade || '').toUpperCase()))
    .slice(0, 6);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Master Resume Card */}
      <section className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: hasCv ? 'var(--success-bg)' : 'var(--warning-bg)',
                color: hasCv ? 'var(--success)' : 'var(--warning)',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0
              }}
            >
              <FileText size={22} />
            </div>
            <div>
              <h2 style={{ margin: '0 0 4px', fontSize: '1.1rem', fontWeight: 700 }}>
                Your Master Resume
              </h2>
              <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-soft)' }}>
                {hasCv
                  ? `${config?.cv_word_count || 0} words saved locally • All tailored resumes stay grounded to your real experience.`
                  : 'Upload your PDF resume or paste text to unlock tailored resumes.'}
              </p>
            </div>
          </div>

          <button type="button" className={hasCv ? 'btn btn-secondary' : 'btn btn-primary'} onClick={openResumeModal}>
            <Upload size={16} />
            <span>{hasCv ? 'Update or Edit Resume' : 'Upload Resume PDF'}</span>
          </button>
        </div>
      </section>

      {/* Tailored Resumes Vault */}
      <section className="card">
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 4px', fontSize: '1.1rem', fontWeight: 700 }}>
            Job-Tailored Resumes ({tailoredApps.length})
          </h3>
          <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-soft)' }}>
            ATS-friendly resumes customized to highlight your best matching skills for each role.
          </p>
        </div>

        {tailoredApps.length ? (
          <div className="cards-subgrid">
            {tailoredApps.map((app) => {
              const isTailoring = tailoringId === app.id;
              return (
                <article
                  key={app.id}
                  style={{
                    border: '1px solid var(--border)',
                    borderRadius: 14,
                    padding: 16,
                    background: 'var(--surface-2)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 14
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <span className={`grade-badge grade-${(app.grade || 'B').toLowerCase()}`}>{app.grade}</span>
                      <div style={{ minInlineSize: 0 }}>
                        <strong style={{ display: 'block', fontSize: '0.96rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {app.company}
                        </strong>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {Number(app.score || 0).toFixed(1)}/10 Match
                        </span>
                      </div>
                    </div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 600 }}>{app.role}</div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                    {app.resume_html ? (
                      <button
                        type="button"
                        className="btn btn-soft btn-sm"
                        onClick={() =>
                          openResumePreview({
                            title: `${app.company} — ${app.role} Resume`,
                            htmlUrl: app.resume_html,
                            pdfUrl: app.resume_pdf
                          })
                        }
                      >
                        <Eye size={13} />
                        <span>Preview</span>
                      </button>
                    ) : null}

                    {app.resume_pdf ? (
                      <a href={app.resume_pdf} download className="btn btn-primary btn-sm">
                        <Download size={13} />
                        <span>Download PDF</span>
                      </a>
                    ) : null}

                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={isTailoring}
                      onClick={() => runResume({ applicationId: app.id })}
                      style={{ marginInlineStart: 'auto' }}
                    >
                      {isTailoring ? <Loader2 size={13} className="spin-animation" /> : <RefreshCw size={13} />}
                      <span>Rebuild</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '38px 16px', color: 'var(--text-soft)' }}>
            <Sparkles size={34} style={{ color: 'var(--text-muted)', marginBottom: 10 }} />
            <h4 style={{ margin: '0 0 6px', fontSize: '1.02rem', fontWeight: 700, color: 'var(--text)' }}>
              No tailored resumes created yet
            </h4>
            <p style={{ margin: '0 0 16px', fontSize: '0.86rem' }}>
              Check a job posting or score jobs first, then click &quot;Tailor Resume&quot; to generate a customized PDF.
            </p>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setCurrentView('check')}>
              Check a Job Posting
            </button>
          </div>
        )}
      </section>

      {/* Quick Suggestions from High-Match Jobs */}
      {untailoredGoodApps.length > 0 && (
        <section className="card">
          <h3 style={{ margin: '0 0 4px', fontSize: '1.02rem', fontWeight: 700 }}>
            Ready to Tailor ({untailoredGoodApps.length} top matches without a custom resume)
          </h3>
          <p style={{ margin: '0 0 14px', fontSize: '0.84rem', color: 'var(--text-soft)' }}>
            Generate an ATS-tailored PDF for any of these strong matches in one click.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {untailoredGoodApps.map((app) => {
              const isTailoring = tailoringId === app.id;
              return (
                <div
                  key={app.id}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 12,
                    border: '1px solid var(--border)',
                    background: 'var(--surface-2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className={`grade-badge grade-${(app.grade || 'B').toLowerCase()}`}>{app.grade}</span>
                    <div>
                      <strong>{app.company}</strong> — {app.role}
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {Number(app.score || 0).toFixed(1)}/10 Match
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={isTailoring}
                    onClick={() => runResume({ applicationId: app.id })}
                  >
                    {isTailoring ? <Loader2 size={13} className="spin-animation" /> : <Sparkles size={13} />}
                    <span>{isTailoring ? 'Building...' : 'Build Resume'}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
