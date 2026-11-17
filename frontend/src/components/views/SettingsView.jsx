import { useEffect, useId, useState } from 'react';
import { CheckCircle2, Key, Loader2, Monitor, Moon, RotateCcw, Sun, Trash2, User } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import ModalDialog from '../ui/ModalDialog';

function getStoredColorScheme() {
  try {
    const val = localStorage.getItem('color-scheme');
    return val === 'light' || val === 'dark' ? val : 'system';
  } catch {
    return 'system';
  }
}

export default function SettingsView() {
  const config = useAppStore((state) => state.config);
  const saveConfig = useAppStore((state) => state.saveConfig);
  const testApiKey = useAppStore((state) => state.testApiKey);
  const resetWorkspace = useAppStore((state) => state.resetWorkspace);
  const pushToast = useAppStore((state) => state.pushToast);

  const [themeMode, setThemeMode] = useState(getStoredColorScheme);
  const [systemPref, setSystemPref] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  );

  const [name, setName] = useState(config?.name || '');
  const [experienceLevel, setExperienceLevel] = useState(config?.experience_level || 'fresher');
  const [expectedCtc, setExpectedCtc] = useState(config?.expected_ctc_lpa || '');
  const [targetRoles, setTargetRoles] = useState((config?.target_roles || []).join(', '));
  const [targetLocations, setTargetLocations] = useState((config?.target_locations || []).join(', '));
  const [geminiModel, setGeminiModel] = useState(config?.gemini_model || 'gemini-2.5-flash');
  const [newApiKey, setNewApiKey] = useState('');
  const [testingKey, setTestingKey] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saving, setSaving] = useState(false);

  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [alsoClearResume, setAlsoClearResume] = useState(false);
  const [alsoClearKey, setAlsoClearKey] = useState(false);
  const [resetting, setResetting] = useState(false);

  const nameId = useId();
  const expId = useId();
  const ctcId = useId();
  const rolesId = useId();
  const locsId = useId();
  const keyId = useId();
  const modelId = useId();

  useEffect(() => {
    setName(config?.name || '');
    setExperienceLevel(config?.experience_level || 'fresher');
    setExpectedCtc(config?.expected_ctc_lpa || '');
    setTargetRoles((config?.target_roles || []).join(', '));
    setTargetLocations((config?.target_locations || []).join(', '));
    setGeminiModel(config?.gemini_model || 'gemini-2.5-flash');
  }, [config]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onMqChange = (e) => setSystemPref(e.matches ? 'dark' : 'light');
    const onStorage = (e) => {
      if (e.key === 'color-scheme') {
        const next = e.newValue === 'light' || e.newValue === 'dark' ? e.newValue : 'system';
        setThemeMode(next);
        const meta = document.querySelector('meta[name="color-scheme"]');
        if (meta) meta.content = next === 'system' ? 'light dark' : next;
      }
    };
    mq.addEventListener('change', onMqChange);
    window.addEventListener('storage', onStorage);
    return () => {
      mq.removeEventListener('change', onMqChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const applyThemeMode = (next) => {
    setThemeMode(next);
    const meta = document.querySelector('meta[name="color-scheme"]');
    if (next === 'system') {
      try {
        localStorage.removeItem('color-scheme');
      } catch {}
      if (meta) meta.content = 'light dark';
    } else {
      try {
        localStorage.setItem('color-scheme', next);
      } catch {}
      if (meta) meta.content = next;
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name,
        experience_level: experienceLevel,
        expected_ctc_lpa: expectedCtc,
        gemini_model: geminiModel,
        target_roles: targetRoles
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        target_locations: targetLocations
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      };
      if (newApiKey.trim()) {
        payload.gemini_api_key = newApiKey.trim();
      }
      await saveConfig(payload);
      setNewApiKey('');
    } catch (err) {
      pushToast({ type: 'error', title: 'Save failed', message: err?.response?.data?.error || err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleTestKey = async () => {
    setTestingKey(true);
    setTestResult(null);
    try {
      const res = await testApiKey({
        ...(newApiKey.trim() ? { api_key: newApiKey.trim() } : {}),
        gemini_model: geminiModel
      });
      setTestResult({ ok: true, message: `Connected (${res.sample || 'OK'})` });
    } catch (err) {
      setTestResult({ ok: false, message: err?.response?.data?.error || err.message });
    } finally {
      setTestingKey(false);
    }
  };

  const handleConfirmReset = async () => {
    setResetting(true);
    try {
      await resetWorkspace({ includeResume: alsoClearResume, includeKey: alsoClearKey });
      setIsResetDialogOpen(false);
      setAlsoClearResume(false);
      setAlsoClearKey(false);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Appearance (3-state system/light/dark) */}
      <section className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: '1.1rem', fontWeight: 700 }}>Appearance</h2>
            <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-soft)' }}>
              Choose Light, Dark, or follow your computer&apos;s theme automatically.
            </p>
          </div>

          <div role="group" aria-label="Color theme preference" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { id: 'system', label: `System (${systemPref === 'dark' ? 'Currently Dark' : 'Currently Light'})`, icon: Monitor },
              { id: 'light', label: 'Light', icon: Sun },
              { id: 'dark', label: 'Dark', icon: Moon }
            ].map(({ id, label, icon: Icon }) => {
              const active = themeMode === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => applyThemeMode(id)}
                  className={active ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                >
                  <Icon size={15} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Profile & AI Settings Form */}
      <form onSubmit={handleSave} className="grid-2">
        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <User size={19} style={{ color: 'var(--accent)' }} />
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>Your Profile &amp; Preferences</h3>
          </div>

          <div className="field-group">
            <label htmlFor={nameId} className="field-label">Your Name</label>
            <input
              id={nameId}
              type="text"
              className="input"
              autoComplete="name"
              placeholder="Optional (used in greetings)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid-2" style={{ gap: 12 }}>
            <div className="field-group">
              <label htmlFor={expId} className="field-label">Experience Level</label>
              <select
                id={expId}
                className="select"
                value={experienceLevel}
                onChange={(e) => setExperienceLevel(e.target.value)}
              >
                <option value="fresher">Fresher / Student</option>
                <option value="0-1yr">0–1 Year</option>
                <option value="1-3yr">1–3 Years</option>
                <option value="3+yr">3+ Years</option>
              </select>
            </div>

            <div className="field-group">
              <label htmlFor={ctcId} className="field-label">Expected Salary (LPA)</label>
              <input
                id={ctcId}
                type="text"
                className="input"
                placeholder="e.g. 6-10"
                value={expectedCtc}
                onChange={(e) => setExpectedCtc(e.target.value)}
              />
            </div>
          </div>

          <div className="field-group">
            <label htmlFor={rolesId} className="field-label">Target Roles (comma-separated)</label>
            <input
              id={rolesId}
              type="text"
              className="input"
              value={targetRoles}
              onChange={(e) => setTargetRoles(e.target.value)}
            />
          </div>

          <div className="field-group">
            <label htmlFor={locsId} className="field-label">Preferred Locations (comma-separated)</label>
            <input
              id={locsId}
              type="text"
              className="input"
              value={targetLocations}
              onChange={(e) => setTargetLocations(e.target.value)}
            />
          </div>
        </section>

        <section className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Key size={19} style={{ color: 'var(--success)' }} />
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>Google AI Connection</h3>
            </div>

            <div className="field-group">
              <label htmlFor={keyId} className="field-label">Google Gemini API Key</label>
              <span className="field-hint">
                {config?.has_key ? `Active key: ${config.masked_key}` : 'No key saved yet.'}
              </span>
              <input
                id={keyId}
                type="password"
                className="input"
                autoComplete="off"
                placeholder={config?.has_key ? 'Paste a new key to replace existing' : 'Paste AIza... key here'}
                value={newApiKey}
                onChange={(e) => setNewApiKey(e.target.value)}
                style={{ fontFamily: 'var(--font-mono)' }}
              />
            </div>

            <div className="field-group">
              <label htmlFor={modelId} className="field-label">AI Model Tier</label>
              <select
                id={modelId}
                className="select"
                value={geminiModel}
                onChange={(e) => setGeminiModel(e.target.value)}
              >
                <option value="gemini-2.5-flash">Fast &amp; Free (Gemini 2.5 Flash)</option>
                <option value="gemini-1.5-flash">Balanced &amp; Steady (Gemini 1.5 Flash)</option>
                <option value="gemini-1.5-pro">Deep Reasoning (Gemini 1.5 Pro)</option>
              </select>
            </div>

            {testResult && (
              <div role="status" className={`pill ${testResult.ok ? 'pill-success' : 'pill-danger'}`} style={{ cursor: 'default' }}>
                {testResult.message}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', paddingTop: 10 }}>
            <button type="button" className="btn btn-secondary" onClick={handleTestKey} disabled={testingKey}>
              {testingKey ? <Loader2 size={15} className="spin-animation" /> : null}
              <span>{testingKey ? 'Testing...' : 'Test Connection'}</span>
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ marginInlineStart: 'auto' }}>
              {saving ? <Loader2 size={15} className="spin-animation" /> : <CheckCircle2 size={15} />}
              <span>{saving ? 'Saving...' : 'Save Preferences'}</span>
            </button>
          </div>
        </section>
      </form>

      {/* Workspace Data Reset */}
      <section className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: '0 0 4px', fontSize: '1.05rem', fontWeight: 700 }}>Start Fresh</h3>
            <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-soft)' }}>
              Clear saved jobs, scan results, and generated resumes inside this web workspace. Your root folder files
              are untouched.
            </p>
          </div>
          <button type="button" className="btn btn-danger btn-sm" onClick={() => setIsResetDialogOpen(true)}>
            <RotateCcw size={14} />
            <span>Reset Web Workspace</span>
          </button>
        </div>
      </section>

      <ModalDialog
        open={isResetDialogOpen}
        onClose={() => setIsResetDialogOpen(false)}
        title="Reset Web Workspace?"
        subtitle="This clears discovered jobs, scored applications, and tailored resumes in the web app."
        footer={
          <>
            <button type="button" className="btn btn-secondary" autoFocus onClick={() => setIsResetDialogOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-danger" disabled={resetting} onClick={handleConfirmReset}>
              {resetting ? <Loader2 size={14} className="spin-animation" /> : <Trash2 size={14} />}
              <span>{resetting ? 'Clearing...' : 'Clear Workspace'}</span>
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '0.9rem' }}>
            <input
              type="checkbox"
              checked={alsoClearResume}
              onChange={(e) => setAlsoClearResume(e.target.checked)}
              style={{ width: 18, height: 18 }}
            />
            <span>Also clear my saved resume</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '0.9rem' }}>
            <input
              type="checkbox"
              checked={alsoClearKey}
              onChange={(e) => setAlsoClearKey(e.target.checked)}
              style={{ width: 18, height: 18 }}
            />
            <span>Also clear my saved Google AI key</span>
          </label>
        </div>
      </ModalDialog>
    </div>
  );
}
