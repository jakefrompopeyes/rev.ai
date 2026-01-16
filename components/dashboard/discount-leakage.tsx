'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { AnimatedNumber } from '@/components/ui/animated-number';
import {
  AlertTriangle,
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
  ArrowUpRight,
  Tag,
  BarChart3,
  Receipt,
} from 'lucide-react';

// ============================================================================
// TYPES (matching backend)
// ============================================================================

interface LeakedDiscount {
  invoiceId: string;
  invoiceStripeId: string;
  customerId: string;
  customerEmail: string | null;
  invoiceDate: string;
  fullPrice: number;
  paidPrice: number;
  leakageAmount: number;
  discountPercent: number;
  evidence: {
    didRenew: boolean;
    paidFullPriceLater: boolean;
    upgraded: boolean;
  };
  laterInvoices: {
    count: number;
  totalPaid: number;
    highestPaid: number;
    lastInvoiceDate: string | null;
  };
  planId: string | null;
  planName: string | null;
  discountId: string | null;
}

interface CouponLeakage {
  discountId: string;
  discountPercent: number | null;
  discountAmountOff: number | null;
  timesUsed: number;
  uniqueCustomers: number;
  leakedCount: number;
  leakedPercent: number;
  totalLeakage: number;
  customersWhoRenewed: number;
  customersWhoPaidFullLater: number;
  customersWhoUpgraded: number;
  customersWhoChurned: number;
  churnRate: number;
  renewalRate: number;
  verdict: 'unnecessary' | 'questionable' | 'justified';
}

interface CustomerLeakage {
  customerId: string;
  email: string | null;
  totalInvoices: number;
  discountedInvoices: number;
  fullPriceInvoices: number;
  leakedDiscountCount: number;
  totalLeakage: number;
  averageLeakagePerInvoice: number;
  pattern: 'always_pays_full_later' | 'mixed' | 'discount_dependent';
}

interface PlanLeakage {
  planId: string;
  planName: string | null;
  planAmount: number;
  totalDiscountedInvoices: number;
  leakedCount: number;
  leakedPercent: number;
  totalLeakage: number;
}

interface LeakageSummary {
  periodDays: number;
  analyzedFrom: string;
  analyzedTo: string;
  totalDiscountedInvoices: number;
  totalLeakedDiscounts: number;
  leakageRate: number;
  totalLeakage: number;
  leakageLast30Days: number;
  averageLeakagePerInvoice: number;
  renewedWithoutNeedingDiscount: number;
  paidFullPriceLater: number;
  upgradedLater: number;
  projectedAnnualLeakage: number;
  potentialRecoveryWithFix: number;
}

interface AIRecommendation {
  priority: number;
  title: string;
  description: string;
  expectedImpact: number;
  dataSupport: string;
}

