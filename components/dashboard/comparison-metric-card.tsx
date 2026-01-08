'use client';

import { motion } from 'framer-motion';
import { ArrowUp, ArrowDown, Minus, LucideIcon } from 'lucide-react';
import { cn, formatCurrency, formatPercent } from '@/lib/utils';

interface ComparisonMetricCardProps {
  title: string;
  currentValue: number;
  previousValue: number;
  isCurrency?: boolean;
  isPercentage?: boolean;
  icon: LucideIcon;
  invertTrend?: boolean; // For metrics where lower is better (like churn)
  delay?: number;
}

export function ComparisonMetricCard({
  title,
  currentValue,
  previousValue,
  isCurrency = false,
  isPercentage = false,
  icon: Icon,
  invertTrend = false,
  delay = 0,
}: ComparisonMetricCardProps) {
  const change = previousValue !== 0 
    ? ((currentValue - previousValue) / previousValue) * 100 
    : 0;
  
  const isPositive = invertTrend ? change < 0 : change > 0;
  const isNeutral = Math.abs(change) < 0.5;

  const formatValue = (value: number) => {
    if (isCurrency) return formatCurrency(value);
    if (isPercentage) return `${value.toFixed(1)}%`;
    return value.toLocaleString();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="rounded-xl border border-border bg-card p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted-foreground">{title}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Current Period */}
        <div>
          <p className="text-xs text-muted-foreground mb-1">Current</p>
          <p className="text-xl font-bold">{formatValue(currentValue)}</p>
        </div>

        {/* Previous Period */}
        <div>
          <p className="text-xs text-muted-foreground mb-1">Previous</p>
          <p className="text-xl font-bold text-muted-foreground">{formatValue(previousValue)}</p>
        </div>
      </div>

      {/* Change indicator */}
      <div className="mt-3 pt-3 border-t border-border">
        <div
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
            isNeutral
              ? 'bg-muted text-muted-foreground'
              : isPositive
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'bg-red-500/10 text-red-600 dark:text-red-400'
          )}
        >
          {isNeutral ? (
            <Minus className="h-3 w-3" />
          ) : isPositive ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )}
          {Math.abs(change).toFixed(1)}% vs previous period
        </div>
      </div>
    </motion.div>
  );
}

