'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
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
import { Brain, TrendingUp, Calendar, Sparkles } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface ForecastDataPoint {
  date: string;
  actual?: number;
  predicted: number;
  lowerBound: number;
  upperBound: number;
}

interface RevenueForecastProps {
  historicalData: { date: string; mrr: number }[];
  isLoading?: boolean;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0]?.payload;
    const isActual = data?.actual !== undefined;
    
    return (
      <div className="rounded-lg border border-border bg-card/95 backdrop-blur-sm p-3 shadow-xl">
        <p className="text-xs font-medium text-muted-foreground mb-2">{label}</p>
        {isActual ? (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-sm">Actual: {formatCurrency(data.actual)}</span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-violet-500" />
              <span className="text-sm">Forecast: {formatCurrency(data.predicted)}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Range: {formatCurrency(data.lowerBound)} - {formatCurrency(data.upperBound)}
            </div>
          </>
        )}
      </div>
    );
  }
  return null;
};

// Simple forecasting using linear regression + growth rate
function generateForecast(
  historicalData: { date: string; mrr: number }[],
  monthsAhead: number = 3
): ForecastDataPoint[] {
  if (historicalData.length < 2) return [];

  // Calculate average monthly growth rate
  const growthRates: number[] = [];
  for (let i = 1; i < historicalData.length; i++) {
    if (historicalData[i - 1].mrr > 0) {
      const rate = (historicalData[i].mrr - historicalData[i - 1].mrr) / historicalData[i - 1].mrr;
      growthRates.push(rate);
    }
  }

  const avgGrowthRate = growthRates.length > 0
    ? growthRates.reduce((a, b) => a + b, 0) / growthRates.length
    : 0.05; // Default 5% growth

  // Calculate volatility for confidence intervals
  const volatility = growthRates.length > 1
    ? Math.sqrt(growthRates.reduce((sum, r) => sum + Math.pow(r - avgGrowthRate, 2), 0) / growthRates.length)
    : 0.1;

  const result: ForecastDataPoint[] = [];
  
  // Add historical data points
  historicalData.forEach(d => {
    result.push({
      date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      actual: d.mrr,
      predicted: d.mrr,
      lowerBound: d.mrr,
      upperBound: d.mrr,
    });
  });

  // Generate forecast points
  const lastMrr = historicalData[historicalData.length - 1].mrr;
  const lastDate = new Date(historicalData[historicalData.length - 1].date);

  for (let i = 1; i <= monthsAhead * 30; i += 7) { // Weekly points
    const futureDate = new Date(lastDate);
    futureDate.setDate(futureDate.getDate() + i);
    
    const weeksAhead = i / 7;
    const predicted = lastMrr * Math.pow(1 + avgGrowthRate / 4, weeksAhead); // Weekly compound
    const uncertainty = volatility * Math.sqrt(weeksAhead) * predicted;
    
    result.push({
      date: futureDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      predicted: Math.round(predicted),
      lowerBound: Math.round(Math.max(0, predicted - uncertainty * 1.5)),
      upperBound: Math.round(predicted + uncertainty * 1.5),
    });
  }

  return result;
}

export function RevenueForecast({ historicalData, isLoading }: RevenueForecastProps) {
  const forecastData = useMemo(() => {
    if (!historicalData || historicalData.length < 7) return [];
    // Use last 30 days of data for forecasting
    const recentData = historicalData.slice(-30);
    return generateForecast(recentData, 3);
  }, [historicalData]);

  const projectedGrowth = useMemo(() => {
    if (forecastData.length < 2) return 0;
    const lastActual = forecastData.find(d => d.actual !== undefined);
    const lastForecast = forecastData[forecastData.length - 1];
    if (!lastActual || !lastForecast) return 0;
    return ((lastForecast.predicted - lastActual.actual!) / lastActual.actual!) * 100;
  }, [forecastData]);

  const todayIndex = useMemo(() => {
    return forecastData.findIndex(d => d.actual === undefined) - 1;
  }, [forecastData]);

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
        <div className="h-[200px] w-full bg-muted/30 rounded animate-pulse" />
      </motion.div>
    );
  }

  if (forecastData.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center"
      >
        <div className="rounded-full bg-muted/50 p-3 w-fit mx-auto">
          <Brain className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="mt-4 font-semibold">Not enough data</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Need at least 7 days of data to generate forecasts.
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
          <div className="rounded-lg bg-violet-500/10 p-2">
            <Brain className="h-4 w-4 text-violet-500" />
          </div>
          <div>
            <h3 className="font-semibold flex items-center gap-1.5">
              Revenue Forecast
              <Sparkles className="h-3.5 w-3.5 text-violet-500" />
            </h3>
            <p className="text-xs text-muted-foreground">3-month AI prediction</p>
          </div>
        </div>
        
        {projectedGrowth !== 0 && (
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
            projectedGrowth > 0 
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'bg-red-500/10 text-red-600 dark:text-red-400'
          }`}>
            <TrendingUp className={`h-3 w-3 ${projectedGrowth < 0 ? 'rotate-180' : ''}`} />
            {projectedGrowth > 0 ? '+' : ''}{projectedGrowth.toFixed(1)}% projected
          </div>
        )}
      </div>

      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={forecastData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(250, 84%, 54%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(250, 84%, 54%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="confidenceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(280, 84%, 60%)" stopOpacity={0.2} />
                <stop offset="95%" stopColor="hsl(280, 84%, 60%)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              className="text-muted-foreground"
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `$${(value / 100).toFixed(0)}`}
              className="text-muted-foreground"
              width={50}
            />
            <Tooltip content={<CustomTooltip />} />
            
            {/* Confidence interval */}
            <Area
              type="monotone"
              dataKey="upperBound"
              stroke="none"
              fill="url(#confidenceGradient)"
              fillOpacity={1}
            />
            <Area
              type="monotone"
              dataKey="lowerBound"
              stroke="none"
              fill="hsl(var(--card))"
              fillOpacity={1}
            />
            
            {/* Actual data */}
            <Area
              type="monotone"
              dataKey="actual"
              stroke="hsl(250, 84%, 54%)"
              strokeWidth={2}
              fill="url(#forecastGradient)"
              fillOpacity={1}
              connectNulls={false}
            />
            
            {/* Forecast line */}
            <Area
              type="monotone"
              dataKey="predicted"
              stroke="hsl(280, 84%, 60%)"
              strokeWidth={2}
              strokeDasharray="5 5"
              fill="none"
              connectNulls
            />
            
            {/* Today marker */}
            {todayIndex >= 0 && (
              <ReferenceLine
                x={forecastData[todayIndex]?.date}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="3 3"
                label={{
                  value: 'Today',
                  position: 'top',
                  fontSize: 10,
                  fill: 'hsl(var(--muted-foreground))',
                }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-center gap-4 mt-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-primary rounded" />
          <span>Actual</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-violet-500 rounded" style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 2px, hsl(280, 84%, 60%) 2px, hsl(280, 84%, 60%) 4px)' }} />
          <span>Forecast</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-violet-500/20 rounded" />
          <span>Confidence</span>
        </div>
      </div>
    </motion.div>
  );
}

