'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  CreditCard,
  UserPlus,
  Trophy,
  X,
  Check,
  Settings,
} from 'lucide-react';
import { cn, getRelativeTime } from '@/lib/utils';

export type NotificationType = 
  | 'payment_failed'
  | 'churn_risk'
  | 'milestone'
  | 'new_enterprise'
  | 'revenue_spike'
  | 'revenue_drop'
  | 'goal_achieved';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
}

interface NotificationCenterProps {
  notifications: Notification[];
  onMarkAsRead?: (id: string) => void;
  onMarkAllRead?: () => void;
  onDismiss?: (id: string) => void;
}

const notificationConfig: Record<NotificationType, {
  icon: typeof Bell;
  color: string;
  bgColor: string;
}> = {
  payment_failed: {
    icon: CreditCard,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
  },
  churn_risk: {
    icon: AlertTriangle,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
  },
  milestone: {
    icon: Trophy,
    color: 'text-violet-600 dark:text-violet-400',
    bgColor: 'bg-violet-100 dark:bg-violet-900/30',
  },
  new_enterprise: {
    icon: UserPlus,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
  },
  revenue_spike: {
    icon: TrendingUp,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
  },
  revenue_drop: {
    icon: TrendingDown,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
  },
  goal_achieved: {
    icon: Trophy,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
  },
};

export function NotificationCenter({
  notifications,
  onMarkAsRead,
  onMarkAllRead,
  onDismiss,
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);

  const unreadCount = useMemo(
    () => notifications.filter(n => !n.read).length,
    [notifications]
  );

  const sortedNotifications = useMemo(
    () => [...notifications].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    ),
    [notifications]
  );

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'relative h-9 w-9 rounded-lg border border-border bg-card',
          'flex items-center justify-center',
          'hover:bg-muted/50 transition-colors',
          isOpen && 'ring-2 ring-ring ring-offset-2 ring-offset-background'
        )}
      >
        <Bell className="h-4 w-4 text-muted-foreground" />
        
        {/* Unread badge */}
        {unreadCount > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 rounded-full bg-red-500 flex items-center justify-center"
          >
            <span className="text-[10px] font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          </motion.div>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className={cn(
                'absolute right-0 top-full mt-2 z-50',
                'w-80 max-h-[400px] rounded-lg border border-border bg-card shadow-xl',
                'overflow-hidden flex flex-col'
              )}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h3 className="font-semibold">Notifications</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={onMarkAllRead}
                    className="text-xs text-primary hover:underline"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              {/* Notifications list */}
              <div className="flex-1 overflow-y-auto">
                {sortedNotifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="rounded-full bg-muted/50 p-3 w-fit mx-auto mb-3">
                      <Bell className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      No notifications yet
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {sortedNotifications.slice(0, 10).map((notification) => {
                      const config = notificationConfig[notification.type];
                      const Icon = config.icon;

                      return (
                        <motion.div
                          key={notification.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className={cn(
                            'px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer group',
                            !notification.read && 'bg-primary/5'
                          )}
                          onClick={() => {
                            if (!notification.read) {
                              onMarkAsRead?.(notification.id);
                            }
                          }}
                        >
                          <div className="flex gap-3">
                            <div className={cn('flex-shrink-0 rounded-full p-2', config.bgColor)}>
                              <Icon className={cn('h-4 w-4', config.color)} />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <p className={cn(
                                  'text-sm truncate',
                                  !notification.read && 'font-semibold'
                                )}>
                                  {notification.title}
                                </p>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDismiss?.(notification.id);
                                  }}
                                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded transition-all"
                                >
                                  <X className="h-3 w-3 text-muted-foreground" />
                                </button>
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                {notification.message}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {getRelativeTime(notification.timestamp)}
                              </p>
                            </div>
                            
                            {!notification.read && (
                              <div className="flex-shrink-0 w-2 h-2 rounded-full bg-primary mt-2" />
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              {sortedNotifications.length > 0 && (
                <div className="px-4 py-2 border-t border-border">
                  <button className="text-xs text-primary hover:underline w-full text-center">
                    View all notifications
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// Generate sample notifications for demo
export function generateSampleNotifications(): Notification[] {
  const now = new Date();
  
  return [
    {
      id: '1',
      type: 'payment_failed',
      title: 'Payment failed',
      message: 'enterprise@acme.co failed to pay $299/mo. Retry scheduled.',
      timestamp: new Date(now.getTime() - 1000 * 60 * 15).toISOString(), // 15 min ago
      read: false,
    },
    {
      id: '2',
      type: 'new_enterprise',
      title: 'New Enterprise signup',
      message: 'bigcorp.com subscribed to Enterprise plan ($999/mo)',
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
      read: false,
    },
    {
      id: '3',
      type: 'milestone',
      title: 'Milestone reached!',
      message: 'You\'ve reached $10,000 MRR. Congratulations! 🎉',
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 5).toISOString(), // 5 hours ago
      read: true,
    },
    {
      id: '4',
      type: 'churn_risk',
      title: 'Churn risk detected',
      message: '3 customers showing signs of churn based on usage patterns.',
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
      read: true,
    },
    {
      id: '5',
      type: 'revenue_spike',
      title: 'Revenue spike',
      message: 'MRR increased 15% this week from upgrades.',
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 48).toISOString(), // 2 days ago
      read: true,
    },
  ];
}

