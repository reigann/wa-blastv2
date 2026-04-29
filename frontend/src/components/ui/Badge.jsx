import React from 'react';
import { cn } from '../../lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

export const Badge = ({ className, variant = 'primary', children, ...props }) => {
  const variants = {
    primary: 'badge-primary',
    success: 'badge-success',
    warning: 'badge-warning',
    danger: 'badge-danger',
    neutral: 'bg-neutral-100 text-neutral-700',
  };

  return (
    <span className={cn('badge', variants[variant], className)} {...props}>
      {children}
    </span>
  );
};

export const StatCard = ({ icon: Icon, label, value, trend, trendValue, loading = false }) => (
  <div className="card p-6">
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <p className="text-sm font-medium text-neutral-600 mb-1">{label}</p>
        {loading ? (
          <div className="h-8 w-24 bg-neutral-200 rounded animate-pulse"></div>
        ) : (
          <>
            <p className="text-3xl font-bold text-neutral-900">{value}</p>
            {trendValue && (
              <div className={cn('flex items-center gap-1 mt-2', trend === 'up' ? 'text-success-600' : 'text-danger-600')}>
                {trend === 'up' ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                <span className="text-xs font-semibold">{trendValue}</span>
              </div>
            )}
          </>
        )}
      </div>
      {Icon && (
        <div className="p-3 rounded-lg bg-primary-100">
          <Icon className="w-6 h-6 text-primary-600" />
        </div>
      )}
    </div>
  </div>
);

export const ProgressBar = ({ value = 0, max = 100, variant = 'primary', label, showValue = false }) => {
  const percentage = (value / max) * 100;
  const variants = {
    primary: 'bg-primary-600',
    success: 'bg-success-600',
    warning: 'bg-warning-600',
    danger: 'bg-danger-600',
  };

  return (
    <div>
      {(label || showValue) && (
        <div className="flex items-center justify-between mb-2">
          {label && <span className="text-sm font-medium text-neutral-700">{label}</span>}
          {showValue && <span className="text-sm font-semibold text-neutral-900">{Math.round(percentage)}%</span>}
        </div>
      )}
      <div className="w-full h-2 rounded-full bg-neutral-200 overflow-hidden">
        <div className={cn('h-full transition-all duration-300', variants[variant])} style={{ width: `${percentage}%` }}></div>
      </div>
    </div>
  );
};
