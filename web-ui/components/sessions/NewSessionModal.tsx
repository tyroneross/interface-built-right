'use client';

import { useState, useEffect } from 'react';

interface Viewport {
  name: string;
  width: number;
  height: number;
}

interface NewSessionFormData {
  url?: string;  // Optional - can create session with just name
  name: string;
  viewport: string;
}

interface NewSessionModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: NewSessionFormData) => void | Promise<void>;
  isLoading?: boolean;
}

const VIEWPORTS: Viewport[] = [
  { name: 'Desktop', width: 1920, height: 1080 },
  { name: 'Tablet', width: 768, height: 1024 },
  { name: 'Mobile', width: 375, height: 667 },
];

export function NewSessionModal({ open, onClose, onSubmit, isLoading = false }: NewSessionModalProps) {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [viewport, setViewport] = useState('desktop');

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setUrl('');
      setName('');
      setViewport('desktop');
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Name is required, URL is optional
    if (!name.trim()) return;

    await onSubmit({
      url: url.trim() || undefined,
      name: name.trim(),
      viewport,
    });
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={handleOverlayClick}
    >
      <div className="bg-white rounded-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">New Session</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Close modal"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l8 8M14 6l-8 8" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit}>
          <div className="px-4 py-4 space-y-4">
            {/* Session Name Field - Required */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1.5">
                Session Name <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., header-update"
                required
                className="w-full h-11 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-400"
              />
            </div>

            {/* URL Field - Optional */}
            <div>
              <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-1.5">
                URL <span className="text-gray-400 text-xs font-normal">(optional)</span>
              </label>
              <input
                id="url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="http://localhost:3000/dashboard"
                className="w-full h-11 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-400"
              />
              <p className="text-xs text-gray-400 mt-1">
                Leave empty to create a session without capturing
              </p>
            </div>

            {/* Viewport Dropdown */}
            <div>
              <label htmlFor="viewport" className="block text-sm font-medium text-gray-700 mb-1.5">
                Viewport
              </label>
              <select
                id="viewport"
                value={viewport}
                onChange={(e) => setViewport(e.target.value)}
                className="w-full h-11 px-3 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-gray-400"
              >
                {VIEWPORTS.map((vp) => (
                  <option key={vp.name.toLowerCase()} value={vp.name.toLowerCase()}>
                    {vp.name} ({vp.width}×{vp.height})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-4 py-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="min-w-20 h-9 px-4 rounded-lg text-sm font-medium bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isLoading}
              className="min-w-20 h-9 px-4 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-700 transition-colors disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg
                    width="16"
                    height="16"
                    className="animate-spin"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="8" cy="8" r="6" strokeDasharray="10 30" />
                  </svg>
                  {url.trim() ? 'Capturing...' : 'Creating...'}
                </>
              ) : (
                <>
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="10" height="10" rx="1" />
                    <path d="M7 3v10" />
                  </svg>
                  {url.trim() ? 'Capture Baseline' : 'Create Session'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
