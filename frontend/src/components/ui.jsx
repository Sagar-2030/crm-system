import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

export function Modal({ title, onClose, children }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(onClose);
  const headingId = useId();
  closeRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    const previousFocus = document.activeElement;
    const getFocusable = () => Array.from(dialog.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter((element) => element.getAttribute('aria-hidden') !== 'true');

    const initialTarget = getFocusable()[0] || dialog;
    initialTarget.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current?.();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = getFocusable();
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
    };
  }, []);

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-labelledby={headingId} tabIndex={-1}>
        <div className="modal-head">
          <h3 id={headingId}>{title}</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const Field = ({ label, children }) => (
  <label className="field">
    <span>{label}</span>
    {children}
  </label>
);

export const StageBadge = ({ stage }) => <span className={`badge stage-${stage}`}>{stage}</span>;

export const Alert = ({ children, kind = 'error' }) => (children ? <div className={`alert ${kind}`}>{children}</div> : null);

export const Empty = ({ children = 'Nothing to show yet.' }) => <div className="empty">{children}</div>;

export function Pager({ page, pages, onChange }) {
  if (!pages || pages <= 1) return null;
  return (
    <div className="pager">
      <button className="btn" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Previous
      </button>
      <span>
        Page {page} of {pages}
      </span>
      <button className="btn" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        Next
      </button>
    </div>
  );
}
