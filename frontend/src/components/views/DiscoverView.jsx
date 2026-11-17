import { useEffect, useId, useMemo, useState } from 'react';
import {
  ArrowUpDown,
  CheckCircle2,
  Compass,
  ExternalLink,
  Eye,
  Loader2,
  MapPin,
  Plus,
  Search,
  Sparkles,
  Square,
  Zap
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { JOB_BOARDS, PRESET_LOCATIONS, PRESET_ROLES, getGradeLabel, isSafeUrl } from '../../utils/jobHelpers';

const GRADE_WEIGHT = Object.freeze({ A: 5, B: 4, C: 3, D: 2, F: 1 });

export default function DiscoverView() {
  const config = useAppStore((state) => state.config);
  const scanResults = useAppStore((state) => state.scanResults);
  const applications = useAppStore((state) => state.applications);
  const activeScan = useAppStore((state) => state.activeScan);
  const activeEvaluation = useAppStore((state) => state.activeEvaluation);
  const runScan = useAppStore((state) => state.runScan);
  const stopScan = useAppStore((state) => state.stopScan);
  const runEvaluate = useAppStore((state) => state.runEvaluate);
  const saveConfig = useAppStore((state) => state.saveConfig);
  const setCurrentView = useAppStore((state) => state.setCurrentView);
  const openResumeModal = useAppStore((state) => state.openResumeModal);
  const openByokModal = useAppStore((state) => state.openByokModal);
  const openJobDetail = useAppStore((state) => state.openJobDetail);
  const pushToast = useAppStore((state) => state.pushToast);

  const [roles, setRoles] = useState(config?.target_roles || []);
  const [locations, setLocations] = useState(config?.target_locations || []);
  const [customRole, setCustomRole] = useState('');
  const [customCity, setCustomCity] = useState('');
  const [selectedSources, setSelectedSources] = useState(() => {
    const disabled = new Set((config?.disabled_sources || []).map((s) => s.toLowerCase()));
    return JOB_BOARDS.map((b) => b.id).filter((id) => !disabled.has(id));
  });
  const [filterText, setFilterText] = useState('');
  const [statusTab, setStatusTab] = useState('all'); // 'all' | 'scored' | 'pending'
  const [sortBy, setSortBy] = useState('grade_desc'); // 'grade_desc' | 'grade_asc' | 'company'
  const [page, setPage] = useState(1);

  const roleInputId = useId();
  const cityInputId = useId();
  const searchInputId = useId();

  useEffect(() => {
    if (Array.isArray(config?.target_roles)) setRoles(config.target_roles);
    if (Array.isArray(config?.target_locations)) setLocations(config.target_locations);
  }, [config?.target_roles, config?.target_locations]);

  const hasCv = Boolean(config?.has_cv);
  const hasKey = Boolean(config?.has_key);
  const isScanning = activeScan?.status === 'running';
  const isBatchScoring = activeEvaluation?.status === 'running';

  const toggleItem = (list, setList, value) => {
    const exists = list.some((item) => item.toLowerCase() === value.toLowerCase());
    if (exists) {
      setList(list.filter((item) => item.toLowerCase() !== value.toLowerCase()));
    } else {
      setList([...list, value]);
    }
  };

  const toggleSource = (id) => {
    setSelectedSources((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const addCustomRole = () => {
    const clean = customRole.trim();
    if (!clean) return;
    if (!roles.some((r) => r.toLowerCase() === clean.toLowerCase())) {
      setRoles([...roles, clean]);
    }
    setCustomRole('');
  };

  const addCustomCity = () => {
    const clean = customCity.trim();
    if (!clean) return;
    if (!locations.some((l) => l.toLowerCase() === clean.toLowerCase())) {
      setLocations([...locations, clean]);
    }
    setCustomCity('');
  };

  const startJobSearch = async (mode) => {
    if (selectedSources.length === 0) {
      pushToast({ type: 'warning', title: 'Select a job board', message: 'Choose at least one job source below.' });
      return;
    }
    const disabledSources = JOB_BOARDS.map((b) => b.id).filter((id) => !selectedSources.includes(id));
    await saveConfig({
      target_roles: roles,
      target_locations: locations,
      disabled_sources: disabledSources
    });
    await runScan({
      mode,
      sources: selectedSources,
      keywords: roles.join(', '),
      limit: 10
    });
  };

  const appLookup = useMemo(() => {
    const map = new Map();
    for (const app of applications) {
      if (app.url) map.set(app.url.trim().toLowerCase(), app);
      if (app.apply_url) map.set(app.apply_url.trim().toLowerCase(), app);
      const key = `${(app.company || '').trim().toLowerCase()}::${(app.role || '').trim().toLowerCase()}`;
      if (!map.has(key)) map.set(key, app);
    }
    return map;
  }, [applications]);

  const getJobEvaluation = (job) => {
    const match =
      (job.url && appLookup.get(job.url.trim().toLowerCase())) ||
      (job.apply_url && appLookup.get(job.apply_url.trim().toLowerCase())) ||
      appLookup.get(
        `${(job.company || '').trim().toLowerCase()}::${(job.role || job.title || '').trim().toLowerCase()}`
      );
    const grade = job.grade || match?.grade;
    const score = job.score != null ? job.score : match?.score != null ? match.score : null;
    const verdict = job.verdict || match?.verdict;
    return {
      evaluated: Boolean(grade || (score != null && !isNaN(Number(score)))),
      grade: grade ? String(grade).toUpperCase() : null,
      score: score != null && !isNaN(Number(score)) ? Number(score) : null,
      verdict,
      appMatch: match
    };
  };

  const scoredCount = useMemo(
    () => scanResults.filter((j) => getJobEvaluation(j).evaluated).length,
    [scanResults, appLookup]
  );
  const pendingCount = Math.max(0, scanResults.length - scoredCount);

  const filteredScans = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    const list = scanResults.filter((item) => {
      const evalInfo = getJobEvaluation(item);
      if (statusTab === 'scored' && !evalInfo.evaluated) return false;
      if (statusTab === 'pending' && evalInfo.evaluated) return false;

      if (!q) return true;
      const haystack = `${item.company || ''} ${item.role || item.title || ''} ${item.location || ''} ${item.source || ''} ${evalInfo.grade || ''} ${evalInfo.verdict || ''} Grade ${evalInfo.grade || ''}`.toLowerCase();
      return haystack.includes(q);
    });

    return list.sort((a, b) => {
      const evalA = getJobEvaluation(a);
      const evalB = getJobEvaluation(b);

      if (sortBy === 'grade_desc') {
        // High to Low by Grade and Score
        if (evalA.evaluated && evalB.evaluated) {
          const diffGrade = (GRADE_WEIGHT[evalB.grade] || 0) - (GRADE_WEIGHT[evalA.grade] || 0);
          if (diffGrade !== 0) return diffGrade;
          return (Number(evalB.score) || 0) - (Number(evalA.score) || 0);
        }
        if (evalA.evaluated && !evalB.evaluated) return -1;
        if (!evalA.evaluated && evalB.evaluated) return 1;

        // For pending jobs, sort by preRankScore descending
        const preA = Number(a.preRankScore) || 0;
        const preB = Number(b.preRankScore) || 0;
        if (preB !== preA) return preB - preA;
        return 0;
      }

      if (sortBy === 'grade_asc') {
        // Low to High by Grade and Score
        if (evalA.evaluated && evalB.evaluated) {
          const diffGrade = (GRADE_WEIGHT[evalA.grade] || 0) - (GRADE_WEIGHT[evalB.grade] || 0);
          if (diffGrade !== 0) return diffGrade;
          return (Number(evalA.score) || 0) - (Number(evalB.score) || 0);
        }
        if (evalA.evaluated && !evalB.evaluated) return 1;
        if (!evalA.evaluated && evalB.evaluated) return -1;
        return 0;
      }

      if (sortBy === 'company') {
        return String(a.company || '').localeCompare(String(b.company || ''));
      }

      return 0;
    });
  }, [scanResults, filterText, statusTab, sortBy, appLookup]);

  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(filteredScans.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleScans = filteredScans.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Search Configuration Card */}
      <section className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: '1.16rem', fontWeight: 700 }}>
              Tell us what jobs to look for
            </h2>
            <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-soft)' }}>
              Click roles and cities to select them, then press Search.
            </p>
          </div>
          {(!hasCv || !hasKey) && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {!hasCv && (
                <button type="button" className="btn btn-soft btn-sm" onClick={openResumeModal}>
                  Add Resume First
                </button>
              )}
              {!hasKey && (
                <button type="button" className="btn btn-soft btn-sm" onClick={openByokModal}>
                  Connect Free AI
                </button>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Roles selector */}
          <div className="field-group">
            <span className="field-label">1. Target Job Roles</span>
            <div className="chip-list">
              {[...new Set([...PRESET_ROLES, ...roles])].map((role) => {
                const selected = roles.some((r) => r.toLowerCase() === role.toLowerCase());
                return (
                  <button
                    key={role}
                    type="button"
                    className={`tag-chip ${selected ? 'selected' : ''}`}
                    aria-pressed={selected}
                    onClick={() => toggleItem(roles, setRoles, role)}
                  >
                    {selected ? <CheckCircle2 size={14} /> : <Plus size={14} />}
                    <span>{role}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 8, maxWidth: 380, marginTop: 4 }}>
              <label htmlFor={roleInputId} className="visually-hidden">Add another job role</label>
              <input
                id={roleInputId}
                type="text"
                className="input"
                placeholder="Add another role (e.g. Data Engineer)"
                value={customRole}
                onChange={(e) => setCustomRole(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomRole();
                  }
                }}
                style={{ minHeight: 40 }}
              />
              <button type="button" className="btn btn-secondary btn-sm" onClick={addCustomRole}>
                Add
              </button>
            </div>
          </div>

          {/* Locations selector */}
          <div className="field-group">
            <span className="field-label">2. Preferred Cities or Remote</span>
            <div className="chip-list">
              {[...new Set([...PRESET_LOCATIONS, ...locations])].map((city) => {
                const selected = locations.some((l) => l.toLowerCase() === city.toLowerCase());
                return (
                  <button
                    key={city}
                    type="button"
                    className={`tag-chip ${selected ? 'selected' : ''}`}
                    aria-pressed={selected}
                    onClick={() => toggleItem(locations, setLocations, city)}
                  >
                    {selected ? <CheckCircle2 size={14} /> : <MapPin size={14} />}
                    <span>{city}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 8, maxWidth: 380, marginTop: 4 }}>
              <label htmlFor={cityInputId} className="visually-hidden">Add another city</label>
              <input
                id={cityInputId}
                type="text"
                className="input"
                placeholder="Add another city (e.g. Noida)"
                value={customCity}
                onChange={(e) => setCustomCity(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomCity();
                  }
                }}
                style={{ minHeight: 40 }}
              />
              <button type="button" className="btn btn-secondary btn-sm" onClick={addCustomCity}>
                Add
              </button>
            </div>
          </div>

          {/* Job boards selector */}
          <fieldset style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', margin: 0 }}>
            <legend style={{ padding: '0 8px', fontSize: '0.86rem', fontWeight: 700 }}>
              3. Job Boards to Search
            </legend>
            <div className="grid-2" style={{ gap: 12 }}>
              {JOB_BOARDS.map((board) => {
                const checked = selectedSources.includes(board.id);
                return (
                  <label
                    key={board.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: `1px solid ${checked ? 'var(--accent)' : 'var(--border)'}`,
                      background: checked ? 'var(--accent-soft)' : 'var(--surface-2)',
                      cursor: 'pointer'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSource(board.id)}
                      style={{ marginTop: 3, width: 17, height: 17 }}
                    />
                    <div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700 }}>
                        {board.label}{' '}
                        {board.group === 'browser' && (
                          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                            (Opens browser • slower)
                          </span>
                        )}
                        {board.group === 'reach' && (
                          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--accent, #3b82f6)' }}>
                            (Agent Reach • Direct & Fast)
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-soft)' }}>{board.description}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={isScanning || !hasCv || !hasKey}
              onClick={() => startJobSearch('autoflow')}
              title={!hasCv || !hasKey ? 'Add your Resume and Free Google AI key first to auto-score jobs' : ''}
            >
              {isScanning ? <Loader2 size={16} className="spin-animation" /> : <Sparkles size={16} />}
              <span>{isScanning ? 'Searching & Scoring...' : 'Search & Score Best Matches'}</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              disabled={isScanning}
              onClick={() => startJobSearch('scan')}
            >
              <Zap size={16} />
              <span>Fetch Job List Only</span>
            </button>

            {isScanning && (
              <button type="button" className="btn btn-danger btn-sm" onClick={stopScan}>
                <Square size={14} />
                <span>Stop</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Friendly Live Progress Card */}
      {(isScanning || activeScan?.logs?.length > 0) && (
        <section className="card" aria-live="polite">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {isScanning ? (
                <Loader2 size={18} className="spin-animation" style={{ color: 'var(--accent)' }} />
              ) : (
                <CheckCircle2 size={18} style={{ color: activeScan.status === 'error' ? 'var(--warning)' : 'var(--success)' }} />
              )}
              <div>
                <strong style={{ fontSize: '0.96rem' }}>
                  {isScanning
                    ? activeScan.phase === 'evaluating'
                      ? 'AI is checking which jobs best match your resume...'
                      : activeScan.phase === 'tailoring'
                        ? 'Creating tailored resumes for your top matches...'
                        : 'Searching job boards for your roles...'
                    : activeScan.message || 'Search complete'}
                </strong>
              </div>
            </div>

            {!isScanning && activeScan.status === 'success' && (
              <button type="button" className="btn btn-soft btn-sm" onClick={() => setCurrentView('applications')}>
                View Scored Matches
              </button>
            )}
          </div>

          <details className="clean-details">
            <summary>Show live activity details ({activeScan.logs.length} steps)</summary>
            <div className="log-box">
              {activeScan.logs.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          </details>
        </section>
      )}

      {/* Discovered Jobs List */}
      <section className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 700 }}>
              Discovered Openings ({scanResults.length})
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              {scoredCount > 0
                ? `${scoredCount} evaluated with Grade/Score • ${pendingCount} waiting for AI scoring`
                : pendingCount > 0
                  ? `${pendingCount} new job(s) waiting for AI scoring`
                  : 'Jobs found from company boards appear here'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {scanResults.length > 0 && (
              <div style={{ display: 'flex', gap: 4, background: 'var(--surface-2)', padding: 3, borderRadius: 10, border: '1px solid var(--border)' }}>
                <button
                  type="button"
                  className={`btn btn-sm ${statusTab === 'all' ? 'btn-secondary' : 'btn-ghost'}`}
                  style={{ minHeight: 30, padding: '4px 10px', fontSize: '0.8rem' }}
                  onClick={() => { setStatusTab('all'); setPage(1); }}
                >
                  All ({scanResults.length})
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${statusTab === 'scored' ? 'btn-secondary' : 'btn-ghost'}`}
                  style={{ minHeight: 30, padding: '4px 10px', fontSize: '0.8rem' }}
                  onClick={() => { setStatusTab('scored'); setPage(1); }}
                >
                  Scored ({scoredCount})
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${statusTab === 'pending' ? 'btn-secondary' : 'btn-ghost'}`}
                  style={{ minHeight: 30, padding: '4px 10px', fontSize: '0.8rem' }}
                  onClick={() => { setStatusTab('pending'); setPage(1); }}
                >
                  Pending ({pendingCount})
                </button>
              </div>
            )}

            {pendingCount > 0 && hasCv && hasKey && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={isBatchScoring}
                  onClick={() => runEvaluate({ mode: 'scanned', limit: pendingCount })}
                  title={`Score all ${pendingCount} remaining openings with AI`}
                >
                  {isBatchScoring ? <Loader2 size={14} className="spin-animation" /> : <Sparkles size={14} />}
                  <span>{isBatchScoring ? 'Scoring...' : `Score All (${pendingCount}) with AI`}</span>
                </button>
                {pendingCount > 10 && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={isBatchScoring}
                    onClick={() => runEvaluate({ mode: 'scanned', limit: 10 })}
                    title="Score next 10 jobs in batch"
                  >
                    <span>Score Next 10 (Batch)</span>
                  </button>
                )}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ArrowUpDown size={14} style={{ color: 'var(--text-muted)' }} />
              <label htmlFor="discover-sort" className="visually-hidden">Sort discovered jobs</label>
              <select
                id="discover-sort"
                className="select-compact"
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setPage(1);
                }}
                style={{ minHeight: 36, padding: '4px 8px', fontSize: '0.8rem', fontWeight: 600 }}
              >
                <option value="grade_desc">Grade: High → Low</option>
                <option value="grade_asc">Grade: Low → High</option>
                <option value="company">Company: A → Z</option>
              </select>
            </div>

            <search>
              <label htmlFor={searchInputId} className="visually-hidden">Filter discovered jobs</label>
              <div style={{ position: 'relative' }}>
                <Search size={15} style={{ position: 'absolute', insetInlineStart: 11, insetBlockStart: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  id={searchInputId}
                  type="search"
                  className="input"
                  placeholder="Filter by company, role, grade..."
                  value={filterText}
                  onChange={(e) => {
                    setFilterText(e.target.value);
                    setPage(1);
                  }}
                  style={{ minHeight: 38, paddingInlineStart: 34, width: 230 }}
                />
              </div>
            </search>
          </div>
        </div>

        {visibleScans.length ? (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Role</th>
                    <th>Location</th>
                    <th>Board</th>
                    <th style={{ minWidth: 150 }}>Resume Fit / Grade</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleScans.map((job, idx) => {
                    const evalInfo = getJobEvaluation(job);
                    return (
                      <tr key={job.url || `${job.company}-${job.role}-${idx}`}>
                        <td><strong>{job.company || 'Company'}</strong></td>
                        <td>{job.role || job.title || 'Software Role'}</td>
                        <td style={{ color: 'var(--text-soft)' }}>{job.location || 'Remote'}</td>
                        <td>
                          <span className="pill" style={{ cursor: 'default', textTransform: 'capitalize' }}>
                            {job.source || 'web'}
                          </span>
                        </td>
                        <td>
                          {evalInfo.evaluated ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span
                                className={`grade-badge grade-${(evalInfo.grade || 'c').toLowerCase()}`}
                                style={{ minWidth: 32, height: 32, fontSize: '0.86rem' }}
                              >
                                {evalInfo.grade || '—'}
                              </span>
                              <div>
                                <div
                                  style={{
                                    fontFamily: 'var(--font-mono)',
                                    fontWeight: 700,
                                    fontSize: '0.88rem',
                                    color:
                                      evalInfo.score >= 8
                                        ? 'var(--success)'
                                        : evalInfo.score >= 6
                                          ? 'var(--accent)'
                                          : evalInfo.score >= 4
                                            ? 'var(--warning)'
                                            : 'var(--danger)'
                                  }}
                                >
                                  {evalInfo.score != null ? `${evalInfo.score.toFixed(1)}/10` : '—'}
                                </div>
                                <div style={{ fontSize: '0.74rem', color: 'var(--text-soft)', whiteSpace: 'nowrap' }}>
                                  {getGradeLabel(evalInfo.grade)}
                                </div>
                              </div>
                            </div>
                          ) : isBatchScoring ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent)', fontSize: '0.8rem', fontWeight: 600 }}>
                              <Loader2 size={13} className="spin-animation" />
                              <span>Scoring...</span>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <span className="pill" style={{ cursor: 'default', fontSize: '0.74rem', color: 'var(--text-muted)', alignSelf: 'flex-start' }}>
                                Not Scored
                              </span>
                              {job.preRankScore != null && (
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-soft)', fontFamily: 'var(--font-mono)' }}>
                                  Pre-rank ~{Number(job.preRankScore).toFixed(1)}/10
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            {evalInfo.evaluated ? (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => {
                                  if (evalInfo.appMatch) {
                                    openJobDetail(evalInfo.appMatch);
                                  } else {
                                    openJobDetail({
                                      ...job,
                                      id: job.id || `${job.company}-${job.role}-${idx}`,
                                      grade: evalInfo.grade,
                                      score: evalInfo.score,
                                      verdict: evalInfo.verdict
                                    });
                                  }
                                }}
                                title="View detailed match analysis, strengths & gaps"
                              >
                                <Sparkles size={13} />
                                <span>View Fit</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-soft btn-sm"
                                disabled={!hasCv || !hasKey || isBatchScoring}
                                onClick={async () => {
                                  await runEvaluate({ mode: 'single', scanItem: job });
                                  setCurrentView('check');
                                }}
                                title={!hasCv || !hasKey ? 'Upload resume & add API key to evaluate' : 'Evaluate with AI'}
                              >
                                <Sparkles size={13} />
                                <span>Check Fit</span>
                              </button>
                            )}
                            {isSafeUrl(job.url) && (
                              <a href={job.url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" title="Open Job Link">
                                <ExternalLink size={13} />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, fontSize: '0.84rem', color: 'var(--text-soft)' }}>
                <span>Page {safePage} of {totalPages}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-soft)' }}>
            <Compass size={34} style={{ color: 'var(--text-muted)', marginBottom: 10 }} />
            <h4 style={{ margin: '0 0 6px', fontWeight: 700, color: 'var(--text)' }}>No openings scanned yet</h4>
            <p style={{ margin: 0, fontSize: '0.86rem' }}>
              Pick your desired roles above and click &quot;Fetch Job List Only&quot; or &quot;Search &amp; Score Best Matches&quot;.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
