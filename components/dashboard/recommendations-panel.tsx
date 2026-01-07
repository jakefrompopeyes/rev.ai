'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { 
  Lightbulb, 
  ArrowRight, 
  Check,
  X,
  AlertCircle,
  DollarSign,
  Clock
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, getRiskColor } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface Recommendation {
  id: string;
  title: string;
  description: string;
  reasoning: string;
  riskLevel: string;
  estimatedImpact: number;
  impactTimeframe: string;
  priorityScore: number;
  status: string;
  implementedAt?: string;
}

interface RecommendationsPanelProps {
  recommendations: Recommendation[];
  onImplement: (id: string) => void;
  onDismiss: (id: string) => void;
  isLoading?: boolean;
}

export function RecommendationsPanel({
  recommendations,
  onImplement,
  onDismiss,
  isLoading,
}: RecommendationsPanelProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl border border-border bg-card p-5"
          >
            <div className="space-y-3">
              <div className="h-5 w-2/3 rounded bg-muted" />
              <div className="h-3 w-full rounded bg-muted" />
              <div className="h-3 w-4/5 rounded bg-muted" />
              <div className="flex gap-2 pt-2">
                <div className="h-8 w-24 rounded bg-muted" />
                <div className="h-8 w-24 rounded bg-muted" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (recommendations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
        <div className="rounded-full bg-primary/10 p-3">
          <Lightbulb className="h-6 w-6 text-primary" />
        </div>
        <h3 className="mt-4 font-semibold">No recommendations yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Recommendations will appear based on your insights.
        </p>
      </div>
    );
  }

  // Sort by priority score
  const sorted = [...recommendations].sort((a, b) => b.priorityScore - a.priorityScore);
  const pending = sorted.filter(r => r.status === 'PENDING');
  const implemented = sorted.filter(r => r.status === 'IMPLEMENTED');

  return (
    <div className="space-y-6">
      {pending.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            Action Items ({pending.length})
          </h3>
          <AnimatePresence mode="popLayout">
            {pending.map((rec, index) => (
              <RecommendationCard
                key={rec.id}
                recommendation={rec}
                index={index}
                onImplement={onImplement}
                onDismiss={onDismiss}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {implemented.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Check className="h-4 w-4" />
            Implemented ({implemented.length})
          </h3>
          <AnimatePresence mode="popLayout">
            {implemented.slice(0, 3).map((rec, index) => (
              <RecommendationCard
                key={rec.id}
                recommendation={rec}
                index={index}
                onImplement={onImplement}
                onDismiss={onDismiss}
                isImplemented
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function RecommendationCard({
  recommendation: rec,
  index,
  onImplement,
  onDismiss,
  isImplemented = false,
}: {
  recommendation: Recommendation;
  index: number;
  onImplement: (id: string) => void;
  onDismiss: (id: string) => void;
  isImplemented?: boolean;
}) {
  const [showReasoning, setShowReasoning] = React.useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className={cn(
        'group relative overflow-hidden rounded-xl border bg-card p-5 transition-all duration-200',
        isImplemented
          ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30'
          : 'border-border hover:shadow-md hover:border-primary/20'
      )}
    >
      {/* Priority indicator */}
      {!isImplemented && rec.priorityScore >= 80 && (
        <div className="absolute top-0 right-0 w-0 h-0 border-l-[40px] border-l-transparent border-t-[40px] border-t-primary/20">
          <span className="absolute -top-8 right-1 text-[10px] font-bold text-primary rotate-45">
            TOP
          </span>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-semibold text-sm pr-8">{rec.title}</h4>
          {isImplemented && (
            <Badge variant="success" className="flex-shrink-0">
              <Check className="h-3 w-3 mr-1" />
              Done
            </Badge>
          )}
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">
          {rec.description}
        </p>

        {showReasoning && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground"
          >
            <strong className="text-foreground">Why this matters:</strong>{' '}
            {rec.reasoning}
          </motion.div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <div className="flex items-center gap-1.5 text-sm">
            <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
            <span className="font-medium text-emerald-600">
              +{formatCurrency(rec.estimatedImpact)}
            </span>
            <span className="text-muted-foreground text-xs">
              / {rec.impactTimeframe}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-sm">
            <AlertCircle className={cn('h-3.5 w-3.5', getRiskColor(rec.riskLevel))} />
            <span className={cn('font-medium', getRiskColor(rec.riskLevel))}>
              {rec.riskLevel} risk
            </span>
          </div>

          <button
            onClick={() => setShowReasoning(!showReasoning)}
            className="text-xs text-primary hover:underline"
          >
            {showReasoning ? 'Hide' : 'Show'} reasoning
          </button>
        </div>

        {!isImplemented && (
          <div className="flex items-center gap-2 pt-2">
            <Button
              size="sm"
              onClick={() => onImplement(rec.id)}
              className="gap-1.5"
            >
              Mark Implemented
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDismiss(rec.id)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {isImplemented && rec.implementedAt && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
            <Clock className="h-3 w-3" />
            Implemented {new Date(rec.implementedAt).toLocaleDateString()}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Need to import React for useState
import React from 'react';


