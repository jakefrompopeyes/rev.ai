'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { AnimatedNumber } from '@/components/ui/animated-number';
import {
  Calendar,
  Users,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Target,
  AlertCircle,
  CheckCircle,
  Info,
  Sparkles,
  RefreshCw,
  TrendingUp,
  Clock,
  CreditCard,
  Award,
  Zap,
} from 'lucide-react';

// ============================================================================
// TYPES (matching backend)
// ============================================================================

interface AnnualPlanCandidate {
  customerId: string;
  subscriptionId: string;
  email: string | null;
  planId: string | null;
  planName: string | null;
  monthlyAmount: number;
  customerSince: string;
  tenureMonths: number;
  consecutivePayments: number;
  status: string;
  paymentFailureCount: number;
  hasDiscount: boolean;
  monthlyLTV: number;
  currentAnnualValue: number;
  discountedAnnualValue: number;
  cashFlowGain: number;
  conversionLikelihood: 'HIGH' | 'MEDIUM' | 'LOW';
  conversionScore: number;
}

interface PlanAnnualOpportunity {
  planId: string;
  planName: string | null;
  monthlyPrice: number;
  eligibleCustomers: number;
  highLikelihood: number;
  mediumLikelihood: number;
  lowLikelihood: number;
  totalMonthlyRevenue: number;
  potentialAnnualCashFlow: number;
  potentialGain: number;
}

