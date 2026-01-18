'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { AnimatedNumber } from '@/components/ui/animated-number';
import {
  Clock,
  Users,
  DollarSign,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle,
  Info,
  Sparkles,
  RefreshCw,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Target,
  History,
  Crown,
  Shield,
  AlertTriangle,
  Wallet,
  Calendar,
  BarChart3,
} from 'lucide-react';

// ============================================================================
// TYPES (matching backend)
// ============================================================================

interface LegacyCustomer {
  customerId: string;
  subscriptionId: string;
  email: string | null;
  planId: string | null;
  planName: string | null;
  currentPayingPrice: number;
  currentMarketPrice: number;
  pricingGap: number;
  pricingGapPercent: number;
  annualGap: number;
  customerSince: string;
  tenureMonths: number;
  totalLifetimeRevenue: number;
  invoiceCount: number;
  averageInvoiceValue: number;
  status: string;
  paymentFailureCount: number;
  hasDiscount: boolean;
  legacyTier: 'deep_legacy' | 'moderate_legacy' | 'recent_legacy';
  migrationRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  recommendedAction: 'migrate_now' | 'gradual_increase' | 'offer_upgrade' | 'hold';
}

interface PlanLegacyInfo {
  planId: string;
  planName: string | null;
  currentMarketPrice: number;
  lowestLegacyPrice: number;
  averageLegacyPrice: number;
  pricingSpread: number;
  totalCustomers: number;
  legacyCustomers: number;
  legacyPercent: number;
  annualGapTotal: number;
  averageGapPerCustomer: number;
}

interface ChurnComparison {
  legacyCustomerCount: number;
  legacyChurnedCount: number;
  legacyChurnRate: number;
  newCustomerCount: number;
  newChurnedCount: number;
  newCustomerChurnRate: number;
  churnAdvantage: number;
  legacyMoreStable: boolean;
  sampleSizeAdequate: boolean;
  confidenceLevel: number;
}

interface LegacyPlanSummary {
  analyzedAt: string;
  customersOnLegacyPricing: number;
  totalActiveCustomers: number;
  legacyPercent: number;
  totalAnnualRevenueGap: number;
  averagePricingGapPercent: number;
  projectedRecoveryWithMigration: number;
  churnComparison: ChurnComparison;
  deepLegacyCount: number;
  moderateLegacyCount: number;
  recentLegacyCount: number;
  safeToMigrateCount: number;
  needsCarefulHandlingCount: number;
  recommendedMigrationPath: 'gradual' | 'immediate' | 'offer_upgrade' | 'hold';
  migrationConfidence: number;
}

interface AIRecommendation {
  priority: number;
  title: string;
  description: string;
  expectedImpact: number;
  customers: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  dataSupport: string;
}

