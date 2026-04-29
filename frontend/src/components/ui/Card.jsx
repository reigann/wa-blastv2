import React from 'react';
import { cn } from '../../lib/utils';

export const Card = React.forwardRef(({ className, children, elevated = false, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'bg-white rounded-xl border border-neutral-200 overflow-hidden',
      elevated ? 'shadow-lg' : 'shadow-base',
      className
    )}
    {...props}
  >
    {children}
  </div>
));

Card.displayName = 'Card';

export const CardHeader = React.forwardRef(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('px-6 py-4 border-b border-neutral-200 bg-neutral-50', className)}
    {...props}
  >
    {children}
  </div>
));

CardHeader.displayName = 'CardHeader';

export const CardBody = React.forwardRef(({ className, children, ...props }, ref) => (
  <div ref={ref} className={cn('px-6 py-4', className)} {...props}>
    {children}
  </div>
));

CardBody.displayName = 'CardBody';

export const CardFooter = React.forwardRef(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('px-6 py-4 border-t border-neutral-200 bg-neutral-50', className)}
    {...props}
  >
    {children}
  </div>
));

CardFooter.displayName = 'CardFooter';
