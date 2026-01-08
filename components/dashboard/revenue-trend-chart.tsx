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
  Legend,
} from 'recharts';
import { TrendingUp, Calendar } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface MetricDataPoint {
  date: string;
  mrr: number;
  arr: number;
  activeSubscriptions?: number;
}

interface RevenueTrendChartProps {
  data: MetricDataPoint[];
  isLoading?: boolean;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-border bg-card/95 backdrop-blur-sm p-3 shadow-xl">
        <p className="text-xs font-medium text-muted-foreground mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-xs text-muted-foreground">{entry.name}:</span>
            <span className="text-sm font-semibold">
              {entry.name.includes('Subscriptions')
                ? entry.value.toLocaleString()
                : formatCurrency(entry.value)}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export function RevenueTrendChart({ data, isLoading }: RevenueTrendChartProps) {
  const chartData = useMemo(() => {
    return data.map((d) => ({
      ...d,
      // Convert cents to dollars for display
      mrr: d.mrr / 100,
      arr: d.arr / 100,
      // Format date for display
      dateLabel: new Date(d.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
    }));
  }, [data]);

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
        <div className="h-[300px] w-full bg-muted/30 rounded-lg animate-pulse" />
      </motion.div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center"
      >
        <div className="rounded-full bg-muted/50 p-3 w-fit mx-auto">
          <TrendingUp className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="mt-4 font-semibold">No trend data yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Sync your Stripe data to see revenue trends over time.
        </p>
      </motion.div>
    );
  }

  // Calculate growth
  const firstMrr = chartData[0]?.mrr || 0;
  const lastMrr = chartData[chartData.length - 1]?.mrr || 0;
  const growth = firstMrr > 0 ? ((lastMrr - firstMrr) / firstMrr) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-xl border border-border bg-card p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-primary/10 p-2">
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Revenue Trend</h3>
            <p className="text-xs text-muted-foreground">
              Last {data.length} days
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`px-2.5 py-1 rounded-full text-xs font-medium ${
              growth >= 0
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            }`}
          >
            {growth >= 0 ? '+' : ''}
            {growth.toFixed(1)}% MRR
          </div>
        </div>
      </div>

      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorMrr" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(250, 84%, 54%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(250, 84%, 54%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorArr" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              vertical={false}
            />
            <XAxis
              dataKey="dateLabel"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickMargin={10}
              interval="preserveStartEnd"
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              width={50}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: '20px' }}
              formatter={(value) => (
                <span className="text-xs text-muted-foreground">{value}</span>
              )}
            />
            <Area
              type="monotone"
              dataKey="mrr"
              name="MRR"
              stroke="hsl(250, 84%, 54%)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorMrr)"
              dot={false}
              activeDot={{
                r: 4,
                stroke: 'hsl(250, 84%, 54%)',
                strokeWidth: 2,
                fill: 'hsl(var(--card))',
              }}
            />
            <Area
              type="monotone"
              dataKey="arr"
              name="ARR"
              stroke="hsl(142, 76%, 36%)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorArr)"
              dot={false}
              activeDot={{
                r: 4,
                stroke: 'hsl(142, 76%, 36%)',
                strokeWidth: 2,
                fill: 'hsl(var(--card))',
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}

