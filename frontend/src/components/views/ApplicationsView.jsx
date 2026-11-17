import { useId, useMemo, useState } from 'react';
import {
  BriefcaseBusiness,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  MapPin,
  Search,
  Sparkles
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { STATUS_OPTIONS, getGradeLabel, isSafeUrl } from '../../utils/jobHelpers';

const STATUS_FILTERS = [
  { id: 'ALL', label: 'All' },
  { id: 'evaluated', label: 'To Apply' },
  { id: 'applied', label: 'Applied' },
  { id: 'interview', label: 'Interviewing' },
  { id: 'offer', label: 'Offer' },
  { id: 'skipped', label: 'Skipped' }
];

export default function ApplicationsView() {
  const applications = useAppStore((state) => state.applications);
  const updateStatus = useAppStore((state) => state.updateStatus);
  const bulkUpdateStatus = useAppStore((state) => state.bulkUpdateStatus);
  const openJobDetail = useAppStore((state) => state.openJobDetail);
  const openResumePreview = useAppStore((state) => state.openResumePreview);
  const runResume = useAppStore((state) => state.runResume);
  const tailoringId = useAppStore((state) => state.tailoringId);
  const setCurrentView = useAppStore((state) => state.setCurrentView);

  const [searchQuery, setSearchQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedIds, setSelectedIds] = useState([]);

  const searchId = useId();

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return applications
      .filter((item) => {
        const normalizedStatus =
          item.status === 'discovered' || item.status === 'new' ? 'evaluated' : item.status || 'evaluated';
        const matchGrade = gradeFilter === 'ALL' || String(item.grade || '').toUpperCase() === gradeFilter;
        const matchStatus = statusFilter === 'ALL' || normalizedStatus === statusFilter;
        const matchQuery =
          !q ||
          `${item.company || ''} ${item.role || ''} ${item.location || ''}`.toLowerCase().includes(q);
        return matchGrade && matchStatus && matchQuery;
      })
      .sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));
  }, [applications, gradeFilter, statusFilter, searchQuery]);

  const toggleSelect = (id, checked) => {
    setSelectedIds((prev) => (checked ? [...new Set([...prev, id])] : prev.filter((item) => item !== id)));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <section className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.16rem', fontWeight: 700 }}>
              My Job Applications ({filtered.length})
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: '0.84rem', color: 'var(--text-soft)' }}>
              Click any job to view strengths, gaps, interview questions, and custom resumes.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {selectedIds.length > 0 && (
              <>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={async () => {
                    await bulkUpdateStatus(selectedIds, 'applied');
                    setSelectedIds([]);
                  }}
                >
                  Mark {selectedIds.length} Applied
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={async () => {
                    await bulkUpdateStatus(selectedIds, 'skipped');
                    setSelectedIds([]);
                  }}
                >
                  Skip Selected
                </button>
              </>
            )}
          </div>
        </div>

        {/* Search & Filter Strip */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <search style={{ flex: '1 1 240px' }}>
              <label htmlFor={searchId} className="visually-hidden">Search saved applications</label>
              <div style={{ position: 'relative' }}>
                <Search size={15} style={{ position: 'absolute', insetInlineStart: 12, insetBlockStart: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  id={searchId}
                  type="search"
                  className="input"
                  placeholder="Search by company, job title, or city..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ minHeight: 40, paddingInlineStart: 36 }}
                />
              </div>
            </search>

            <div className="chip-list" role="group" aria-label="Filter by match grade">
              {['ALL', 'A', 'B', 'C', 'D'].map((g) => {
                const active = gradeFilter === g;
                return (
                  <button
                    key={g}
                    type="button"
                    aria-pressed={active}
                    className={`tag-chip ${active ? 'selected' : ''}`}
                    onClick={() => setGradeFilter(g)}
                  >
                    {g === 'ALL' ? 'All Grades' : `Grade ${g}`}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="chip-list" role="group" aria-label="Filter by application status">
            {STATUS_FILTERS.map((f) => {
              const active = statusFilter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={active}
                  className={`tag-chip ${active ? 'selected' : ''}`}
                  onClick={() => setStatusFilter(f.id)}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Jobs List */}
        {filtered.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map((item) => {
              const grade = (item.grade || 'C').toUpperCase();
              const isSelected = selectedIds.includes(item.id);
              const isTailoring = tailoringId === item.id;
              const normalizedStatus =
                item.status === 'discovered' || item.status === 'new' ? 'evaluated' : item.status || 'evaluated';
              const applyLink = item.apply_url || item.url;

              return (
                <article
                  key={item.id}
                  style={{
                    border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 14,
                    padding: '14px 16px',
                    background: 'var(--surface-2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 14,
                    flexWrap: 'wrap'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minInlineSize: 0, flex: '1 1 280px' }}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${item.company} ${item.role}`}
                      checked={isSelected}
                      onChange={(e) => toggleSelect(item.id, e.target.checked)}
                      style={{ width: 18, height: 18, flexShrink: 0 }}
                    />
                    <span className={`grade-badge grade-${grade.toLowerCase()}`}>{grade}</span>
                    <div style={{ minInlineSize: 0 }}>
                      <button
                        type="button"
                        onClick={() => openJobDetail(item)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          textAlign: 'start',
                          cursor: 'pointer',
                          color: 'var(--text)',
                          fontWeight: 700,
                          fontSize: '0.96rem'
                        }}
                      >
                        {item.company || 'Company'} — {item.role || 'Software Role'}
                      </button>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--text-soft)', marginTop: 3 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--success)' }}>
                          {Number(item.score || 0).toFixed(1)}/10 ({getGradeLabel(grade)})
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <MapPin size={12} /> {item.location || 'Remote'}
                        </span>
                        {item.salary_estimate && <span>{item.salary_estimate}</span>}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <label htmlFor={`status-${item.id}`} className="visually-hidden">
                      Status for {item.company}
                    </label>
                    <select
                      id={`status-${item.id}`}
                      className="select-compact"
                      value={normalizedStatus}
                      onChange={(e) => updateStatus(item.id, e.target.value)}
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>

                    <button type="button" className="btn btn-soft btn-sm" onClick={() => openJobDetail(item)}>
                      <FileText size={13} />
                      <span>Details</span>
                    </button>

                    {item.resume_html ? (
                      <button
                        type="button"
                        className="btn btn-soft btn-sm"
                        onClick={() =>
                          openResumePreview({
                            title: `${item.company} — ${item.role} Resume`,
                            htmlUrl: item.resume_html,
                            pdfUrl: item.resume_pdf
                          })
                        }
                      >
                        <Eye size={13} />
                        <span>Preview</span>
                      </button>
                    ) : null}

                    {item.resume_pdf ? (
                      <a href={item.resume_pdf} download className="btn btn-success btn-sm">
                        <Download size={13} />
                        <span>PDF</span>
                      </a>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={isTailoring}
                        onClick={() => runResume({ applicationId: item.id })}
                      >
                        {isTailoring ? <Loader2 size={13} className="spin-animation" /> : <Sparkles size={13} />}
                        <span>{isTailoring ? 'Building...' : 'Tailor'}</span>
                      </button>
                    )}

                    {isSafeUrl(applyLink) ? (
                      <a href={applyLink} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
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
          <div style={{ textAlign: 'center', padding: '44px 16px', color: 'var(--text-soft)' }}>
            <BriefcaseBusiness size={36} style={{ color: 'var(--text-muted)', marginBottom: 10 }} />
            <h3 style={{ margin: '0 0 6px', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)' }}>
              {applications.length ? 'No jobs match your filters' : 'No saved jobs yet'}
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '0.88rem' }}>
              {applications.length
                ? 'Try clearing your search box or switching back to All Grades.'
                : 'Check a job posting you found or run Job Finder to score matches.'}
            </p>
            {!applications.length && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setCurrentView('check')}>
                  Check a Job Posting
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setCurrentView('discover')}>
                  Find Jobs Automatically
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
