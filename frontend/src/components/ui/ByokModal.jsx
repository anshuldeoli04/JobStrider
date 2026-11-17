import { useEffect, useId, useState } from 'react';
import {
  Key,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Shield,
  Sparkles,
  Loader2,
  Eye,
  EyeOff
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import ModalDialog from './ModalDialog';

export default function ByokModal() {
  const isOpen = useAppStore((state) => state.isByokModalOpen);
  const close = useAppStore((state) => state.closeByokModal);
  const config = useAppStore((state) => state.config);
  const testApiKey = useAppStore((state) => state.testApiKey);
  const updateApiKey = useAppStore((state) => state.updateApiKey);
  const pushToast = useAppStore((state) => state.pushToast);

  const [keyInput, setKeyInput] = useState('');
  const [model, setModel] = useState('gemini-2.5-flash');
  const [showKey, setShowKey] = useState(false);
  const [testStatus, setTestStatus] = useState({ state: 'idle', message: '' });
  const [saving, setSaving] = useState(false);

  const keyFieldId = useId();
  const keyHintId = useId();
  const modelFieldId = useId();

  useEffect(() => {
    if (isOpen) {
      setModel(config?.gemini_model || 'gemini-2.5-flash');
      setTestStatus({ state: 'idle', message: '' });
      setKeyInput('');
    }
  }, [isOpen, config?.gemini_model]);

  const hasExistingKey = Boolean(config?.has_key);

  const handleTestKey = async () => {
    const keyToTest = keyInput.trim();
    if (!keyToTest && !hasExistingKey) {
      setTestStatus({ state: 'error', message: 'Please paste a Gemini API key first.' });
      return;
    }

    setTestStatus({ state: 'testing', message: 'Testing connection with Google Gemini...' });
    try {
      const res = await testApiKey({
        ...(keyToTest ? { api_key: keyToTest } : {}),
        gemini_model: model
      });
      setTestStatus({
        state: 'success',
        message: `Connected! Model responded cleanly (${res.sample || 'OK'}).`
      });
    } catch (err) {
      setTestStatus({
        state: 'error',
        message: err?.response?.data?.error || err.message || 'Verification failed. Please check your key.'
      });
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const keyToSave = keyInput.trim();
    if (!keyToSave && !hasExistingKey) {
      pushToast({ type: 'error', title: 'API key required', message: 'Paste your free Google AI Studio key first.' });
      return;
    }

    setSaving(true);
    try {
      if (keyToSave) {
        await updateApiKey({ key: keyToSave, model });
      } else {
        await useAppStore.getState().saveConfig({ gemini_model: model });
      }
      close();
    } catch (err) {
      pushToast({
        type: 'error',
        title: 'Could not save key',
        message: err?.response?.data?.error || err.message
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalDialog
      open={isOpen}
      onClose={close}
      title="Connect Free Google AI"
      subtitle="Powers smart job matching and custom resume writing"
      icon={
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 11,
            background: 'var(--accent-soft)',
            color: 'var(--accent)',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0
          }}
        >
          <Key size={20} />
        </div>
      }
      footer={
        <>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleTestKey}
            disabled={testStatus.state === 'testing'}
          >
            <Shield size={15} />
            <span>Test Connection</span>
          </button>
          <button
            type="submit"
            form="byok-form"
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? <Loader2 size={15} className="spin-animation" /> : <CheckCircle2 size={15} />}
            <span>{saving ? 'Saving...' : 'Save & Connect'}</span>
          </button>
        </>
      }
    >
      <form id="byok-form" onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div
          style={{
            padding: '14px 16px',
            borderRadius: 12,
            background: 'var(--accent-soft)',
            border: '1px solid rgba(79, 70, 229, 0.22)',
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start'
          }}
        >
          <Sparkles size={18} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: '0.86rem', lineHeight: 1.55, color: 'var(--text-soft)' }}>
            <strong style={{ color: 'var(--text)' }}>100% Free &amp; Private:</strong> Google gives you up to{' '}
            <strong style={{ color: 'var(--text)' }}>1,500 free AI checks per day</strong> with no card required. Your
            key stays only on this computer.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-soft)' }}>Current Status</span>
          {hasExistingKey ? (
            <span className="pill pill-success">
              <CheckCircle2 size={14} /> Connected ({config?.masked_key || 'Saved'})
            </span>
          ) : (
            <span className="pill pill-warning">
              <AlertCircle size={14} /> Not connected yet
            </span>
          )}
        </div>

        <div
          style={{
            padding: '14px 16px',
            borderRadius: 12,
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <strong style={{ fontSize: '0.88rem' }}>Step 1: Get your free key in 20 seconds</strong>
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
              className="btn btn-soft btn-sm"
            >
              <span>Open Google AI Studio</span>
              <ExternalLink size={13} />
            </a>
          </div>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-soft)' }}>
            Sign in with Google, click <strong>Create API key</strong>, and paste it below.
          </p>
        </div>

        <div className="field-group">
          <label htmlFor={keyFieldId} className="field-label">
            Step 2: Paste your Google Gemini Key
          </label>
          <span id={keyHintId} className="field-hint">
            {hasExistingKey
              ? 'Leave blank to keep your saved key, or paste a new one to replace it.'
              : 'Starts with AIza...'}
          </span>
          <div style={{ position: 'relative' }}>
            <input
              id={keyFieldId}
              name="gemini_api_key"
              type={showKey ? 'text' : 'password'}
              className="input"
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              aria-describedby={keyHintId}
              placeholder={hasExistingKey ? 'Saved securely (paste new key to replace)' : 'Paste AIza... key here'}
              value={keyInput}
              onChange={(e) => {
                setKeyInput(e.target.value);
                if (testStatus.state !== 'idle') setTestStatus({ state: 'idle', message: '' });
              }}
              style={{ paddingInlineEnd: 54, fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}
            />
            <button
              type="button"
              aria-pressed={showKey}
              aria-label={showKey ? 'Hide API key' : 'Show API key'}
              onClick={() => setShowKey((prev) => !prev)}
              className="btn btn-ghost btn-sm"
              style={{
                position: 'absolute',
                insetInlineEnd: 6,
                insetBlockStart: '50%',
                transform: 'translateY(-50%)',
                minWidth: 36,
                padding: '6px'
              }}
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div className="field-group">
          <label htmlFor={modelFieldId} className="field-label">
            AI Speed &amp; Accuracy Mode
          </label>
          <select
            id={modelFieldId}
            name="gemini_model"
            className="select"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          >
            <option value="gemini-2.5-flash">Fast &amp; Free (Recommended — Gemini 2.5 Flash)</option>
            <option value="gemini-1.5-flash">Balanced &amp; Steady (Gemini 1.5 Flash)</option>
            <option value="gemini-1.5-pro">Deep Reasoning (Gemini 1.5 Pro)</option>
          </select>
        </div>

        {testStatus.state !== 'idle' && (
          <div
            role="status"
            aria-live="polite"
            className={`pill ${
              testStatus.state === 'success'
                ? 'pill-success'
                : testStatus.state === 'error'
                  ? 'pill-danger'
                  : 'pill-info'
            }`}
            style={{ borderRadius: 10, padding: '10px 14px', width: '100%' }}
          >
            {testStatus.state === 'testing' && <Loader2 size={16} className="spin-animation" />}
            {testStatus.state === 'success' && <CheckCircle2 size={16} />}
            {testStatus.state === 'error' && <AlertCircle size={16} />}
            <span>{testStatus.message}</span>
          </div>
        )}
      </form>
    </ModalDialog>
  );
}
