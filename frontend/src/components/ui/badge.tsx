import * as React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
}

export function Badge({
  className = '',
  variant = 'default',
  ...props
}: BadgeProps) {
  const baseClasses = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors';

  const variantClasses = {
    default: 'bg-primary text-primary-foreground',
    secondary: 'bg-secondary text-secondary-foreground',
    destructive: 'bg-destructive text-destructive-foreground',
    outline: 'border border-input text-foreground',
  };

  return (
    <span
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}
