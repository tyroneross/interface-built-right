'use client';

import { useState, useEffect } from 'react';

interface SessionSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export function SessionSearch({ value, onChange }: SessionSearchProps) {
  const [localValue, setLocalValue] = useState(value);

  // Debounce search input (300ms as per Calm Precision)
  useEffect(() => {
    const timer = setTimeout(() => {
      onChange(localValue);
    }, 300);

    return () => clearTimeout(timer);
  }, [localValue, onChange]);

  // Sync with external changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  return (
    <div className="px-3 py-3 border-b border-gray-100">
      <div className="relative">
        <svg
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        >
          <circle cx="8" cy="8" r="6" />
          <path d="M12 12l3 3" />
        </svg>
        <input
          type="search"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          placeholder="Search pages..."
          className="w-full h-9 pl-9 pr-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-400"
        />
      </div>
    </div>
  );
}
