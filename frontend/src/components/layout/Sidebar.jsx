import {
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardCheck,
  Compass,
  FileText,
  Home,
  Settings,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'discover', label: 'Find Jobs', icon: Compass },
  { id: 'check', label: 'Check a Job', icon: ClipboardCheck },
  { id: 'applications', label: 'My Jobs', icon: BriefcaseBusiness },
  { id: 'resumes', label: 'Resumes', icon: FileText }
];

export default function Sidebar() {
  const currentView = useAppStore((state) => state.currentView);
  const setCurrentView = useAppStore((state) => state.setCurrentView);
  const applications = useAppStore((state) => state.applications);
  const scanResults = useAppStore((state) => state.scanResults);
  const config = useAppStore((state) => state.config);
  const openByokModal = useAppStore((state) => state.openByokModal);
  const openResumeModal = useAppStore((state) => state.openResumeModal);

  const hasCv = Boolean(config?.has_cv);
  const hasKey = Boolean(config?.has_key);
  const tailoredCount = applications.filter((a) => a.resume_pdf || a.resume_html).length;

  const badgeCounts = {
    discover: scanResults.length || null,
    applications: applications.length || null,
    resumes: tailoredCount || null
  };

  return (
    <>
      <aside className="sidebar-rail" aria-label="Main workspace navigation">
        <button type="button" className="brand-lockup" onClick={() => setCurrentView('home')}>
          <div className="brand-mark" aria-hidden="true">
            <Sparkles size={19} />
          </div>
          <div>
            <span className="brand-name">JobStrider</span>
            <span className="brand-sub">Personal Job Assistant</span>
          </div>
        </button>

        <nav className="sidebar-nav" aria-label="Primary sections">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const count = badgeCounts[id];
            const active = currentView === id;
            return (
              <button
                key={id}
                type="button"
                className="nav-item"
                aria-current={active ? 'page' : undefined}
                onClick={() => setCurrentView(id)}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{label}</span>
                {count ? <span className="nav-badge">{count}</span> : null}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="readiness-box">
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Setup Checklist
            </div>
            <button
              type="button"
              onClick={openResumeModal}
              className="readiness-row"
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', width: '100%' }}
            >
              <span>Your Resume</span>
              {hasCv ? (
                <span style={{ color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <CheckCircle2 size={13} /> Ready
                </span>
              ) : (
                <span style={{ color: 'var(--warning)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <AlertCircle size={13} /> Add PDF
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={openByokModal}
              className="readiness-row"
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', width: '100%' }}
            >
              <span>Google AI</span>
              {hasKey ? (
                <span style={{ color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <CheckCircle2 size={13} /> Connected
                </span>
              ) : (
                <span style={{ color: 'var(--warning)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <AlertCircle size={13} /> Add Key
                </span>
              )}
            </button>
          </div>

          <button
            type="button"
            className="nav-item"
            aria-current={currentView === 'settings' ? 'page' : undefined}
            onClick={() => setCurrentView('settings')}
          >
            <Settings size={18} aria-hidden="true" />
            <span>Settings</span>
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-nav-bar" aria-label="Mobile navigation">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const active = currentView === id;
          return (
            <button
              key={id}
              type="button"
              className="mobile-nav-btn"
              aria-current={active ? 'page' : undefined}
              onClick={() => setCurrentView(id)}
            >
              <Icon size={19} aria-hidden="true" />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
