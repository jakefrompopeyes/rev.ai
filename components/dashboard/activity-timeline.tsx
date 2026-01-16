'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  UserPlus,
  UserMinus,
  TrendingUp,
  TrendingDown,
  CreditCard,
  AlertCircle,
  RefreshCw,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { cn, getRelativeTime, formatCurrency } from '@/lib/utils';

export type ActivityType =
  | 'new_subscription'
  | 'cancellation'
  | 'upgrade'
  | 'downgrade'
  | 'payment_success'
  | 'payment_failed'
  | 'sync_complete'
  | 'milestone';

export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  description?: string;
  amount?: number;
  timestamp: string;
}

interface ActivityTimelineProps {
  activities: Activity[];
  isLoading?: boolean;
  maxItems?: number;
}

const activityConfig: Record<
  ActivityType,
  { icon: typeof UserPlus; color: string; bgColor: string }
> = {
  new_subscription: {
    icon: UserPlus,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
  },
  cancellation: {
    icon: UserMinus,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
  },
  upgrade: {
    icon: TrendingUp,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
  },
  downgrade: {
    icon: TrendingDown,
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
  },
  payment_success: {
    icon: CreditCard,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
  },
  payment_failed: {
    icon: AlertCircle,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
  },
  sync_complete: {
    icon: RefreshCw,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  milestone: {
    icon: CheckCircle,
    color: 'text-violet-600 dark:text-violet-400',
    bgColor: 'bg-violet-100 dark:bg-violet-900/30',
  },
};

export function ActivityTimeline({
  activities,
  isLoading,
  maxItems = 8,
}: ActivityTimelineProps) {
  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-xl border border-border bg-card p-6"
      >
        <div className="flex items-center gap-2 mb-6">
          <div className="h-5 w-5 rounded bg-muted animate-pulse" />
          <div className="h-5 w-28 rounded bg-muted animate-pulse" />
        </div>
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
                <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    );
  }

  if (activities.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center"
      >
        <div className="rounded-full bg-muted/50 p-3 w-fit mx-auto">
          <Clock className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="mt-4 font-semibold">No recent activity</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Activity will appear here as events occur.
        </p>
      </motion.div>
    );
  }

  const displayedActivities = activities.slice(0, maxItems);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="rounded-xl border border-border bg-card p-6"
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-primary/10 p-2">
            <Clock className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Recent Activity</h3>
            <p className="text-xs text-muted-foreground">
              {activities.length} events
            </p>
          </div>
        </div>
      </div>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

        <AnimatePresence mode="popLayout">
          <div className="space-y-4">
            {displayedActivities.map((activity, index) => {
              const config = activityConfig[activity.type];
              const Icon = config.icon;

              return (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.05 }}
                  className="relative flex gap-3 pl-1"
                >
                  {/* Icon */}
                  <div
                    className={cn(
                      'relative z-10 flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center',
                      config.bgColor
                    )}
                  >
                    <Icon className={cn('h-4 w-4', config.color)} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {activity.title}
                        </p>
                        {activity.description && (
                          <p className="text-xs text-muted-foreground truncate">
                            {activity.description}
                          </p>
                        )}
                      </div>
                      {activity.amount !== undefined && (
                        <span
                          className={cn(
                            'text-sm font-semibold flex-shrink-0',
                            activity.type === 'cancellation' ||
                              activity.type === 'downgrade' ||
                              activity.type === 'payment_failed'
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          )}
                        >
                          {activity.type === 'cancellation' ||
                          activity.type === 'downgrade'
                            ? '-'
                            : '+'}
                          {formatCurrency(activity.amount)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {getRelativeTime(activity.timestamp)}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </AnimatePresence>
      </div>

      {activities.length > maxItems && (
        <button className="mt-4 text-xs text-primary hover:underline">
          View all {activities.length} events
        </button>
      )}
    </motion.div>
  );
}


