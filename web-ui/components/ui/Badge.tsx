import React from 'react';

export type BadgeVariant = 'match' | 'changed' | 'broken' | 'active' | 'pending' | 'expected';

export interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

/**
 * Aurora Deep Badge — text color only, no background.
 * Status communicated through color weight alone.
 */
const variantClasses: Record<BadgeVariant, string> = {
  match: 'text-[#34d399]',
  changed: 'text-[#fbbf24]',
  broken: 'text-[#fb7185]',
  active: 'text-[#818cf8]',
  pending: 'text-[#5a5a72]',
  expected: 'text-[#818cf8]',
};

export const Badge: React.FC<BadgeProps> = ({ variant, children, className = '' }) => (
  <span className={`text-xs font-medium ${variantClasses[variant]} ${className}`}>
    {children}
  </span>
);
