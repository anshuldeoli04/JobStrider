import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BriefcaseBusiness,
  CircleDashed,
  ScanSearch,
  Sparkles,
  Trophy,
  Zap,
  ExternalLink,
  FileText,
  MapPin,
  Flame,
  CheckCircle2,
  AlertCircle,
  Key,
  Upload,
  ArrowRight,
  TrendingUp,
  Download,
  Terminal,
  Loader2
} from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import Panel from '../components/ui/Panel';
import GradeBadge from '../components/ui/GradeBadge';
import ScoreBar from '../components/ui/ScoreBar';
import EmptyState from '../components/ui/EmptyState';
import { useAppStore } from '../store/useAppStore';
import { api } from '../api/client';

const colors = {
  A: '#10b981',
  B: '#6366f1',
  C: '#f59e0b',
  D: '#f97316',
  F: '#f43f5e'
};

function isSafeUrl(url) {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim().toLowerCase();
  return trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/');
}

export default function Dashboard() {
  const navigate = useNavigate();
  const applications = useAppStore((state) => state.applications);
  const scanResults = useAppStore((state) => state.scanResults);
  const activity = useAppStore((state) => state.activity);
  const config = useAppStore((state) => state.config);
  const runScan = useAppStore((state) => state.runScan);
  const activeScan = useAppStore((state) => state.activeScan);
  const openByokModal = useAppStore((state) => state.openByokModal);
  const openResumeModal = useAppStore((state) => state.openResumeModal);
  const updateApplicationStatus = useAppStore((state) => state.updateApplicationStatus);
  const pushToast = useAppStore((state) => state.pushToast);
  const bootstrap = useAppStore((state) => state.bootstrap);

  const [tailoringId, setTailoringId] = useState(null);
  const [tailoredFiles, setTailoredFiles] = useState({});
  const [showLogs, setShowLogs] = useState(false);

  const hasKey = Boolean(config?.has_key);
  const hasCv = Boolean(config?.has_cv);
  const isScanning = activeScan?.status === 'running';

  // Auto-expand logs when scan starts
  useEffect(() => {
    if (isScanning) {
      setShowLogs(true);
    }
  }, [isScanning]);

  const gradeACount = applications.filter((item) => item.grade === 'A').length;
  const gradeBCount = applications.filter((item) => item.grade === 'B').length;
  const appliedCount = applications.filter((item) => ['applied', 'interview', 'offer'].includes(item.status)).length;
  const interviewCount = applications.filter((item) => item.status === 'interview').length;
  const offerCount = applications.filter((item) => item.status === 'offer').length;

  const avgScore = useMemo(() => {
    if (!applications.length) return '0.0';
    const sum = applications.reduce((acc, curr) => acc + (Number(curr.score) || 0), 0);
    return (sum / applications.length).toFixed(1);
  }, [applications]);

  const stats = useMemo(() => [
    {
      id: 'scanned',
      label: 'Jobs Scanned',
      value: scanResults.length || applications.length,
      icon: ScanSearch,
      color: '#06b6d4',
      badge: 'Multi-Board'
    },
    {
      id: 'evaluated',
      label: 'AI Evaluated',
      value: applications.length,
      icon: CircleDashed,
      color: '#6366f1',
      badge: config?.gemini_model || 'Gemini 2.5'
    },
    {
      id: 'gradeA',
      label: 'High Match (A/B)',
      value: gradeACount + gradeBCount,
      icon: Trophy,
      color: '#10b981',
      badge: `${gradeACount} Grade A`
    },
    {
      id: 'applied',
      label: 'Applied',
      value: appliedCount,
      icon: BriefcaseBusiness,
      color: '#8b5cf6',
      badge: `${Math.round((appliedCount / (applications.length || 1)) * 100)}% Funnel`
    },
    {
      id: 'interviews',
      label: 'Interviews & Offers',
      value: interviewCount + offerCount,
      icon: Sparkles,
      color: '#f59e0b',
      badge: offerCount > 0 ? `${offerCount} Offer!` : 'In Motion'
    },
    {
      id: 'avgScore',
      label: 'Average Fit Score',
      value: `${avgScore} / 10`,
      icon: TrendingUp,
      color: '#38bdf8',
      badge: 'Grounded'
    }
  ], [scanResults.length, applications.length, gradeACount, gradeBCount, appliedCount, interviewCount, offerCount, avgScore, config?.gemini_model]);

  const chartData = useMemo(() => ['A', 'B', 'C', 'D', 'F']
    .map((grade) => ({ name: grade, value: applications.filter((item) => item.grade === grade).length }))
    .filter((item) => item.value > 0), [applications]);

  const topMatches = useMemo(() => applications
    .filter((item) => ['A', 'B'].includes(item.grade))
    .sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0))
    .slice(0, 8), [applications]);

  const handleTailorResume = async (app) => {
    setTailoringId(app.id);
    try {
      pushToast({
        type: 'info',
        title: 'Tailoring Resume',
        message: `Synthesizing tailored CV for ${app.company} (${app.role})...`
      });
      const res = await api.runResume({ applicationId: app.id });
      if (res?.file) {
        setTailoredFiles((prev) => ({ ...prev, [app.id]: res.file }));
        pushToast({
          type: 'success',
          title: 'Resume Ready!',
          message: `ATS-optimized resume created for ${app.company}. Click Download to view.`
        });
      } else {
        pushToast({
          type: 'success',
          title: 'Resume Tailored',
          message: res?.message || 'Resume customized successfully.'
        });
      }
      await bootstrap();
    } catch (err) {
      pushToast({
        type: 'error',
        title: 'Tailoring Failed',
        message: err?.response?.data?.error || err.message || 'Could not tailor resume.'
      });
    } finally {
      setTailoringId(null);
    }
  };

  const handleMarkApplied = async (appId) => {
    try {
      await updateApplicationStatus(appId, { status: 'applied' });
      pushToast({ type: 'success', title: 'Status Updated', message: 'Marked as Applied.' });
    } catch (err) {
      pushToast({ type: 'error', title: 'Update failed', message: err.message });
    }
  };

  return (
    <div className="page-grid">
      {/* 3-Step Layman Onboarding Bento */}
      {(!hasKey || !hasCv) && (
        <section
          style={{
            gridColumn: '1 / -1',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(16, 185, 129, 0.08) 100%)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            borderRadius: 20,
            padding: '24px 28px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '3px 10px',
                  borderRadius: 999,
                  background: 'rgba(245, 158, 11, 0.15)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  color: '#fbbf24',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  marginBottom: 6
                }}
              >
                QUICK SETUP • 2 MINUTES
              </span>
              <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, color: '#f8fafc' }}>
                Welcome to JobStrider! Complete these 2 quick steps to start hunting:
              </h2>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {/* Step 1 Card */}
            <div
              style={{
                background: hasKey ? 'rgba(16, 185, 129, 0.06)' : 'rgba(255, 255, 255, 0.03)',
                border: hasKey ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: 14,
                padding: '18px 20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#94a3b8' }}>STEP 1</span>
                  {hasKey ? (
                    <span style={{ fontSize: '0.78rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                      <CheckCircle2 size={14} /> Connected
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.78rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                      <AlertCircle size={14} /> Action Required
                    </span>
                  )}
                </div>
                <h4 style={{ margin: '0 0 6px', fontSize: '1.05rem', color: '#f8fafc' }}>
                  🔑 Connect Free Gemini Key
                </h4>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.5 }}>
                  Google provides 1,500 free evaluations every day. Zero subscription fee.
                </p>
              </div>

              <button
                type="button"
                onClick={openByokModal}
                style={{
                  marginTop: 16,
                  padding: '10px 16px',
                  borderRadius: 10,
                  border: 'none',
                  background: hasKey ? 'rgba(16, 185, 129, 0.15)' : 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                  color: hasKey ? '#34d399' : '#ffffff',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8
                }}
              >
                <Key size={14} />
                <span>{hasKey ? 'Manage Gemini Key' : 'Enter Free Gemini Key'}</span>
              </button>
            </div>

            {/* Step 2 Card */}
            <div
              style={{
                background: hasCv ? 'rgba(16, 185, 129, 0.06)' : 'rgba(255, 255, 255, 0.03)',
                border: hasCv ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: 14,
                padding: '18px 20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#94a3b8' }}>STEP 2</span>
                  {hasCv ? (
                    <span style={{ fontSize: '0.78rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                      <CheckCircle2 size={14} /> Loaded
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.78rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                      <AlertCircle size={14} /> Action Required
                    </span>
                  )}
                </div>
                <h4 style={{ margin: '0 0 6px', fontSize: '1.05rem', color: '#f8fafc' }}>
                  📄 Upload Your Resume PDF
                </h4>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.5 }}>
                  Drop your existing resume. JobStrider extracts skills & experience automatically.
                </p>
              </div>

              <button
                type="button"
                onClick={openResumeModal}
                style={{
                  marginTop: 16,
                  padding: '10px 16px',
                  borderRadius: 10,
                  border: 'none',
                  background: hasCv ? 'rgba(16, 185, 129, 0.15)' : 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                  color: hasCv ? '#34d399' : '#ffffff',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8
                }}
              >
                <Upload size={14} />
                <span>{hasCv ? 'Update Resume' : 'Drop Resume PDF'}</span>
              </button>
            </div>

            {/* Step 3 Card */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 14,
                padding: '18px 20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#94a3b8' }}>STEP 3</span>
                  <span style={{ fontSize: '0.78rem', color: '#38bdf8', fontWeight: 600 }}>Ready To Hunt</span>
                </div>
                <h4 style={{ margin: '0 0 6px', fontSize: '1.05rem', color: '#f8fafc' }}>
                  ⚡ Discover High-Fit Jobs
                </h4>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.5 }}>
                  Scans Ashby, Lever, Greenhouse & Naukri for verified software engineer roles.
                </p>
              </div>

              <button
                type="button"
                disabled={isScanning}
                onClick={() => runScan({ mode: 'scan' })}
                style={{
                  marginTop: 16,
                  padding: '10px 16px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)',
                  color: '#ffffff',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: isScanning ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8
                }}
              >
                <Zap size={14} />
                <span>{isScanning ? 'Scanning Active...' : 'Scan Job Boards Now'}</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Hero Bento Header */}
      <section
        className="hero-panel"
        style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.16) 0%, rgba(16, 185, 129, 0.08) 50%, rgba(14, 18, 27, 0.95) 100%)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: '999px',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#34d399',
                fontSize: '0.78rem',
                fontFamily: 'JetBrains Mono, monospace',
                fontWeight: 600
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', animation: 'pulse 2s infinite' }} />
              ZERO-DB ENGINE ONLINE
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>•</span>
            <span style={{ color: 'var(--text-soft)', fontSize: '0.82rem', fontFamily: 'JetBrains Mono, monospace' }}>
              Ashby • Lever • Greenhouse • Naukri • Internshala
            </span>
          </div>

          <h1 style={{ fontSize: '1.9rem', fontWeight: 700, margin: '6px 0 10px', letterSpacing: '-0.02em' }}>
            JobStrider Autonomous Career Cockpit
          </h1>
          <p style={{ maxWidth: 680, lineHeight: 1.6, color: 'var(--text-soft)', margin: 0 }}>
            Discover high-fit software engineering roles, calibrate match scores with Gemini AI, and craft
            ATS-tailored resumes in one single-click workspace.
          </p>
        </div>

        <div className="hero-actions" style={{ position: 'relative', zIndex: 2, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            className="primary-button"
            type="button"
            disabled={isScanning}
            onClick={() => runScan({ mode: 'scan' })}
            style={{
              background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
              boxShadow: '0 8px 24px -4px rgba(99, 102, 241, 0.5)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 20px',
              fontWeight: 600
            }}
          >
            <Zap size={16} />
            <span>{isScanning ? 'Scanning Boards...' : '⚡ Scan Boards'}</span>
          </button>

          <button
            className="secondary-button"
            type="button"
            onClick={() => runScan({ mode: 'autoflow' })}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 18px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.12)'
            }}
          >
            <Flame size={16} color="#f59e0b" />
            <span>AutoFlow Pipeline</span>
          </button>

          <button
            className="ghost-button"
            type="button"
            onClick={() => setShowLogs(!showLogs)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 16px',
              color: isScanning ? '#38bdf8' : 'var(--text-soft)'
            }}
          >
            <Terminal size={16} />
            <span>{showLogs ? 'Hide Live Logs' : 'Show Live Logs'}</span>
          </button>
        </div>
      </section>

      {/* Live Scanner Terminal Stream (Expandable) */}
      {showLogs && (
        <section
          style={{
            gridColumn: '1 / -1',
            background: '#070a12',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: 16,
            padding: '16px 20px',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.6)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Terminal size={16} color="#38bdf8" />
              <strong style={{ fontSize: '0.88rem', color: '#f8fafc', fontFamily: 'monospace' }}>
                JobStrider Live Pipeline Console
              </strong>
              {isScanning && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: '0.74rem',
                    color: '#38bdf8',
                    fontFamily: 'monospace'
                  }}
                >
                  <Loader2 size={12} className="spin-animation" /> STREAMING FROM SCANNER
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowLogs(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                fontSize: '0.78rem'
              }}
            >
              Close Console
            </button>
          </div>

          <div
            style={{
              maxHeight: 220,
              overflowY: 'auto',
              background: 'rgba(0, 0, 0, 0.5)',
              borderRadius: 10,
              padding: '12px 14px',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.78rem',
              lineHeight: 1.6,
              color: '#94a3b8'
            }}
          >
            {(activeScan?.logs || []).length ? (
              activeScan.logs.map((line, idx) => (
                <div key={idx} style={{ color: line.startsWith('[WARN]') ? '#fbbf24' : '#cbd5e1' }}>
                  {line}
                </div>
              ))
            ) : (
              <div style={{ color: '#64748b' }}>Console ready. Click &quot;Scan Boards&quot; to begin discovery stream.</div>
            )}
          </div>
        </section>
      )}

      {/* KPI Bento Grid */}
      <section className="stats-grid">
        {stats.map(({ id, label, value, icon: Icon, color, badge }) => (
          <article
            key={id}
            className="stat-card"
            style={{
              position: 'relative',
              overflow: 'hidden',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              background: 'var(--surface-glass)',
              border: '1px solid var(--border)'
            }}
            onClick={() => {
              if (id === 'scanned') navigate('/scanner');
              else navigate('/applications');
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 3,
                background: `linear-gradient(90deg, ${color} 0%, transparent 100%)`
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: `${color}18`,
                  border: `1px solid ${color}35`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Icon size={20} color={color} />
              </div>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontFamily: 'JetBrains Mono, monospace',
                  padding: '3px 8px',
                  borderRadius: 6,
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: 'var(--text-soft)'
                }}
              >
                {badge}
              </span>
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
              {value}
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-soft)', fontWeight: 500 }}>
              {label}
            </div>
          </article>
        ))}
      </section>

      {/* High Match Radar Grid */}
      <Panel
        title="High-Fit Job Opportunities"
        subtitle="Ranked matches with Grade A or B from Gemini evaluations"
        action={
          <button
            className="ghost-button"
            type="button"
            onClick={() => navigate('/applications')}
            style={{ fontSize: '0.82rem' }}
          >
            View All ({applications.length}) →
          </button>
        }
        className="full-span"
      >
        {topMatches.length ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16, marginTop: 8 }}>
            {topMatches.map((item) => (
              <div
                key={item.id}
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 14,
                  transition: 'all 0.18s ease'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <GradeBadge grade={item.grade} />
                      <strong style={{ fontSize: '1.05rem', color: 'var(--text)' }}>{item.company}</strong>
                    </div>
                    <span
                      style={{
                        fontSize: '0.74rem',
                        fontFamily: 'JetBrains Mono, monospace',
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: 'rgba(16, 185, 129, 0.1)',
                        color: '#34d399',
                        fontWeight: 600
                      }}
                    >
                      {Number(item.score).toFixed(1)} / 10
                    </span>
                  </div>

                  <div style={{ fontSize: '0.92rem', fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>
                    {item.role}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: '0.78rem', color: 'var(--text-soft)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <MapPin size={12} />
                      {item.location || 'Remote'}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'JetBrains Mono, monospace' }}>
                      💰 {item.salary_estimate || 'Competitive'}
                    </span>
                  </div>

                  {item.fit_summary ? (
                    <p
                      style={{
                        margin: '10px 0 0',
                        fontSize: '0.8rem',
                        lineHeight: 1.5,
                        color: 'var(--text-soft)',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}
                    >
                      {item.fit_summary}
                    </p>
                  ) : null}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid rgba(255, 255, 255, 0.05)', flexWrap: 'wrap', gap: 8 }}>
                  <ScoreBar score={item.score} />

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {isSafeUrl(item.apply_url || item.url) ? (
                      <a
                        href={item.apply_url || item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="table-link"
                        style={{
                          fontSize: '0.8rem',
                          padding: '5px 10px',
                          background: 'rgba(99, 102, 241, 0.12)',
                          borderRadius: 8,
                          color: '#818cf8',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          textDecoration: 'none'
                        }}
                      >
                        Apply <ExternalLink size={12} />
                      </a>
                    ) : null}

                    {tailoredFiles[item.id] ? (
                      <a
                        href={`/files/${tailoredFiles[item.id]}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          fontSize: '0.8rem',
                          padding: '5px 10px',
                          background: 'rgba(16, 185, 129, 0.2)',
                          border: '1px solid rgba(16, 185, 129, 0.4)',
                          borderRadius: 8,
                          color: '#34d399',
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontWeight: 600
                        }}
                      >
                        <Download size={12} /> PDF
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled={tailoringId === item.id}
                        onClick={() => handleTailorResume(item)}
                        style={{
                          fontSize: '0.8rem',
                          padding: '5px 10px',
                          background: 'rgba(16, 185, 129, 0.12)',
                          borderRadius: 8,
                          color: '#34d399',
                          border: 'none',
                          cursor: tailoringId === item.id ? 'not-allowed' : 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        {tailoringId === item.id ? <Loader2 size={12} className="spin-animation" /> : <Sparkles size={12} />}
                        <span>{tailoringId === item.id ? 'Tailoring...' : 'Tailor'}</span>
                      </button>
                    )}

                    {item.status !== 'applied' && (
                      <button
                        type="button"
                        onClick={() => handleMarkApplied(item.id)}
                        title="Mark as Applied"
                        style={{
                          fontSize: '0.78rem',
                          padding: '5px 8px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          borderRadius: 8,
                          color: '#94a3b8',
                          border: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        ✓
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No high-fit matches yet"
            body="Run the scanner to discover jobs across Ashby, Lever, Greenhouse, and let Gemini score them."
          />
        )}
      </Panel>

      {/* Grade Distribution Donut Chart */}
      <Panel title="Candidate Match Matrix" subtitle="Score breakdown across all evaluated applications">
        {chartData.length ? (
          <div className="chart-layout">
            <div className="chart-box" style={{ position: 'relative' }}>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    innerRadius={68}
                    outerRadius={92}
                    paddingAngle={4}
                    stroke="none"
                  >
                    {chartData.map((entry) => (
                      <Cell key={entry.name} fill={colors[entry.name]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(17, 24, 39, 0.95)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: 8,
                      color: '#f8fafc',
                      fontSize: '0.8rem'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none'
                }}
              >
                <span style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text)' }}>
                  {applications.length}
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-soft)', textTransform: 'uppercase' }}>
                  Evaluated
                </span>
              </div>
            </div>

            <div className="chart-legend">
              {['A', 'B', 'C', 'D', 'F'].map((grade) => {
                const count = applications.filter((item) => item.grade === grade).length;
                return (
                  <div key={grade} className="legend-row">
                    <span className="legend-dot" style={{ background: colors[grade] }} />
                    <span className="legend-label">Grade {grade}</span>
                    <strong className="legend-value">{count}</strong>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <EmptyState title="No evaluation chart data" body="Evaluations will populate this matrix once jobs are scored." />
        )}
      </Panel>

      {/* Recent Pipeline Activity */}
      <Panel title="Recent Pipeline Activity" subtitle="Live updates from scanner and evaluation engine">
        {activity.length ? (
          <div className="timeline-list">
            {activity.slice(0, 7).map((item) => (
              <div key={item.id || item.timestamp} className="timeline-item">
                <span className="timeline-bullet" />
                <div className="timeline-body">
                  <div className="timeline-header">
                    <strong>{item.title}</strong>
                    <time>{new Date(item.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</time>
                  </div>
                  <p>{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No recent activity" body="Scanner events and evaluation milestones appear here." />
        )}
      </Panel>
    </div>
  );
}
