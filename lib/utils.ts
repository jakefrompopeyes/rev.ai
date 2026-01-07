import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format cents to dollars with currency symbol
 */
export function formatCurrency(cents: number, currency: string = 'USD'): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(dollars);
}

/**
 * Format large numbers with abbreviations
 */
export function formatCompactNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

/**
 * Format percentage
 */
export function formatPercent(value: number, decimals: number = 1): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}

/**
 * Format percentage without sign
 */
export function formatPercentAbs(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Get relative time string
 */
export function getRelativeTime(date: Date | string): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return then.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Get color class for severity
 */
export function getSeverityColor(severity: string): string {
  switch (severity.toUpperCase()) {
    case 'CRITICAL':
      return 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950 dark:border-red-900';
    case 'HIGH':
      return 'text-orange-600 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-950 dark:border-orange-900';
    case 'MEDIUM':
      return 'text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-900';
    case 'LOW':
      return 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950 dark:border-emerald-900';
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200 dark:text-gray-400 dark:bg-gray-800 dark:border-gray-700';
  }
}

/**
 * Get color class for risk level
 */
export function getRiskColor(risk: string): string {
  switch (risk.toUpperCase()) {
    case 'HIGH':
      return 'text-red-600 dark:text-red-400';
    case 'MEDIUM':
      return 'text-amber-600 dark:text-amber-400';
    case 'LOW':
      return 'text-emerald-600 dark:text-emerald-400';
    default:
      return 'text-gray-600 dark:text-gray-400';
  }
}

/**
 * Get category icon name
 */
export function getCategoryIcon(category: string): string {
  switch (category.toUpperCase()) {
    case 'CHURN':
      return 'user-minus';
    case 'PRICING':
      return 'tag';
    case 'REVENUE':
      return 'trending-up';
    case 'GROWTH':
      return 'rocket';
    case 'EFFICIENCY':
      return 'zap';
    case 'ANOMALY':
      return 'alert-triangle';
    default:
      return 'info';
  }
}


