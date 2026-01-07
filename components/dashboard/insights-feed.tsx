'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { 
  UserMinus, 
  Tag, 
  TrendingUp, 
  Rocket, 
  Zap, 
  AlertTriangle,
  X,
  Clock
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getRelativeTime } from '@/lib/utils';

interface Insight {
  id: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  generatedAt: string;
  confidence: number;
}

interface InsightsFeedProps {
  insights: Insight[];
  onDismiss: (id: string) => void;
  isLoading?: boolean;
}

const categoryIcons: Record<string, typeof UserMinus> = {
  CHURN: UserMinus,
  PRICING: Tag,
  REVENUE: TrendingUp,
  GROWTH: Rocket,
  EFFICIENCY: Zap,
  ANOMALY: AlertTriangle,
};

const severityVariants: Record<string, 'critical' | 'high' | 'medium' | 'low'> = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
};

export function InsightsFeed({ insights, onDismiss, isLoading }: InsightsFeedProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl border border-border bg-card p-5"
          >
            <div className="flex gap-4">
              <div className="h-10 w-10 rounded-lg bg-muted" />
              <div className="flex-1 space-y-3">
                <div className="h-4 w-3/4 rounded bg-muted" />
                <div className="h-3 w-full rounded bg-muted" />
                <div className="h-3 w-2/3 rounded bg-muted" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (insights.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
        <div className="rounded-full bg-primary/10 p-3">
          <Zap className="h-6 w-6 text-primary" />
        </div>
        <h3 className="mt-4 font-semibold">No insights yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect your Stripe account and sync data to generate AI insights.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <AnimatePresence mode="popLayout">
        {insights.map((insight, index) => {
          const Icon = categoryIcons[insight.category] || AlertTriangle;
          const severityVariant = severityVariants[insight.severity] || 'medium';

          return (
            <motion.div
              key={insight.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className="group relative overflow-hidden rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:shadow-md hover:border-primary/20"
            >
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="rounded-lg bg-primary/10 p-2.5">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-sm">{insight.title}</h4>
                      <Badge variant={severityVariant} className="text-[10px]">
                        {insight.severity}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => onDismiss(insight.id)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {insight.description}
                  </p>
                  
                  <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {getRelativeTime(insight.generatedAt)}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="opacity-50">•</span>
                      {Math.round(insight.confidence * 100)}% confidence
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}


