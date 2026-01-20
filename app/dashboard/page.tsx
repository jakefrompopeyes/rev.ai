'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DollarSign,
  Users,
  TrendingUp,
  Percent,
  AlertTriangle,
  CreditCard,
  Activity as ActivityIcon,
  X,
  Target,
} from 'lucide-react';
import { MetricCard } from '@/components/dashboard/metric-card';
import { InsightsFeed } from '@/components/dashboard/insights-feed';
import { RecommendationsPanel } from '@/components/dashboard/recommendations-panel';
import { StripeConnection } from '@/components/dashboard/stripe-connection';
import { RevenueTrendChart } from '@/components/dashboard/revenue-trend-chart';
import { RevenueWaterfall } from '@/components/dashboard/revenue-waterfall';
import { PlanDistribution } from '@/components/dashboard/plan-distribution';
import { DateRangePicker, getDaysFromRange, type DateRange } from '@/components/dashboard/date-range-picker';
import { ActivityTimeline, type Activity } from '@/components/dashboard/activity-timeline';
import { CustomerHealth } from '@/components/dashboard/customer-health';
import { QuickStats, generateQuickStats } from '@/components/dashboard/quick-stats';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { RevenueForecast } from '@/components/dashboard/revenue-forecast';
import { CohortHeatmap } from '@/components/dashboard/cohort-heatmap';
import { ExportButton } from '@/components/dashboard/export-button';
import { PricingOptimizer } from '@/components/dashboard/pricing-optimizer';
import { PricingCopilotChat } from '@/components/dashboard/pricing-copilot-chat';
import { NotificationCenter, type Notification } from '@/components/dashboard/notification-center';
import { DiscountLeakage } from '@/components/dashboard/discount-leakage';
import { PriceIncreaseSafety } from '@/components/dashboard/price-increase-safety';
import { LegacyPlanDetector } from '@/components/dashboard/legacy-plan-detector';
import { AnnualPlanOpportunity } from '@/components/dashboard/annual-plan-opportunity';
import { ComparisonToggle } from '@/components/dashboard/comparison-toggle';
import { KeyboardShortcutsHelp } from '@/components/dashboard/keyboard-shortcuts-help';
import { SettingsPanel } from '@/components/dashboard/settings-panel';
import { PlanMigrationPaths } from '@/components/dashboard/plan-migration-paths';
import { CustomerSegmentation } from '@/components/dashboard/customer-segmentation';
import { useKeyboardShortcuts } from '@/lib/hooks/use-keyboard-shortcuts';
import { formatCurrency, formatPercentAbs } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
  supportsDirectConnect?: boolean;
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

interface CohortData {
  cohort: string;
  startCount: number;
  months: (number | undefined)[];
}

interface AtRiskCustomer {
  id: string;
  email: string;
  mrr: number;
  riskReason: 'past_due' | 'usage_drop' | 'downgrade_intent' | 'failed_payment';
  riskScore: number;
  daysSinceIssue: number;
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
  
