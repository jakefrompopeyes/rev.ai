'use client';

import { motion } from 'framer-motion';
import { GitCompare } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ComparisonToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  className?: string;
}

export function ComparisonToggle({ enabled, onChange, className }: ComparisonToggleProps) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm font-medium',
        enabled
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border bg-card hover:bg-muted/50 text-muted-foreground',
        className
      )}
    >
      <GitCompare className="h-4 w-4" />
      <span>Compare</span>
      
      {/* Toggle indicator */}
      <div
        className={cn(
          'w-8 h-5 rounded-full p-0.5 transition-colors',
          enabled ? 'bg-primary' : 'bg-muted'
        )}
      >
        <motion.div
          animate={{ x: enabled ? 14 : 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="w-4 h-4 rounded-full bg-white shadow-sm"
        />
      </div>
    </button>
  );
}

