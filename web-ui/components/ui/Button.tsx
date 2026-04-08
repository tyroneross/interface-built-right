import React from 'react';

export type ButtonVariant = 'primary' | 'glass' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

/**
 * Aurora Deep Button
 * Primary: indigo gradient CTA with glow hover
 * Glass: translucent surface button
 * Ghost: transparent text button
 * Destructive: rose text, transparent bg
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
    const base =
      'inline-flex items-center justify-center gap-1.5 font-medium rounded-xl cursor-pointer transition-all duration-200 outline-none';

    const variants: Record<ButtonVariant, string> = {
      primary: [
        'text-white border-none',
        'bg-gradient-to-br from-[#818cf8] to-[#6366f1]',
        'hover:shadow-[0_4px_20px_rgba(99,102,241,0.4)] hover:-translate-y-px',
        'disabled:text-[#5a5a72] disabled:from-[rgba(255,255,255,0.03)] disabled:to-[rgba(255,255,255,0.03)] disabled:shadow-none disabled:translate-y-0',
      ].join(' '),
      glass: [
        'text-[#9d9db5] bg-[rgba(255,255,255,0.03)]',
        'border border-[rgba(255,255,255,0.06)]',
        'hover:bg-[rgba(255,255,255,0.05)] hover:text-[#f0f0f5]',
        'disabled:text-[#5a5a72] disabled:bg-[rgba(255,255,255,0.02)]',
      ].join(' '),
      ghost: [
        'text-[#5a5a72] bg-transparent border-none',
        'hover:text-[#9d9db5] hover:bg-[rgba(255,255,255,0.025)]',
        'disabled:text-[#3a3a4a]',
      ].join(' '),
      destructive: [
        'text-[#fb7185] bg-transparent border-none',
        'hover:bg-[rgba(251,113,133,0.08)]',
        'disabled:text-[#5a5a72]',
      ].join(' '),
    };

    const sizes: Record<ButtonSize, string> = {
      sm: 'h-9 px-3 text-xs min-w-[44px]',
      md: 'h-9 px-4 text-[13px] min-w-[44px]',
      lg: 'h-11 px-5 text-sm min-w-[44px]',
      icon: 'h-9 w-9 p-0 min-w-[36px]',
    };

    const classes = [
      base,
      variants[variant],
      sizes[size],
      disabled || loading ? 'cursor-not-allowed' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ');

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
