import React from 'react';

export type BadgeVariant = 'match' | 'changed' | 'broken' | 'pending' | 'expected';

export interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

/**
 * Badge component following Calm Precision guidelines:
 * - Text color only for status (no background boxes)
 * - Clear semantic meaning through color
 * - Contrast ratios meet WCAG AA standards (4.5:1 minimum)
 */
export const Badge: React.FC<BadgeProps> = ({
  variant,
  children,
  className = ''
}) => {
  // Text color only per Calm Precision - no background boxes
  // Colors from design-3-updated.html status patterns
  const variantClasses: Record<BadgeVariant, string> = {
    match: 'text-green-600',      // Success state
    changed: 'text-amber-600',    // Warning/attention state
    broken: 'text-red-600',       // Error state
    pending: 'text-gray-500',     // Neutral/inactive state
    expected: 'text-blue-600'     // Info state
  };

  const classes = [
    'text-xs font-medium',
    variantClasses[variant],
    className
  ].join(' ');

  return (
    <span className={classes}>
      {children}
    </span>
  );
};
