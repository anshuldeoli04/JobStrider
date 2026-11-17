import { useEffect, useId, useRef, useState } from 'react';
import { FileText, Upload, CheckCircle2, AlertCircle, Loader2, Sparkles } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import ModalDialog from './ModalDialog';

const STARTER_RESUME_GUIDE = `# Your Full Name
Email: you@example.com | Phone: +91 98765 43210 | City: Bengaluru, India
LinkedIn: linkedin.com/in/yourname | GitHub: github.com/yourname

## Summary
Motivated software developer experienced in building modern web apps, APIs, and responsive user interfaces.

## Skills
- Languages: JavaScript, Python, Java, SQL
- Frameworks: React, Node.js, Express
- Tools: Git, Docker, PostgreSQL

## Projects
### Project Name
- Built a full-stack web application improving task tracking and reporting.
- Integrated REST APIs and automated validation checks.

## Education
B.Tech / B.Sc in Computer Science — University Name (2020 - 2024)
`;

export default function ResumeModal() {
  const isOpen = useAppStore((state) => state.isResumeModalOpen);
  const close = useAppStore((state) => state.closeResumeModal);
  const config = useAppStore((state) => state.config);
  const uploadCvPdf = useAppStore((state) => state.uploadCvPdf);
  const saveConfig = useAppStore((state) => state.saveConfig);
  const pushToast = useAppStore((state) => state.pushToast);

  const [activeTab, setActiveTab] = useState('upload');
  const [cvText, setCvText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef(null);
  const uploadTabRef = useRef(null);
  const editTabRef = useRef(null);
  const textareaId = useId();

  useEffect(() => {
    if (isOpen) {
      setCvText(config?.cv_content || '');
      setActiveTab(config?.has_cv ? 'edit' : 'upload');
    }
  }, [isOpen, config?.cv_content, config?.has_cv]);

  const trimmedLength = cvText.trim().length;
  const wordCount = cvText.trim() ? cvText.trim().split(/\s+/).filter(Boolean).length : 0;
  const hasResume = Boolean(config?.has_cv);

  const handlePdfUpload = async (file) => {
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
      pushToast({ type: 'error', title: 'PDF file needed', message: 'Please choose a .pdf resume file.' });
      return;
    }

    setUploading(true);
    try {
      const res = await uploadCvPdf(file);
      if (res?.cv_content) setCvText(res.cv_content);
      close();
    } catch (err) {
      pushToast({
        type: 'error',
        title: 'Could not read PDF',
        message: err?.response?.data?.error || err.message || 'Try pasting your resume text instead.'
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSaveText = async (e) => {
    e.preventDefault();
    if (trimmedLength < 200) {
      pushToast({
        type: 'warning',
        title: 'Add a bit more detail',
        message: 'Please include at least 200 characters (skills, projects, or experience) so AI can evaluate jobs accurately.'
      });
      return;
    }

    setSaving(true);
    try {
      await saveConfig({ cv_content: cvText });
      close();
    } catch (err) {
      pushToast({
        type: 'error',
        title: 'Save failed',
        message: err?.response?.data?.error || err.message
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTabKeyDown = (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const next = activeTab === 'upload' ? 'edit' : 'upload';
      setActiveTab(next);
      (next === 'upload' ? uploadTabRef : editTabRef).current?.focus();
    }
  };

  return (
    <ModalDialog
      open={isOpen}
      onClose={close}
      title="Your Master Resume"
      subtitle="Used to check job fit and build tailored resumes for each application"
      icon={
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 11,
            background: 'var(--success-bg)',
            color: 'var(--success)',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0
          }}
        >
          <FileText size={20} />
        </div>
      }
      footer={
        activeTab === 'edit' ? (
          <>
            <button type="button" className="btn btn-ghost" onClick={close}>
              Cancel
            </button>
            <button type="submit" form="resume-text-form" className="btn btn-primary" disabled={saving}>
              {saving ? <Loader2 size={15} className="spin-animation" /> : <CheckCircle2 size={15} />}
              <span>{saving ? 'Saving...' : 'Save Resume'}</span>
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-secondary" onClick={close}>
            Done
          </button>
        )
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div className="tablist" role="tablist" aria-label="Resume input method" onKeyDown={handleTabKeyDown}>
            <button
              ref={uploadTabRef}
              type="button"
              role="tab"
              id="tab-upload-pdf"
              aria-selected={activeTab === 'upload'}
              tabIndex={activeTab === 'upload' ? 0 : -1}
              className="tab-btn"
              onClick={() => setActiveTab('upload')}
            >
              <Upload size={15} />
              <span>Upload PDF</span>
            </button>
            <button
              ref={editTabRef}
              type="button"
              role="tab"
              id="tab-edit-text"
              aria-selected={activeTab === 'edit'}
              tabIndex={activeTab === 'edit' ? 0 : -1}
              className="tab-btn"
              onClick={() => setActiveTab('edit')}
            >
              <FileText size={15} />
              <span>Paste or Edit Text</span>
            </button>
          </div>

          {hasResume ? (
            <span className="pill pill-success">
              <CheckCircle2 size={13} /> {config?.cv_word_count || wordCount} words ready
            </span>
          ) : (
            <span className="pill pill-warning">
              <AlertCircle size={13} /> No resume added yet
            </span>
          )}
        </div>

        <div role="tabpanel" aria-labelledby="tab-upload-pdf" hidden={activeTab !== 'upload'}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                if (e.dataTransfer.files?.[0]) handlePdfUpload(e.dataTransfer.files[0]);
              }}
              style={{
                border: `2px dashed ${dragActive ? 'var(--accent)' : 'var(--success-border)'}`,
                borderRadius: 16,
                padding: '34px 20px',
                textAlign: 'center',
                background: dragActive ? 'var(--accent-soft)' : 'var(--success-bg)',
                transition: 'all 0.16s ease'
              }}
            >
              <input
                type="file"
                ref={fileInputRef}
                accept=".pdf,application/pdf"
                className="visually-hidden"
                aria-label="Choose resume PDF file"
                onChange={(e) => {
                  if (e.target.files?.[0]) handlePdfUpload(e.target.files[0]);
                }}
              />
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  background: 'var(--surface)',
                  color: 'var(--success)',
                  display: 'grid',
                  placeItems: 'center',
                  margin: '0 auto 12px',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                {uploading ? <Loader2 size={24} className="spin-animation" /> : <Upload size={24} />}
              </div>
              <h3 style={{ margin: '0 0 6px', fontSize: '1rem', fontWeight: 700 }}>
                {uploading ? 'Reading your resume...' : 'Drop your PDF resume here'}
              </h3>
              <p style={{ margin: '0 0 16px', fontSize: '0.84rem', color: 'var(--text-soft)' }}>
                We automatically read your skills, projects, and experience from standard PDFs.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={15} />
                <span>{uploading ? 'Importing...' : 'Choose PDF File'}</span>
              </button>
            </div>

            {hasResume && (
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: 12,
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  flexWrap: 'wrap'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.84rem' }}>
                  <Sparkles size={16} style={{ color: 'var(--success)' }} />
                  <span>Your current resume ({config?.cv_word_count || wordCount} words) is saved locally.</span>
                </div>
                <button type="button" className="btn btn-soft btn-sm" onClick={() => setActiveTab('edit')}>
                  View or Edit Text
                </button>
              </div>
            )}
          </div>
        </div>

        <div role="tabpanel" aria-labelledby="tab-edit-text" hidden={activeTab !== 'edit'}>
          <form id="resume-text-form" onSubmit={handleSaveText} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <label htmlFor={textareaId} className="field-label">
                Paste or edit your resume details
              </label>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setCvText(STARTER_RESUME_GUIDE)}
              >
                Insert Blank Guide
              </button>
            </div>
            <textarea
              id={textareaId}
              name="cv_content"
              className="textarea"
              rows={12}
              value={cvText}
              onChange={(e) => setCvText(e.target.value)}
              placeholder="Paste your name, skills, projects, experience, and education here..."
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              <span>
                {trimmedLength < 200
                  ? `Add ${200 - trimmedLength} more characters for accurate AI matching.`
                  : 'Looks good — enough detail for accurate AI matching.'}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{wordCount} words</span>
            </div>
          </form>
        </div>
      </div>
    </ModalDialog>
  );
}
