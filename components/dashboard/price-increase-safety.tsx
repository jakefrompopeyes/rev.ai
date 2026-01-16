'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { AnimatedNumber } from '@/components/ui/animated-number';
import {
  TrendingUp,
  TrendingDown,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
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
  BarChart3,
  Target,
  Zap,
  Clock,
} from 'lucide-react';

// ============================================================================
// TYPES (matching backend)
// ============================================================================

interface PriceIncreaseEvent {
  id: string;
  subscriptionId: string;
  customerId: string;
  customerEmail: string | null;
  previousPrice: number;
  newPrice: number;
  increaseAmount: number;
  increasePercent: number;
  planId: string | null;
  planName: string | null;
  occurredAt: string;
  outcome: 'stayed' | 'churned' | 'pending';
  daysUntilChurn: number | null;
  currentStatus: string;
  totalRevenueAfter: number;
  monthsRetainedAfter: number;
}

interface PlanPriceIncreaseSafety {
  planId: string;
  planName: string | null;
  currentPrice: number;
  priceIncreases: {
    date: string;
    fromPrice: number;
    toPrice: number;
    increasePercent: number;
  }[];
  customersAffected: number;
  customersStayed: number;
  customersChurned: number;
  customersPending: number;
  churnRateAfterIncrease: number;
  baselineChurnRate: number;
  churnDelta: number;
  revenueRetainedAfterIncrease: number;
  averageMonthsRetainedAfter: number;
  safetyScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  safeToIncrease: boolean;
  maxSafeIncrease: number;
  confidence: number;
}

interface SegmentPriceSensitivity {
  segment: string;
  description: string;
  size: number;
  experiencedIncrease: number;
  stayedAfterIncrease: number;
  churnedAfterIncrease: number;
  retentionRate: number;
  sensitivity: 'LOW' | 'MEDIUM' | 'HIGH';
  recommendation: string;
}

interface PriceIncreaseSafetySummary {
  periodDays: number;
  analyzedFrom: string;
  analyzedTo: string;
  totalPriceIncreases: number;
  customersAffected: number;
  overallRetentionRate: number;
  overallChurnRate: number;
  baselineChurnRate: number;
  priceIncreaseChurnImpact: number;
  revenueGainedFromIncreases: number;
  revenueLostToChurn: number;
  netRevenueImpact: number;
  overallSafetyScore: number;
  overallRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  safestPlanToIncrease: string | null;
  safestPlanIncreasePotential: number;
}

interface AIRecommendation {
  priority: number;
  title: string;
  description: string;
  expectedImpact: number;
  confidence: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  dataSupport: string;
}

interface PriceIncreaseSafetyReport {
  summary: PriceIncreaseSafetySummary;
  planSafety: PlanPriceIncreaseSafety[];
  segmentSensitivity: SegmentPriceSensitivity[];
  priceIncreaseEvents: PriceIncreaseEvent[];
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
    LOW: { color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: ShieldCheck, label: 'Low Risk' },
    MEDIUM: { color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: ShieldAlert, label: 'Medium Risk' },
    HIGH: { color: 'bg-red-500/10 text-red-400 border-red-500/20', icon: ShieldX, label: 'High Risk' },
  };
  const { color, icon: Icon, label } = config[level];
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border ${color}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

