import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

/**
 * Button component following Calm Precision guidelines:
 * - Size matches user intent weight (Fitts' Law)
 * - Touch targets >= 44px on mobile
 * - Clear visual hierarchy through color and weight
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled = false,
      icon,
      children,
      className = '',
      ...props
    },
    ref
  ) => {
    // Base classes - 8pt grid spacing, accessible touch targets
    const baseClasses = 'inline-flex items-center justify-center gap-1.5 font-medium rounded-lg border-none cursor-pointer transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed';

    // Variant classes - text color only for status (Calm Precision)
    const variantClasses: Record<ButtonVariant, string> = {
      primary: 'bg-gray-900 text-white hover:bg-gray-700 active:bg-gray-800',
      secondary: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300',
      ghost: 'bg-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900',
      danger: 'bg-transparent text-red-600 hover:bg-red-50'
    };

    // Size classes - minimum 44px height for mobile touch targets
    const sizeClasses: Record<ButtonSize, string> = {
      sm: 'h-9 px-3 text-xs min-w-[44px]', // 36px height, min-width ensures touch target
      md: 'h-9 px-4 text-sm min-w-[44px]', // 36px height for desktop
      lg: 'h-11 px-4 text-sm min-w-[44px]'  // 44px height - full mobile compliance
    };

    // Icon-only button (square with min touch target)
    const iconOnlyClasses = !children && icon ? 'w-9 p-0 min-w-[44px]' : '';

    const classes = [
      baseClasses,
      variantClasses[variant],
      iconOnlyClasses || sizeClasses[size],
      className
    ].join(' ');

    return (
      <button
        ref={ref}
        className={classes}
        disabled={disabled || loading}
        aria-busy={loading}
        {...props}
      >
        {loading ? (
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-label="Loading"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          icon
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
