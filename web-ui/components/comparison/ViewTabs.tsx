'use client';

export type ViewMode = 'split' | 'overlay' | 'diff';

interface ViewTabsProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export default function ViewTabs({ value, onChange }: ViewTabsProps) {
  const tabs: { mode: ViewMode; label: string }[] = [
    { mode: 'split', label: 'Split' },
    { mode: 'overlay', label: 'Overlay' },
    { mode: 'diff', label: 'Diff' },
  ];

  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-gray-200 bg-white">
      {tabs.map((tab, index) => (
        <button
          key={tab.mode}
          onClick={() => onChange(tab.mode)}
          className={`min-h-[40px] border-none px-4 py-2 text-sm transition-colors ${
            value === tab.mode
              ? 'bg-gray-900 text-white'
              : 'bg-transparent text-gray-600 hover:bg-gray-50'
          } ${index > 0 ? 'border-l border-gray-200' : ''}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
