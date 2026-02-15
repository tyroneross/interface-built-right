import React from 'react';

interface HeaderProps {
  onToggleLibrary: () => void;
  onNewSession: () => void;
  onUploadReference?: () => void;
  onFullScan?: () => void;
  onBuildBaseline?: () => void;
  scanning?: boolean;
  buildingBaseline?: boolean;
}

export function Header({
  onToggleLibrary,
  onNewSession,
  onUploadReference,
  onFullScan,
  onBuildBaseline,
  scanning,
  buildingBaseline,
}: HeaderProps) {
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
        {onBuildBaseline && (
          <button
            onClick={onBuildBaseline}
            disabled={buildingBaseline}
            className="inline-flex items-center justify-center gap-1.5 px-4 h-9 text-[13px] font-medium rounded-lg bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all duration-150 min-w-11 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {buildingBaseline ? (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
              </svg>
            )}
            {buildingBaseline ? 'Building...' : 'Build Baseline'}
          </button>
        )}
        {onFullScan && (
          <button
            onClick={onFullScan}
            disabled={scanning}
            className="inline-flex items-center justify-center gap-1.5 px-4 h-9 text-[13px] font-medium rounded-lg bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all duration-150 min-w-11 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {scanning ? (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            )}
            {scanning ? 'Scanning...' : 'Full Scan'}
          </button>
        )}
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
