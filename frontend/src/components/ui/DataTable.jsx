import GradeBadge from './GradeBadge';
import ScoreBar from './ScoreBar';
import StatusBadge from './StatusBadge';
import { Fragment } from 'react';
import { api } from '../../api/client';
import { ExternalLink, FileText, CheckCircle2, AlertCircle, HelpCircle, ChevronDown, ChevronUp, Brain } from 'lucide-react';

function isSafeUrl(url) {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim().toLowerCase();
  return trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/');
}

export default function DataTable({
  rows,
  expandedId,
  onExpand,
  selectedIds = [],
  onSelect,
  onSelectAll,
  onStatusChange,
  onOpenInterviewPrep
}) {
  const allSelected = rows.length > 0 && rows.every((row) => selectedIds.includes(row.id));

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th style={{ width: 40 }}>
              <input type="checkbox" checked={allSelected} onChange={(e) => onSelectAll(e.target.checked)} aria-label="Select all applications" />
            </th>
            <th style={{ width: 80 }}>Grade</th>
            <th style={{ width: 140 }}>Fit Score</th>
            <th>Company</th>
            <th>Role Title</th>
            <th>Location</th>
            <th style={{ width: 130 }}>Status</th>
            <th style={{ width: 140 }}>Actions</th>
            <th style={{ width: 100 }}>Date</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isExpanded = expandedId === row.id;
            return (
              <Fragment key={row.id}>
                <tr
                  className={`clickable-row ${isExpanded ? 'active-row' : ''}`}
                  onClick={() => onExpand(isExpanded ? null : row.id)}
                  style={{
                    cursor: 'pointer',
                    background: isExpanded ? 'rgba(99, 102, 241, 0.06)' : undefined
                  }}
                >
                  <td onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(row.id)}
                      onChange={(e) => onSelect(row.id, e.target.checked)}
                      aria-label={`Select ${row.company}`}
                    />
                  </td>
                  <td>
                    <GradeBadge grade={row.grade} />
                  </td>
                  <td>
                    <ScoreBar score={row.score} />
                  </td>
                  <td>
                    <strong style={{ color: 'var(--text)', fontSize: '0.94rem' }}>{row.company}</strong>
                  </td>
                  <td style={{ maxWidth: 260 }}>
                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>
                      {row.role}
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-soft)' }}>
                      {row.location || 'Remote'}
                    </span>
                  </td>
                  <td onClick={(event) => event.stopPropagation()}>
                    <select
                      value={row.status || 'evaluated'}
                      onChange={(e) => onStatusChange(row.id, e.target.value)}
                      className="status-select"
                      style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                    >
                      {['evaluated', 'applied', 'interview', 'offer', 'rejected', 'withdrawn'].map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td onClick={(event) => event.stopPropagation()}>
                    <div className="row-actions" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {isSafeUrl(row.apply_url || row.url) ? (
                        <a
                          href={row.apply_url || row.url}
                          target="_blank"
                          rel="noreferrer"
                          className="table-link"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                            fontSize: '0.78rem',
                            padding: '3px 8px',
                            borderRadius: 4,
                            background: 'rgba(99, 102, 241, 0.1)',
                            color: '#818cf8'
                          }}
                        >
                          Apply <ExternalLink size={11} />
                        </a>
                      ) : null}

                      {isSafeUrl(row.resume_pdf) ? (
                        <button
                          type="button"
                          onClick={() => api.openProtectedFile(row.resume_pdf)}
                          className="table-link"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                            fontSize: '0.78rem',
                            padding: '3px 8px',
                            borderRadius: 4,
                            background: 'rgba(16, 185, 129, 0.1)',
                            color: '#34d399',
                            border: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          <FileText size={11} /> PDF
                        </button>
                      ) : null}

                      {row.ats_score != null ? (
                        <span
                          title={`ATS Parseability Score: ${row.ats_score}%`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 2,
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            padding: '2px 6px',
                            borderRadius: 4,
                            background: row.ats_score >= 80 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                            color: row.ats_score >= 80 ? '#34d399' : '#fbbf24',
                          }}
                        >
                          {row.ats_score}%
                        </span>
                      ) : null}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenInterviewPrep?.(row);
                        }}
                        className="table-link"
                        title="Prepare for Interview"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                          fontSize: '0.78rem',
                          padding: '3px 8px',
                          borderRadius: 4,
                          background: 'rgba(99, 102, 241, 0.12)',
                          color: '#818cf8',
                          border: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        <Brain size={11} /> Prep
                      </button>

                      <button
                        type="button"
                        onClick={() => onExpand(isExpanded ? null : row.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: 2,
                          display: 'inline-flex'
                        }}
                      >
                        {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </button>
                    </div>
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                    {new Date(row.timestamp || row.scanned_at || Date.now()).toLocaleDateString('en-IN')}
                  </td>
                </tr>

                {isExpanded ? (
                  <tr className="expand-row">
                    <td colSpan="9" style={{ padding: 0 }}>
                      <div
                        className="expand-panel"
                        style={{
                          background: 'rgba(14, 18, 27, 0.95)',
                          borderBottom: '1px solid var(--border)',
                          padding: '20px 24px',
                          display: 'grid',
                          gap: 16
                        }}
                      >
                        {/* Summary Box */}
                        <div
                          style={{
                            padding: '14px 18px',
                            borderRadius: 10,
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid rgba(255, 255, 255, 0.06)'
                          }}
                        >
                          <div className="mini-label" style={{ color: 'var(--accent-cyan)', fontWeight: 600, marginBottom: 6 }}>
                            🤖 AI Candidate Fit Assessment
                          </div>
                          <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: 1.6, color: 'var(--text)' }}>
                            {row.fit_summary || 'Fit summary calculated based on candidate CV and employer ATS job requirements.'}
                          </p>
                        </div>

                        {/* Strengths & Gaps Two-Up Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                          <div style={{ padding: 14, borderRadius: 10, background: 'rgba(16, 185, 129, 0.04)', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
                            <div className="mini-label" style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                              <CheckCircle2 size={14} /> Key Matched Strengths
                            </div>
                            <div className="chip-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {(row.strengths || []).length ? (
                                row.strengths.map((item) => (
                                  <span key={item} className="chip success" style={{ fontSize: '0.78rem' }}>
                                    {item}
                                  </span>
                                ))
                              ) : (
                                <span className="muted-copy" style={{ fontSize: '0.8rem' }}>No specific strengths logged.</span>
                              )}
                            </div>
                          </div>

                          <div style={{ padding: 14, borderRadius: 10, background: 'rgba(244, 63, 94, 0.04)', border: '1px solid rgba(244, 63, 94, 0.15)' }}>
                            <div className="mini-label" style={{ color: '#f87171', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                              <AlertCircle size={14} /> Honest Skill Gaps
                            </div>
                            <div className="chip-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {(row.gaps || []).length ? (
                                row.gaps.map((item) => (
                                  <span key={item} className="chip danger" style={{ fontSize: '0.78rem' }}>
                                    {item}
                                  </span>
                                ))
                              ) : (
                                <span className="muted-copy" style={{ fontSize: '0.8rem' }}>No severe gaps identified.</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Interview Prep Questions */}
                        {(row.interview_prep || []).length ? (
                          <div style={{ padding: 14, borderRadius: 10, background: 'rgba(99, 102, 241, 0.04)', border: '1px solid rgba(99, 102, 241, 0.15)' }}>
                            <div className="mini-label" style={{ color: '#818cf8', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                              <HelpCircle size={14} /> Custom Interview Prep Questions
                            </div>
                            <ol className="number-list" style={{ margin: 0, paddingLeft: 20, fontSize: '0.85rem', lineHeight: 1.6 }}>
                              {row.interview_prep.map((item) => (
                                <li key={item} style={{ marginBottom: 4 }}>
                                  {item}
                                </li>
                              ))}
                            </ol>
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
