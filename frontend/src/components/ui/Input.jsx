import React from 'react';
import { cn } from '../../lib/utils';

export const Input = React.forwardRef(({ className, type = 'text', ...props }, ref) => (
  <input
    type={type}
    className={cn('input-base', className)}
    ref={ref}
    {...props}
  />
));

Input.displayName = 'Input';

export const Label = React.forwardRef(({ className, children, ...props }, ref) => (
  <label className={cn('label-base', className)} ref={ref} {...props}>
    {children}
  </label>
));

Label.displayName = 'Label';

export const Textarea = React.forwardRef(({ className, ...props }, ref) => (
  <textarea
    className={cn(
      'px-4 py-2.5 rounded-lg border border-neutral-300 bg-white text-neutral-900 text-sm placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 resize-vertical',
      className
    )}
    ref={ref}
    {...props}
  />
));

Textarea.displayName = 'Textarea';

export const FormGroup = ({ label, error, children, helperText }) => (
  <div className="mb-4">
    {label && <Label>{label}</Label>}
    {children}
    {error && <p className="mt-1.5 text-xs font-medium text-danger-600">{error}</p>}
    {helperText && !error && <p className="mt-1.5 text-xs text-neutral-500">{helperText}</p>}
  </div>
);
