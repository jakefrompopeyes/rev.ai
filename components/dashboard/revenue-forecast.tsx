'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { 
  Brain, 
  TrendingUp, 
  TrendingDown,
  Sparkles, 
  RefreshCw,
  Target,
  AlertTriangle,
  Lightbulb,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

interface ChartDataPoint {
  date: string;
  actual?: number;
  forecast?: number;
  optimistic?: number;
  pessimistic?: number;
}

interface ForecastScenario {
  name: string;
  endMrr: number;
  growth: number;
  probability: number;
  color: string;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatDollars(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1000000) {
    return `$${(dollars / 1000000).toFixed(1)}M`;
  } else if (dollars >= 1000) {
    return `$${(dollars / 1000).toFixed(1)}k`;
  }
  return `$${dollars.toFixed(0)}`;
}

function formatAxisDollars(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1000000) {
    return `$${(dollars / 1000000).toFixed(0)}M`;
  } else if (dollars >= 1000) {
    return `$${Math.round(dollars / 1000)}k`;
  }
  return `$${Math.round(dollars)}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ============================================================================
// CUSTOM TOOLTIP
// ============================================================================

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  
  const data = payload[0]?.payload as ChartDataPoint;
  const isActual = data?.actual !== undefined;
  
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-xl border border-white/10 bg-zinc-900/95 backdrop-blur-md p-4 shadow-2xl"
    >
      <p className="text-xs font-medium text-zinc-400 mb-2">{formatDate(label)}</p>
      {isActual ? (
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-violet-500" />
          <span className="text-sm font-semibold text-white">{formatDollars(data.actual!)}</span>
          <span className="text-xs text-zinc-500">Actual MRR</span>
        </div>
      ) : data.forecast ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
            <span className="text-sm font-semibold text-white">{formatDollars(data.forecast)}</span>
            <span className="text-xs text-zinc-500">Forecast</span>
          </div>
          {data.optimistic && data.pessimistic && (
            <div className="flex items-center justify-between text-xs text-zinc-500 pt-1 border-t border-white/5">
              <span>Range</span>
              <span className="text-zinc-400">
                {formatDollars(data.pessimistic)} – {formatDollars(data.optimistic)}
              </span>
            </div>
          )}
        </div>
      ) : null}
    </motion.div>
  );
}

// ============================================================================
// SCENARIO CARD
// ============================================================================

function ScenarioCard({ 
  scenario, 
  isActive, 
  onClick 
}: { 
  scenario: ForecastScenario; 
  isActive: boolean;
  onClick: () => void;
}) {
  const styles: Record<string, { gradient: string; border: string; text: string; bar: string }> = {
    'Optimistic': {
      gradient: 'from-emerald-500/20 to-emerald-500/5',
      border: isActive ? 'border-emerald-400' : 'border-emerald-500/30',
      text: 'text-emerald-400',
      bar: 'bg-emerald-500',
    },
    'Base Case': {
      gradient: 'from-violet-500/20 to-violet-500/5',
      border: isActive ? 'border-violet-400' : 'border-violet-500/30',
      text: 'text-violet-400',
      bar: 'bg-violet-500',
    },
    'Conservative': {
      gradient: 'from-amber-500/20 to-amber-500/5',
      border: isActive ? 'border-amber-400' : 'border-amber-500/30',
      text: 'text-amber-400',
      bar: 'bg-amber-500',
    },
  };
  
  const style = styles[scenario.name] || styles['Base Case'];
  
  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "relative w-full text-left p-4 rounded-xl border transition-all duration-300",
        "bg-gradient-to-br",
        style.gradient,
        style.border,
        isActive && "ring-1 ring-white/20"
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <h4 className={cn("font-semibold text-sm", style.text)}>
          {scenario.name}
        </h4>
        <div className="text-right">
          <div className="text-lg font-bold text-white">{formatDollars(scenario.endMrr)}</div>
          <div className={cn(
            "text-xs font-medium flex items-center justify-end gap-0.5",
            scenario.growth >= 0 ? "text-emerald-400" : "text-red-400"
          )}>
            {scenario.growth >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {scenario.growth >= 0 ? '+' : ''}{scenario.growth.toFixed(1)}%
          </div>
        </div>
      </div>
      
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-500">Probability</span>
        <div className="flex items-center gap-2">
          <div className="w-12 h-1 bg-zinc-800 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${scenario.probability}%` }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className={cn("h-full rounded-full", style.bar)}
            />
          </div>
          <span className="text-zinc-400 w-8">{scenario.probability}%</span>
        </div>
      </div>
    </motion.button>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function RevenueForecast() {
  const [metrics, setMetrics] = useState<{ date: string; mrr: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeScenario, setActiveScenario] = useState<string>('Base Case');

  const fetchMetrics = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/metrics?view=history&days=90');
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
        return;
      }
      
      // Extract daily MRR from metrics history response
      if (data.history && data.history.length >= 7) {
        setMetrics(data.history.map((m: any) => ({
          date: m.date,
          mrr: m.mrr,
        })));
      } else {
        setError('Need at least 7 days of data for forecasting');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load metrics');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // Calculate forecast based on actual metrics
  const { chartData, scenarios, summary } = useMemo(() => {
    if (metrics.length < 7) {
      return { chartData: [], scenarios: [], summary: null };
    }

    // Calculate growth rate from last 30 days of data
    const last30 = metrics.slice(-30);
    const startMrr = last30[0]?.mrr || 0;
    const endMrr = last30[last30.length - 1]?.mrr || 0;
    const daysSpan = last30.length;
    const dailyGrowthRate = daysSpan > 1 ? Math.pow(endMrr / startMrr, 1 / daysSpan) - 1 : 0;
    const monthlyGrowthRate = Math.pow(1 + dailyGrowthRate, 30) - 1;

    // Build chart data with actuals
    const chartData: ChartDataPoint[] = metrics.slice(-30).map(m => ({
      date: m.date,
      actual: m.mrr,
    }));

    // Add 90 days of forecast
    const currentMrr = endMrr;
    const lastDate = new Date(metrics[metrics.length - 1].date);
    
    for (let i = 1; i <= 90; i += 7) { // Weekly points for 90 days
      const forecastDate = new Date(lastDate);
      forecastDate.setDate(forecastDate.getDate() + i);
      
      const progress = i / 90;
      const baseGrowth = Math.pow(1 + dailyGrowthRate, i);
      const optimisticGrowth = Math.pow(1 + dailyGrowthRate * 1.5, i);
      const pessimisticGrowth = Math.pow(1 + dailyGrowthRate * 0.5, i);
      
      chartData.push({
        date: forecastDate.toISOString().split('T')[0],
        forecast: Math.round(currentMrr * baseGrowth),
        optimistic: Math.round(currentMrr * optimisticGrowth),
        pessimistic: Math.round(currentMrr * pessimisticGrowth),
      });
    }

    // Calculate scenarios (3 months = ~90 days)
    const projectedBase = Math.round(currentMrr * Math.pow(1 + dailyGrowthRate, 90));
    const projectedOptimistic = Math.round(currentMrr * Math.pow(1 + dailyGrowthRate * 1.5, 90));
    const projectedConservative = Math.round(currentMrr * Math.pow(1 + dailyGrowthRate * 0.5, 90));

    const scenarios: ForecastScenario[] = [
      {
        name: 'Optimistic',
        endMrr: projectedOptimistic,
        growth: ((projectedOptimistic - currentMrr) / currentMrr) * 100,
        probability: 20,
        color: 'emerald',
      },
      {
        name: 'Base Case',
        endMrr: projectedBase,
        growth: ((projectedBase - currentMrr) / currentMrr) * 100,
        probability: 55,
        color: 'violet',
      },
      {
        name: 'Conservative',
        endMrr: projectedConservative,
        growth: ((projectedConservative - currentMrr) / currentMrr) * 100,
        probability: 25,
        color: 'amber',
      },
    ];

    const summary = {
      currentMrr,
      projectedMrr: projectedBase,
      growth: ((projectedBase - currentMrr) / currentMrr) * 100,
      confidenceLow: projectedConservative,
      confidenceHigh: projectedOptimistic,
    };

    return { chartData, scenarios, summary };
  }, [metrics]);

  // Find where actual data ends
  const todayIndex = chartData.findIndex(d => d.actual === undefined) - 1;
  const todayDate = todayIndex >= 0 ? chartData[todayIndex].date : null;

  // Loading state
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-white/5 bg-zinc-900/50 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-zinc-800 animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 w-32 rounded bg-zinc-800 animate-pulse" />
            <div className="h-3 w-24 rounded bg-zinc-800 animate-pulse" />
          </div>
        </div>
        <div className="h-[300px] bg-zinc-800/50 rounded-xl animate-pulse" />
      </div>
    );
  }

  // Error state
  if (error || !summary) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-dashed border-white/10 bg-gradient-to-br from-violet-500/5 to-transparent p-8 text-center"
      >
        <div className="rounded-2xl bg-violet-500/10 p-4 w-fit mx-auto">
          <Brain className="h-8 w-8 text-violet-400" />
        </div>
        <h3 className="mt-4 font-semibold text-lg text-white">AI Forecast Unavailable</h3>
        <p className="mt-2 text-sm text-zinc-400 max-w-sm mx-auto">
          {error || 'Need at least 7 days of data to generate forecasts.'}
        </p>
        <button
          onClick={fetchMetrics}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 transition-colors text-sm font-medium"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/5 bg-zinc-900/50 overflow-hidden"
    >
      {/* Header */}
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 p-3">
                <Brain className="h-5 w-5 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 rounded-full bg-emerald-500 p-0.5">
                <Sparkles className="h-2.5 w-2.5 text-white" />
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-lg text-white flex items-center gap-2">
                AI Revenue Forecast
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 font-medium">
                  90 days
                </span>
              </h3>
              <p className="text-sm text-zinc-500">
                Statistical trend analysis • {metrics.length} days of data
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-2xl font-bold text-white">
                {formatDollars(summary.projectedMrr)}
              </div>
              <div className={cn(
                "flex items-center justify-end gap-1 text-sm font-medium",
                summary.growth >= 0 ? "text-emerald-400" : "text-red-400"
              )}>
                {summary.growth >= 0 ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                {summary.growth >= 0 ? '+' : ''}{summary.growth.toFixed(1)}%
              </div>
            </div>
            <button
              onClick={fetchMetrics}
              className="p-2 rounded-lg hover:bg-white/5 transition-colors"
              title="Refresh forecast"
            >
              <RefreshCw className="h-4 w-4 text-zinc-500" />
            </button>
          </div>
        </div>

        {/* Confidence indicator */}
        <div className="mt-4 flex items-center gap-6 text-xs">
          <div className="flex items-center gap-2">
            <Target className="h-3.5 w-3.5 text-zinc-500" />
            <span className="text-zinc-500">Confidence Range</span>
            <span className="text-zinc-400 font-medium">
              {formatDollars(summary.confidenceLow)} – {formatDollars(summary.confidenceHigh)}
            </span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="p-6">
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="confidenceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.1} />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#71717a' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatDate}
                interval="preserveStartEnd"
              />
              
              <YAxis
                tick={{ fontSize: 11, fill: '#71717a' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatAxisDollars}
                width={55}
              />
              
              <Tooltip content={<ChartTooltip />} />
              
              {/* Confidence band (optimistic to pessimistic) */}
              <Area
                type="monotone"
                dataKey="optimistic"
                stroke="none"
                fill="url(#confidenceGradient)"
                fillOpacity={1}
              />
              <Area
                type="monotone"
                dataKey="pessimistic"
                stroke="none"
                fill="#18181b"
                fillOpacity={1}
              />
              
              {/* Actual data line */}
              <Area
                type="monotone"
                dataKey="actual"
                stroke="#8b5cf6"
                strokeWidth={2.5}
                fill="url(#actualGradient)"
                fillOpacity={1}
                dot={false}
              />
              
              {/* Forecast line */}
              <Area
                type="monotone"
                dataKey="forecast"
                stroke="#22d3ee"
                strokeWidth={2}
                strokeDasharray="6 4"
                fill="url(#forecastGradient)"
                fillOpacity={1}
                dot={false}
              />
              
              {/* Today marker */}
              {todayDate && (
                <ReferenceLine
                  x={todayDate}
                  stroke="rgba(255,255,255,0.3)"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                  label={{
                    value: 'Today',
                    position: 'top',
                    fontSize: 10,
                    fill: '#71717a',
                  }}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-4 text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-violet-500 rounded" />
            <span>Actual MRR</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-cyan-400 rounded" style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 2px, #22d3ee 2px, #22d3ee 5px)' }} />
            <span>Forecast</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-3 bg-cyan-400/10 rounded" />
            <span>Confidence Range</span>
          </div>
        </div>
      </div>

      {/* Scenarios */}
      {scenarios.length > 0 && (
        <div className="px-6 pb-6">
          <h4 className="font-medium text-sm text-zinc-400 mb-3">Forecast Scenarios</h4>
          <div className="grid grid-cols-3 gap-3">
            {scenarios.map((scenario) => (
              <ScenarioCard
                key={scenario.name}
                scenario={scenario}
                isActive={activeScenario === scenario.name}
                onClick={() => setActiveScenario(scenario.name)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Key Insights */}
      <div className="px-6 pb-6">
        <h4 className="font-medium text-sm text-zinc-400 mb-3 flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-violet-400" />
          Key Insights
        </h4>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <Lightbulb className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-medium text-emerald-400">Growth Trend</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                MRR growing at {(summary.growth / 3).toFixed(1)}% monthly
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-medium text-amber-400">Variance Risk</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                ±{formatDollars((summary.confidenceHigh - summary.confidenceLow) / 2)} uncertainty range
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