interface LegacyPlanReport {
  summary: LegacyPlanSummary;
  legacyCustomers: LegacyCustomer[];
  planBreakdown: PlanLegacyInfo[];
  aiNarrative: string | null;
  aiRecommendations: AIRecommendation[];
  generatedAt: string;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function RiskBadge({ level }: { level: 'LOW' | 'MEDIUM' | 'HIGH' }) {
  const config = {
    LOW: { color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: CheckCircle, label: 'Low Risk' },
    MEDIUM: { color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: AlertTriangle, label: 'Medium Risk' },
    HIGH: { color: 'bg-red-500/10 text-red-400 border-red-500/20', icon: AlertCircle, label: 'High Risk' },
  };
  const { color, icon: Icon, label } = config[level];
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border ${color}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

function LegacyTierBadge({ tier }: { tier: LegacyCustomer['legacyTier'] }) {
  const config = {
    deep_legacy: { color: 'bg-purple-500/10 text-purple-400 border-purple-500/20', icon: Crown, label: '2+ years' },
    moderate_legacy: { color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', icon: History, label: '18+ months' },
    recent_legacy: { color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20', icon: Clock, label: '12+ months' },
  };
  const { color, icon: Icon, label } = config[tier];
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border ${color}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

function ActionBadge({ action }: { action: LegacyCustomer['recommendedAction'] }) {
  const config = {
    migrate_now: { color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', label: 'Migrate Now' },
    gradual_increase: { color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', label: 'Gradual' },
    offer_upgrade: { color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', label: 'Offer Upgrade' },
    hold: { color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20', label: 'Hold' },
  };
  const { color, label } = config[action];
  
  return (
    <span className={`px-2 py-0.5 text-xs rounded-full border ${color}`}>
      {label}
    </span>
  );
}

function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  subValue,
  color = 'purple'
}: { 
  icon: React.ElementType; 
  label: string; 
  value: string | number;
  subValue?: string;
  color?: 'purple' | 'red' | 'emerald' | 'blue' | 'amber';
}) {
  const colors = {
    purple: 'bg-purple-500/10 text-purple-500',
    red: 'bg-red-500/10 text-red-500',
    emerald: 'bg-emerald-500/10 text-emerald-500',
    blue: 'bg-blue-500/10 text-blue-500',
    amber: 'bg-amber-500/10 text-amber-500',
  };
  
  return (
    <Card className="bg-card/80 border-border/60 shadow-sm dark:bg-zinc-900/50 dark:border-zinc-800">
      <CardContent className="pt-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${colors[color]}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground dark:text-white">{value}</p>
            <p className="text-xs text-muted-foreground dark:text-zinc-500">{label}</p>
            {subValue && <p className="text-xs text-muted-foreground/70 dark:text-zinc-600 mt-0.5">{subValue}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ChurnComparisonCard({ comparison }: { comparison: ChurnComparison }) {
  const churnDiff = Math.abs(comparison.churnAdvantage);
  const isPositive = comparison.legacyMoreStable;
  
  return (
    <div className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="h-5 w-5 text-blue-400" />
        <h4 className="font-semibold text-white">Churn Rate Comparison</h4>
        {isPositive && (
          <Badge variant="outline" className="ml-auto border-emerald-500/30 text-emerald-400">
            Key Insight
          </Badge>
        )}
      </div>
      
      <div className="grid grid-cols-2 gap-6">
        {/* Legacy Customers */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-400">Legacy Customers</span>
            <span className="text-xs text-zinc-600">{comparison.legacyCustomerCount} customers</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-3 bg-zinc-700 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full ${isPositive ? 'bg-emerald-500' : 'bg-amber-500'}`}
                style={{ width: `${Math.min(comparison.legacyChurnRate * 5, 100)}%` }}
              />
            </div>
            <span className={`text-lg font-bold ${isPositive ? 'text-emerald-400' : 'text-amber-400'}`}>
              {comparison.legacyChurnRate.toFixed(1)}%
            </span>
          </div>
        </div>
        
        {/* New Customers */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-400">New Customers</span>
            <span className="text-xs text-zinc-600">{comparison.newCustomerCount} customers</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-3 bg-zinc-700 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full ${!isPositive ? 'bg-emerald-500' : 'bg-amber-500'}`}
                style={{ width: `${Math.min(comparison.newCustomerChurnRate * 5, 100)}%` }}
              />
            </div>
            <span className={`text-lg font-bold ${!isPositive ? 'text-emerald-400' : 'text-amber-400'}`}>
              {comparison.newCustomerChurnRate.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
      
      {/* Key Insight */}
      <div className={`mt-4 p-3 rounded-lg ${isPositive ? 'bg-emerald-950/30 border border-emerald-900/30' : 'bg-amber-950/30 border border-amber-900/30'}`}>
        <div className="flex items-start gap-2">
          {isPositive ? (
            <TrendingDown className="h-5 w-5 text-emerald-400 mt-0.5" />
          ) : (
            <TrendingUp className="h-5 w-5 text-amber-400 mt-0.5" />
          )}
          <div>
            <p className={`text-sm font-medium ${isPositive ? 'text-emerald-400' : 'text-amber-400'}`}>
              {isPositive 
                ? `Legacy customers churn ${churnDiff.toFixed(1)}% less than newer customers`
                : `Legacy customers churn ${churnDiff.toFixed(1)}% more than newer customers`
              }
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              {isPositive
                ? 'Strong evidence these customers can handle a price increase'
                : 'Proceed carefully—legacy customers may be price sensitive'
              }
            </p>
          </div>
        </div>
      </div>
      
      {!comparison.sampleSizeAdequate && (
        <p className="text-xs text-zinc-500 mt-3 flex items-center gap-1">
          <Info className="h-3 w-3" />
          Limited sample size—confidence: {(comparison.confidenceLevel * 100).toFixed(0)}%
        </p>
      )}
    </div>
  );
}

function PlanBreakdownCard({ plan }: { plan: PlanLegacyInfo }) {
  return (
    <div className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700/50 hover:border-purple-900/50 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-semibold text-white">{plan.planName || plan.planId}</h4>
          <p className="text-sm text-zinc-500">
            {plan.legacyCustomers} of {plan.totalCustomers} customers on legacy pricing
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-purple-400">{formatCurrency(plan.annualGapTotal)}</p>
          <p className="text-xs text-zinc-500">/year opportunity</p>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <span className="text-zinc-500 block text-xs">Current Price</span>
          <span className="text-white font-medium">{formatCurrency(plan.currentMarketPrice)}/mo</span>
        </div>
        <div>
          <span className="text-zinc-500 block text-xs">Avg Legacy Price</span>
          <span className="text-amber-400 font-medium">{formatCurrency(plan.averageLegacyPrice)}/mo</span>
        </div>
        <div>
          <span className="text-zinc-500 block text-xs">Pricing Spread</span>
          <span className="text-purple-400 font-medium">{plan.pricingSpread.toFixed(0)}%</span>
        </div>
      </div>
      
      {/* Visual bar showing legacy vs current */}
      <div className="mt-3 space-y-1">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-zinc-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-amber-500 to-purple-500 rounded-full"
              style={{ width: `${100 - plan.pricingSpread}%` }}
            />
          </div>
          <span className="text-xs text-zinc-500 w-12 text-right">{plan.legacyPercent.toFixed(0)}%</span>
        </div>
        <p className="text-xs text-zinc-600">Legacy customers paying {plan.pricingSpread.toFixed(0)}% below market</p>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export type LegacyPlanDetectorVariant = 'full' | 'hero';

export function LegacyPlanDetector({ variant = 'full' }: { variant?: LegacyPlanDetectorVariant }) {
  const [report, setReport] = useState<LegacyPlanReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['churn', 'recommendations', 'plans'])
  );

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/legacy-plans');
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch legacy plan data');
      }
      
      setReport(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardContent className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <Spinner />
            <p className="text-sm text-zinc-500">Detecting legacy pricing...</p>
            <p className="text-xs text-zinc-600">Comparing customer pricing vs current market rates</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardContent className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3 text-red-500">
            <AlertCircle className="h-8 w-8" />
            <p className="text-sm">{error}</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchData}
              className="mt-2 border-zinc-700"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!report) return null;

  const { summary, legacyCustomers, planBreakdown, aiNarrative, aiRecommendations } = report;

  // No legacy customers found
  if (summary.customersOnLegacyPricing === 0) {
    const hasActiveCustomers = summary.totalActiveCustomers > 0;
    const emptyState = (
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardContent className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="p-3 rounded-full bg-emerald-500/10">
              <CheckCircle className="h-8 w-8 text-emerald-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">
              {hasActiveCustomers ? 'No Legacy Pricing Detected' : 'No Active Customers Yet'}
            </h3>
            <p className="text-sm text-zinc-400 max-w-md">
              {hasActiveCustomers
                ? `All your active customers are paying current market rates. As you adjust pricing over time, this detector will surface customers who may be paying below your current rates.`
                : `Once you have active subscriptions, this detector will compare customer pricing to your current rates and surface legacy pricing risks.`}
            </p>
          </div>
        </CardContent>
      </Card>
    );

    if (variant === 'hero') {
      return emptyState;
    }

    return emptyState;
  }

  // Determine hero styling based on opportunity
  const hasOpportunity = summary.churnComparison.legacyMoreStable && summary.safeToMigrateCount > 0;

  const heroCard = (
    <Card className={`relative overflow-hidden bg-card/80 border-border/60 shadow-sm dark:bg-gradient-to-br ${hasOpportunity ? 'dark:from-purple-950/30 dark:via-zinc-900/50' : 'dark:from-amber-950/30 dark:via-zinc-900/50'} dark:to-zinc-900/50 ${hasOpportunity ? 'dark:border-purple-900/30' : 'dark:border-amber-900/30'}`}>
      <div className={`absolute inset-0 ${hasOpportunity ? 'bg-[radial-gradient(ellipse_at_top_right,rgba(168,85,247,0.08),transparent_50%)] dark:bg-[radial-gradient(ellipse_at_top_right,rgba(168,85,247,0.1),transparent_50%)]' : 'bg-[radial-gradient(ellipse_at_top_right,rgba(245,158,11,0.08),transparent_50%)] dark:bg-[radial-gradient(ellipse_at_top_right,rgba(245,158,11,0.1),transparent_50%)]'}`} />
      <CardContent className="relative pt-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <History className={`h-5 w-5 ${hasOpportunity ? 'text-purple-600 dark:text-purple-400' : 'text-amber-600 dark:text-amber-400'}`} />
              <span className={`text-sm font-medium ${hasOpportunity ? 'text-purple-600 dark:text-purple-400' : 'text-amber-600 dark:text-amber-400'}`}>
                Legacy Plan Detector
              </span>
            </div>
            <h2 className="text-4xl font-bold text-foreground dark:text-white mb-2">
              <AnimatedNumber value={summary.customersOnLegacyPricing} /> customers
            </h2>
            <p className="text-lg text-foreground/80 dark:text-zinc-300 max-w-md">
              are on legacy pricing, paying{' '}
              <span className={hasOpportunity ? 'text-purple-600 dark:text-purple-400' : 'text-amber-600 dark:text-amber-400'}>
                {summary.averagePricingGapPercent.toFixed(0)}% below
              </span>{' '}
              current rates
            </p>
            <p className="text-sm text-muted-foreground dark:text-zinc-500 mt-2">
              {summary.legacyPercent.toFixed(0)}% of your {summary.totalActiveCustomers} active customers
            </p>
          </div>
          <div className="text-right space-y-4">
            <div>
              <p className="text-xs text-muted-foreground dark:text-zinc-500 uppercase tracking-wider">Annual Revenue Gap</p>
              <p className={`text-2xl font-bold ${hasOpportunity ? 'text-purple-600 dark:text-purple-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {formatCurrency(summary.totalAnnualRevenueGap)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground dark:text-zinc-500 uppercase tracking-wider">Recoverable</p>
              <p className="text-xl font-semibold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(summary.projectedRecoveryWithMigration)}/yr
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (variant === 'hero') {
    return heroCard;
  }
  
  return (
    <div className="space-y-6">
      {/* Hero Section - The Key Insight */}
      {heroCard}

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard 
          icon={Crown} 
          label="Deep Legacy (2+ yrs)" 
          value={summary.deepLegacyCount}
          subValue="Most stable segment"
          color="purple"
        />
        <StatCard 
          icon={Shield} 
          label="Safe to Migrate" 
          value={summary.safeToMigrateCount}
          subValue={`${summary.needsCarefulHandlingCount} need careful handling`}
          color="emerald"
        />
        <StatCard 
          icon={Wallet} 
          label="Avg Gap per Customer" 
          value={formatCurrency(summary.totalAnnualRevenueGap / summary.customersOnLegacyPricing)}
          subValue="/year"
          color="blue"
        />
        <StatCard 
          icon={Target} 
          label="Migration Confidence" 
          value={`${(summary.migrationConfidence * 100).toFixed(0)}%`}
          subValue={summary.recommendedMigrationPath}
          color={summary.migrationConfidence >= 0.7 ? 'emerald' : 'amber'}
        />
      </div>

      {/* Churn Comparison - The "Aha!" Moment */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader 
          className="cursor-pointer hover:bg-zinc-800/30 transition-colors"
          onClick={() => toggleSection('churn')}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-400" />
              <CardTitle className="text-lg">The Key Insight: Churn Comparison</CardTitle>
              {summary.churnComparison.legacyMoreStable && (
                <Badge variant="outline" className="ml-2 border-emerald-500/30 text-emerald-400">
                  Opportunity
                </Badge>
              )}
            </div>
            {expandedSections.has('churn') ? (
              <ChevronUp className="h-5 w-5 text-zinc-500" />
            ) : (
              <ChevronDown className="h-5 w-5 text-zinc-500" />
            )}
          </div>
          <CardDescription>
            Do legacy customers churn more or less than newer customers?
          </CardDescription>
        </CardHeader>
        {expandedSections.has('churn') && (
          <CardContent>
            <ChurnComparisonCard comparison={summary.churnComparison} />
          </CardContent>
        )}
      </Card>

      {/* AI Analysis */}
      {aiNarrative && (
        <Card className="bg-gradient-to-br from-purple-950/20 via-zinc-900/50 to-zinc-900/50 border-purple-900/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Sparkles className="h-5 w-5 text-purple-400" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-purple-400 uppercase tracking-wider mb-3">AI Analysis</p>
                <div className="space-y-2">
                  {aiNarrative.split('\n').filter(line => line.trim()).map((line, idx) => (
                    <p key={idx} className="text-zinc-300 leading-relaxed">
                      {line}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {aiRecommendations.length > 0 && (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader 
            className="cursor-pointer hover:bg-zinc-800/30 transition-colors"
            onClick={() => toggleSection('recommendations')}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-emerald-400" />
                <CardTitle className="text-lg">Recommended Actions</CardTitle>
                <Badge variant="outline" className="ml-2">{aiRecommendations.length}</Badge>
              </div>
              {expandedSections.has('recommendations') ? (
                <ChevronUp className="h-5 w-5 text-zinc-500" />
              ) : (
                <ChevronDown className="h-5 w-5 text-zinc-500" />
              )}
            </div>
            <CardDescription>Data-driven migration recommendations</CardDescription>
          </CardHeader>
          {expandedSections.has('recommendations') && (
            <CardContent className="space-y-4">
              {aiRecommendations.map((rec, idx) => (
                <div 
                  key={idx}
                  className={`p-4 rounded-lg border transition-colors ${
                    rec.riskLevel === 'LOW' 
                      ? 'bg-emerald-950/20 border-emerald-900/30 hover:border-emerald-700/50' 
                      : rec.riskLevel === 'MEDIUM'
                      ? 'bg-amber-950/20 border-amber-900/30 hover:border-amber-700/50'
                      : 'bg-red-950/20 border-red-900/30 hover:border-red-700/50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                        rec.riskLevel === 'LOW' 
                          ? 'bg-emerald-500/20 text-emerald-400' 
                          : rec.riskLevel === 'MEDIUM'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {idx + 1}
                      </span>
                      <h4 className="font-semibold text-white">{rec.title}</h4>
                      <RiskBadge level={rec.riskLevel} />
                    </div>
                    {rec.expectedImpact > 0 && (
                      <div className="flex items-center gap-1.5">
                        <DollarSign className="h-4 w-4 text-emerald-400" />
                        <span className="text-sm text-emerald-400 font-medium">
                          +{formatCurrency(rec.expectedImpact)}/yr
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-zinc-400 mb-2 ml-8">{rec.description}</p>
                  <div className="flex items-center gap-4 text-xs text-zinc-500 ml-8">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {rec.customers} customers
                    </span>
                    <span className="flex items-center gap-1">
                      <Info className="h-3 w-3" />
                      {rec.dataSupport}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      )}

      {/* Plan Breakdown */}
      {planBreakdown.length > 0 && (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader 
            className="cursor-pointer hover:bg-zinc-800/30 transition-colors"
            onClick={() => toggleSection('plans')}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-purple-400" />
                <CardTitle className="text-lg">Legacy Pricing by Plan</CardTitle>
                <Badge variant="outline" className="ml-2">{planBreakdown.length}</Badge>
              </div>
              {expandedSections.has('plans') ? (
                <ChevronUp className="h-5 w-5 text-zinc-500" />
              ) : (
                <ChevronDown className="h-5 w-5 text-zinc-500" />
              )}
            </div>
            <CardDescription>
              Which plans have the most legacy pricing opportunity
            </CardDescription>
          </CardHeader>
          {expandedSections.has('plans') && (
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {planBreakdown.map((plan) => (
                  <PlanBreakdownCard key={plan.planId} plan={plan} />
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Individual Legacy Customers */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader 
          className="cursor-pointer hover:bg-zinc-800/30 transition-colors"
          onClick={() => toggleSection('customers')}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-zinc-400" />
              <CardTitle className="text-lg">Legacy Customers</CardTitle>
              <Badge variant="outline" className="ml-2">{legacyCustomers.length}</Badge>
            </div>
            {expandedSections.has('customers') ? (
              <ChevronUp className="h-5 w-5 text-zinc-500" />
            ) : (
              <ChevronDown className="h-5 w-5 text-zinc-500" />
            )}
          </div>
          <CardDescription>
            Customers on legacy pricing, sorted by revenue opportunity
          </CardDescription>
        </CardHeader>
        {expandedSections.has('customers') && (
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
                    <th className="pb-3 font-medium">Customer</th>
                    <th className="pb-3 font-medium">Plan</th>
                    <th className="pb-3 font-medium text-right">Current Price</th>
                    <th className="pb-3 font-medium text-right">Market Price</th>
                    <th className="pb-3 font-medium text-right">Gap</th>
                    <th className="pb-3 font-medium text-center">Tenure</th>
                    <th className="pb-3 font-medium text-center">Risk</th>
                    <th className="pb-3 font-medium text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {legacyCustomers.slice(0, 25).map((customer) => (
                    <tr key={customer.customerId} className="hover:bg-zinc-800/30">
                      <td className="py-3">
                        <p className="text-sm text-white">{customer.email || 'Anonymous'}</p>
                        <p className="text-xs text-zinc-500">
                          Since {formatDate(customer.customerSince)}
                        </p>
                      </td>
                      <td className="py-3 text-sm text-zinc-400">
                        {customer.planName || '—'}
                      </td>
                      <td className="py-3 text-sm text-right text-amber-400">
                        {formatCurrency(customer.currentPayingPrice)}/mo
                      </td>
                      <td className="py-3 text-sm text-right text-zinc-300">
                        {formatCurrency(customer.currentMarketPrice)}/mo
                      </td>
                      <td className="py-3 text-right">
                        <p className="text-sm font-medium text-purple-400">
                          {formatCurrency(customer.annualGap)}/yr
                        </p>
                        <p className="text-xs text-zinc-500">
                          {customer.pricingGapPercent.toFixed(0)}% below
                        </p>
                      </td>
                      <td className="py-3 text-center">
                        <LegacyTierBadge tier={customer.legacyTier} />
                      </td>
                      <td className="py-3 text-center">
                        <RiskBadge level={customer.migrationRisk} />
                      </td>
                      <td className="py-3 text-center">
                        <ActionBadge action={customer.recommendedAction} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {legacyCustomers.length > 25 && (
                <p className="text-xs text-zinc-500 text-center py-4">
                  Showing 25 of {legacyCustomers.length} legacy customers
                </p>
              )}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

