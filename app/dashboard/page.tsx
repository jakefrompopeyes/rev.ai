'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { motion } from 'framer-motion';
import {
  DollarSign,
  Users,
  TrendingUp,
  Percent,
  AlertTriangle,
  CreditCard,
  Activity,
} from 'lucide-react';
import { MetricCard } from '@/components/dashboard/metric-card';
import { InsightsFeed } from '@/components/dashboard/insights-feed';
import { RecommendationsPanel } from '@/components/dashboard/recommendations-panel';
import { StripeConnection } from '@/components/dashboard/stripe-connection';
import { RevenueTrendChart } from '@/components/dashboard/revenue-trend-chart';
import { RevenueWaterfall } from '@/components/dashboard/revenue-waterfall';
import { PlanDistribution } from '@/components/dashboard/plan-distribution';
import { DateRangePicker, getDaysFromRange, type DateRange } from '@/components/dashboard/date-range-picker';
import { ActivityTimeline, generateActivitiesFromMetrics, type Activity } from '@/components/dashboard/activity-timeline';
import { CustomerHealth, generateMockAtRiskCustomers } from '@/components/dashboard/customer-health';
import { QuickStats, generateQuickStats } from '@/components/dashboard/quick-stats';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { RevenueForecast } from '@/components/dashboard/revenue-forecast';
import { GoalTracker } from '@/components/dashboard/goal-tracker';
import { CohortHeatmap, generateMockCohortData } from '@/components/dashboard/cohort-heatmap';
import { ExportButton } from '@/components/dashboard/export-button';
import { NotificationCenter, generateSampleNotifications, type Notification } from '@/components/dashboard/notification-center';
import { ComparisonToggle } from '@/components/dashboard/comparison-toggle';
import { KeyboardShortcutsHelp } from '@/components/dashboard/keyboard-shortcuts-help';
import { useKeyboardShortcuts } from '@/lib/hooks/use-keyboard-shortcuts';
import { formatCurrency, formatPercentAbs } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

interface Metrics {
  mrr: number;
  arr: number;
  arpu: number;
  activeSubscriptions: number;
  grossChurnRate: number;
  netRevenueRetention: number;
  failedPaymentRate: number;
  newSubscriptions?: number;
  canceledSubscriptions?: number;
  upgrades?: number;
  downgrades?: number;
  averageDiscount?: number;
  planDistribution?: Record<string, number>;
}

interface MetricsSnapshot {
  current: Metrics;
  previousPeriod: Partial<Metrics>;
  changes: Record<string, number>;
}

interface StripeStatus {
  connected: boolean;
  connection?: {
    accountId: string;
    livemode: boolean;
    connectedAt: string;
    lastSyncAt?: string;
    lastSyncStatus?: string;
    lastSyncError?: string;
  };
}

interface Insight {
  id: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  generatedAt: string;
  confidence: number;
}

interface Recommendation {
  id: string;
  title: string;
  description: string;
  reasoning: string;
  riskLevel: string;
  estimatedImpact: number;
  impactTimeframe: string;
  priorityScore: number;
  status: string;
  implementedAt?: string;
}

interface MetricHistoryPoint {
  date: string;
  mrr: number;
  arr: number;
  activeSubscriptions?: number;
}