function SensitivityBadge({ sensitivity }: { sensitivity: 'LOW' | 'MEDIUM' | 'HIGH' }) {
  const config = {
    LOW: { color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', label: 'Price Insensitive' },
    MEDIUM: { color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', label: 'Moderately Sensitive' },
    HIGH: { color: 'bg-red-500/10 text-red-400 border-red-500/20', label: 'Price Sensitive' },
  };
  const { color, label } = config[sensitivity];
  
  return (
    <span className={`px-2 py-0.5 text-xs rounded-full border ${color}`}>
      {label}
    </span>
  );
}

function OutcomeBadge({ outcome }: { outcome: PriceIncreaseEvent['outcome'] }) {
  const config = {
    stayed: { color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', label: 'Stayed' },
    churned: { color: 'bg-red-500/10 text-red-400 border-red-500/20', label: 'Churned' },
    pending: { color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', label: 'Pending' },
  };
  const { color, label } = config[outcome];
  
  return (
    <span className={`px-2 py-0.5 text-xs rounded-full border ${color}`}>
      {label}
    </span>
  );
}

function SafetyGauge({ score, size = 120 }: { score: number; size?: number }) {
  const radius = (size - 20) / 2;
  const circumference = radius * Math.PI; // Half circle
  const offset = circumference - (score / 100) * circumference;
  
  const getColor = (score: number) => {
    if (score >= 70) return { stroke: '#10b981', bg: 'from-emerald-500/20' }; // emerald
    if (score >= 40) return { stroke: '#f59e0b', bg: 'from-amber-500/20' }; // amber
    return { stroke: '#ef4444', bg: 'from-red-500/20' }; // red
  };
  
  const { stroke, bg } = getColor(score);

  return (
    <div className="relative" style={{ width: size, height: size / 2 + 30 }}>
      <svg width={size} height={size / 2 + 10} className="overflow-visible">
        {/* Background arc */}
        <path
          d={`M 10 ${size / 2} A ${radius} ${radius} 0 0 1 ${size - 10} ${size / 2}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="12"
          className="text-zinc-800"
          strokeLinecap="round"
        />
        {/* Foreground arc */}
        <path
          d={`M 10 ${size / 2} A ${radius} ${radius} 0 0 1 ${size - 10} ${size / 2}`}
          fill="none"
          stroke={stroke}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute bottom-0 left-0 right-0 text-center">
        <span className="text-3xl font-bold text-white">{Math.round(score)}</span>
        <span className="text-sm text-zinc-500 block">Safety Score</span>
      </div>
    </div>
  );
}

function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  subValue,
  color = 'emerald'
}: { 
  icon: React.ElementType; 
  label: string; 
  value: string | number;
  subValue?: string;
  color?: 'emerald' | 'red' | 'amber' | 'blue' | 'purple';
}) {
  const colors = {
    emerald: 'bg-emerald-500/10 text-emerald-500',
    red: 'bg-red-500/10 text-red-500',
    amber: 'bg-amber-500/10 text-amber-500',
    blue: 'bg-blue-500/10 text-blue-500',
    purple: 'bg-purple-500/10 text-purple-500',
  };
  
  return (
    <Card className="bg-zinc-900/50 border-zinc-800">
      <CardContent className="pt-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${colors[color]}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-xs text-zinc-500">{label}</p>
            {subValue && <p className="text-xs text-zinc-600 mt-0.5">{subValue}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PlanSafetyCard({ plan }: { plan: PlanPriceIncreaseSafety }) {
  const [expanded, setExpanded] = useState(false);
  
  const completedCustomers = plan.customersAffected - plan.customersPending;
  const retentionRate = completedCustomers > 0 
    ? (plan.customersStayed / completedCustomers) * 100 
    : 0;

  return (
    <Card className={`bg-zinc-900/50 border-zinc-800 ${plan.safeToIncrease ? 'hover:border-emerald-900/50' : ''} transition-colors`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-white">{plan.planName || plan.planId}</h4>
              <RiskBadge level={plan.riskLevel} />
            </div>
            <p className="text-sm text-zinc-500">{formatCurrency(plan.currentPrice)}/mo</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-white">{plan.safetyScore}</div>
            <p className="text-xs text-zinc-500">Safety Score</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 text-sm mb-4">
          <div>
            <span className="text-zinc-500 block">Customers</span>
            <span className="text-white font-medium">{plan.customersAffected}</span>
          </div>
          <div>
            <span className="text-zinc-500 block">Stayed</span>
            <span className="text-emerald-400 font-medium">{retentionRate.toFixed(0)}%</span>
          </div>
          <div>
            <span className="text-zinc-500 block">Churn Impact</span>
            <span className={`font-medium ${plan.churnDelta <= 0 ? 'text-emerald-400' : plan.churnDelta <= 3 ? 'text-amber-400' : 'text-red-400'}`}>
              {plan.churnDelta > 0 ? '+' : ''}{plan.churnDelta.toFixed(1)}%
            </span>
          </div>
        </div>

        {plan.safeToIncrease && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-950/30 border border-emerald-900/30 mb-4">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            <div>
              <p className="text-sm font-medium text-emerald-400">Safe to increase up to {plan.maxSafeIncrease}%</p>
              <p className="text-xs text-emerald-400/70">{(plan.confidence * 100).toFixed(0)}% confidence based on {plan.customersAffected} customers</p>
            </div>
          </div>
        )}

        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-sm text-zinc-400 hover:text-white transition-colors"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          {expanded ? 'Show less' : 'View history'}
        </button>

        {expanded && (
          <div className="mt-4 pt-4 border-t border-zinc-800 space-y-3">
            <h5 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Past Price Increases</h5>
            {plan.priceIncreases.length === 0 ? (
              <p className="text-sm text-zinc-500">No historical price increases found</p>
            ) : (
              <div className="space-y-2">
                {plan.priceIncreases.slice(0, 5).map((pi, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm p-2 rounded bg-zinc-800/50">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-zinc-500" />
                      <span className="text-zinc-400">{formatDate(pi.date)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-400">{formatCurrency(pi.fromPrice)}</span>
                      <ArrowRight className="h-3 w-3 text-zinc-600" />
                      <span className="text-white">{formatCurrency(pi.toPrice)}</span>
                      <Badge variant="outline" className="ml-2 border-emerald-500/30 text-emerald-400">
                        +{pi.increasePercent.toFixed(0)}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 text-sm mt-4">
              <div className="p-3 rounded bg-zinc-800/50">
                <span className="text-zinc-500 block text-xs">Revenue Retained</span>
                <span className="text-white font-medium">{formatCurrency(plan.revenueRetainedAfterIncrease)}</span>
              </div>
              <div className="p-3 rounded bg-zinc-800/50">
                <span className="text-zinc-500 block text-xs">Avg Retention</span>
                <span className="text-white font-medium">{plan.averageMonthsRetainedAfter.toFixed(1)} months</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export type PriceIncreaseSafetyVariant = 'full' | 'hero';

export function PriceIncreaseSafety({ variant = 'full' }: { variant?: PriceIncreaseSafetyVariant }) {
  const [report, setReport] = useState<PriceIncreaseSafetyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['recommendations', 'plans'])
  );

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/price-increase-safety');
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch price increase safety data');
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
            <p className="text-sm text-zinc-500">Analyzing price increase safety...</p>
            <p className="text-xs text-zinc-600">Checking historical retention after price changes</p>
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

  const { summary, planSafety, segmentSensitivity, priceIncreaseEvents, aiNarrative, aiRecommendations } = report;

  // Determine the hero message based on safety
  const heroConfig = {
    LOW: {
      gradient: 'from-emerald-950/30 via-zinc-900/50 to-zinc-900/50',
      border: 'border-emerald-900/30',
      iconBg: 'bg-emerald-500/10',
      icon: ShieldCheck,
      iconColor: 'text-emerald-400',
      title: 'Safe to Raise Prices',
      titleColor: 'text-emerald-400',
    },
    MEDIUM: {
      gradient: 'from-amber-950/30 via-zinc-900/50 to-zinc-900/50',
      border: 'border-amber-900/30',
      iconBg: 'bg-amber-500/10',
      icon: ShieldAlert,
      iconColor: 'text-amber-400',
      title: 'Proceed with Caution',
      titleColor: 'text-amber-400',
    },
    HIGH: {
      gradient: 'from-red-950/30 via-zinc-900/50 to-zinc-900/50',
      border: 'border-red-900/30',
      iconBg: 'bg-red-500/10',
      icon: ShieldX,
      iconColor: 'text-red-400',
      title: 'High Churn Risk',
      titleColor: 'text-red-400',
    },
  };

  const hero = heroConfig[summary.overallRiskLevel];
  const HeroIcon = hero.icon;

  const heroCard = (
    <Card className={`relative overflow-hidden bg-gradient-to-br ${hero.gradient} ${hero.border}`}>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.1),transparent_50%)]" />
      <CardContent className="relative pt-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <div className={`p-2 rounded-lg ${hero.iconBg}`}>
                <HeroIcon className={`h-5 w-5 ${hero.iconColor}`} />
              </div>
              <span className={`text-sm font-medium ${hero.titleColor}`}>Price Increase Safety Detector</span>
            </div>
            <h2 className={`text-3xl font-bold mb-2 ${hero.titleColor}`}>
              {hero.title}
            </h2>
            <p className="text-lg text-zinc-300 max-w-xl">
              {summary.overallRetentionRate.toFixed(0)}% of customers stayed after past price increases
            </p>
            <p className="text-sm text-zinc-500 mt-2">
              Based on {summary.totalPriceIncreases} price increases affecting {summary.customersAffected} customers over {summary.periodDays} days
            </p>
          </div>
          <div className="hidden md:block">
            <SafetyGauge score={summary.overallSafetyScore} />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (variant === 'hero') {
    return heroCard;
  }

  return (
    <div className="space-y-4">
      {/* Hero Section */}
      {heroCard}

      {/* Key Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard 
          icon={Users} 
          label="Customers Affected" 
          value={summary.customersAffected}
          subValue={`${summary.totalPriceIncreases} price increases`}
          color="blue"
        />
        <StatCard 
          icon={TrendingUp} 
          label="Retention Rate" 
          value={`${summary.overallRetentionRate.toFixed(0)}%`}
          subValue={`vs ${summary.baselineChurnRate.toFixed(0)}% baseline churn`}
          color="emerald"
        />
        <StatCard 
          icon={summary.priceIncreaseChurnImpact <= 0 ? TrendingDown : TrendingUp} 
          label="Churn Impact" 
          value={`${summary.priceIncreaseChurnImpact > 0 ? '+' : ''}${summary.priceIncreaseChurnImpact.toFixed(1)}%`}
          subValue={summary.priceIncreaseChurnImpact <= 0 ? 'No extra churn!' : 'Extra churn from increases'}
          color={summary.priceIncreaseChurnImpact <= 0 ? 'emerald' : summary.priceIncreaseChurnImpact <= 3 ? 'amber' : 'red'}
        />
        <StatCard 
          icon={DollarSign} 
          label="Net Revenue Impact" 
          value={formatCurrency(summary.netRevenueImpact)}
          subValue={summary.netRevenueImpact >= 0 ? 'Gained from increases' : 'Lost to churn'}
          color={summary.netRevenueImpact >= 0 ? 'emerald' : 'red'}
        />
      </div>

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
            data-expanded={expandedSections.has('recommendations')}
            className="group p-4 space-y-1 cursor-pointer hover:bg-zinc-800/30 transition-colors"
            onClick={() => toggleSection('recommendations')}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-emerald-400" />
                <CardTitle className="text-base">Recommended Actions</CardTitle>
                <Badge variant="outline" className="ml-2">{aiRecommendations.length}</Badge>
              </div>
              {expandedSections.has('recommendations') ? (
                <ChevronUp className="h-4 w-4 text-zinc-500" />
              ) : (
                <ChevronDown className="h-4 w-4 text-zinc-500" />
              )}
            </div>
            <CardDescription className="text-xs hidden group-hover:block group-data-[expanded=true]:block">
              Data-driven recommendations for safe price optimization
            </CardDescription>
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
                    <div className="flex items-center gap-1.5">
                      <DollarSign className={`h-4 w-4 ${rec.expectedImpact >= 0 ? 'text-emerald-400' : 'text-red-400'}`} />
                      <span className={`text-sm font-medium ${rec.expectedImpact >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {rec.expectedImpact >= 0 ? '+' : ''}{formatCurrency(rec.expectedImpact)}/mo
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-zinc-400 mb-2 ml-8">{rec.description}</p>
                  <div className="flex items-center gap-4 text-xs text-zinc-500 ml-8">
                    <span className="flex items-center gap-1">
                      <Info className="h-3 w-3" />
                      {rec.dataSupport}
                    </span>
                    <span className="flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      {(rec.confidence * 100).toFixed(0)}% confidence
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      )}

      {/* Plan-by-Plan Safety */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader 
          data-expanded={expandedSections.has('plans')}
          className="group p-4 space-y-1 cursor-pointer hover:bg-zinc-800/30 transition-colors"
          onClick={() => toggleSection('plans')}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-400" />
              <CardTitle className="text-base">Safety by Plan</CardTitle>
              <Badge variant="outline" className="ml-2">{planSafety.length}</Badge>
            </div>
            {expandedSections.has('plans') ? (
              <ChevronUp className="h-4 w-4 text-zinc-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-zinc-500" />
            )}
          </div>
          <CardDescription className="text-xs hidden group-hover:block group-data-[expanded=true]:block">
            How each plan responded to historical price increases
          </CardDescription>
        </CardHeader>
        {expandedSections.has('plans') && (
          <CardContent>
            {planSafety.length === 0 ? (
              <div className="text-center py-8">
                <Shield className="h-12 w-12 text-zinc-700 mx-auto mb-3" />
                <p className="text-sm text-zinc-500">No price increase data available yet</p>
                <p className="text-xs text-zinc-600 mt-1">Data will appear after your first price changes</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {planSafety.map((plan) => (
                  <PlanSafetyCard key={plan.planId} plan={plan} />
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Segment Sensitivity */}
      {segmentSensitivity.length > 0 && (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader 
            data-expanded={expandedSections.has('segments')}
            className="group p-4 space-y-1 cursor-pointer hover:bg-zinc-800/30 transition-colors"
            onClick={() => toggleSection('segments')}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-purple-400" />
                <CardTitle className="text-base">Price Sensitivity by Segment</CardTitle>
                <Badge variant="outline" className="ml-2">{segmentSensitivity.length}</Badge>
              </div>
              {expandedSections.has('segments') ? (
                <ChevronUp className="h-4 w-4 text-zinc-500" />
              ) : (
                <ChevronDown className="h-4 w-4 text-zinc-500" />
              )}
            </div>
            <CardDescription className="text-xs hidden group-hover:block group-data-[expanded=true]:block">
              Which customer segments are most price sensitive
            </CardDescription>
          </CardHeader>
          {expandedSections.has('segments') && (
            <CardContent>
              <div className="space-y-3">
                {segmentSensitivity.map((segment) => (
                  <div 
                    key={segment.segment}
                    className="flex items-center justify-between p-4 rounded-lg bg-zinc-800/50 border border-zinc-700/50"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-white">{segment.segment}</h4>
                        <SensitivityBadge sensitivity={segment.sensitivity} />
                      </div>
                      <p className="text-sm text-zinc-500">{segment.description}</p>
                      <p className="text-xs text-zinc-600 mt-1">{segment.recommendation}</p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-lg font-bold text-white">{segment.retentionRate.toFixed(0)}%</p>
                      <p className="text-xs text-zinc-500">retention</p>
                      <p className="text-xs text-zinc-600">{segment.size} customers</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Recent Price Increase Events */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader 
          data-expanded={expandedSections.has('events')}
          className="group p-4 space-y-1 cursor-pointer hover:bg-zinc-800/30 transition-colors"
          onClick={() => toggleSection('events')}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-zinc-400" />
              <CardTitle className="text-base">Recent Price Increases</CardTitle>
              <Badge variant="outline" className="ml-2">{priceIncreaseEvents.length}</Badge>
            </div>
            {expandedSections.has('events') ? (
              <ChevronUp className="h-4 w-4 text-zinc-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-zinc-500" />
            )}
          </div>
          <CardDescription className="text-xs hidden group-hover:block group-data-[expanded=true]:block">
            Individual price increase events and their outcomes
          </CardDescription>
        </CardHeader>
        {expandedSections.has('events') && (
          <CardContent>
            {priceIncreaseEvents.length === 0 ? (
              <p className="text-sm text-zinc-500 text-center py-8">No price increase events found</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
                      <th className="pb-3 font-medium">Date</th>
                      <th className="pb-3 font-medium">Customer</th>
                      <th className="pb-3 font-medium">Plan</th>
                      <th className="pb-3 font-medium text-right">Price Change</th>
                      <th className="pb-3 font-medium text-right">Increase</th>
                      <th className="pb-3 font-medium text-center">Outcome</th>
                      <th className="pb-3 font-medium text-right">Revenue After</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {priceIncreaseEvents.slice(0, 25).map((event) => (
                      <tr key={event.id} className="hover:bg-zinc-800/30">
                        <td className="py-3 text-sm text-zinc-300">
                          {formatDate(event.occurredAt)}
                        </td>
                        <td className="py-3">
                          <p className="text-sm text-white">{event.customerEmail || 'Anonymous'}</p>
                        </td>
                        <td className="py-3 text-sm text-zinc-400">
                          {event.planName || '—'}
                        </td>
                        <td className="py-3 text-sm text-right">
                          <span className="text-zinc-400">{formatCurrency(event.previousPrice)}</span>
                          <span className="text-zinc-600 mx-1">→</span>
                          <span className="text-white">{formatCurrency(event.newPrice)}</span>
                        </td>
                        <td className="py-3 text-sm text-right text-emerald-400 font-medium">
                          +{event.increasePercent.toFixed(0)}%
                        </td>
                        <td className="py-3 text-center">
                          <OutcomeBadge outcome={event.outcome} />
                        </td>
                        <td className="py-3 text-sm text-right text-zinc-300">
                          {formatCurrency(event.totalRevenueAfter)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {priceIncreaseEvents.length > 25 && (
                  <p className="text-xs text-zinc-500 text-center py-4">
                    Showing 25 of {priceIncreaseEvents.length} events
                  </p>
                )}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}

