import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: React.ReactNode;
}

const baseStyles = 'inline-flex items-center justify-center gap-2 rounded border-2 font-sans font-medium transition-colors duration-fast disabled:pointer-events-none disabled:border-hairline disabled:bg-transparent disabled:text-logwood-600';

const outlineStyles = 'border-strong bg-transparent text-fg hover:bg-raised';

const variantStyles = {
  primary: 'border-action bg-action text-action-fg hover:border-strong',
  secondary: outlineStyles,
  outline: outlineStyles,
  ghost: 'border-transparent bg-transparent text-fg hover:bg-raised',
  danger: 'border-alert bg-alert text-surface hover:border-strong',
};

const sizeStyles = {
  sm: 'min-h-control px-3 text-body-sm',
  md: 'min-h-control px-4 text-body-sm',
  lg: 'min-h-field px-6 text-body',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button type="button"
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2"></circle>
            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"></path>
          </svg>
          <span>Loading…</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
