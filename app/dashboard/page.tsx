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
import { formatCurrency, formatPercentAbs } from '@/lib/utils';

interface Metrics {
  mrr: number;
  arr: number;
  arpu: number;
  activeSubscriptions: number;
  grossChurnRate: number;
  netRevenueRetention: number;
  failedPaymentRate: number;
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

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [stripeStatus, setStripeStatus] = useState<StripeStatus>({ connected: false });
  const [metrics, setMetrics] = useState<MetricsSnapshot | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoadingDemo, setIsLoadingDemo] = useState(false);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);
  const [isLoadingInsights, setIsLoadingInsights] = useState(true);
  const [isLoadingRecs, setIsLoadingRecs] = useState(true);

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
      fetchInsights();
      fetchRecommendations();
    }
  }, [user, fetchStripeStatus, fetchMetrics, fetchInsights, fetchRecommendations]);

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

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const current = metrics?.current;
  const changes = metrics?.changes || {};

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
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {user?.email}
              </span>
              <button
                onClick={handleSignOut}
                className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors"
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
            {/* Section A: Live Revenue Snapshot */}
            <section className="mb-10">
              <div className="flex items-center gap-2 mb-5">
                <div className="h-2 w-2 rounded-full bg-emerald-500 pulse-dot" />
                <h2 className="text-lg font-semibold">Live Revenue Snapshot</h2>
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

