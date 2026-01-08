'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type DateRange = '7d' | '30d' | '60d' | '90d' | 'ytd' | 'all';

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

const ranges: { value: DateRange; label: string; days?: number }[] = [
  { value: '7d', label: 'Last 7 days', days: 7 },
  { value: '30d', label: 'Last 30 days', days: 30 },
  { value: '60d', label: 'Last 60 days', days: 60 },
  { value: '90d', label: 'Last 90 days', days: 90 },
  { value: 'ytd', label: 'Year to date' },
  { value: 'all', label: 'All time' },
];

export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const selectedRange = ranges.find(r => r.value === value) || ranges[1];

  return (
    <div className={cn('relative', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg border border-border',
          'bg-card hover:bg-muted/50 transition-colors',
          'text-sm font-medium',
          isOpen && 'ring-2 ring-ring ring-offset-2 ring-offset-background'
        )}
      >
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <span>{selectedRange.label}</span>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            
            {/* Dropdown */}
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className={cn(
                'absolute right-0 top-full mt-2 z-50',
                'min-w-[180px] rounded-lg border border-border bg-card shadow-lg',
                'overflow-hidden'
              )}
            >
              <div className="py-1">
                {ranges.map((range) => (
                  <button
                    key={range.value}
                    onClick={() => {
                      onChange(range.value);
                      setIsOpen(false);
                    }}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 text-sm',
                      'hover:bg-muted/50 transition-colors',
                      value === range.value && 'bg-primary/10 text-primary'
                    )}
                  >
                    <span>{range.label}</span>
                    {value === range.value && (
                      <Check className="h-4 w-4" />
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export function getDaysFromRange(range: DateRange): number {
  switch (range) {
    case '7d':
      return 7;
    case '30d':
      return 30;
    case '60d':
      return 60;
    case '90d':
      return 90;
    case 'ytd':
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      return Math.ceil((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
    case 'all':
      return 365; // Default to 1 year for "all time"
    default:
      return 30;
  }
}

