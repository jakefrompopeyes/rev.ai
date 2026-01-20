'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Users,
  DollarSign,
  Clock,
  Percent,
  Zap,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';

interface MigrationPath {
  fromPlan: string | null;
  toPlan: string;
  count: number;
  totalMrrDelta: number;
  avgMrrDelta: number;
  conversionRate?: number;
  avgDaysToMigrate?: number;
}

interface PlanFunnel {
  plan: string;
  totalCustomers: number;
  upgradeCount: number;
  downgradeCount: number;
  churnCount: number;
  upgradeRate: number;
  downgradeRate: number;
  churnRate: number;
}

interface PlanMigrationAnalysis {
  paths: MigrationPath[];
  funnel: PlanFunnel[];
  insights: string[];
  frictionPoints: {
    fromPlan: string;
    toPlan: string;
    issue: string;
    severity: 'low' | 'medium' | 'high';
  }[];
}

export function PlanMigrationPaths() {
  const [data, setData] = useState<PlanMigrationAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [months, setMonths] = useState(12);
  const [view, setView] = useState<'paths' | 'funnel' | 'friction'>('paths');

  useEffect(() => {
    fetchData();
  }, [months]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(`/api/migration-paths?months=${months}`);
      if (!res.ok) throw new Error('Failed to fetch migration paths');
      const analysis = await res.json();
      setData(analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-20">
          <Spinner className="w-8 h-8" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="py-20 text-center">
          <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">{error || 'No data available'}</p>
        </CardContent>
      </Card>
    );
  }

  const topPaths = data.paths.slice(0, 10);
  const upgrades = data.paths.filter(p => p.avgMrrDelta > 0);
  const downgrades = data.paths.filter(p => p.avgMrrDelta < 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              Plan Migration Paths
            </CardTitle>
            <CardDescription>
              Analyze how customers move between plans
            </CardDescription>
          </div>
          <select
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
          >
            <option value={3}>Last 3 months</option>
            <option value={6}>Last 6 months</option>
            <option value={12}>Last 12 months</option>
            <option value={24}>Last 24 months</option>
          </select>
        </div>

        {/* View Tabs */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setView('paths')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === 'paths'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Migration Paths
          </button>
          <button
            onClick={() => setView('funnel')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === 'funnel'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Plan Funnel
          </button>
          <button
            onClick={() => setView('friction')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === 'friction'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Friction Points
            {data.frictionPoints.length > 0 && (
              <Badge className="ml-2 bg-amber-500">{data.frictionPoints.length}</Badge>
            )}
          </button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Insights */}
        {data.insights.length > 0 && (
          <div className="rounded-lg bg-muted/50 p-4 space-y-2">
            <h3 className="text-sm font-semibold">Key Insights</h3>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {data.insights.map((insight, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>{insight}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Migration Paths View */}
        {view === 'paths' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Top Migration Paths</h3>
              <div className="flex gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  {upgrades.length} upgrades
                </span>
                <span className="flex items-center gap-1">
                  <TrendingDown className="w-4 h-4 text-red-500" />
                  {downgrades.length} downgrades
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {topPaths.map((path, i) => (
                <motion.div
                  key={`${path.fromPlan}-${path.toPlan}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex items-center gap-2 min-w-[200px]">
                      <span className="text-sm font-medium text-muted-foreground">
                        {path.fromPlan || 'New Customer'}
                      </span>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-semibold">{path.toPlan}</span>
                    </div>

                    <div className="flex items-center gap-4 flex-1">
                      <div className="flex items-center gap-1 text-sm">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{path.count}</span>
                        <span className="text-muted-foreground">customers</span>
                      </div>

                      <div className={`flex items-center gap-1 text-sm ${
                        path.avgMrrDelta > 0 ? 'text-emerald-600' : path.avgMrrDelta < 0 ? 'text-red-600' : ''
                      }`}>
                        <DollarSign className="w-4 h-4" />
                        <span className="font-medium">
                          {path.avgMrrDelta > 0 ? '+' : ''}
                          {formatCurrency(path.avgMrrDelta)}
                        </span>
                        <span className="text-muted-foreground">/mo avg</span>
                      </div>

                      {path.conversionRate !== undefined && (
                        <div className="flex items-center gap-1 text-sm">
                          <Percent className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{path.conversionRate.toFixed(1)}%</span>
                          <span className="text-muted-foreground">conversion</span>
                        </div>
                      )}

                      {path.avgDaysToMigrate && (
                        <div className="flex items-center gap-1 text-sm">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">
                            {Math.round(path.avgDaysToMigrate / 30)}mo
                          </span>
                          <span className="text-muted-foreground">avg time</span>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Funnel View */}
        {view === 'funnel' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Plan Performance Funnel</h3>
            <div className="space-y-3">
              {data.funnel.map((plan, i) => (
                <motion.div
                  key={plan.plan}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="p-4 rounded-lg border border-border bg-card"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold">{plan.plan}</h4>
                    <span className="text-sm text-muted-foreground">
                      {plan.totalCustomers} total customers
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <div className="text-xs text-muted-foreground mb-1">Upgrades</div>
                      <div className="text-lg font-bold text-emerald-600">
                        {plan.upgradeCount}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {plan.upgradeRate.toFixed(1)}% rate
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <div className="text-xs text-muted-foreground mb-1">Downgrades</div>
                      <div className="text-lg font-bold text-amber-600">
                        {plan.downgradeCount}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {plan.downgradeRate.toFixed(1)}% rate
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                      <div className="text-xs text-muted-foreground mb-1">Churns</div>
                      <div className="text-lg font-bold text-red-600">
                        {plan.churnCount}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {plan.churnRate.toFixed(1)}% rate
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Friction Points View */}
        {view === 'friction' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Friction Points</h3>
            {data.frictionPoints.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Zap className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No friction points detected. Great job!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.frictionPoints.map((point, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`p-4 rounded-lg border ${
                      point.severity === 'high'
                        ? 'bg-red-500/10 border-red-500/30'
                        : point.severity === 'medium'
                        ? 'bg-amber-500/10 border-amber-500/30'
                        : 'bg-blue-500/10 border-blue-500/30'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle
                            className={`w-5 h-5 ${
                              point.severity === 'high'
                                ? 'text-red-500'
                                : point.severity === 'medium'
                                ? 'text-amber-500'
                                : 'text-blue-500'
                            }`}
                          />
                          <span className="font-semibold">
                            {point.fromPlan} → {point.toPlan}
                          </span>
                          <Badge
                            variant="outline"
                            className={
                              point.severity === 'high'
                                ? 'border-red-500 text-red-500'
                                : point.severity === 'medium'
                                ? 'border-amber-500 text-amber-500'
                                : 'border-blue-500 text-blue-500'
                            }
                          >
                            {point.severity.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{point.issue}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
