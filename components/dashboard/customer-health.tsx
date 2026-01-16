'use client';

import { motion } from 'framer-motion';
import {
  AlertTriangle,
  TrendingDown,
  Clock,
  CreditCard,
  Users,
  ChevronRight,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface AtRiskCustomer {
  id: string;
  email: string;
  mrr: number;
  riskReason: 'past_due' | 'usage_drop' | 'downgrade_intent' | 'failed_payment';
  riskScore: number; // 0-100
  daysSinceIssue: number;
}

interface CustomerHealthProps {
  atRiskCustomers: AtRiskCustomer[];
  healthScore: number; // 0-100
  churnRate: number;
  failedPaymentRate: number;
  isLoading?: boolean;
}

const riskReasonLabels: Record<string, { label: string; color: string }> = {
  past_due: { label: 'Past Due', color: 'text-red-600 dark:text-red-400' },
  usage_drop: { label: 'Low Usage', color: 'text-orange-600 dark:text-orange-400' },
  downgrade_intent: { label: 'May Downgrade', color: 'text-amber-600 dark:text-amber-400' },
  failed_payment: { label: 'Payment Failed', color: 'text-red-600 dark:text-red-400' },
};

function HealthScoreRing({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 36;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  
  const getColor = () => {
    if (score >= 80) return 'text-emerald-500';
    if (score >= 60) return 'text-amber-500';
    return 'text-red-500';
  };

  return (
    <div className="relative w-24 h-24">
      <svg className="w-24 h-24 transform -rotate-90">
        {/* Background circle */}
        <circle
          cx="48"
          cy="48"
          r="36"
          stroke="currentColor"
          strokeWidth="8"
          fill="transparent"
          className="text-muted/30"
        />
        {/* Progress circle */}
        <circle
          cx="48"
          cy="48"
          r="36"
          stroke="currentColor"
          strokeWidth="8"
          fill="transparent"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={cn('transition-all duration-1000', getColor())}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('text-2xl font-bold', getColor())}>{score}</span>
        <span className="text-xs text-muted-foreground">Health</span>
      </div>
    </div>
  );
}

export function CustomerHealth({
  atRiskCustomers,
  healthScore,
  churnRate,
  failedPaymentRate,
  isLoading,
}: CustomerHealthProps) {
  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-xl border border-border bg-card p-6"
      >
        <div className="flex items-center gap-2 mb-6">
          <div className="h-5 w-5 rounded bg-muted animate-pulse" />
          <div className="h-5 w-32 rounded bg-muted animate-pulse" />
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="h-24 w-24 rounded-full bg-muted animate-pulse" />
        </div>
      </motion.div>
    );
  }

  const totalAtRiskMrr = atRiskCustomers.reduce((sum, c) => sum + c.mrr, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.25 }}
      className="rounded-xl border border-border bg-card p-6"
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-primary/10 p-2">
            <Users className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Customer Health</h3>
            <p className="text-xs text-muted-foreground">
              {atRiskCustomers.length} at-risk customers
            </p>
          </div>
        </div>
      </div>

      {/* Health Score and Stats */}
      <div className="flex items-center gap-6 mb-6">
        <HealthScoreRing score={healthScore} />
        
        <div className="flex-1 grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-muted/30 p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <TrendingDown className="h-3 w-3" />
              Churn Rate
            </div>
            <p className="text-lg font-bold">{churnRate.toFixed(1)}%</p>
          </div>
          <div className="rounded-lg bg-muted/30 p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <CreditCard className="h-3 w-3" />
              Failed Payments
            </div>
            <p className="text-lg font-bold">{failedPaymentRate.toFixed(1)}%</p>
          </div>
        </div>
      </div>

      {/* At Risk Summary */}
      {atRiskCustomers.length > 0 && (
        <div className="border-t border-border pt-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              At-Risk Revenue
            </span>
            <span className="text-sm font-bold text-red-600 dark:text-red-400">
              {formatCurrency(totalAtRiskMrr)}/mo
            </span>
          </div>

          <div className="space-y-2">
            {atRiskCustomers.slice(0, 4).map((customer) => {
              const reason = riskReasonLabels[customer.riskReason];
              return (
                <div
                  key={customer.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {customer.email}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={cn('text-xs', reason.color)}>
                        {reason.label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        · {customer.daysSinceIssue}d ago
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">
                      {formatCurrency(customer.mrr)}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              );
            })}
          </div>

          {atRiskCustomers.length > 4 && (
            <button className="mt-3 text-xs text-primary hover:underline w-full text-center">
              View all {atRiskCustomers.length} at-risk customers
            </button>
          )}
        </div>
      )}

      {atRiskCustomers.length === 0 && (
        <div className="border-t border-border pt-4 text-center text-sm text-muted-foreground">
          <span className="text-emerald-600 dark:text-emerald-400">✓</span> No customers at risk
        </div>
      )}
    </motion.div>
  );
}

