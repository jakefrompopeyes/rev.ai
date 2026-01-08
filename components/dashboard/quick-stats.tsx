'use client';

import { motion } from 'framer-motion';
import {
  Zap,
  Target,
  TrendingUp,
  Shield,
  Clock,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';

interface QuickStat {
  id: string;
  label: string;
  value: string | number;
  change?: number;
  trend?: 'up' | 'down' | 'neutral';
  icon: typeof Zap;
  color: string;
}

interface QuickStatsProps {
  stats: QuickStat[];
  isLoading?: boolean;
}

const defaultStats: QuickStat[] = [
  {
    id: 'ltv',
    label: 'Avg LTV',
    value: '$2,340',
    change: 12.5,
    trend: 'up',
    icon: Target,
    color: 'text-violet-600 dark:text-violet-400',
  },
  {
    id: 'payback',
    label: 'CAC Payback',
    value: '4.2 mo',
    change: -8.3,
    trend: 'up', // Lower is better
    icon: Clock,
    color: 'text-blue-600 dark:text-blue-400',
  },
  {
    id: 'expansion',
    label: 'Expansion Rate',
    value: '18.5%',
    change: 3.2,
    trend: 'up',
    icon: TrendingUp,
    color: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    id: 'health',
    label: 'Health Score',
    value: '82/100',
    change: 5,
    trend: 'up',
    icon: Shield,
    color: 'text-primary',
  },
];

export function QuickStats({ stats = defaultStats, isLoading }: QuickStatsProps) {
  if (isLoading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="flex-shrink-0 rounded-lg border border-border bg-card p-3 min-w-[140px]"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="h-4 w-4 rounded bg-muted animate-pulse" />
              <div className="h-3 w-16 rounded bg-muted animate-pulse" />
            </div>
            <div className="h-6 w-20 rounded bg-muted animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <motion.div
            key={stat.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={cn(
              'flex-shrink-0 rounded-lg border border-border bg-card p-3',
              'min-w-[140px] hover:border-primary/30 transition-colors cursor-default'
            )}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <Icon className={cn('h-3.5 w-3.5', stat.color)} />
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold">{stat.value}</span>
              {stat.change !== undefined && (
                <span
                  className={cn(
                    'flex items-center text-xs font-medium',
                    stat.trend === 'up'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : stat.trend === 'down'
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-muted-foreground'
                  )}
                >
                  {stat.trend === 'up' ? (
                    <ArrowUp className="h-3 w-3" />
                  ) : stat.trend === 'down' ? (
                    <ArrowDown className="h-3 w-3" />
                  ) : null}
                  {Math.abs(stat.change)}%
                </span>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// Generate stats from metrics
export function generateQuickStats(metrics: {
  arpu?: number;
  netRevenueRetention?: number;
  grossChurnRate?: number;
  averageDiscount?: number;
}): QuickStat[] {
  return [
    {
      id: 'arpu',
      label: 'ARPU',
      value: metrics.arpu ? formatCurrency(metrics.arpu) : '$0',
      trend: 'neutral',
      icon: Target,
      color: 'text-violet-600 dark:text-violet-400',
    },
    {
      id: 'nrr',
      label: 'Net Retention',
      value: metrics.netRevenueRetention
        ? `${metrics.netRevenueRetention.toFixed(0)}%`
        : '100%',
      trend: (metrics.netRevenueRetention ?? 100) >= 100 ? 'up' : 'down',
      icon: TrendingUp,
      color: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      id: 'churn',
      label: 'Churn Rate',
      value: metrics.grossChurnRate
        ? `${metrics.grossChurnRate.toFixed(1)}%`
        : '0%',
      trend: (metrics.grossChurnRate ?? 0) <= 3 ? 'up' : 'down',
      icon: Shield,
      color: 'text-blue-600 dark:text-blue-400',
    },
    {
      id: 'discount',
      label: 'Avg Discount',
      value: metrics.averageDiscount
        ? `${metrics.averageDiscount.toFixed(0)}%`
        : '0%',
      trend: 'neutral',
      icon: Zap,
      color: 'text-amber-600 dark:text-amber-400',
    },
  ];
}