interface WaterfallData {
  startingMrr: number;
  newBusiness: number;
  expansion: number;
  contraction: number;
  churn: number;
  endingMrr: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [stripeStatus, setStripeStatus] = useState<StripeStatus>({ connected: false });
  const [metrics, setMetrics] = useState<MetricsSnapshot | null>(null);
  const [metricsHistory, setMetricsHistory] = useState<MetricHistoryPoint[]>([]);
  const [waterfallData, setWaterfallData] = useState<WaterfallData | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoadingDemo, setIsLoadingDemo] = useState(false);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isLoadingWaterfall, setIsLoadingWaterfall] = useState(true);
  const [isLoadingInsights, setIsLoadingInsights] = useState(true);
  const [isLoadingRecs, setIsLoadingRecs] = useState(true);
  
  // New state for enhanced features
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [comparisonEnabled, setComparisonEnabled] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(generateSampleNotifications());
  const [mrrGoal, setMrrGoal] = useState<number>(0);

  // Check auth status
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setIsAuthLoading(false);
    };
    checkUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  // Define fetch functions first (before useEffects that depend on them)
  const fetchStripeStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/stripe/status');
      const data = await res.json();
      setStripeStatus(data);
    } catch (error) {
      console.error('Failed to fetch Stripe status:', error);
    }
  }, []);

  const fetchMetrics = useCallback(async () => {
    try {
      setIsLoadingMetrics(true);
      const res = await fetch('/api/metrics');
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
      }
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    } finally {
      setIsLoadingMetrics(false);
    }
  }, []);

  const fetchInsights = useCallback(async () => {
    try {
      setIsLoadingInsights(true);
      const res = await fetch('/api/insights');
      if (res.ok) {
        const data = await res.json();
        setInsights(data.insights || []);
      }
    } catch (error) {
      console.error('Failed to fetch insights:', error);
    } finally {
      setIsLoadingInsights(false);
    }
  }, []);

  const fetchRecommendations = useCallback(async () => {
    try {
      setIsLoadingRecs(true);
      const res = await fetch('/api/recommendations');
      if (res.ok) {
        const data = await res.json();
        setRecommendations(data.recommendations || []);
      }
    } catch (error) {
      console.error('Failed to fetch recommendations:', error);
    } finally {
      setIsLoadingRecs(false);
    }
  }, []);

  const fetchMetricsHistory = useCallback(async (days?: number) => {
    try {
      setIsLoadingHistory(true);
      const daysParam = days ?? getDaysFromRange(dateRange);
      const res = await fetch(`/api/metrics?view=history&days=${daysParam}`);
      if (res.ok) {
        const data = await res.json();
        setMetricsHistory(data.history || []);
      }
    } catch (error) {
      console.error('Failed to fetch metrics history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [dateRange]);

  const fetchWaterfallData = useCallback(async () => {
    try {
      setIsLoadingWaterfall(true);
      const res = await fetch('/api/metrics?view=waterfall');
      if (res.ok) {
        const data = await res.json();
        setWaterfallData(data.waterfall || null);
      }
    } catch (error) {
      console.error('Failed to fetch waterfall data:', error);
    } finally {
      setIsLoadingWaterfall(false);
    }
  }, []);

  // Check for connection callback
  useEffect(() => {
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    
    if (connected === 'true') {
      // Refresh status and trigger sync
      fetchStripeStatus();
      // Clear the URL param
      router.replace('/dashboard');
    }
    
    if (error) {
      console.error('Stripe connection error:', error);
      router.replace('/dashboard');
    }
  }, [searchParams, router, fetchStripeStatus]);

  // Fetch data on mount when authenticated
  useEffect(() => {
    if (user) {
      fetchStripeStatus();
      fetchMetrics();
      fetchMetricsHistory();
      fetchWaterfallData();
      fetchInsights();
      fetchRecommendations();
    }
  }, [user, fetchStripeStatus, fetchMetrics, fetchMetricsHistory, fetchWaterfallData, fetchInsights, fetchRecommendations]);

  // Actions
  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const res = await fetch('/api/stripe/connect');
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Failed to initiate connection:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await fetch('/api/stripe/connect', { method: 'DELETE' });
      setStripeStatus({ connected: false });
      setMetrics(null);
      setInsights([]);
      setRecommendations([]);
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/stripe/sync', { method: 'POST' });
      if (res.ok) {
        // Refresh all data
        await Promise.all([
          fetchStripeStatus(),
          fetchMetrics(),
          fetchMetricsHistory(),
          fetchWaterfallData(),
          fetchInsights(),
          fetchRecommendations(),
        ]);
      }
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLoadDemo = async () => {
    setIsLoadingDemo(true);
    try {
      const res = await fetch('/api/demo/seed', { method: 'POST' });
      if (res.ok) {
        await Promise.all([
          fetchStripeStatus(),
          fetchMetrics(),
          fetchMetricsHistory(),
          fetchWaterfallData(),
          fetchInsights(),
          fetchRecommendations(),
        ]);
      }
    } catch (error) {
      console.error('Demo seed failed:', error);
    } finally {
      setIsLoadingDemo(false);
    }
  };

  const handleDismissInsight = async (insightId: string) => {
    try {
      await fetch('/api/insights', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ insightId, action: 'dismiss' }),
      });
      setInsights(prev => prev.filter(i => i.id !== insightId));
    } catch (error) {
      console.error('Failed to dismiss insight:', error);
    }
  };

  const handleImplementRecommendation = async (recId: string) => {
    try {
      await fetch('/api/recommendations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recommendationId: recId, action: 'implement' }),
      });
      setRecommendations(prev =>
        prev.map(r =>
          r.id === recId
            ? { ...r, status: 'IMPLEMENTED', implementedAt: new Date().toISOString() }
            : r
        )
      );
    } catch (error) {
      console.error('Failed to implement recommendation:', error);
    }
  };

  const handleDismissRecommendation = async (recId: string) => {
    try {
      await fetch('/api/recommendations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recommendationId: recId, action: 'dismiss' }),
      });
      setRecommendations(prev => prev.filter(r => r.id !== recId));
    } catch (error) {
      console.error('Failed to dismiss recommendation:', error);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleDateRangeChange = (range: DateRange) => {
    setDateRange(range);
    fetchMetricsHistory(getDaysFromRange(range));
  };

  // Extract current metrics for use in computed values
  const current = metrics?.current;
  const changes = metrics?.changes || {};

  // Compute derived data for new components
  const activities: Activity[] = current
    ? generateActivitiesFromMetrics({
        newSubscriptions: current.newSubscriptions,
        canceledSubscriptions: current.canceledSubscriptions,
        upgrades: current.upgrades,
        downgrades: current.downgrades,
      })
    : [];

  const quickStats = current
    ? generateQuickStats({
        arpu: current.arpu,
        netRevenueRetention: current.netRevenueRetention,
        grossChurnRate: current.grossChurnRate,
        averageDiscount: current.averageDiscount,
      })
    : [];

  const atRiskCustomers = generateMockAtRiskCustomers();
  const healthScore = current
    ? Math.max(0, Math.min(100, 100 - (current.grossChurnRate || 0) * 10 - (current.failedPaymentRate || 0) * 5))
    : 80;

  const cohortData = generateMockCohortData();

  // Export data compilation
  const exportData = {
    metrics: current,
    history: metricsHistory,
    waterfall: waterfallData,
    insights: insights,
    recommendations: recommendations,
    exportedAt: new Date().toISOString(),
  };

  // Notification handlers
  const handleMarkNotificationRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const handleMarkAllNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleDismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Toggle theme function for keyboard shortcut
  const toggleTheme = () => {
    const root = document.documentElement;
    const isDark = root.classList.contains('dark');
    root.classList.toggle('dark', !isDark);
    localStorage.setItem('theme', isDark ? 'light' : 'dark');
  };

  // Keyboard shortcuts
  const shortcuts = [
    { key: 'r', description: 'Refresh data', action: () => handleSync() },
    { key: 't', description: 'Toggle theme', action: toggleTheme },
    { key: 'c', description: 'Toggle comparison', action: () => setComparisonEnabled(!comparisonEnabled) },
  ];

  useKeyboardShortcuts(shortcuts);

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary p-2">
                <Activity className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">REV.AI</h1>
                <p className="text-xs text-muted-foreground">Revenue Intelligence</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <KeyboardShortcutsHelp shortcuts={shortcuts} />
              <ExportButton data={exportData} filename="revai-dashboard" />
              <NotificationCenter
                notifications={notifications}
                onMarkAsRead={handleMarkNotificationRead}
                onMarkAllRead={handleMarkAllNotificationsRead}
                onDismiss={handleDismissNotification}
              />
              <ThemeToggle />
              <span className="text-sm text-muted-foreground hidden md:inline">
                {user?.email}
              </span>
              <button
                onClick={handleSignOut}
                className="h-9 w-9 rounded-lg border border-border bg-card flex items-center justify-center hover:bg-muted/50 transition-colors"
                title="Sign out"
              >
                <span className="text-sm font-medium text-primary">
                  {user?.user_metadata?.name?.[0] || user?.email?.[0]?.toUpperCase()}
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stripe Connection */}
        <section className="mb-8">
          <div className="flex items-center justify-end mb-3">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleLoadDemo}
              disabled={isLoadingDemo}
            >
              {isLoadingDemo ? (
                <>
                  <Spinner size="sm" />
                  Seeding demo...
                </>
              ) : (
                <>Load Demo Data</>
              )}
            </Button>
          </div>
          <StripeConnection
            isConnected={stripeStatus.connected}
            connection={stripeStatus.connection}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            onSync={handleSync}
            isConnecting={isConnecting}
            isSyncing={isSyncing}
            onLoadDemo={handleLoadDemo}
            isLoadingDemo={isLoadingDemo}
          />
        </section>

        {stripeStatus.connected && (
          <>
            {/* Quick Stats Strip */}
            <section className="mb-6">
              <QuickStats stats={quickStats} isLoading={isLoadingMetrics} />
            </section>

            {/* Section A: Live Revenue Snapshot */}
            <section className="mb-10">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 pulse-dot" />
                  <h2 className="text-lg font-semibold">Live Revenue Snapshot</h2>
                </div>
                <div className="flex items-center gap-2">
                  <ComparisonToggle
                    enabled={comparisonEnabled}
                    onChange={setComparisonEnabled}
                  />
                  <DateRangePicker value={dateRange} onChange={handleDateRangeChange} />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  title="Monthly Recurring Revenue"
                  value={current ? formatCurrency(current.mrr) : '$0'}
                  change={changes.mrr}
                  icon={DollarSign}
                  trend={changes.mrr > 0 ? 'up' : changes.mrr < 0 ? 'down' : 'neutral'}
                  delay={0}
                />
                <MetricCard
                  title="Active Subscriptions"
                  value={current?.activeSubscriptions?.toLocaleString() || '0'}
                  change={changes.activeSubscriptions}
                  icon={Users}
                  trend={changes.activeSubscriptions > 0 ? 'up' : changes.activeSubscriptions < 0 ? 'down' : 'neutral'}
                  delay={0.1}
                />
                <MetricCard
                  title="Average Revenue Per User"
                  value={current ? formatCurrency(current.arpu) : '$0'}
                  change={changes.arpu}
                  icon={TrendingUp}
                  trend={changes.arpu > 0 ? 'up' : changes.arpu < 0 ? 'down' : 'neutral'}
                  delay={0.2}
                />
                <MetricCard
                  title="Monthly Churn Rate"
                  value={current ? formatPercentAbs(current.grossChurnRate) : '0%'}
                  change={changes.grossChurnRate}
                  changeLabel="vs last month"
                  icon={Percent}
                  trend={changes.grossChurnRate < 0 ? 'up' : changes.grossChurnRate > 0 ? 'down' : 'neutral'}
                  delay={0.3}
                />
              </div>

              {/* Secondary metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="rounded-xl border border-border bg-card p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Annual Revenue</span>
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-2xl font-bold mt-1">
                    {current ? formatCurrency(current.arr) : '$0'}
                  </p>
                </motion.div>
                
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45 }}
                  className="rounded-xl border border-border bg-card p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Net Revenue Retention</span>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-2xl font-bold mt-1">
                    {current ? formatPercentAbs(current.netRevenueRetention) : '0%'}
                  </p>
                </motion.div>
                
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="rounded-xl border border-border bg-card p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Failed Payment Rate</span>
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-2xl font-bold mt-1">
                    {current ? formatPercentAbs(current.failedPaymentRate) : '0%'}
                  </p>
                </motion.div>
              </div>
            </section>

            {/* Section: Revenue Charts */}
            <section className="mb-10">
              <div className="flex items-center gap-2 mb-5">
                <h2 className="text-lg font-semibold">Revenue Analytics</h2>
              </div>
              
              {/* First row: Trend Chart and Waterfall */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <RevenueTrendChart data={metricsHistory} isLoading={isLoadingHistory} />
                <RevenueWaterfall data={waterfallData} isLoading={isLoadingWaterfall} />
              </div>
              
              {/* Second row: Forecast and Goal Tracker */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                <RevenueForecast
                  historicalData={metricsHistory}
                  isLoading={isLoadingHistory}
                />
                <GoalTracker
                  currentMrr={current?.mrr || 0}
                  targetMrr={mrrGoal}
                  onTargetChange={setMrrGoal}
                  isLoading={isLoadingMetrics}
                />
              </div>
              
              {/* Third row: Plan Distribution, Customer Health, Activity */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                <PlanDistribution
                  data={current?.planDistribution || null}
                  totalMrr={current?.mrr}
                  isLoading={isLoadingMetrics}
                />
                <CustomerHealth
                  atRiskCustomers={atRiskCustomers}
                  healthScore={Math.round(healthScore)}
                  churnRate={current?.grossChurnRate || 0}
                  failedPaymentRate={current?.failedPaymentRate || 0}
                  isLoading={isLoadingMetrics}
                />
                <ActivityTimeline
                  activities={activities}
                  isLoading={isLoadingMetrics}
                  maxItems={6}
                />
              </div>

              {/* Fourth row: Cohort Retention Heatmap */}
              <div className="mt-6">
                <CohortHeatmap
                  data={cohortData}
                  isLoading={isLoadingMetrics}
                />
              </div>
            </section>

            {/* Sections B & C: Insights and Recommendations */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Section B: AI Insights Feed */}
              <section>
                <div className="flex items-center gap-2 mb-5">
                  <h2 className="text-lg font-semibold">AI Insights</h2>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {insights.length} active
                  </span>
                </div>
                <InsightsFeed
                  insights={insights}
                  onDismiss={handleDismissInsight}
                  isLoading={isLoadingInsights}
                />
              </section>

              {/* Section C: AI Recommendations */}
              <section>
                <div className="flex items-center gap-2 mb-5">
                  <h2 className="text-lg font-semibold">Recommendations</h2>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {recommendations.filter(r => r.status === 'PENDING').length} pending
                  </span>
                </div>
                <RecommendationsPanel
                  recommendations={recommendations}
                  onImplement={handleImplementRecommendation}
                  onDismiss={handleDismissRecommendation}
                  isLoading={isLoadingRecs}
                />
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