interface AnnualOpportunitySummary {
  analyzedAt: string;
  eligibleCustomers: number;
  totalMonthlyCustomers: number;
  eligiblePercent: number;
  totalCurrentMonthlyRevenue: number;
  projectedAnnualCashFlow: number;
  cashFlowGain: number;
  annualDiscountPercent: number;
  expectedConversions: number;
  expectedCashFlowGain: number;
  highLikelihoodCount: number;
  mediumLikelihoodCount: number;
  lowLikelihoodCount: number;
  avgTenureMonths: number;
  avgConsecutivePayments: number;
  percentWithPerfectHistory: number;
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

interface AnnualPlanOpportunityReport {
  summary: AnnualOpportunitySummary;
  candidates: AnnualPlanCandidate[];
  planBreakdown: PlanAnnualOpportunity[];
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

function LikelihoodBadge({ likelihood }: { likelihood: AnnualPlanCandidate['conversionLikelihood'] }) {
  const config = {
    HIGH: { color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: TrendingUp, label: 'High' },
    MEDIUM: { color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: Target, label: 'Medium' },
    LOW: { color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20', icon: Clock, label: 'Low' },
  };
  const { color, icon: Icon, label } = config[likelihood];
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border ${color}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

function RiskBadge({ risk }: { risk: AIRecommendation['riskLevel'] }) {
  const config = {
    LOW: { color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    MEDIUM: { color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    HIGH: { color: 'bg-red-500/10 text-red-400 border-red-500/20' },
  };
  const { color } = config[risk];
  
  return (
    <span className={`px-2 py-0.5 text-xs rounded-full border ${color}`}>
      {risk} risk
    </span>
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
  color?: 'amber' | 'emerald' | 'blue' | 'purple' | 'cyan';
}) {
  const colors = {
    amber: 'bg-amber-500/10 text-amber-500',
    emerald: 'bg-emerald-500/10 text-emerald-500',
    blue: 'bg-blue-500/10 text-blue-500',
    purple: 'bg-purple-500/10 text-purple-500',
    cyan: 'bg-cyan-500/10 text-cyan-500',
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

function ConversionScoreBar({ score }: { score: number }) {
  const getColor = (s: number) => {
    if (s >= 75) return 'bg-emerald-500';
    if (s >= 50) return 'bg-amber-500';
    return 'bg-zinc-500';
  };
  
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
        <div 
          className={`h-full ${getColor(score)} transition-all duration-500`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-xs text-zinc-400">{score}</span>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export type AnnualPlanOpportunityVariant = 'full' | 'hero';

export function AnnualPlanOpportunity({ variant = 'full' }: { variant?: AnnualPlanOpportunityVariant }) {
  const [report, setReport] = useState<AnnualPlanOpportunityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [discountPercent, setDiscountPercent] = useState(10);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['signals', 'recommendations', 'plans'])
  );

  async function fetchData(discount: number = discountPercent) {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/annual-plan-opportunity?discount=${discount}`);
      let data: any = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        throw new Error(data?.error || `Request failed (${response.status})`);
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to fetch annual plan opportunity data');
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDiscountChange = (newDiscount: number) => {
    if (newDiscount === discountPercent) return;
    setDiscountPercent(newDiscount);
    fetchData(newDiscount);
  };

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
            <p className="text-sm text-zinc-500">Analyzing subscription patterns...</p>
            <p className="text-xs text-zinc-600">Finding loyal monthly subscribers</p>
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
              onClick={() => fetchData()}
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

  const { summary, candidates, planBreakdown, aiNarrative, aiRecommendations } = report;

  const hasMonthlyCustomers = summary.totalMonthlyCustomers > 0;
  const hasEligibleCustomers = summary.eligibleCustomers > 0;
  const heroMessage = hasEligibleCustomers
    ? 'monthly subscribers would probably commit yearly if asked'
    : hasMonthlyCustomers
      ? 'No eligible customers yet — look for 6+ months tenure, ≤1 failed payment in 12 months, no discounts.'
      : 'No active monthly customers detected yet.';

  const heroCard = (
    <Card className="relative overflow-hidden bg-card/80 border-border/60 shadow-sm dark:bg-gradient-to-br dark:from-emerald-950/30 dark:via-zinc-900/50 dark:to-zinc-900/50 dark:border-emerald-900/30">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.08),transparent_50%)] dark:bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.1),transparent_50%)]" />
      <CardContent className="relative pt-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Annual Plan Opportunity</span>
            </div>
            <h2 className="text-4xl font-bold text-foreground dark:text-white mb-2">
              <AnimatedNumber value={summary.eligibleCustomers} />
            </h2>
            <p className={`${hasEligibleCustomers ? 'text-lg' : 'text-sm'} text-foreground/80 dark:text-zinc-300 max-w-md`}>
              {heroMessage}
            </p>
            {hasMonthlyCustomers ? (
              <p className="text-sm text-muted-foreground dark:text-zinc-500 mt-2">
                {summary.eligiblePercent.toFixed(0)}% of your {summary.totalMonthlyCustomers} monthly customers
              </p>
            ) : (
              <p className="text-xs text-muted-foreground/80 dark:text-zinc-600 mt-2">
                We need at least one active monthly subscription to run this analysis.
              </p>
            )}
          </div>
          <div className="text-right space-y-4">
            <div>
              <p className="text-xs text-muted-foreground dark:text-zinc-500 uppercase tracking-wider">Expected Cash Flow Gain</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(summary.expectedCashFlowGain)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground dark:text-zinc-500 uppercase tracking-wider">With {summary.annualDiscountPercent}% Discount</p>
              <p className="text-xl font-semibold text-emerald-600/90 dark:text-emerald-300">{formatCurrency(summary.projectedAnnualCashFlow)}</p>
              <p className="text-xs text-muted-foreground/70 dark:text-zinc-600">
                vs {formatCurrency(summary.totalCurrentMonthlyRevenue * 12)}/yr from eligible monthly subscribers
              </p>
            </div>
          </div>
        </div>
        
        {/* Discount Slider */}
        <div className="mt-6 pt-4 border-t border-border/60 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground dark:text-zinc-400">Annual Discount</span>
            <div className="flex items-center gap-3">
              {[5, 10, 15, 20].map(d => (
                <button
                  key={d}
                  onClick={() => handleDiscountChange(d)}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    discountPercent === d
                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted dark:bg-zinc-800/50 dark:text-zinc-400 dark:hover:bg-zinc-700/50'
                  }`}
                >
                  {d}%
                </button>
              ))}
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
    <div className="space-y-4">
      {/* Hero Section - The Big Number */}
      {heroCard}

      {/* Qualification Signals */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader 
          data-expanded={expandedSections.has('signals')}
          className="group p-4 space-y-1 cursor-pointer hover:bg-zinc-800/30 transition-colors"
          onClick={() => toggleSection('signals')}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-cyan-400" />
              <CardTitle className="text-base">Why These Customers Qualify</CardTitle>
            </div>
            {expandedSections.has('signals') ? (
              <ChevronUp className="h-4 w-4 text-zinc-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-zinc-500" />
            )}
          </div>
          <CardDescription className="text-xs hidden group-hover:block group-data-[expanded=true]:block">
            Signals that indicate annual commitment readiness
          </CardDescription>
        </CardHeader>
        {expandedSections.has('signals') && (
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              {/* Signal 1: Tenure */}
              <div className="p-4 rounded-lg bg-cyan-950/20 border border-cyan-900/30">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="h-5 w-5 text-cyan-400" />
                  <h4 className="font-semibold text-white">Long Tenure</h4>
                </div>
                <p className="text-3xl font-bold text-cyan-400 mb-1">
                  {summary.avgTenureMonths.toFixed(1)}
                </p>
                <p className="text-sm text-zinc-400">
                  average months active
                </p>
                <p className="text-xs text-zinc-600 mt-2">
                  6+ months = strong commitment signal
                </p>
              </div>
              
              {/* Signal 2: Payment History */}
              <div className="p-4 rounded-lg bg-emerald-950/20 border border-emerald-900/30">
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard className="h-5 w-5 text-emerald-400" />
                  <h4 className="font-semibold text-white">Low Payment Failures</h4>
                </div>
                <p className="text-3xl font-bold text-emerald-400 mb-1">
                  {summary.percentWithPerfectHistory.toFixed(0)}%
                </p>
                <p className="text-sm text-zinc-400">
                  with zero payment failures
                </p>
                <p className="text-xs text-zinc-600 mt-2">
                  {summary.avgConsecutivePayments.toFixed(0)} avg consecutive payments
                </p>
              </div>
              
              {/* Signal 3: No Discounts */}
              <div className="p-4 rounded-lg bg-purple-950/20 border border-purple-900/30">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="h-5 w-5 text-purple-400" />
                  <h4 className="font-semibold text-white">Full Price</h4>
                </div>
                <p className="text-3xl font-bold text-purple-400 mb-1">
                  {summary.eligibleCustomers}
                </p>
                <p className="text-sm text-zinc-400">
                  paying without discounts
                </p>
                <p className="text-xs text-zinc-600 mt-2">
                  Already committed at market rate
                </p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard 
          icon={TrendingUp} 
          label="High Likelihood" 
          value={summary.highLikelihoodCount}
          subValue={`${((summary.highLikelihoodCount / Math.max(summary.eligibleCustomers, 1)) * 100).toFixed(0)}% of eligible`}
          color="emerald"
        />
        <StatCard 
          icon={Target} 
          label="Medium Likelihood" 
          value={summary.mediumLikelihoodCount}
          subValue="worth pursuing"
          color="amber"
        />
        <StatCard 
          icon={DollarSign} 
          label="Total Cash Flow Gain" 
          value={formatCurrency(summary.cashFlowGain)}
          subValue="if all convert"
          color="cyan"
        />
        <StatCard 
          icon={Users} 
          label="Expected Conversions" 
          value={summary.expectedConversions}
          subValue="~25% conversion rate"
          color="purple"
        />
      </div>

      {/* AI Analysis */}
      {aiNarrative && (
        <Card className="bg-gradient-to-br from-cyan-950/20 via-zinc-900/50 to-zinc-900/50 border-cyan-900/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10">
                <Sparkles className="h-5 w-5 text-cyan-400" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-cyan-400 uppercase tracking-wider mb-3">AI Analysis</p>
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

      {/* Recommendations Section */}
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
              Data-driven recommendations to maximize annual conversions
            </CardDescription>
          </CardHeader>
          {expandedSections.has('recommendations') && (
            <CardContent className="space-y-4">
              {aiRecommendations.map((rec, idx) => (
                <div 
                  key={idx}
                  className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700/50 hover:border-emerald-900/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold">
                        {idx + 1}
                      </span>
                      <h4 className="font-semibold text-white">{rec.title}</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <RiskBadge risk={rec.riskLevel} />
                      <div className="flex items-center gap-1.5">
                        <DollarSign className="h-4 w-4 text-emerald-400" />
                        <span className="text-sm text-emerald-400 font-medium">
                          +{formatCurrency(rec.expectedImpact)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-zinc-400 mb-2 ml-8">{rec.description}</p>
                  <div className="flex items-center justify-between ml-8">
                    <p className="text-xs text-zinc-600 flex items-center gap-1">
                      <Info className="h-3 w-3" />
                      {rec.dataSupport}
                    </p>
                    <p className="text-xs text-zinc-500">
                      <Users className="h-3 w-3 inline mr-1" />
                      {rec.customers} customers
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      )}

      {/* Plan Breakdown Section */}
      {planBreakdown.length > 0 && (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader 
            data-expanded={expandedSections.has('plans')}
            className="group p-4 space-y-1 cursor-pointer hover:bg-zinc-800/30 transition-colors"
            onClick={() => toggleSection('plans')}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-purple-400" />
                <CardTitle className="text-base">Opportunity by Plan</CardTitle>
                <Badge variant="outline" className="ml-2">{planBreakdown.length}</Badge>
              </div>
              {expandedSections.has('plans') ? (
                <ChevronUp className="h-4 w-4 text-zinc-500" />
              ) : (
                <ChevronDown className="h-4 w-4 text-zinc-500" />
              )}
            </div>
            <CardDescription className="text-xs hidden group-hover:block group-data-[expanded=true]:block">
              Which plans have the most annual conversion potential
            </CardDescription>
          </CardHeader>
          {expandedSections.has('plans') && (
            <CardContent>
              <div className="space-y-3">
                {planBreakdown.map((plan) => (
                  <div 
                    key={plan.planId}
                    className="flex items-center justify-between p-4 rounded-lg bg-zinc-800/50 border border-zinc-700/50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-2 h-12 rounded-full bg-gradient-to-b from-emerald-400 to-purple-400" />
                      <div>
                        <p className="text-base font-medium text-white">
                          {plan.planName || plan.planId}
                        </p>
                        <p className="text-sm text-zinc-500">
                          {formatCurrency(plan.monthlyPrice)}/mo · {plan.eligibleCustomers} eligible
                        </p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-emerald-400">{plan.highLikelihood} high</span>
                          <span className="text-xs text-amber-400">{plan.mediumLikelihood} medium</span>
                          <span className="text-xs text-zinc-500">{plan.lowLikelihood} low</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-emerald-400">
                        +{formatCurrency(plan.potentialGain)}
                      </p>
                      <p className="text-xs text-zinc-500">
                        cash flow gain
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Individual Candidates */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader 
          data-expanded={expandedSections.has('candidates')}
          className="group p-4 space-y-1 cursor-pointer hover:bg-zinc-800/30 transition-colors"
          onClick={() => toggleSection('candidates')}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-400" />
              <CardTitle className="text-base">Annual Plan Candidates</CardTitle>
              <Badge variant="outline" className="ml-2">{candidates.length}</Badge>
            </div>
            {expandedSections.has('candidates') ? (
              <ChevronUp className="h-4 w-4 text-zinc-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-zinc-500" />
            )}
          </div>
          <CardDescription className="text-xs hidden group-hover:block group-data-[expanded=true]:block">
            Monthly subscribers ranked by conversion likelihood
          </CardDescription>
        </CardHeader>
        {expandedSections.has('candidates') && (
          <CardContent>
            {candidates.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-zinc-700 mx-auto mb-3" />
                <p className="text-sm text-zinc-500">No eligible candidates found</p>
                <p className="text-xs text-zinc-600 mt-1">
                  Customers need 6+ months tenure, ≤1 failed payment in 12 months, and no active discounts
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
                      <th className="pb-3 font-medium">Customer</th>
                      <th className="pb-3 font-medium">Plan</th>
                      <th className="pb-3 font-medium text-right">Monthly</th>
                      <th className="pb-3 font-medium text-right">Tenure</th>
                      <th className="pb-3 font-medium text-right">Payments</th>
                      <th className="pb-3 font-medium text-center">Score</th>
                      <th className="pb-3 font-medium text-right">Cash Flow Gain</th>
                      <th className="pb-3 font-medium text-right">Likelihood</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {candidates.slice(0, 30).map((candidate) => (
                      <tr key={candidate.subscriptionId} className="hover:bg-zinc-800/30">
                        <td className="py-3">
                          <p className="text-sm text-white">{candidate.email || 'Anonymous'}</p>
                          <p className="text-xs text-zinc-600">Since {formatDate(candidate.customerSince)}</p>
                        </td>
                        <td className="py-3">
                          <p className="text-sm text-zinc-300">{candidate.planName || candidate.planId || '—'}</p>
                        </td>
                        <td className="py-3 text-sm text-right text-zinc-300">
                          {formatCurrency(candidate.monthlyAmount)}
                        </td>
                        <td className="py-3 text-sm text-right text-zinc-300">
                          {candidate.tenureMonths}mo
                        </td>
                        <td className="py-3 text-sm text-right">
                          <span className={candidate.paymentFailureCount === 0 ? 'text-emerald-400' : 'text-zinc-400'}>
                            {candidate.consecutivePayments}
                          </span>
                          {candidate.paymentFailureCount === 0 && (
                            <CheckCircle className="h-3 w-3 inline ml-1 text-emerald-400" />
                          )}
                        </td>
                        <td className="py-3">
                          <ConversionScoreBar score={candidate.conversionScore} />
                        </td>
                        <td className="py-3 text-sm text-right text-emerald-400 font-medium">
                          +{formatCurrency(candidate.cashFlowGain)}
                        </td>
                        <td className="py-3 text-right">
                          <LikelihoodBadge likelihood={candidate.conversionLikelihood} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {candidates.length > 30 && (
                  <p className="text-xs text-zinc-500 text-center py-4">
                    Showing 30 of {candidates.length} candidates
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

