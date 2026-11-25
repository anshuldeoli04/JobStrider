import {
  BriefcaseBusiness,
  CheckCircle2,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  MapPin,
  Sparkles,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import ModalDialog from './ModalDialog';
import { STATUS_OPTIONS, getGradeLabel, isSafeUrl } from '../../utils/jobHelpers';
import { findMatchingAffiliateTracks, MOCK_INTERVIEW_PARTNER } from '../../utils/affiliatePartners';
import { AffiliateSkillCard, MockInterviewCard } from './AffiliateSkillCard';

export default function JobDetailDrawer() {
  const job = useAppStore((state) => state.selectedJob);
  const close = useAppStore((state) => state.closeJobDetail);
  const updateStatus = useAppStore((state) => state.updateStatus);
  const deleteApplication = useAppStore((state) => state.deleteApplication);
  const runResume = useAppStore((state) => state.runResume);
  const tailoringId = useAppStore((state) => state.tailoringId);
  const openResumePreview = useAppStore((state) => state.openResumePreview);

  const grade = (job?.grade || 'C').toUpperCase();
  const score = Number(job?.score || 0);
  const isTailoring = Boolean(job && tailoringId === job.id);
  const applyLink = job?.apply_url || job?.url;

  return (
    <ModalDialog
      open={Boolean(job)}
      onClose={close}
      variant="drawer"
      title={job ? `${job.company || 'Company'} — ${job.role || 'Role'}` : 'Job Details'}
      subtitle={job ? `${job.location || 'Remote'} • ${job.salary_estimate || 'Salary not listed'}` : ''}
      icon={<span className={`grade-badge grade-${grade.toLowerCase()}`}>{grade}</span>}
      footer={
        job ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ color: 'var(--danger)' }}
              onClick={() => deleteApplication(job.id)}
            >
              <Trash2 size={14} />
              <span>Remove</span>
            </button>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {isSafeUrl(applyLink) ? (
                <a href={applyLink} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                  <span>Open Job Post</span>
                  <ExternalLink size={14} />
                </a>
              ) : null}

              {job.resume_html ? (
                <button
                  type="button"
                  className="btn btn-soft btn-sm"
                  onClick={() =>
                    openResumePreview({
                      title: `${job.company} — ${job.role} Resume`,
                      htmlUrl: job.resume_html,
                      pdfUrl: job.resume_pdf
                    })
                  }
                >
                  <Eye size={14} />
                  <span>Preview Resume</span>
                </button>
              ) : null}

              {job.resume_pdf ? (
                <a href={job.resume_pdf} download className="btn btn-success btn-sm">
                  <Download size={14} />
                  <span>Download PDF</span>
                </a>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={isTailoring}
                  onClick={() => runResume({ applicationId: job.id })}
                >
                  {isTailoring ? <Loader2 size={14} className="spin-animation" /> : <Sparkles size={14} />}
                  <span>{isTailoring ? 'Building Resume...' : 'Tailor Resume'}</span>
                </button>
              )}
            </div>
          </div>
        ) : null
      }
    >
      {job ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Score + Status Summary Card */}
          <div
            style={{
              padding: 16,
              borderRadius: 14,
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 14,
              flexWrap: 'wrap'
            }}
          >
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                AI MATCH SCORE
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
                <span style={{ fontSize: '1.65rem', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                  {score.toFixed(1)} / 10
                </span>
                <span className="pill pill-accent" style={{ cursor: 'default' }}>
                  {job.verdict || getGradeLabel(grade)}
                </span>
              </div>
            </div>

            <div className="field-group" style={{ minWidth: 150 }}>
              <label htmlFor="drawer-status-select" className="field-label" style={{ fontSize: '0.76rem' }}>
                Application Status
              </label>
              <select
                id="drawer-status-select"
                className="select-compact"
                value={job.status === 'discovered' || job.status === 'new' ? 'evaluated' : job.status || 'evaluated'}
                onChange={(e) => updateStatus(job.id, e.target.value)}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Meta badges */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: '0.84rem', color: 'var(--text-soft)' }}>
            <span className="pill" style={{ cursor: 'default' }}>
              <MapPin size={13} /> {job.location || 'Remote / India'}
            </span>
            <span className="pill" style={{ cursor: 'default' }}>
              <BriefcaseBusiness size={13} /> {job.salary_estimate || 'Salary not listed'}
            </span>
          </div>

          {/* Fit Summary */}
          <div>
            <h3 style={{ margin: '0 0 6px', fontSize: '0.94rem', fontWeight: 700 }}>Why This Matches (or Doesn&apos;t)</h3>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-soft)', lineHeight: 1.6 }}>
              {job.fit_summary || 'Run a full job check to generate a detailed written breakdown.'}
            </p>
          </div>

          {/* Strengths */}
          {Array.isArray(job.strengths) && job.strengths.length > 0 && (
            <div>
              <h3 style={{ margin: '0 0 8px', fontSize: '0.92rem', fontWeight: 700, color: 'var(--success)' }}>
                Your Strengths for This Role
              </h3>
              <div className="chip-list">
                {job.strengths.map((item, idx) => (
                  <span key={idx} className="pill pill-success" style={{ cursor: 'default' }}>
                    <CheckCircle2 size={13} /> {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Gaps */}
          {Array.isArray(job.gaps) && job.gaps.length > 0 && (
            <div>
              <h3 style={{ margin: '0 0 8px', fontSize: '0.92rem', fontWeight: 700, color: 'var(--warning)' }}>
                Missing Skills / Things to Prepare
              </h3>
              <div className="chip-list">
                {job.gaps.map((item, idx) => (
                  <span key={idx} className="pill pill-warning" style={{ cursor: 'default' }}>
                    <AlertTriangle size={13} /> {item}
                  </span>
                ))}
              </div>
              {findMatchingAffiliateTracks(job.gaps).map((track, idx) => (
                <AffiliateSkillCard key={idx} track={track} />
              ))}
            </div>
          )}

          {/* Interview Prep */}
          {Boolean(job.interview_prep) && (
            <div>
              <h3 style={{ margin: '0 0 8px', fontSize: '0.92rem', fontWeight: 700 }}>Likely Interview Questions</h3>
              {Array.isArray(job.interview_prep) && job.interview_prep.length > 0 ? (
                <ol style={{ margin: 0, paddingInlineStart: 20, display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.88rem', color: 'var(--text-soft)' }}>
                  {job.interview_prep.map((q, idx) => (
                    <li key={idx}>{typeof q === 'string' ? q : q.question || JSON.stringify(q)}</li>
                  ))}
                </ol>
              ) : typeof job.interview_prep === 'object' ? (
                <ol style={{ margin: 0, paddingInlineStart: 20, display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.88rem', color: 'var(--text-soft)' }}>
                  {[
                    ...(Array.isArray(job.interview_prep.technical_questions) ? job.interview_prep.technical_questions : []),
                    ...(Array.isArray(job.interview_prep.behavioral_questions) ? job.interview_prep.behavioral_questions : [])
                  ].slice(0, 8).map((item, idx) => (
                    <li key={idx}>{typeof item === 'string' ? item : item.question || JSON.stringify(item)}</li>
                  ))}
                </ol>
              ) : null}

              {score >= 6.5 && <MockInterviewCard partner={MOCK_INTERVIEW_PARTNER} />}
            </div>
          )}

          {/* Action Items & Negotiation */}
          {(job.negotiation_note || (Array.isArray(job.action_items) && job.action_items.length > 0)) && (
            <div
              style={{
                padding: 14,
                borderRadius: 12,
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10
              }}
            >
              {job.negotiation_note && (
                <div>
                  <strong style={{ fontSize: '0.84rem' }}>Salary &amp; Offer Tip:</strong>
                  <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: 'var(--text-soft)' }}>
                    {job.negotiation_note}
                  </p>
                </div>
              )}
              {Array.isArray(job.action_items) && job.action_items.length > 0 && (
                <div>
                  <strong style={{ fontSize: '0.84rem' }}>Recommended Next Steps:</strong>
                  <ul style={{ margin: '4px 0 0', paddingInlineStart: 18, fontSize: '0.84rem', color: 'var(--text-soft)' }}>
                    {job.action_items.map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {job.resume_pdf && (
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                background: 'var(--success-bg)',
                border: '1px solid var(--success-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                flexWrap: 'wrap'
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', fontWeight: 600, color: 'var(--success)' }}>
                <FileText size={16} /> Tailored ATS resume ready for {job.company}
              </span>
              <button
                type="button"
                className="btn btn-soft btn-sm"
                disabled={isTailoring}
                onClick={() => runResume({ applicationId: job.id })}
              >
                {isTailoring ? 'Refreshing...' : 'Regenerate'}
              </button>
            </div>
          )}
        </div>
      ) : null}
    </ModalDialog>
  );
}
