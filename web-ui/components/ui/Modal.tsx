'use client';

import React, { useEffect } from 'react';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}

/**
 * Aurora Deep Modal — glass surface, dark overlay, max-w-sm default.
 */
export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  children,
  footer,
  maxWidth = 'max-w-sm',
}) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose();
    };
    if (open) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className={`${maxWidth} w-full mx-4 max-h-[90vh] flex flex-col rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#0c0c1d] backdrop-blur-xl`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(255,255,255,0.06)]">
          <h2
            id="modal-title"
            className="text-lg font-semibold text-[#f0f0f5]"
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-[#5a5a72] hover:text-[#9d9db5] hover:bg-[rgba(255,255,255,0.025)] transition-colors duration-200"
            aria-label="Close modal"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l8 8M14 6l-8 8" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 overflow-y-auto">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[rgba(255,255,255,0.06)]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
