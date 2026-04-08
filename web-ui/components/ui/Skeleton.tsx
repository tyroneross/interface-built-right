import React from 'react';

export type SkeletonVariant = 'text' | 'thumbnail' | 'block';

export interface SkeletonProps {
  variant?: SkeletonVariant;
  width?: string | number;
  height?: string | number;
  className?: string;
}

/**
 * Aurora Deep Skeleton — dark shimmer animation.
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'text',
  width,
  height,
  className = '',
}) => {
  const baseClasses = 'animate-shimmer rounded';

  const variantClasses: Record<SkeletonVariant, string> = {
    text: 'h-3.5 mb-2 last:w-3/5',
    thumbnail: 'w-12 h-9 flex-shrink-0',
    block: 'w-full',
  };

  const inlineStyles: React.CSSProperties = {};
  if (width) inlineStyles.width = typeof width === 'number' ? `${width}px` : width;
  if (height) inlineStyles.height = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={inlineStyles}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
};

export const SkeletonListItem: React.FC = () => (
  <div className="flex gap-2.5 p-2 rounded-lg">
    <div className="flex-1 min-w-0">
      <Skeleton variant="text" width="80%" />
      <Skeleton variant="text" width="40%" />
    </div>
  </div>
);
