'use client';

import { useEffect, useCallback } from 'react';

export interface ImageModalProps {
  imageUrl: string;
  label: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ImageModal({ imageUrl, label, isOpen, onClose }: ImageModalProps) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Header */}
      <div className="absolute left-0 right-0 top-0 flex items-center justify-between p-4">
        <span className="rounded-lg bg-black/50 px-3 py-1.5 text-sm font-medium text-white">
          {label}
        </span>
        <button
          onClick={onClose}
          className="rounded-lg bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Image container */}
      <div
        className="max-h-[90vh] max-w-[90vw] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={imageUrl}
          alt={label}
          className="rounded-lg shadow-2xl"
          style={{ maxHeight: '85vh', width: 'auto' }}
        />
      </div>

      {/* Instructions */}
      <div className="absolute bottom-4 left-0 right-0 text-center">
        <span className="rounded-lg bg-black/50 px-3 py-1.5 text-xs text-gray-300">
          Press ESC or click outside to close
        </span>
      </div>
    </div>
  );
}
