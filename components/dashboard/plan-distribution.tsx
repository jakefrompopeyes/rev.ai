'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { PieChart as PieIcon } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface PlanDistributionProps {
  data: Record<string, number> | null;
  totalMrr?: number;
  isLoading?: boolean;
}

const COLORS = [
  'hsl(250, 84%, 54%)', // Primary purple
  'hsl(142, 76%, 36%)', // Green
  'hsl(38, 92%, 50%)',  // Orange
  'hsl(280, 84%, 60%)', // Violet
  'hsl(190, 84%, 45%)', // Cyan
  'hsl(350, 84%, 60%)', // Pink
];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-lg border border-border bg-card/95 backdrop-blur-sm p-3 shadow-xl">
        <p className="text-sm font-semibold">{data.name}</p>
        <p className="text-lg font-bold" style={{ color: data.fill }}>
          {data.value} subscribers
        </p>
        <p className="text-xs text-muted-foreground">
          {data.percentage.toFixed(1)}% of total
        </p>
      </div>
    );
  }
  return null;
};

const renderCustomLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
  name,
}: any) => {
  if (percent < 0.05) return null; // Don't show labels for tiny slices
  
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      className="text-xs font-semibold"
      style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export function PlanDistribution({ data, totalMrr, isLoading }: PlanDistributionProps) {
  const chartData = useMemo(() => {
    if (!data) return [];
    
    const total = Object.values(data).reduce((sum, val) => sum + val, 0);
    
    return Object.entries(data)
      .map(([name, value], index) => ({
        name,
        value,
        percentage: total > 0 ? (value / total) * 100 : 0,
        fill: COLORS[index % COLORS.length],
      }))
      .sort((a, b) => b.value - a.value);
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
        <div className="h-[250px] w-full flex items-center justify-center">
          <div className="h-40 w-40 rounded-full bg-muted animate-pulse" />
        </div>
      </motion.div>
    );
  }

  if (!data || Object.keys(data).length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center"
      >
        <div className="rounded-full bg-muted/50 p-3 w-fit mx-auto">
          <PieIcon className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="mt-4 font-semibold">No plan data</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Sync your Stripe data to see plan distribution.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="rounded-xl border border-border bg-card p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-primary/10 p-2">
            <PieIcon className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Plan Distribution</h3>
            <p className="text-xs text-muted-foreground">
              {chartData.reduce((sum, d) => sum + d.value, 0)} total subscribers
            </p>
          </div>
        </div>
      </div>

      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderCustomLabel}
              outerRadius={90}
              innerRadius={50}
              dataKey="value"
              stroke="hsl(var(--card))"
              strokeWidth={2}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-3 mt-2">
        {chartData.map((entry, index) => (
          <div key={entry.name} className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: entry.fill }}
            />
            <span className="text-xs text-muted-foreground">{entry.name}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

