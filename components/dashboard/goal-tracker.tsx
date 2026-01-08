'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Target, TrendingUp, Calendar, Trophy, AlertCircle, Edit2, Check, X } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface GoalTrackerProps {
  currentMrr: number;
  targetMrr?: number;
  periodStart?: Date;
  periodEnd?: Date;
  onTargetChange?: (target: number) => void;
  isLoading?: boolean;
}

export function GoalTracker({
  currentMrr,
  targetMrr = 0,
  periodStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  periodEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
  onTargetChange,
  isLoading,
}: GoalTrackerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [localTarget, setLocalTarget] = useState(targetMrr);

  const effectiveTarget = localTarget || targetMrr;

  const progress = useMemo(() => {
    if (effectiveTarget <= 0) return 0;
    return Math.min(100, (currentMrr / effectiveTarget) * 100);
  }, [currentMrr, effectiveTarget]);

  const daysRemaining = useMemo(() => {
    const now = new Date();
    const end = new Date(periodEnd);
    const diff = end.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [periodEnd]);

  const daysPassed = useMemo(() => {
    const now = new Date();
    const start = new Date(periodStart);
    const diff = now.getTime() - start.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [periodStart]);

  const totalDays = useMemo(() => {
    const start = new Date(periodStart);
    const end = new Date(periodEnd);
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }, [periodStart, periodEnd]);

  const expectedProgress = useMemo(() => {
    if (totalDays <= 0) return 0;
    return (daysPassed / totalDays) * 100;
  }, [daysPassed, totalDays]);

  const pace = useMemo(() => {
    if (expectedProgress <= 0) return 'on_track';
    const ratio = progress / expectedProgress;
    if (ratio >= 1.1) return 'ahead';
    if (ratio >= 0.9) return 'on_track';
    return 'behind';
  }, [progress, expectedProgress]);

  const neededDaily = useMemo(() => {
    if (daysRemaining <= 0 || effectiveTarget <= currentMrr) return 0;
    return (effectiveTarget - currentMrr) / daysRemaining;
  }, [currentMrr, effectiveTarget, daysRemaining]);

  const handleSaveTarget = () => {
    const value = parseFloat(editValue) * 100; // Convert dollars to cents
    if (!isNaN(value) && value > 0) {
      setLocalTarget(value);
      onTargetChange?.(value);
    }
    setIsEditing(false);
    setEditValue('');
  };

  const handleStartEdit = () => {
    setEditValue(((effectiveTarget || currentMrr * 1.1) / 100).toFixed(0));
    setIsEditing(true);
  };

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-xl border border-border bg-card p-6"
      >
        <div className="flex items-center gap-2 mb-6">
          <div className="h-5 w-5 rounded bg-muted animate-pulse" />
          <div className="h-5 w-24 rounded bg-muted animate-pulse" />
        </div>
        <div className="h-4 w-full rounded-full bg-muted animate-pulse mb-4" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      </motion.div>
    );
  }

  const paceConfig = {
    ahead: {
      label: 'Ahead of pace',
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      icon: Trophy,
    },
    on_track: {
      label: 'On track',
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-500/10',
      icon: TrendingUp,
    },
    behind: {
      label: 'Behind pace',
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-500/10',
      icon: AlertCircle,
    },
  };

  const currentPace = paceConfig[pace];
  const PaceIcon = currentPace.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-xl border border-border bg-card p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-amber-500/10 p-2">
            <Target className="h-4 w-4 text-amber-500" />
          </div>
          <div>
            <h3 className="font-semibold">MRR Goal</h3>
            <p className="text-xs text-muted-foreground">
              {new Date(periodStart).toLocaleDateString('en-US', { month: 'short' })} target
            </p>
          </div>
        </div>
        
        {effectiveTarget > 0 && (
          <div className={cn('flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium', currentPace.bgColor, currentPace.color)}>
            <PaceIcon className="h-3 w-3" />
            {currentPace.label}
          </div>
        )}
      </div>

      {/* Target display/edit */}
      <div className="flex items-center justify-between mb-4">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <span className="text-lg text-muted-foreground">$</span>
            <input
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-32 text-2xl font-bold bg-transparent border-b-2 border-primary focus:outline-none"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveTarget();
                if (e.key === 'Escape') setIsEditing(false);
              }}
            />
            <button
              onClick={handleSaveTarget}
              className="p-1 rounded hover:bg-muted/50 text-emerald-600"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="p-1 rounded hover:bg-muted/50 text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">
              {effectiveTarget > 0 ? formatCurrency(effectiveTarget) : 'Set target'}
            </span>
            <button
              onClick={handleStartEdit}
              className="p-1 rounded hover:bg-muted/50 text-muted-foreground"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <span className="text-sm text-muted-foreground">
          {daysRemaining} days left
        </span>
      </div>

      {/* Progress bar */}
      <div className="relative h-4 bg-muted/30 rounded-full overflow-hidden mb-4">
        {/* Expected progress marker */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-muted-foreground/50 z-10"
          style={{ left: `${Math.min(100, expectedProgress)}%` }}
        />
        
        {/* Actual progress */}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className={cn(
            'absolute top-0 left-0 h-full rounded-full',
            progress >= 100 ? 'bg-emerald-500' :
            pace === 'ahead' ? 'bg-emerald-500' :
            pace === 'on_track' ? 'bg-primary' :
            'bg-amber-500'
          )}
        />

        {/* Progress percentage label */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-semibold text-white mix-blend-difference">
            {progress.toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-muted/30 p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Current</p>
          <p className="text-sm font-bold">{formatCurrency(currentMrr)}</p>
        </div>
        <div className="rounded-lg bg-muted/30 p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Remaining</p>
          <p className="text-sm font-bold">
            {effectiveTarget > currentMrr 
              ? formatCurrency(effectiveTarget - currentMrr)
              : '✓ Complete!'
            }
          </p>
        </div>
        <div className="rounded-lg bg-muted/30 p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Need/day</p>
          <p className="text-sm font-bold">
            {neededDaily > 0 ? formatCurrency(neededDaily) : '—'}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

