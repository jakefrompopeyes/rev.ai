'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';
import { ArrowUpRight, ArrowDownRight, Droplets } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface WaterfallData {
  startingMrr: number;
  newBusiness: number;
  expansion: number;
  contraction: number;
  churn: number;
  endingMrr: number;
}

interface RevenueWaterfallProps {
  data: WaterfallData | null;
  isLoading?: boolean;
}

const COLORS = {
  starting: 'hsl(220, 14%, 46%)', // Gray for starting
  new: 'hsl(142, 76%, 36%)', // Green for new
  expansion: 'hsl(162, 84%, 39%)', // Teal for expansion
  contraction: 'hsl(38, 92%, 50%)', // Orange for contraction
  churn: 'hsl(0, 84%, 60%)', // Red for churn
  ending: 'hsl(250, 84%, 54%)', // Primary for ending
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const item = payload[0].payload;
    return (
      <div className="rounded-lg border border-border bg-card/95 backdrop-blur-sm p-3 shadow-xl">
        <p className="text-sm font-semibold mb-1">{item.name}</p>
        <p className="text-lg font-bold" style={{ color: item.color }}>
          {item.isNegative ? '-' : item.type !== 'total' ? '+' : ''}
          {formatCurrency(Math.abs(item.displayValue))}
        </p>
        {item.description && (
          <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
        )}
      </div>
    );
  }
  return null;
};

export function RevenueWaterfall({ data, isLoading }: RevenueWaterfallProps) {
  const chartData = useMemo(() => {
    if (!data) return [];

    // Build waterfall data structure
    // Each bar has: value (height), base (starting y position), displayValue (tooltip)
    let runningTotal = data.startingMrr / 100;

    const items = [
      {
        name: 'Starting MRR',
        value: runningTotal,
        base: 0,
        displayValue: data.startingMrr,
        color: COLORS.starting,
        type: 'total',
        isNegative: false,
        description: 'MRR at start of period',
      },
      {
        name: 'New Business',
        value: data.newBusiness / 100,
        base: runningTotal,
        displayValue: data.newBusiness,
        color: COLORS.new,
        type: 'increase',
        isNegative: false,
        description: 'Revenue from new customers',
      },
      {
        name: 'Expansion',
        value: data.expansion / 100,
        base: runningTotal + data.newBusiness / 100,
        displayValue: data.expansion,
        color: COLORS.expansion,
        type: 'increase',
        isNegative: false,
        description: 'Upgrades & add-ons from existing customers',
      },
      {
        name: 'Contraction',
        value: data.contraction / 100,
        base:
          runningTotal +
          data.newBusiness / 100 +
          data.expansion / 100 -
          data.contraction / 100,
        displayValue: data.contraction,
        color: COLORS.contraction,
        type: 'decrease',
        isNegative: true,
        description: 'Downgrades from existing customers',
      },
      {
        name: 'Churn',
        value: data.churn / 100,
        base:
          runningTotal +
          data.newBusiness / 100 +
          data.expansion / 100 -
          data.contraction / 100 -
          data.churn / 100,
        displayValue: data.churn,
        color: COLORS.churn,
        type: 'decrease',
        isNegative: true,
        description: 'Lost revenue from churned customers',
      },
      {
        name: 'Ending MRR',
        value: data.endingMrr / 100,
        base: 0,
        displayValue: data.endingMrr,
        color: COLORS.ending,
        type: 'total',
        isNegative: false,
        description: 'MRR at end of period',
      },
    ];

    return items;
  }, [data]);

  // Calculate net change
  const netChange = data ? data.endingMrr - data.startingMrr : 0;
  const netChangePercent =
    data && data.startingMrr > 0
      ? ((data.endingMrr - data.startingMrr) / data.startingMrr) * 100
      : 0;

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
        <div className="h-[280px] w-full bg-muted/30 rounded-lg animate-pulse" />
      </motion.div>
    );
  }

  if (!data) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center"
      >
        <div className="rounded-full bg-muted/50 p-3 w-fit mx-auto">
          <Droplets className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="mt-4 font-semibold">No waterfall data</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Sync more data to see your MRR movements breakdown.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="rounded-xl border border-border bg-card p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-primary/10 p-2">
            <Droplets className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Revenue Waterfall</h3>
            <p className="text-xs text-muted-foreground">MRR movement this month</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
              netChange >= 0
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            }`}
          >
            {netChange >= 0 ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {formatCurrency(Math.abs(netChange))} ({netChangePercent >= 0 ? '+' : ''}
            {netChangePercent.toFixed(1)}%)
          </div>
        </div>
      </div>

      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 10, left: 0, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              vertical={false}
            />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickMargin={10}
              interval={0}
              angle={-15}
              textAnchor="end"
              height={50}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              width={50}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.3)' }} />
            
            {/* Invisible base bars for waterfall effect */}
            <Bar dataKey="base" stackId="a" fill="transparent" />
            
            {/* Actual value bars */}
            <Bar dataKey="value" stackId="a" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 mt-4 pt-4 border-t border-border">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS.new }} />
          <span className="text-xs text-muted-foreground">New</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS.expansion }} />
          <span className="text-xs text-muted-foreground">Expansion</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS.contraction }} />
          <span className="text-xs text-muted-foreground">Contraction</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS.churn }} />
          <span className="text-xs text-muted-foreground">Churn</span>
        </div>
      </div>
    </motion.div>
  );
}

