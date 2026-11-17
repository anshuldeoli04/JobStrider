import { useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import Cockpit from './pages/Cockpit';
import ToastViewport from './components/ui/ToastViewport';
import LoadingBar from './components/ui/LoadingBar';
import { useAppStore } from './store/useAppStore';

export default function App() {
  const hydrated = useAppStore((state) => state.hydrated);
  const bootstrap = useAppStore((state) => state.bootstrap);

  useEffect(() => {
    if (!hydrated) {
      bootstrap();
    }
  }, [bootstrap, hydrated]);

  if (!hydrated) {
    return (
      <div
        style={{
          minBlockSize: '100dvh',
          display: 'grid',
          placeItems: 'center',
          padding: 24
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
          <div className="brand-mark" style={{ width: 48, height: 48 }}>
            <Sparkles size={22} />
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 700 }}>Opening JobStrider...</div>
          <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
            Preparing your private workspace
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="workspace-shell">
      <LoadingBar />
      <Sidebar />
      <div className="workspace-main">
        <Header />
        <main className="main-content">
          <Cockpit />
        </main>
      </div>
      <ToastViewport />
    </div>
  );
}
