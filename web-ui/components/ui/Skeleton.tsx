import React from 'react';

export type SkeletonVariant = 'text' | 'thumbnail' | 'block';

export interface SkeletonProps {
  variant?: SkeletonVariant;
  width?: string | number;
  height?: string | number;
  className?: string;
}

/**
 * Skeleton component for loading states following Calm Precision guidelines:
 * - Shimmer animation (1.5s cycle per design spec)
 * - Matches final layout structure
 * - Subtle visual indication of loading
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'text',
  width,
  height,
  className = ''
}) => {
  // Base shimmer animation classes
  const baseClasses = 'animate-shimmer bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] rounded';

  // Variant-specific dimensions
  const variantClasses: Record<SkeletonVariant, string> = {
    text: 'h-3.5 mb-2 last:w-3/5',           // 14px height, 8px bottom margin
    thumbnail: 'w-12 h-9 flex-shrink-0',     // 48x36px per design spec
    block: 'w-full'                          // Full width block
  };

  // Build inline styles for custom dimensions
  const inlineStyles: React.CSSProperties = {};
  if (width) {
    inlineStyles.width = typeof width === 'number' ? `${width}px` : width;
  }
  if (height) {
    inlineStyles.height = typeof height === 'number' ? `${height}px` : height;
  }

  const classes = [
    baseClasses,
    variantClasses[variant],
    className
  ].join(' ');

  return (
    <div
      className={classes}
      style={inlineStyles}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
};

/**
 * Skeleton group for list items - matches three-line hierarchy pattern
 */
export const SkeletonListItem: React.FC = () => (
  <div className="flex gap-2.5 p-2 rounded-lg">
    <Skeleton variant="thumbnail" />
    <div className="flex-1 min-w-0">
      <Skeleton variant="text" width="80%" />
      <Skeleton variant="text" width="40%" />
    </div>
  </div>
);

/**
 * Skeleton card for larger content blocks
 */
export const SkeletonCard: React.FC<{ lines?: number }> = ({ lines = 3 }) => (
  <div className="p-4 rounded-lg border border-gray-200 bg-white">
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton key={i} variant="text" width={i === lines - 1 ? '60%' : '100%'} />
    ))}
  </div>
);
