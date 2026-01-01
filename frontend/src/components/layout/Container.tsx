import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface ContainerProps {
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
}

const sizeClasses = {
  sm: 'max-w-container-sm',
  md: 'max-w-container-md',
  lg: 'max-w-container-lg',
  xl: 'max-w-container-xl',
  full: 'max-w-full',
};

/**
 * Container component for consistent max-width and padding
 *
 * @example
 * <Container size="xl">
 *   <h1>Page Content</h1>
 * </Container>
 */
export function Container({ children, size = 'xl', className }: ContainerProps) {
  return (
    <div className={cn(
      'mx-auto px-6 lg:px-10',
      sizeClasses[size],
      className
    )}>
      {children}
    </div>
  );
}

export default Container;
