import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardCheck,
  Compass,
  Download,
  ExternalLink,
  FileText,
  Key,
  Loader2,
  MapPin,
  Sparkles,
  Trophy,
  Upload
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { getGradeLabel, isSafeUrl } from '../../utils/jobHelpers';

export default function HomeView() {
  const config = useAppStore((state) => state.config);
  const applications = useAppStore((state) => state.applications);
  const scanResults = useAppStore((state) => state.scanResults);
  const setCurrentView = useAppStore((state) => state.setCurrentView);
  const openByokModal = useAppStore((state) => state.openByokModal);
  const openResumeModal = useAppStore((state) => state.openResumeModal);
  const openJobDetail = useAppStore((state) => state.openJobDetail);
  const runResume = useAppStore((state) => state.runResume);
  const tailoringId = useAppStore((state) => state.tailoringId);

  const hasCv = Boolean(config?.has_cv);
  const hasKey = Boolean(config?.has_key);
  const setupComplete = hasCv && hasKey;

  const strongMatches = applications
    .filter((a) => ['A', 'B'].includes(String(a.grade || '').toUpperCase()))
    .sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));

  const appliedCount = applications.filter((a) => ['applied', 'interview', 'offer'].includes(a.status)).length;
  const interviewOrOfferCount = applications.filter((a) => ['interview', 'offer'].includes(a.status)).length;

  const greetingName = config?.name ? `, ${config.name.split(' ')[0]}` : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* Welcome Banner */}
      <section className="hero-card">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="pill pill-accent" style={{ cursor: 'default' }}>
              <span className="pulse-dot" /> Private &amp; Local on Your Computer
            </span>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Zero subscriptions • Bring your own free Google AI key
            </span>
          </div>

          <h2 style={{ margin: 0, fontSize: 'clamp(1.35rem, 2.2vw, 1.85rem)', fontWeight: 800, letterSpacing: '-0.025em' }}>
            {setupComplete
              ? `Ready to land your next role${greetingName}`
              : `Find jobs that actually match your skills${greetingName}`}
          </h2>
          <p style={{ margin: 0, maxWidth: 680, color: 'var(--text-soft)', fontSize: '0.95rem', lineHeight: 1.6 }}>
            Upload your resume once, check how well you fit any job posting, discover openings across tech boards,
            and create customized ATS resumes in one click.
          </p>
        </div>
      </section>

      {/* Guided 3-Step Setup when incomplete */}
      {!setupComplete && (
        <section className="card" aria-label="Quick setup steps">
          <div style={{ marginBottom: 16 }}>
            <span className="pill pill-warning" style={{ cursor: 'default', marginBottom: 8 }}>
              Quick 2-Minute Setup
            </span>
            <h3 style={{ margin: 0, fontSize: '1.12rem', fontWeight: 700 }}>
              Complete these 2 steps to unlock AI matching &amp; tailored resumes
            </h3>
          </div>

          <div className="grid-3">
            {/* Step 1: Resume */}
            <article
              style={{
                padding: 18,
                borderRadius: 14,
                border: `1px solid ${hasCv ? 'var(--success-border)' : 'var(--warning-border)'}`,
                background: hasCv ? 'var(--success-bg)' : 'var(--surface-2)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 14
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)' }}>STEP 1</span>
                  {hasCv ? (
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <CheckCircle2 size={14} /> Done
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--warning)' }}>Required</span>
                  )}
                </div>
                <h4 style={{ margin: '0 0 6px', fontSize: '1rem', fontWeight: 700 }}>Add Your Resume</h4>
                <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-soft)' }}>
                  Upload a PDF resume or paste your skills and experience as plain text.
                </p>
              </div>
              <button type="button" className={hasCv ? 'btn btn-secondary btn-sm' : 'btn btn-primary btn-sm'} onClick={openResumeModal}>
                <Upload size={15} />
                <span>{hasCv ? 'Update Resume' : 'Upload Resume PDF'}</span>
              </button>
            </article>

            {/* Step 2: Free AI Key */}
            <article
              style={{
                padding: 18,
                borderRadius: 14,
                border: `1px solid ${hasKey ? 'var(--success-border)' : 'var(--warning-border)'}`,
                background: hasKey ? 'var(--success-bg)' : 'var(--surface-2)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 14
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)' }}>STEP 2</span>
                  {hasKey ? (
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <CheckCircle2 size={14} /> Connected
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--warning)' }}>Required</span>
                  )}
                </div>
                <h4 style={{ margin: '0 0 6px', fontSize: '1rem', fontWeight: 700 }}>Connect Free Google AI</h4>
                <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-soft)' }}>
                  Free Google AI Studio key gives 1,500 job checks/day without any credit card.
                </p>
              </div>
              <button type="button" className={hasKey ? 'btn btn-secondary btn-sm' : 'btn btn-primary btn-sm'} onClick={openByokModal}>
                <Key size={15} />
                <span>{hasKey ? 'Manage AI Key' : 'Connect Free AI Key'}</span>
              </button>
            </article>

            {/* Step 3: Preferences */}
            <article
              style={{
                padding: 18,
                borderRadius: 14,
                border: '1px solid var(--border)',
                background: 'var(--surface-2)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 14
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)' }}>STEP 3</span>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--info)' }}>Optional</span>
                </div>
                <h4 style={{ margin: '0 0 6px', fontSize: '1rem', fontWeight: 700 }}>Pick Roles &amp; Cities</h4>
                <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-soft)' }}>
                  Currently targeting {(config?.target_roles || []).slice(0, 2).join(', ') || 'Software roles'} in{' '}
                  {(config?.target_locations || []).slice(0, 2).join(', ') || 'Remote / India'}.
                </p>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setCurrentView('discover')}>
                <Compass size={15} />
                <span>Choose Roles &amp; Scan</span>
              </button>
            </article>
          </div>
        </section>
      )}

      {/* Two Primary Layman Actions */}
      <section className="grid-2" aria-label="Main actions">
        <article className="card card-interactive" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 12,
                background: 'var(--accent-soft)',
                color: 'var(--accent)',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0
              }}
            >
              <Compass size={22} />
            </div>
            <div>
              <h3 style={{ margin: '0 0 6px', fontSize: '1.08rem', fontWeight: 700 }}>Find Matching Jobs Automatically</h3>
              <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-soft)', lineHeight: 1.55 }}>
                Pick your preferred roles and cities, and JobStrider searches startup &amp; company boards for fresh
                openings that fit your experience.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-primary" onClick={() => setCurrentView('discover')}>
              <span>Open Job Finder</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </article>

        <article className="card card-interactive" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 12,
                background: 'var(--success-bg)',
                color: 'var(--success)',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0
              }}
            >
              <ClipboardCheck size={22} />
            </div>
            <div>
              <h3 style={{ margin: '0 0 6px', fontSize: '1.08rem', fontWeight: 700 }}>Check a Job You Already Found</h3>
              <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-soft)', lineHeight: 1.55 }}>
                Saw a job on LinkedIn, Naukri, or email? Paste the description to see your match score, missing skills,
                interview questions, and generate a tailored resume.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setCurrentView('check')}>
              <span>Check a Job Posting</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </article>
      </section>

      {/* Metrics & Top Matches only appear once there is real data */}
      {(applications.length > 0 || scanResults.length > 0) && (
        <>
          <section className="grid-4" aria-label="Progress summary">
            <button
              type="button"
              className="card card-interactive"
              onClick={() => setCurrentView('discover')}
              style={{ textAlign: 'start', cursor: 'pointer', padding: 18 }}
            >
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Jobs Discovered</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: 4 }}>{scanResults.length}</div>
            </button>

            <button
              type="button"
              className="card card-interactive"
              onClick={() => setCurrentView('applications')}
              style={{ textAlign: 'start', cursor: 'pointer', padding: 18 }}
            >
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Strong Matches (A/B)</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: 4, color: 'var(--success)' }}>
                {strongMatches.length}
              </div>
            </button>

            <button
              type="button"
              className="card card-interactive"
              onClick={() => setCurrentView('applications')}
              style={{ textAlign: 'start', cursor: 'pointer', padding: 18 }}
            >
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Applied</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: 4, color: 'var(--accent)' }}>
                {appliedCount}
              </div>
            </button>

            <button
              type="button"
              className="card card-interactive"
              onClick={() => setCurrentView('applications')}
              style={{ textAlign: 'start', cursor: 'pointer', padding: 18 }}
            >
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Interviews &amp; Offers</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: 4 }}>{interviewOrOfferCount}</div>
            </button>
          </section>

          <section className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Trophy size={20} style={{ color: 'var(--success)' }} />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 700 }}>Top Picks For You</h3>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Highest-scoring roles tailored to your resume
                  </p>
                </div>
              </div>
              <button type="button" className="btn btn-soft btn-sm" onClick={() => setCurrentView('applications')}>
                <span>See All ({applications.length})</span>
                <ArrowRight size={14} />
              </button>
            </div>

            {strongMatches.length ? (
              <div className="cards-subgrid">
                {strongMatches.slice(0, 6).map((item) => {
                  const isTailoring = tailoringId === item.id;
                  const applyLink = item.apply_url || item.url;
                  return (
                    <article
                      key={item.id}
                      style={{
                        border: '1px solid var(--border)',
                        borderRadius: 14,
                        padding: 16,
                        background: 'var(--surface-2)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: 12
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minInlineSize: 0 }}>
                            <span className={`grade-badge grade-${(item.grade || 'B').toLowerCase()}`}>
                              {item.grade}
                            </span>
                            <div style={{ minInlineSize: 0 }}>
                              <strong style={{ display: 'block', fontSize: '0.96rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.company}
                              </strong>
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                {getGradeLabel(item.grade)} • {Number(item.score || 0).toFixed(1)}/10
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => openJobDetail(item)}
                          style={{
                            margin: '10px 0 6px',
                            padding: 0,
                            background: 'none',
                            border: 'none',
                            textAlign: 'start',
                            fontSize: '0.96rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            color: 'var(--text)'
                          }}
                        >
                          {item.role}
                        </button>

                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: '0.78rem', color: 'var(--text-soft)' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <MapPin size={12} /> {item.location || 'Remote'}
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <BriefcaseBusiness size={12} /> {item.salary_estimate || 'Competitive'}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                        <button type="button" className="btn btn-soft btn-sm" onClick={() => openJobDetail(item)}>
                          <FileText size={13} />
                          <span>Details</span>
                        </button>

                        {item.resume_pdf ? (
                          <>
                            <a href={item.resume_pdf} download className="btn btn-success btn-sm">
                              <Download size={13} />
                              <span>PDF</span>
                            </a>
                            {item.ats_score != null ? (
                              <span
                                className="pill"
                                title={`ATS Compatibility Score: ${item.ats_score}%`}
                                style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  background: item.ats_score >= 80 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                  color: item.ats_score >= 80 ? '#34d399' : '#fbbf24',
                                  alignSelf: 'center',
                                  padding: '2px 7px'
                                }}
                              >
                                {item.ats_score}% ATS
                              </span>
                            ) : null}
                          </>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={isTailoring}
                            onClick={() => runResume({ applicationId: item.id })}
                          >
                            {isTailoring ? <Loader2 size={13} className="spin-animation" /> : <Sparkles size={13} />}
                            <span>{isTailoring ? 'Building...' : 'Tailor Resume'}</span>
                          </button>
                        )}

                        {isSafeUrl(applyLink) ? (
                          <a href={applyLink} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{ marginInlineStart: 'auto' }}>
                            <span>Apply</span>
                            <ExternalLink size={13} />
                          </a>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--text-soft)' }}>
                <p style={{ margin: '0 0 12px' }}>
                  You have {scanResults.length} discovered job(s) waiting to be scored against your resume.
                </p>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setCurrentView('discover')}>
                  Score Discovered Jobs
                </button>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
