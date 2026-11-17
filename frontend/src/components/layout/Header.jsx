import {
  Key,
  FileText,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Settings,
  ClipboardCheck,
  Loader2
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import ByokModal from '../ui/ByokModal';
import ResumeModal from '../ui/ResumeModal';
import ResumePreviewModal from '../ui/ResumePreviewModal';
import JobDetailDrawer from '../ui/JobDetailDrawer';

const VIEW_TITLES = {
  home: 'Welcome Home',
  discover: 'Find Matching Jobs',
  check: 'Check Any Job Posting',
  applications: 'My Applications',
  resumes: 'Tailored Resumes',
  settings: 'Settings & Preferences'
};

export default function Header() {
  const currentView = useAppStore((state) => state.currentView);
  const setCurrentView = useAppStore((state) => state.setCurrentView);
  const config = useAppStore((state) => state.config);
  const openByokModal = useAppStore((state) => state.openByokModal);
  const openResumeModal = useAppStore((state) => state.openResumeModal);
  const activeScan = useAppStore((state) => state.activeScan);

  const hasKey = Boolean(config?.has_key);
  const hasCv = Boolean(config?.has_cv);
  const isScanning = activeScan?.status === 'running';

  return (
    <>
      <header className="topbar">
        <div className="topbar-left">
          <button
            type="button"
            className="mobile-menu-btn btn btn-ghost btn-sm"
            onClick={() => setCurrentView('home')}
            aria-label="JobStrider Home"
            style={{ padding: '6px' }}
          >
            <Sparkles size={18} style={{ color: 'var(--accent)' }} />
          </button>
          <h1 className="topbar-title">{VIEW_TITLES[currentView] || 'JobStrider'}</h1>
          {isScanning && (
            <button
              type="button"
              onClick={() => setCurrentView('discover')}
              className="pill pill-info"
              title="Click to view job search progress"
            >
              <Loader2 size={13} className="spin-animation" />
              <span>Searching jobs...</span>
            </button>
          )}
        </div>

        <div className="topbar-actions">
          <button
            type="button"
            onClick={openResumeModal}
            className={`pill ${hasCv ? 'pill-success' : 'pill-warning'}`}
            title={hasCv ? 'Click to view or update your resume' : 'Upload your PDF resume or paste text'}
          >
            {hasCv ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
            <FileText size={13} />
            <span>{hasCv ? 'Resume Ready' : 'Add Resume'}</span>
          </button>

          <button
            type="button"
            onClick={openByokModal}
            className={`pill ${hasKey ? 'pill-success' : 'pill-warning'}`}
            title={hasKey ? 'Google AI key is connected' : 'Connect your free Google AI Studio key'}
          >
            {hasKey ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
            <Key size={13} />
            <span>{hasKey ? 'AI Connected' : 'Connect Free AI'}</span>
          </button>

          {currentView !== 'check' && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setCurrentView('check')}
            >
              <ClipboardCheck size={15} />
              <span>Check a Job</span>
            </button>
          )}

          <button
            type="button"
            className="mobile-menu-btn btn btn-ghost btn-sm"
            aria-label="Open Settings"
            onClick={() => setCurrentView('settings')}
            style={{ minWidth: 36, padding: '6px' }}
          >
            <Settings size={17} />
          </button>
        </div>
      </header>

      <ByokModal />
      <ResumeModal />
      <ResumePreviewModal />
      <JobDetailDrawer />
    </>
  );
}