interface DiscountLeakageReport {
  summary: LeakageSummary;
  leakedDiscounts: LeakedDiscount[];
  couponLeakage: CouponLeakage[];
  customerLeakage: CustomerLeakage[];
  planLeakage: PlanLeakage[];
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

function VerdictBadge({ verdict }: { verdict: CouponLeakage['verdict'] }) {
  const config = {
    unnecessary: { color: 'bg-red-500/10 text-red-400 border-red-500/20', icon: AlertCircle, label: 'Unnecessary' },
    questionable: { color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: AlertTriangle, label: 'Questionable' },
    justified: { color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: CheckCircle, label: 'Justified' },
  };
  const { color, icon: Icon, label } = config[verdict];
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border ${color}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

function PatternBadge({ pattern }: { pattern: CustomerLeakage['pattern'] }) {
  const config = {
    always_pays_full_later: { color: 'bg-red-500/10 text-red-400 border-red-500/20', label: 'Pays full later' },
    mixed: { color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', label: 'Mixed' },
    discount_dependent: { color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', label: 'Discount needed' },
  };
  const { color, label } = config[pattern];
  
  return (
    <span className={`px-2 py-0.5 text-xs rounded-full border ${color}`}>
      {label}
    </span>
  );
}

function EvidenceBadges({ evidence }: { evidence: LeakedDiscount['evidence'] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {evidence.didRenew && (
        <span className="px-1.5 py-0.5 text-[10px] rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
          Renewed
        </span>
      )}
      {evidence.paidFullPriceLater && (
        <span className="px-1.5 py-0.5 text-[10px] rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          Paid full later
        </span>
      )}
      {evidence.upgraded && (
        <span className="px-1.5 py-0.5 text-[10px] rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
          Upgraded
        </span>
      )}
    </div>
  );
}

function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  subValue,
  color = 'amber'
}: { 
  icon: React.ElementType; 
  label: string; 
  value: string | number;
  subValue?: string;
  color?: 'amber' | 'red' | 'emerald' | 'blue' | 'purple';
}) {
  const colors = {
    amber: 'bg-amber-500/10 text-amber-500',
    red: 'bg-red-500/10 text-red-500',
    emerald: 'bg-emerald-500/10 text-emerald-500',
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

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export type DiscountLeakageVariant = 'full' | 'hero';

export function DiscountLeakage({ variant = 'full' }: { variant?: DiscountLeakageVariant }) {
  const [report, setReport] = useState<DiscountLeakageReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['evidence', 'recommendations', 'coupons'])
  );

    async function fetchData() {
      try {
        setLoading(true);
      setError(null);
        const response = await fetch('/api/discount-leakage');
        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch discount leakage data');
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
            <p className="text-sm text-zinc-500">Analyzing discount patterns...</p>
            <p className="text-xs text-zinc-600">Checking renewal, upgrade & payment history</p>
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

  const { summary, couponLeakage, customerLeakage, planLeakage, leakedDiscounts, aiNarrative, aiRecommendations } = report;

  const hero = (
    <Card className="relative overflow-hidden bg-gradient-to-br from-red-950/30 via-zinc-900/50 to-zinc-900/50 border-red-900/30">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(239,68,68,0.1),transparent_50%)]" />
      <CardContent className="relative pt-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-5 w-5 text-red-400" />
              <span className="text-sm font-medium text-red-400">Evidence-Based Discount Analysis</span>
            </div>
            <h2 className="text-4xl font-bold text-white mb-2">
              <AnimatedNumber value={summary.leakageRate} />%
            </h2>
            <p className="text-lg text-zinc-300 max-w-md">
              of discounts were given to customers who didn&apos;t need them
            </p>
            <p className="text-sm text-zinc-500 mt-2">
              Based on {summary.totalDiscountedInvoices} discounted invoices over {summary.periodDays} days
            </p>
          </div>
          <div className="text-right space-y-4">
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wider">Total Leakage</p>
              <p className="text-2xl font-bold text-red-400">{formatCurrency(summary.totalLeakage)}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wider">Last 30 Days</p>
              <p className="text-xl font-semibold text-red-300">{formatCurrency(summary.leakageLast30Days)}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wider">Potential Recovery</p>
              <p className="text-xl font-semibold text-emerald-400">{formatCurrency(summary.potentialRecoveryWithFix)}/yr</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (variant === 'hero') {
    return hero;
  }

  return (
    <div className="space-y-4">
      {/* Hero Section - The Big Number */}
      {hero}

      {/* Evidence Breakdown */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader 
          data-expanded={expandedSections.has('evidence')}
          className="group p-4 space-y-1 cursor-pointer hover:bg-zinc-800/30 transition-colors"
          onClick={() => toggleSection('evidence')}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-400" />
              <CardTitle className="text-base">How We Know Discounts Were Unnecessary</CardTitle>
            </div>
            {expandedSections.has('evidence') ? (
              <ChevronUp className="h-4 w-4 text-zinc-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-zinc-500" />
            )}
          </div>
          <CardDescription className="text-xs hidden group-hover:block group-data-[expanded=true]:block">
            Evidence from actual customer behavior, not predictions
          </CardDescription>
        </CardHeader>
        {expandedSections.has('evidence') && (
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              {/* Check 1: Did they renew? */}
              <div className="p-4 rounded-lg bg-blue-950/20 border border-blue-900/30">
                <div className="flex items-center gap-2 mb-3">
                  <RefreshCw className="h-5 w-5 text-blue-400" />
                  <h4 className="font-semibold text-white">They Renewed</h4>
                </div>
                <p className="text-3xl font-bold text-blue-400 mb-1">
                  {summary.renewedWithoutNeedingDiscount}
                </p>
                <p className="text-sm text-zinc-400">
                  customers renewed after discounted invoice
                </p>
                <p className="text-xs text-zinc-600 mt-2">
                  If they renewed, they likely would have paid full price initially
                </p>
              </div>
              
              {/* Check 2: Did they pay full price later? */}
              <div className="p-4 rounded-lg bg-emerald-950/20 border border-emerald-900/30">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="h-5 w-5 text-emerald-400" />
                  <h4 className="font-semibold text-white">Paid Full Later</h4>
                </div>
                <p className="text-3xl font-bold text-emerald-400 mb-1">
                  {summary.paidFullPriceLater}
                </p>
                <p className="text-sm text-zinc-400">
                  customers paid full price on later invoices
                </p>
                <p className="text-xs text-zinc-600 mt-2">
                  Definitive proof discount wasn&apos;t needed
                </p>
                  </div>
              
              {/* Check 3: Did they upgrade? */}
              <div className="p-4 rounded-lg bg-purple-950/20 border border-purple-900/30">
                <div className="flex items-center gap-2 mb-3">
                  <ArrowUpRight className="h-5 w-5 text-purple-400" />
                  <h4 className="font-semibold text-white">They Upgraded</h4>
                </div>
                <p className="text-3xl font-bold text-purple-400 mb-1">
                  {summary.upgradedLater}
                </p>
                <p className="text-sm text-zinc-400">
                  customers upgraded to higher plans
                </p>
                <p className="text-xs text-zinc-600 mt-2">
                  Higher willingness to pay than discount implied
                </p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard 
          icon={Receipt} 
          label="Leaked Discounts" 
          value={summary.totalLeakedDiscounts}
          subValue={`of ${summary.totalDiscountedInvoices} discounted`}
          color="red"
        />
        <StatCard 
          icon={Tag} 
          label="Unnecessary Coupons" 
          value={couponLeakage.filter(c => c.verdict === 'unnecessary').length}
          subValue={`of ${couponLeakage.length} coupons`}
          color="amber"
        />
        <StatCard 
          icon={Users} 
          label="Customers Affected" 
          value={customerLeakage.length}
          subValue={`${customerLeakage.filter(c => c.pattern === 'always_pays_full_later').length} always pay full later`}
          color="blue"
        />
        <StatCard 
          icon={DollarSign} 
          label="Avg Leakage/Invoice" 
          value={formatCurrency(summary.averageLeakagePerInvoice)}
          color="purple"
        />
      </div>

      {/* AI Analysis - Simple Summary */}
      {aiNarrative && (
        <Card className="bg-gradient-to-br from-amber-950/20 via-zinc-900/50 to-zinc-900/50 border-amber-900/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Sparkles className="h-5 w-5 text-amber-400" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-amber-400 uppercase tracking-wider mb-3">AI Analysis</p>
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
              Data-driven recommendations based on actual customer behavior
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
                  <div className="flex items-center gap-1.5">
                    <DollarSign className="h-4 w-4 text-emerald-400" />
                    <span className="text-sm text-emerald-400 font-medium">
                        +{formatCurrency(rec.expectedImpact)}/yr
                    </span>
                    </div>
                  </div>
                  <p className="text-sm text-zinc-400 mb-2 ml-8">{rec.description}</p>
                  <p className="text-xs text-zinc-600 ml-8 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Evidence: {rec.dataSupport}
                  </p>
              </div>
            ))}
          </CardContent>
        )}
      </Card>
      )}

      {/* Coupon Leakage Section */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader 
          data-expanded={expandedSections.has('coupons')}
          className="group p-4 space-y-1 cursor-pointer hover:bg-zinc-800/30 transition-colors"
          onClick={() => toggleSection('coupons')}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-amber-400" />
              <CardTitle className="text-base">Coupon Leakage Analysis</CardTitle>
              <Badge variant="outline" className="ml-2">{couponLeakage.length}</Badge>
            </div>
            {expandedSections.has('coupons') ? (
              <ChevronUp className="h-4 w-4 text-zinc-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-zinc-500" />
            )}
          </div>
          <CardDescription className="text-xs hidden group-hover:block group-data-[expanded=true]:block">
            Which coupons are being used by customers who don&apos;t need them
          </CardDescription>
        </CardHeader>
        {expandedSections.has('coupons') && (
          <CardContent>
            {couponLeakage.length === 0 ? (
              <p className="text-sm text-zinc-500 text-center py-8">No coupon data available</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
                      <th className="pb-3 font-medium">Coupon</th>
                      <th className="pb-3 font-medium">Discount</th>
                      <th className="pb-3 font-medium text-right">Uses</th>
                      <th className="pb-3 font-medium text-right">Leaked</th>
                      <th className="pb-3 font-medium text-right">Leak Rate</th>
                      <th className="pb-3 font-medium text-right">Total Leakage</th>
                      <th className="pb-3 font-medium text-right">Renewal Rate</th>
                      <th className="pb-3 font-medium text-right">Verdict</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {couponLeakage.map((coupon) => (
                      <tr key={coupon.discountId} className="hover:bg-zinc-800/30">
                        <td className="py-3">
                          <code className="text-xs bg-zinc-800 px-2 py-1 rounded text-zinc-300">
                            {coupon.discountId.length > 20 
                              ? `${coupon.discountId.slice(0, 20)}...`
                              : coupon.discountId
                            }
                          </code>
                        </td>
                        <td className="py-3 text-sm text-white">
                          {coupon.discountPercent 
                            ? `${coupon.discountPercent}% off`
                            : coupon.discountAmountOff 
                            ? formatCurrency(coupon.discountAmountOff) + ' off'
                            : '—'
                          }
                        </td>
                        <td className="py-3 text-sm text-right text-zinc-300">{coupon.timesUsed}</td>
                        <td className="py-3 text-sm text-right text-zinc-300">{coupon.leakedCount}</td>
                        <td className="py-3 text-sm text-right">
                          <span className={coupon.leakedPercent > 50 ? 'text-red-400' : 'text-zinc-300'}>
                            {coupon.leakedPercent.toFixed(0)}%
                          </span>
                        </td>
                        <td className="py-3 text-sm text-right text-red-400 font-medium">
                          {formatCurrency(coupon.totalLeakage)}
                        </td>
                        <td className="py-3 text-sm text-right">
                          <span className={coupon.renewalRate > 60 ? 'text-emerald-400' : 'text-zinc-300'}>
                            {coupon.renewalRate.toFixed(0)}%
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <VerdictBadge verdict={coupon.verdict} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Plan Leakage Section */}
      {planLeakage.length > 0 && (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader 
            data-expanded={expandedSections.has('plans')}
            className="group p-4 space-y-1 cursor-pointer hover:bg-zinc-800/30 transition-colors"
            onClick={() => toggleSection('plans')}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-purple-400" />
                <CardTitle className="text-base">Leakage by Plan</CardTitle>
                <Badge variant="outline" className="ml-2">{planLeakage.length}</Badge>
              </div>
              {expandedSections.has('plans') ? (
                <ChevronUp className="h-4 w-4 text-zinc-500" />
              ) : (
                <ChevronDown className="h-4 w-4 text-zinc-500" />
              )}
            </div>
            <CardDescription className="text-xs hidden group-hover:block group-data-[expanded=true]:block">
              Which plans have the most unnecessary discounts
            </CardDescription>
          </CardHeader>
          {expandedSections.has('plans') && (
            <CardContent>
              <div className="space-y-3">
                {planLeakage.map((plan) => (
                  <div 
                    key={plan.planId}
                    className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-purple-400" />
                      <div>
                        <p className="text-sm font-medium text-white">
                          {plan.planName || plan.planId}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {plan.leakedCount} of {plan.totalDiscountedInvoices} discounted invoices leaked
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-red-400">
                        {formatCurrency(plan.totalLeakage)}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {plan.leakedPercent.toFixed(0)}% leak rate
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Customer Leakage Section */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader 
          data-expanded={expandedSections.has('customers')}
          className="group p-4 space-y-1 cursor-pointer hover:bg-zinc-800/30 transition-colors"
          onClick={() => toggleSection('customers')}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-400" />
              <CardTitle className="text-base">Customer Leakage Patterns</CardTitle>
              <Badge variant="outline" className="ml-2">{customerLeakage.length}</Badge>
            </div>
            {expandedSections.has('customers') ? (
              <ChevronUp className="h-4 w-4 text-zinc-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-zinc-500" />
            )}
          </div>
          <CardDescription className="text-xs hidden group-hover:block group-data-[expanded=true]:block">
            Customers with leaked discounts, sorted by leakage amount
          </CardDescription>
        </CardHeader>
        {expandedSections.has('customers') && (
          <CardContent>
            {customerLeakage.length === 0 ? (
              <p className="text-sm text-zinc-500 text-center py-8">No customer leakage data</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {customerLeakage.slice(0, 20).map((customer) => (
                  <div 
                    key={customer.customerId}
                      className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50"
                    >
                      <div>
                      <p className="text-sm text-white">{customer.email || 'Anonymous'}</p>
                        <p className="text-xs text-zinc-500">
                        {customer.discountedInvoices} discounted, {customer.fullPriceInvoices} full price invoices
                        </p>
                      </div>
                    <div className="flex items-center gap-3">
                      <PatternBadge pattern={customer.pattern} />
                      <div className="text-right">
                        <p className="text-sm font-medium text-red-400">
                          {formatCurrency(customer.totalLeakage)}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {customer.leakedDiscountCount} leaked discounts
                        </p>
                      </div>
                      </div>
                    </div>
                  ))}
                {customerLeakage.length > 20 && (
                    <p className="text-xs text-zinc-500 text-center pt-2">
                    +{customerLeakage.length - 20} more customers
                    </p>
                  )}
                </div>
              )}
          </CardContent>
        )}
      </Card>

      {/* Individual Leaked Discounts */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader 
          data-expanded={expandedSections.has('invoices')}
          className="group p-4 space-y-1 cursor-pointer hover:bg-zinc-800/30 transition-colors"
          onClick={() => toggleSection('invoices')}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-zinc-400" />
              <CardTitle className="text-base">Leaked Discount Details</CardTitle>
              <Badge variant="outline" className="ml-2">{leakedDiscounts.length}</Badge>
            </div>
            {expandedSections.has('invoices') ? (
              <ChevronUp className="h-4 w-4 text-zinc-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-zinc-500" />
            )}
                      </div>
          <CardDescription className="text-xs hidden group-hover:block group-data-[expanded=true]:block">
            Individual invoices with evidence of unnecessary discounts
          </CardDescription>
        </CardHeader>
        {expandedSections.has('invoices') && (
          <CardContent>
            {leakedDiscounts.length === 0 ? (
              <p className="text-sm text-zinc-500 text-center py-8">No leaked discounts found</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
                      <th className="pb-3 font-medium">Date</th>
                      <th className="pb-3 font-medium">Customer</th>
                      <th className="pb-3 font-medium text-right">Full Price</th>
                      <th className="pb-3 font-medium text-right">Paid</th>
                      <th className="pb-3 font-medium text-right">Leakage</th>
                      <th className="pb-3 font-medium">Evidence</th>
                      <th className="pb-3 font-medium text-right">Later Invoices</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {leakedDiscounts.slice(0, 50).map((leaked) => (
                      <tr key={leaked.invoiceId} className="hover:bg-zinc-800/30">
                        <td className="py-3 text-sm text-zinc-300">
                          {formatDate(leaked.invoiceDate)}
                        </td>
                        <td className="py-3">
                          <p className="text-sm text-white">{leaked.customerEmail || 'Anonymous'}</p>
                          {leaked.planName && (
                            <p className="text-xs text-zinc-500">{leaked.planName}</p>
                          )}
                        </td>
                        <td className="py-3 text-sm text-right text-zinc-300">
                          {formatCurrency(leaked.fullPrice)}
                        </td>
                        <td className="py-3 text-sm text-right text-zinc-300">
                          {formatCurrency(leaked.paidPrice)}
                        </td>
                        <td className="py-3 text-sm text-right text-red-400 font-medium">
                          {formatCurrency(leaked.leakageAmount)}
                        </td>
                        <td className="py-3">
                          <EvidenceBadges evidence={leaked.evidence} />
                        </td>
                        <td className="py-3 text-sm text-right text-zinc-400">
                          {leaked.laterInvoices.count} ({formatCurrency(leaked.laterInvoices.totalPaid)})
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {leakedDiscounts.length > 50 && (
                  <p className="text-xs text-zinc-500 text-center py-4">
                    Showing 50 of {leakedDiscounts.length} leaked discounts
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
