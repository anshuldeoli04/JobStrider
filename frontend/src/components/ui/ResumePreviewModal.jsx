import { Download, ExternalLink, FileText } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import ModalDialog from './ModalDialog';

export default function ResumePreviewModal() {
  const preview = useAppStore((state) => state.previewResume);
  const close = useAppStore((state) => state.closeResumePreview);

  return (
    <ModalDialog
      open={Boolean(preview)}
      onClose={close}
      wide
      title={preview?.title || 'Tailored Resume Preview'}
      subtitle="Clean ATS-ready layout generated from your verified experience"
      icon={
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: 'var(--success-bg)',
            color: 'var(--success)',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0
          }}
        >
          <FileText size={18} />
        </div>
      }
      footer={
        <>
          {preview?.htmlUrl ? (
            <a href={preview.htmlUrl} target="_blank" rel="noreferrer" className="btn btn-secondary">
              <ExternalLink size={15} />
              <span>Open in New Tab</span>
            </a>
          ) : null}
          {preview?.pdfUrl ? (
            <a href={preview.pdfUrl} download className="btn btn-primary">
              <Download size={15} />
              <span>Download PDF</span>
            </a>
          ) : null}
        </>
      }
    >
      {preview?.htmlUrl ? (
        <div
          style={{
            borderRadius: 12,
            overflow: 'hidden',
            border: '1px solid var(--border)',
            background: '#ffffff',
            blockSize: 'min(68dvh, 680px)'
          }}
        >
          <iframe
            src={preview.htmlUrl}
            title={preview.title || 'Tailored Resume Preview'}
            style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
          />
        </div>
      ) : (
        <p style={{ margin: 0, color: 'var(--text-soft)' }}>HTML preview is unavailable; use Download PDF below.</p>
      )}
    </ModalDialog>
  );
}
