'use client';

type FilterValue = 'all' | 'changed' | 'broken';

interface SessionFiltersProps {
  value: FilterValue;
  onChange: (value: FilterValue) => void;
}

export function SessionFilters({ value, onChange }: SessionFiltersProps) {
  const filters: { label: string; value: FilterValue }[] = [
    { label: 'All', value: 'all' },
    { label: 'Changed', value: 'changed' },
    { label: 'Broken', value: 'broken' },
  ];

  return (
    <div className="flex gap-1 px-3 py-2 border-b border-gray-100">
      {filters.map((filter) => (
        <button
          key={filter.value}
          onClick={() => onChange(filter.value)}
          className={`
            px-2.5 py-1 text-xs rounded-md border-none cursor-pointer transition-colors
            ${value === filter.value
              ? 'bg-gray-900 text-white'
              : 'bg-transparent text-gray-600 hover:bg-gray-100'
            }
          `}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}
