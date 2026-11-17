import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sparkles, Terminal } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export default function Login() {
  const navigate = useNavigate();
  const login = useAppStore((state) => state.login);
  const loginLocal = useAppStore((state) => state.loginLocal);
  const [form, setForm] = useState({ email: 'operator@jobstrider.local', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleLocalAccess = async () => {
    setSubmitting(true);
    setError('');
    try {
      await loginLocal();
      navigate('/');
    } catch (err) {
      setError(err?.response?.data?.error || 'Local sign in failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-card">
      <div>
        <div className="eyebrow">Control Room</div>
        <h2>Sign in to JobStrider</h2>
        <p className="muted-copy">Track applications, AI match evaluations, and ATS resume workflows.</p>
      </div>

      <button
        className="primary-button full-width"
        type="button"
        onClick={handleLocalAccess}
        disabled={submitting}
        style={{
          background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #2563eb 100%)',
          boxShadow: '0 8px 24px -4px rgba(99, 102, 241, 0.45)',
          padding: '14px 20px',
          fontWeight: 600,
          fontSize: '0.96rem'
        }}
      >
        <Sparkles size={18} />
        <span>⚡ Launch Local Workspace (One Click)</span>
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '8px 0' }}>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>OR SIGN IN WITH ACCOUNT</span>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      </div>

      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setSubmitting(true);
          setError('');
          try {
            await login(form);
            navigate('/');
          } catch (err) {
            setError(err?.response?.data?.error || 'Login failed');
          } finally {
            setSubmitting(false);
          }
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <label>
          Email
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </label>
        <label>
          Password
          <input type="password" value={form.password} placeholder="••••••••••" onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        </label>
        {error ? <div className="inline-error">{error}</div> : null}
        <button className="secondary-button full-width" type="submit" disabled={submitting}>
          {submitting ? 'Authenticating...' : 'Sign In with Password'}
        </button>
      </form>

      <p className="muted-copy" style={{ textAlign: 'center', marginTop: 8 }}>
        Multi-user deployment? <Link to="/auth/signup">Create local account</Link>
      </p>
    </div>
  );
}
