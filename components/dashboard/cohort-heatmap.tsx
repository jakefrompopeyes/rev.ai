'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Grid3X3, Users, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CohortData {
  cohort: string; // e.g., "Jan 2024"
  startCount: number;
  months: number[]; // Retention percentages for each month [100, 85, 72, ...]
}

interface CohortHeatmapProps {
  data: CohortData[];
  isLoading?: boolean;
}

// Generate mock cohort data for demo
export function generateMockCohortData(): CohortData[] {
  const cohorts: CohortData[] = [];
  const now = new Date();
  
  for (let i = 5; i >= 0; i--) {
    const cohortDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const cohortName = cohortDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    
    // Generate retention curve with some randomness
    const months: number[] = [100];
    let retention = 100;
    const monthsAvailable = i + 1;
    
    for (let m = 1; m < monthsAvailable; m++) {
      // Natural decay with variance
      const decay = 0.08 + Math.random() * 0.08; // 8-16% monthly churn
      retention = Math.max(0, retention * (1 - decay));
      months.push(Math.round(retention));
    }
    
    cohorts.push({
      cohort: cohortName,
      startCount: Math.floor(50 + Math.random() * 100),
      months,
    });
  }
  
  return cohorts;
}

function getRetentionColor(value: number): string {
  if (value >= 90) return 'bg-emerald-500 dark:bg-emerald-600';
  if (value >= 80) return 'bg-emerald-400 dark:bg-emerald-500';
  if (value >= 70) return 'bg-teal-400 dark:bg-teal-500';
  if (value >= 60) return 'bg-cyan-400 dark:bg-cyan-500';
  if (value >= 50) return 'bg-blue-400 dark:bg-blue-500';
  if (value >= 40) return 'bg-violet-400 dark:bg-violet-500';
  if (value >= 30) return 'bg-purple-400 dark:bg-purple-500';
  if (value >= 20) return 'bg-pink-400 dark:bg-pink-500';
  return 'bg-red-400 dark:bg-red-500';
}

function getTextColor(value: number): string {
  return value >= 50 ? 'text-white' : 'text-white';
}

export function CohortHeatmap({ data, isLoading }: CohortHeatmapProps) {
  const maxMonths = useMemo(() => {
    return Math.max(...data.map(d => d.months.length), 6);
  }, [data]);

  const averageRetention = useMemo(() => {
    if (data.length === 0) return [];
    
    const avgByMonth: number[] = [];
    for (let m = 0; m < maxMonths; m++) {
      const values = data
        .filter(d => d.months[m] !== undefined)
        .map(d => d.months[m]);
      
      if (values.length > 0) {
        avgByMonth.push(Math.round(values.reduce((a, b) => a + b, 0) / values.length));
      }
    }
    return avgByMonth;
  }, [data, maxMonths]);

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-xl border border-border bg-card p-6"
      >
        <div className="flex items-center gap-2 mb-6">
          <div className="h-5 w-5 rounded bg-muted animate-pulse" />
          <div className="h-5 w-36 rounded bg-muted animate-pulse" />
        </div>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-2">
              <div className="h-8 w-16 rounded bg-muted animate-pulse" />
              {[...Array(6)].map((_, j) => (
                <div key={j} className="h-8 w-12 rounded bg-muted animate-pulse" />
              ))}
            </div>
          ))}
        </div>
      </motion.div>
    );
  }

  if (data.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center"
      >
        <div className="rounded-full bg-muted/50 p-3 w-fit mx-auto">
          <Grid3X3 className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="mt-4 font-semibold">No cohort data</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Need subscription history to generate cohort analysis.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-xl border border-border bg-card p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-cyan-500/10 p-2">
            <Grid3X3 className="h-4 w-4 text-cyan-500" />
          </div>
          <div>
            <h3 className="font-semibold">Cohort Retention</h3>
            <p className="text-xs text-muted-foreground">
              Monthly retention by signup cohort
            </p>
          </div>
        </div>
        
        {averageRetention[1] !== undefined && (
          <div className="text-xs text-muted-foreground">
            Avg M1 retention: <span className="font-semibold text-foreground">{averageRetention[1]}%</span>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="text-left font-medium text-muted-foreground pb-2 pr-2">Cohort</th>
              <th className="text-center font-medium text-muted-foreground pb-2 px-1">Size</th>
              {[...Array(maxMonths)].map((_, i) => (
                <th key={i} className="text-center font-medium text-muted-foreground pb-2 px-1">
                  M{i}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((cohort, rowIndex) => (
              <motion.tr
                key={cohort.cohort}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: rowIndex * 0.05 }}
              >
                <td className="font-medium py-1 pr-2 whitespace-nowrap">
                  {cohort.cohort}
                </td>
                <td className="text-center py-1 px-1">
                  <div className="flex items-center justify-center gap-1">
                    <Users className="h-3 w-3 text-muted-foreground" />
                    {cohort.startCount}
                  </div>
                </td>
                {[...Array(maxMonths)].map((_, monthIndex) => {
                  const value = cohort.months[monthIndex];
                  const hasValue = value !== undefined;
                  
                  return (
                    <td key={monthIndex} className="py-1 px-1">
                      {hasValue ? (
                        <div
                          className={cn(
                            'w-12 h-7 rounded flex items-center justify-center font-semibold transition-all hover:scale-105 cursor-default',
                            getRetentionColor(value),
                            getTextColor(value)
                          )}
                          title={`${cohort.cohort} - Month ${monthIndex}: ${value}% retention`}
                        >
                          {value}%
                        </div>
                      ) : (
                        <div className="w-12 h-7 rounded bg-muted/20" />
                      )}
                    </td>
                  );
                })}
              </motion.tr>
            ))}
            
            {/* Average row */}
            <tr className="border-t border-border">
              <td className="font-semibold py-2 pr-2">Average</td>
              <td className="py-2 px-1" />
              {averageRetention.map((value, i) => (
                <td key={i} className="py-2 px-1">
                  <div className="w-12 h-7 rounded bg-muted/50 flex items-center justify-center font-semibold">
                    {value}%
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-1 mt-4">
        <span className="text-xs text-muted-foreground mr-2">Retention:</span>
        <div className="flex items-center gap-0.5">
          {[90, 70, 50, 30, 10].map((value) => (
            <div
              key={value}
              className={cn('w-6 h-4 rounded', getRetentionColor(value))}
              title={`${value}%`}
            />
          ))}
        </div>
        <span className="text-xs text-muted-foreground ml-1">Low</span>
      </div>
    </motion.div>
  );
}