  const [activities, setActivities] = useState<Activity[]>([]);
  
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isLoadingWaterfall, setIsLoadingWaterfall] = useState(true);
  const [isLoadingActivities, setIsLoadingActivities] = useState(true);
  const [isLoadingInsights, setIsLoadingInsights] = useState(true);
  const [isLoadingRecs, setIsLoadingRecs] = useState(true);
  const [cohortData, setCohortData] = useState<CohortData[]>([]);
  const [isLoadingCohorts, setIsLoadingCohorts] = useState(true);
  const [atRiskCustomers, setAtRiskCustomers] = useState<AtRiskCustomer[]>([]);
  const [isLoadingAtRisk, setIsLoadingAtRisk] = useState(true);
  
  // New state for enhanced features
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [comparisonEnabled, setComparisonEnabled] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'revenue' | 'customers' | 'pricing' | 'ai'>('overview');

  // Free report onboarding (lightweight, client-only)
  const flow = searchParams.get('flow');
  const [showFreeReportOnboarding, setShowFreeReportOnboarding] = useState(false);
  const [freeReportStep, setFreeReportStep] = useState<'connect' | 'goal'>('connect');

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

  // Optional deep link: /dashboard?tab=pricing (etc.)
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (!tab) return;
    const allowed = ['overview', 'revenue', 'customers', 'pricing', 'ai'] as const;
    if (allowed.includes(tab as any)) {
      setActiveTab(tab as (typeof allowed)[number]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const fetchActivities = useCallback(async () => {
    try {
      setIsLoadingActivities(true);
      const res = await fetch('/api/metrics?view=activities&limit=20');
      if (res.ok) {
        const data = await res.json();
        setActivities(data.activities || []);
      }
    } catch (error) {
      console.error('Failed to fetch activities:', error);
    } finally {
      setIsLoadingActivities(false);
    }
  }, []);

  const fetchCohortData = useCallback(async () => {
    try {
      setIsLoadingCohorts(true);
      const res = await fetch('/api/metrics?view=cohorts&months=12');
      if (res.ok) {
        const data = await res.json();
        setCohortData(data.cohorts || []);
      }
    } catch (error) {
      console.error('Failed to fetch cohort data:', error);
    } finally {
      setIsLoadingCohorts(false);
    }
  }, []);

  const fetchAtRiskCustomers = useCallback(async () => {
    try {
      setIsLoadingAtRisk(true);
      const res = await fetch('/api/metrics?view=at-risk&limit=20');
      if (res.ok) {
        const data = await res.json();
        setAtRiskCustomers(data.atRiskCustomers || []);
      }
    } catch (error) {
      console.error('Failed to fetch at-risk customers:', error);
    } finally {
      setIsLoadingAtRisk(false);
    }
  }, []);

  // Check for connection callback
  useEffect(() => {
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    
    if (connected === 'true') {
      // Refresh status and trigger sync
      fetchStripeStatus();
      // Clear the URL param but preserve other query params (e.g. flow=free-report)
      const params = new URLSearchParams(searchParams.toString());
      params.delete('connected');
      params.delete('error');
      const qs = params.toString();
      router.replace(qs ? `/dashboard?${qs}` : '/dashboard');
    }
    
    if (error) {
      const decodedError = decodeURIComponent(error);
      console.error('Stripe connection error:', decodedError);
      
      // Show user-friendly error message
      let errorMessage = decodedError;
      let helpText = '';
      
      if (decodedError.includes('Invalid redirect URI')) {
        errorMessage = 'Redirect URI not configured in Stripe';
        helpText = `\n\nTo fix this:\n1. Go to https://dashboard.stripe.com/test/settings/applications\n2. Find your Connect app\n3. Add this exact redirect URI:\n   http://localhost:3000/api/stripe/callback\n4. Save and try again\n\nOr use the "Use API Key instead" option below to skip OAuth setup.`;
      } else if (decodedError.includes('Invalid request')) {
        errorMessage = 'Stripe configuration error';
        helpText = `\n\nError details: ${decodedError}\n\nPlease check your Stripe Connect app settings.`;
      }
      
      alert(`Stripe Connection Error: ${errorMessage}${helpText}`);
      
      // Clear the URL param
      const params = new URLSearchParams(searchParams.toString());
      params.delete('connected');
      params.delete('error');
      const qs = params.toString();
      router.replace(qs ? `/dashboard?${qs}` : '/dashboard');
    }
  }, [searchParams, router, fetchStripeStatus]);

  // Trigger free report onboarding flow when arriving via /dashboard?flow=free-report
  useEffect(() => {
    if (!user?.id) return;
    if (flow !== 'free-report') return;
    const key = `discovred:onboarding:free-report:${user.id}`;
    const completed = localStorage.getItem(key) === '1';
    if (!completed) setShowFreeReportOnboarding(true);
  }, [flow, user?.id]);

  // Keep onboarding step in sync with Stripe connection
  useEffect(() => {
    if (!showFreeReportOnboarding) return;
    setFreeReportStep(stripeStatus.connected ? 'goal' : 'connect');
  }, [showFreeReportOnboarding, stripeStatus.connected]);

  // Fetch data on mount when authenticated (or in dev mode)
  useEffect(() => {
    const isDev = process.env.NODE_ENV === 'development';
    if (user || isDev) {
      fetchStripeStatus();
      fetchMetrics();
      fetchMetricsHistory();
      fetchWaterfallData();
      fetchActivities();
      fetchCohortData();
      fetchAtRiskCustomers();
      fetchInsights();
      fetchRecommendations();
    }
  }, [user, fetchStripeStatus, fetchMetrics, fetchMetricsHistory, fetchWaterfallData, fetchActivities, fetchCohortData, fetchAtRiskCustomers, fetchInsights, fetchRecommendations]);

  // Actions
  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const res = await fetch('/api/stripe/connect');
      const data = await res.json();
      
      if (!res.ok) {
        const errorMessage = data.error || 'Failed to initiate Stripe connection';
        console.error('Stripe connection error:', errorMessage);
        alert(`Error: ${errorMessage}\n\nPlease check:\n1. STRIPE_CLIENT_ID or STRIPE_CLIENT_ID_TEST is set in your environment variables\n2. Your Stripe Connect app is configured correctly`);
        return;
      }
      
      // Store whether direct connect is supported (for showing API key option)
      if (data.supportsDirectConnect !== undefined) {
        setStripeStatus(prev => ({ ...prev, supportsDirectConnect: data.supportsDirectConnect }));
      }
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error('No OAuth URL returned from API');
        alert('Error: No OAuth URL received. Please check that STRIPE_CLIENT_ID or STRIPE_CLIENT_ID_TEST is configured in your environment variables.');
      }
    } catch (error) {
      console.error('Failed to initiate connection:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Connection failed: ${errorMessage}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDirectConnect = async (apiKey: string) => {
    const res = await fetch('/api/stripe/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey }),
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      throw new Error(data.error || 'Connection failed');
    }
    
    // Refresh stripe status after successful connection
    await fetchStripeStatus();
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
          fetchActivities(),
          fetchCohortData(),
          fetchAtRiskCustomers(),
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

  const dismissFreeReportFlow = () => {
    setShowFreeReportOnboarding(false);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('flow');
    const qs = params.toString();
    router.replace(qs ? `/dashboard?${qs}` : '/dashboard');
  };

  const completeFreeReportFlow = (goal: 'pricing' | 'retention' | 'growth') => {
    if (user?.id) {
      const key = `discovred:onboarding:free-report:${user.id}`;
      localStorage.setItem(key, '1');
    }

    // Put them on the most valuable view immediately
    setActiveTab('overview');
    setShowFreeReportOnboarding(false);

    // Clean URL
    const params = new URLSearchParams(searchParams.toString());
    params.delete('flow');
    const qs = params.toString();
    router.replace(qs ? `/dashboard?${qs}` : '/dashboard');

    // Scroll to the hero pricing section
    window.setTimeout(() => {
      const el = document.getElementById('pricing-intelligence');
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);

    // Keep goal around for future personalization (client-only for now)
    try {
      if (user?.id) {
        localStorage.setItem(`discovred:goal:${user.id}`, goal);
      }
    } catch {
      // ignore
    }
  };

  // Extract current metrics for use in computed values
  const current = metrics?.current;
  const changes = metrics?.changes || {};

  const quickStats = current
    ? generateQuickStats({
        arr: current.arr,
        netRevenueRetention: current.netRevenueRetention,
        failedPaymentRate: current.failedPaymentRate,
        averageDiscount: current.averageDiscount,
      })
    : [];

  const healthScore = current
    ? Math.max(0, Math.min(100, 100 - (current.grossChurnRate || 0) * 10 - (current.failedPaymentRate || 0) * 5))
    : 80;


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
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary p-2">
                <ActivityIcon className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">discovred</h1>
                <p className="text-xs text-muted-foreground">Revenue Intelligence</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <KeyboardShortcutsHelp shortcuts={shortcuts} />
              <ExportButton data={exportData} filename="discovred-dashboard" />
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
                onClick={() => setIsSettingsOpen(true)}
                className="h-9 w-9 rounded-lg border border-border bg-card flex items-center justify-center hover:bg-muted/50 transition-colors group relative"
                title="Settings"
              >
                <span className="text-sm font-medium text-primary group-hover:scale-110 transition-transform">
                  {user?.user_metadata?.name?.[0] || user?.email?.[0]?.toUpperCase()}
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Free report onboarding overlay */}
        <AnimatePresence>
          {showFreeReportOnboarding && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-background/70 backdrop-blur-sm"
            >
              <div className="absolute inset-0" onClick={dismissFreeReportFlow} />
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.98 }}
                transition={{ duration: 0.18 }}
                className="relative z-[61] mx-auto mt-24 w-[min(720px,calc(100%-2rem))] rounded-2xl border border-border bg-card shadow-2xl"
              >
                <div className="flex items-start justify-between gap-4 p-6 border-b border-border">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-primary/10 p-3 mt-0.5">
                      <Target className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Free Stripe Pricing Opportunity Report</div>
                      <h2 className="text-xl font-bold tracking-tight mt-1">Let’s generate your first “wow” insight</h2>
                      <p className="text-sm text-muted-foreground mt-2">
                        {freeReportStep === 'connect'
                          ? 'Step 1 of 2: Connect Stripe (read-only) to generate your report.'
                          : 'Step 2 of 2: Pick your goal, then we’ll jump you to the best report.'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={dismissFreeReportFlow}
                    className="h-9 w-9 rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors flex items-center justify-center"
                    title="Close"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>

                <div className="p-6">
                  {freeReportStep === 'connect' ? (
                    <div className="space-y-4">
                      <div className="rounded-xl border border-border bg-muted/30 p-4">
                        <div className="flex items-start gap-3">
                          <div className="rounded-lg bg-primary/10 p-2 mt-0.5">
                            <CreditCard className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <div className="font-semibold">Connect Stripe (read-only)</div>
                            <div className="text-sm text-muted-foreground mt-1">
                              We’ll use your subscription + invoice data to surface discount leakage and safer pricing moves.
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" onClick={dismissFreeReportFlow}>
                          Not now
                        </Button>
                        <Button className="gap-2" onClick={handleConnect} disabled={isConnecting}>
                          {isConnecting ? (
                            <>
                              <Spinner size="sm" />
                              Connecting…
                            </>
                          ) : (
                            <>
                              <CreditCard className="h-4 w-4" />
                              Connect Stripe
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <button
                          onClick={() => completeFreeReportFlow('pricing')}
                          className="rounded-xl border border-border bg-background p-4 text-left hover:bg-muted/40 transition-colors"
                        >
                          <div className="font-semibold">Discover pricing</div>
                          <div className="text-sm text-muted-foreground mt-1">
                            Discount leakage, plan risk, safer price moves.
                          </div>
                        </button>
                        <button
                          onClick={() => completeFreeReportFlow('retention')}
                          className="rounded-xl border border-border bg-background p-4 text-left hover:bg-muted/40 transition-colors"
                        >
                          <div className="font-semibold">Reduce churn</div>
                          <div className="text-sm text-muted-foreground mt-1">
                            Find churn drivers and at-risk segments.
                          </div>
                        </button>
                        <button
                          onClick={() => completeFreeReportFlow('growth')}
                          className="rounded-xl border border-border bg-background p-4 text-left hover:bg-muted/40 transition-colors"
                        >
                          <div className="font-semibold">Increase expansion</div>
                          <div className="text-sm text-muted-foreground mt-1">
                            Upgrade paths and annual plan candidates.
                          </div>
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          Tip: you can export/share results after starting a plan trial.
                        </p>
                        <Button variant="ghost" onClick={dismissFreeReportFlow}>
                          Skip
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

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
            onDirectConnect={handleDirectConnect}
            supportsDirectConnect={stripeStatus.supportsDirectConnect}
          />
        </section>

        {stripeStatus.connected && (
          <>
            <section className="mb-10">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="w-full">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <TabsList className="w-full sm:w-auto">
                      <TabsTrigger value="overview">Overview</TabsTrigger>
                      <TabsTrigger value="revenue">Revenue</TabsTrigger>
                      <TabsTrigger value="customers">Customers</TabsTrigger>
                      <TabsTrigger value="pricing">Pricing</TabsTrigger>
                      <TabsTrigger value="ai">AI</TabsTrigger>
                    </TabsList>

                    <div className="flex items-center gap-2">
                      <div className="hidden md:block">
                        <ComparisonToggle enabled={comparisonEnabled} onChange={setComparisonEnabled} />
                      </div>
                      <DateRangePicker value={dateRange} onChange={handleDateRangeChange} />
                    </div>
                  </div>

                  <TabsContent value="overview" className="space-y-6">
                    <QuickStats stats={quickStats} isLoading={isLoadingMetrics} />

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

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <section>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <h2 className="text-lg font-semibold">AI Insights</h2>
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                              {insights.length} active
                            </span>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => setActiveTab('ai')}>
                            View all
                          </Button>
                        </div>
                        <InsightsFeed
                          insights={insights.slice(0, 3)}
                          onDismiss={handleDismissInsight}
                          isLoading={isLoadingInsights}
                        />
                      </section>

                      <section>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <h2 className="text-lg font-semibold">Recommendations</h2>
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                              {recommendations.filter(r => r.status === 'PENDING').length} pending
                            </span>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => setActiveTab('ai')}>
                            View all
                          </Button>
                        </div>
                        <RecommendationsPanel
                          recommendations={recommendations.filter(r => r.status === 'PENDING').slice(0, 3)}
                          onImplement={handleImplementRecommendation}
                          onDismiss={handleDismissRecommendation}
                          isLoading={isLoadingRecs}
                        />
                      </section>
                    </div>

                    <section className="space-y-4">
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-semibold">Pricing Intelligence</h2>
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                          AI-powered
                        </span>
                      </div>

                      <div id="pricing-intelligence" className="grid grid-cols-1 lg:grid-cols-2 gap-6 scroll-mt-24">
                        <DiscountLeakage variant="hero" />
                        <PriceIncreaseSafety variant="hero" />
                        <LegacyPlanDetector variant="hero" />
                        <AnnualPlanOpportunity variant="hero" />
                      </div>
                    </section>
                  </TabsContent>

                  <TabsContent value="revenue" className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <RevenueTrendChart data={metricsHistory} isLoading={isLoadingHistory} />
                      <RevenueWaterfall data={waterfallData} isLoading={isLoadingWaterfall} />
                    </div>
                    <RevenueForecast />
                  </TabsContent>

                  <TabsContent value="customers" className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <CustomerHealth
                        atRiskCustomers={atRiskCustomers}
                        healthScore={Math.round(healthScore)}
                        churnRate={current?.grossChurnRate || 0}
                        failedPaymentRate={current?.failedPaymentRate || 0}
                        isLoading={isLoadingMetrics || isLoadingAtRisk}
                      />
                      <div className="lg:col-span-2">
                        <ActivityTimeline
                          activities={activities}
                          isLoading={isLoadingActivities}
                          maxItems={12}
                        />
                      </div>
                    </div>
                    <CohortHeatmap data={cohortData} isLoading={isLoadingCohorts} />
                    
                    <section>
                      <CustomerSegmentation />
                    </section>
                  </TabsContent>

                  <TabsContent value="pricing" className="space-y-10">
                    <section>
                      <PricingOptimizer />
                    </section>

                    <section>
                      <div className="flex items-center gap-2 mb-5">
                        <h2 className="text-lg font-semibold">Plan Mix</h2>
                      </div>
                      <PlanDistribution
                        data={current?.planDistribution || null}
                        totalMrr={current?.mrr}
                        isLoading={isLoadingMetrics}
                      />
                    </section>

                    <section>
                      <PlanMigrationPaths />
                    </section>
                  </TabsContent>

                  <TabsContent value="ai" className="space-y-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
                  </TabsContent>
                </Tabs>
              </div>
            </section>
          </>
        )}
      </main>

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        user={user}
        onSignOut={handleSignOut}
      />

      {/* Pricing Copilot Chat (Floating) */}
      {stripeStatus.connected && <PricingCopilotChat />}
    </div>
  );
}

