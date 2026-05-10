import React, { useEffect } from 'react';

export function Modal({ title, onClose, children, onBack }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onMouseDown={onClose}>
      <div className="modal-card">
        <div className="modal-head" onMouseDown={(event) => event.stopPropagation()}>
          <div className="modal-head-left">
            {onBack ? <button className="modal-nav-button" type="button" onClick={onBack}>Back</button> : null}
            <h3>{title}</h3>
          </div>
          <button className="modal-nav-button" type="button" onClick={onClose}>Close</button>
        </div>
        <div className="modal-body" onMouseDown={(event) => event.stopPropagation()}>
          {children}
        </div>
      </div>
    </div>
  );
}
