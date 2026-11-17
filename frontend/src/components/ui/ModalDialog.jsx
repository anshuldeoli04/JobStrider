import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

export default function ModalDialog({
  open,
  onClose,
  title,
  subtitle = '',
  icon = null,
  variant = 'modal', // 'modal' | 'drawer'
  wide = false,
  footer = null,
  children
}) {
  const dialogRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Fallback for browsers without native <dialog closedby="any"> (e.g. Safari)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || 'closedBy' in HTMLDialogElement.prototype) return;

    const isOutside = (event) => {
      const rect = dialog.getBoundingClientRect();
      return (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      );
    };

    let pressedOutside = false;
    const onPointerDown = (event) => {
      pressedOutside = isOutside(event);
    };
    const onPointerUp = (event) => {
      if (pressedOutside && isOutside(event)) {
        dialog.close();
      }
      pressedOutside = false;
    };

    dialog.addEventListener('pointerdown', onPointerDown);
    dialog.addEventListener('pointerup', onPointerUp);
    return () => {
      dialog.removeEventListener('pointerdown', onPointerDown);
      dialog.removeEventListener('pointerup', onPointerUp);
    };
  }, []);

  const handleClose = () => {
    const dialog = dialogRef.current;
    if (dialog) dialog.returnValue = '';
    onClose?.();
  };

  const classes = [
    'native-dialog',
    variant === 'drawer' ? 'drawer' : '',
    wide ? 'wide' : ''
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <dialog
      ref={dialogRef}
      className={classes}
      aria-labelledby={titleId}
      closedby="any"
      onClose={handleClose}
    >
      <div className="dialog-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minInlineSize: 0 }}>
          {icon}
          <div style={{ minInlineSize: 0 }}>
            <h2
              id={titleId}
              style={{
                margin: 0,
                fontSize: '1.08rem',
                fontWeight: 700,
                lineHeight: 1.3
              }}
            >
              {title}
            </h2>
            {subtitle ? (
              <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--text-soft)' }}>
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => dialogRef.current?.close()}
          aria-label="Close dialog"
          style={{ minWidth: 38, padding: '6px' }}
        >
          <X size={18} />
        </button>
      </div>

      <div className="dialog-body">{open ? children : null}</div>

      {footer ? <div className="dialog-foot">{footer}</div> : null}
    </dialog>
  );
}
