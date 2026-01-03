import React from 'react';

interface HeaderProps {
  onToggleLibrary: () => void;
  onNewSession: () => void;
  onUploadReference?: () => void;
}

export function Header({ onToggleLibrary, onNewSession, onUploadReference }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 px-4 flex items-center justify-between h-14 shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleLibrary}
          className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-all duration-150 min-w-11"
          aria-label="Toggle library"
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
        <span className="text-[15px] font-semibold text-gray-900">
          Interface Built Right
        </span>
      </div>
      <div className="flex items-center gap-2">
        {onUploadReference && (
          <button
            onClick={onUploadReference}
            className="inline-flex items-center justify-center gap-1.5 px-4 h-9 text-[13px] font-medium rounded-lg bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all duration-150 min-w-11"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            Upload Reference
          </button>
        )}
        <button
          onClick={onNewSession}
          className="inline-flex items-center justify-center gap-1.5 px-4 h-9 text-[13px] font-medium rounded-lg bg-gray-900 text-white hover:bg-gray-700 transition-all duration-150 min-w-11"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 4v8M4 8h8" />
          </svg>
          New Session
        </button>
        <button
          className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-all duration-150 min-w-11"
          aria-label="Settings"
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="10" cy="10" r="3" />
            <path d="M10 1v2M10 17v2M1 10h2M17 10h2M3 3l1.5 1.5M15.5 15.5L17 17M3 17l1.5-1.5M15.5 4.5L17 3" />
          </svg>
        </button>
      </div>
    </header>
  );
}
