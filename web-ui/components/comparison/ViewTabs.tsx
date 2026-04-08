'use client';

export type ViewMode = 'split' | 'overlay' | 'diff';

interface ViewTabsProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}

const tabs: { mode: ViewMode; label: string }[] = [
  { mode: 'split', label: 'Split' },
  { mode: 'overlay', label: 'Overlay' },
  { mode: 'diff', label: 'Diff' },
];

/**
 * Aurora Deep underline text tabs (not pill toggles).
 */
export default function ViewTabs({ value, onChange }: ViewTabsProps) {
  return (
    <div className="flex gap-4">
      {tabs.map((tab) => (
        <button
          key={tab.mode}
          onClick={() => onChange(tab.mode)}
          className={`
            pb-1 text-[13px] font-medium border-b-2 transition-colors duration-200
            ${value === tab.mode
              ? 'text-[#818cf8] border-[#818cf8]'
              : 'text-[#5a5a72] border-transparent hover:text-[#9d9db5]'
            }
          `}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
