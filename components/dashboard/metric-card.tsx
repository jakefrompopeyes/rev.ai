'use client';

import { motion } from 'framer-motion';
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: string;
  change?: number;
  changeLabel?: string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  delay?: number;
}

export function MetricCard({
  title,
  value,
  change,
  changeLabel = 'vs last month',
  icon: Icon,
  trend,
  delay = 0,
}: MetricCardProps) {
  const getTrendColor = () => {
    if (!trend) return 'text-muted-foreground';
    if (trend === 'up') return 'text-emerald-600 dark:text-emerald-400';
    if (trend === 'down') return 'text-red-600 dark:text-red-400';
    return 'text-muted-foreground';
  };

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="group relative overflow-hidden rounded-xl border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:border-primary/20"
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      
      <div className="relative">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
          <div className="rounded-lg bg-primary/10 p-2">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        </div>
        
        <div className="mt-3">
          <span className="text-3xl font-bold tracking-tight">{value}</span>
        </div>
        
        {change !== undefined && (
          <div className="mt-3 flex items-center gap-1.5">
            <div className={cn('flex items-center gap-0.5', getTrendColor())}>
              <TrendIcon className="h-3.5 w-3.5" />
              <span className="text-sm font-medium">
                {change >= 0 ? '+' : ''}{change.toFixed(1)}%
              </span>
            </div>
            <span className="text-xs text-muted-foreground">{changeLabel}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}


