import { Outlet } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="auth-shell">
      <div className="auth-brand-panel">
        <div className="brand-mark">JobStrider</div>
        <h1>From autonomous scanning to operator-grade job cockpit.</h1>
        <p>
          Auth flow captures your target experience from day one so profile settings and scans persist reliably.
        </p>
        <div className="auth-highlight-grid">
          <div className="glass-card">
            <span>Scanner</span>
            <strong>Multi-source pipeline</strong>
          </div>
          <div className="glass-card">
            <span>Evaluator</span>
            <strong>Fit score + gaps + prep</strong>
          </div>
          <div className="glass-card">
            <span>Resume</span>
            <strong>Tailored output contracts</strong>
          </div>
        </div>
      </div>
      <div className="auth-form-panel">
        <Outlet />
      </div>
    </div>
  );
}
