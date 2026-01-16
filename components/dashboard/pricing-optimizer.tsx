'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AnimatedNumber, AnimatedCurrency } from '@/components/ui/animated-number';
import { Spinner } from '@/components/ui/spinner';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Zap,
  Target,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  BarChart3,
  Layers,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Play,
  Brain,
  FlaskConical,
  Gauge,
  Quote,
} from 'lucide-react';

// Types matching the API response
interface PlanPerformance {
  planId: string;
  planName: string;
  pricePerMonth: number;
  activeSubscriptions: number;
  totalEverSubscribed: number;
  conversionFromTrial: number;
  averageLifetimeDays: number;
  churnRate: number;
  retentionAt30Days: number;
  retentionAt90Days: number;
  ltv: number;
  mrr: number;
  mrrShare: number;
  upgradeRate: number;
  downgradeRate: number;
  revenuePerEffort: number;
  discountFrequency: number;
  avgDiscountPercent: number;
  performanceScore: number;
  scoreBreakdown: {
    retention: number;
    revenue: number;
    growth: number;
    efficiency: number;
  };
}

interface PriceElasticityPoint {
  pricePoint: number;
  subscriptionCount: number;
  churnRate: number;
  conversionRate: number;
  estimatedDemand: number;
  estimatedRevenue: number;
}

interface SegmentPricingInsight {
  segment: string;
  description: string;
  size: number;
  avgPrice: number;
  priceRangeAccepted: { min: number; max: number };
  churnSensitivity: 'LOW' | 'MEDIUM' | 'HIGH';
  willingnessToPay: number;
  recommendations: string[];
}

interface PricingRecommendation {
  type: 'INCREASE' | 'DECREASE' | 'NEW_TIER' | 'BUNDLE' | 'RESTRUCTURE';
  planId: string;
  planName: string;
  currentPrice: number;
  recommendedPrice?: number;
  reasoning: string;
  estimatedImpact: {
    mrrChange: number;
    churnRisk: 'LOW' | 'MEDIUM' | 'HIGH';
    confidenceScore: number;
    timeToRealize: string;
  };
  implementationSteps: string[];
  riskFactors: string[];
}

interface PricingAnalysis {
  summary: {
    totalMRR: number;
    avgARPU: number;
    priceSpread: { min: number; max: number };
    dominantPlan: string;
    underperformingPlans: string[];
    pricingPower: 'WEAK' | 'MODERATE' | 'STRONG';
  };
  planPerformance: PlanPerformance[];
  elasticityCurve: PriceElasticityPoint[];
  recommendations: PricingRecommendation[];
  segmentInsights: SegmentPricingInsight[];
}

interface PriceSimulation {
  scenario: string;
  planId: string;
  currentPrice: number;
  newPrice: number;
  priceChangePercent: number;
  projectedOutcomes: {
    newSubscriptions: number;
    churnedSubscriptions: number;
    netMRRChange: number;
    breakEvenDays: number;
  };
  confidence: number;
}

// AI-powered types
interface PricingNarrative {
  headline: string;
  summary: string;
  healthScore: number;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
  keyInsights: Array<{
    insight: string;
    importance: 'critical' | 'high' | 'medium' | 'low';
    actionRequired: boolean;
  }>;
  executiveSummary: string;
}

interface OptimalPriceResult {
  planId: string;
  planName: string;
  currentPrice: number;
  optimalPrice: number;
  optimalRange: { min: number; max: number };
  confidence: number;
  methodology: string;
  factors: Array<{
    factor: string;
    impact: 'positive' | 'negative' | 'neutral';
    weight: number;
    explanation: string;
  }>;
  projectedOutcome: {
    revenueChange: number;
    churnChange: number;
    netImpact: number;
  };
}

interface PricingExperiment {
  id: string;
  name: string;
  hypothesis: string;
  targetPlan: string;
  controlPrice: number;
  variants: Array<{
    name: string;
    price: number;
    expectedConversionChange: number;
    expectedChurnChange: number;
  }>;
  sampleSize: number;
  duration: string;
  expectedLift: number;
  confidence: number;
  priority: number;
  risks: string[];
  successMetrics: string[];
}

interface AIPricingAnalysis {
  narrative: PricingNarrative;
  optimalPrices: OptimalPriceResult[];
  experiments: PricingExperiment[];
  totalOpportunity: number;
  topRecommendation: string;
}

// Helper to format currency
const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
};

// Score ring component
function ScoreRing({ score, size = 80, strokeWidth = 8 }: { score: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (score / 100) * circumference;
  
  const getColor = (score: number) => {
    if (score >= 75) return '#10b981'; // emerald
    if (score >= 50) return '#f59e0b'; // amber
    return '#ef4444'; // red
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-zinc-800"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={getColor(score)}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold text-white">{Math.round(score)}</span>
      </div>
    </div>
  );
}

// Mini bar chart for score breakdown
function ScoreBreakdown({ breakdown }: { breakdown: PlanPerformance['scoreBreakdown'] }) {
  const items = [
    { label: 'Retention', value: breakdown.retention, color: 'bg-emerald-500' },
    { label: 'Revenue', value: breakdown.revenue, color: 'bg-blue-500' },
    { label: 'Growth', value: breakdown.growth, color: 'bg-purple-500' },
    { label: 'Efficiency', value: breakdown.efficiency, color: 'bg-amber-500' },
  ];

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <span className="text-xs text-zinc-500 w-16">{item.label}</span>
          <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full ${item.color} transition-all duration-500`}
              style={{ width: `${item.value}%` }}
            />
          </div>
          <span className="text-xs text-zinc-400 w-8 text-right">{Math.round(item.value)}</span>
        </div>
      ))}
    </div>
  );
}

// Plan card component
function PlanCard({ plan, onSimulate }: { plan: PlanPerformance; onSimulate: (planId: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-all duration-300">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <ScoreRing score={plan.performanceScore} />
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-white truncate">{plan.planName}</h3>
              <Badge
                variant="outline"
                className={
                  plan.performanceScore >= 75
                    ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10'
                    : plan.performanceScore >= 50
                    ? 'border-amber-500/50 text-amber-400 bg-amber-500/10'
                    : 'border-red-500/50 text-red-400 bg-red-500/10'
                }
              >
                {plan.performanceScore >= 75 ? 'Strong' : plan.performanceScore >= 50 ? 'Moderate' : 'Weak'}
              </Badge>
            </div>
            
            <div className="text-2xl font-bold text-white mb-2">
              {formatCurrency(plan.pricePerMonth)}
              <span className="text-sm text-zinc-500 font-normal">/mo</span>
            </div>

            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-zinc-500 block">Active</span>
                <span className="text-white font-medium">{plan.activeSubscriptions}</span>
              </div>
              <div>
                <span className="text-zinc-500 block">Churn</span>
                <span className={`font-medium ${plan.churnRate > 10 ? 'text-red-400' : plan.churnRate > 5 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {plan.churnRate.toFixed(1)}%
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block">LTV</span>
                <span className="text-white font-medium">{formatCurrency(plan.ltv)}</span>
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-sm text-zinc-500">MRR Share</div>
            <div className="text-lg font-bold text-white">{plan.mrrShare.toFixed(1)}%</div>
            <div className="text-sm text-zinc-400">{formatCurrency(plan.mrr)}</div>
          </div>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-sm text-zinc-400 hover:text-white mt-4 transition-colors"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          {expanded ? 'Show less' : 'Show details'}
        </button>

        {expanded && (
          <div className="mt-4 pt-4 border-t border-zinc-800 space-y-4 animate-in slide-in-from-top-2 duration-200">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium text-zinc-400 mb-2">Score Breakdown</h4>
                <ScoreBreakdown breakdown={plan.scoreBreakdown} />
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">30-day retention</span>
                  <span className="text-white">{plan.retentionAt30Days.toFixed(0)}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">90-day retention</span>
                  <span className="text-white">{plan.retentionAt90Days.toFixed(0)}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Avg lifetime</span>
                  <span className="text-white">{Math.round(plan.averageLifetimeDays)} days</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Upgrade rate</span>
                  <span className="text-emerald-400">{plan.upgradeRate.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Discount usage</span>
                  <span className={plan.discountFrequency > 30 ? 'text-amber-400' : 'text-zinc-400'}>
                    {plan.discountFrequency.toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full border-zinc-700 hover:bg-zinc-800"
              onClick={() => onSimulate(plan.planId)}
            >
              <Play className="w-4 h-4 mr-2" />
              Simulate Price Change
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Recommendation card
function RecommendationCard({ rec, index }: { rec: PricingRecommendation; index: number }) {
  const [expanded, setExpanded] = useState(false);

  const typeConfig = {
    INCREASE: { icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
    DECREASE: { icon: TrendingDown, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
    NEW_TIER: { icon: Layers, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
    BUNDLE: { icon: Target, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
    RESTRUCTURE: { icon: Zap, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30' },
  };

  const config = typeConfig[rec.type];
  const Icon = config.icon;

  const riskColors = {
    LOW: 'text-emerald-400',
    MEDIUM: 'text-amber-400',
    HIGH: 'text-red-400',
  };

  return (
    <Card
      className={`${config.bg} ${config.border} border hover:border-opacity-60 transition-all duration-300`}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-xl ${config.bg} ${config.border} border`}>
            <Icon className={`w-6 h-6 ${config.color}`} />
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className={`${config.border} ${config.color} bg-transparent`}>
                {rec.type.replace('_', ' ')}
              </Badge>
              <span className="text-sm text-zinc-500">{rec.planName}</span>
            </div>

            <p className="text-zinc-300 text-sm leading-relaxed mb-3">
              {rec.reasoning}
            </p>

            <div className="flex flex-wrap gap-4 text-sm mb-3">
              {rec.recommendedPrice && rec.currentPrice > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500">Price:</span>
                  <span className="text-zinc-400 line-through">{formatCurrency(rec.currentPrice)}</span>
                  <ArrowRight className="w-4 h-4 text-zinc-600" />
                  <span className="text-white font-medium">{formatCurrency(rec.recommendedPrice)}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-zinc-500">Impact:</span>
                <span className={rec.estimatedImpact.mrrChange > 0 ? 'text-emerald-400' : 'text-red-400'}>
                  {rec.estimatedImpact.mrrChange > 0 ? '+' : ''}{formatCurrency(rec.estimatedImpact.mrrChange)}/mo
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-zinc-500">Risk:</span>
                <span className={riskColors[rec.estimatedImpact.churnRisk]}>
                  {rec.estimatedImpact.churnRisk}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-zinc-500">Confidence:</span>
                <span className="text-zinc-300">{(rec.estimatedImpact.confidenceScore * 100).toFixed(0)}%</span>
              </div>
            </div>

            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-sm text-zinc-400 hover:text-white transition-colors"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {expanded ? 'Hide steps' : 'View implementation steps'}
            </button>

            {expanded && (
              <div className="mt-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
                <div>
                  <h4 className="text-sm font-medium text-zinc-400 mb-2 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    Implementation Steps
                  </h4>
                  <ol className="space-y-2">
                    {rec.implementationSteps.map((step, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                        <span className="text-zinc-600 font-mono">{i + 1}.</span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>

                {rec.riskFactors.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-zinc-400 mb-2 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      Risk Factors
                    </h4>
                    <ul className="space-y-1">
                      {rec.riskFactors.map((risk, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-zinc-400">
                          <span className="text-amber-500">•</span>
                          {risk}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Segment insight card
function SegmentCard({ segment }: { segment: SegmentPricingInsight }) {
  const sensitivityColors = {
    LOW: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    MEDIUM: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    HIGH: 'text-red-400 bg-red-500/10 border-red-500/30',
  };

  return (
    <Card className="bg-zinc-900/50 border-zinc-800">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-white">{segment.segment}</h3>
          <Badge variant="outline" className={sensitivityColors[segment.churnSensitivity]}>
            {segment.churnSensitivity} sensitivity
          </Badge>
        </div>

        <p className="text-sm text-zinc-400 mb-4">{segment.description}</p>

        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
          <div>
            <span className="text-zinc-500 block">Size</span>
            <span className="text-white font-medium">{segment.size} customers</span>
          </div>
          <div>
            <span className="text-zinc-500 block">Avg Price</span>
            <span className="text-white font-medium">{formatCurrency(segment.avgPrice)}</span>
          </div>
          <div>
            <span className="text-zinc-500 block">Price Range</span>
            <span className="text-white font-medium">
              {formatCurrency(segment.priceRangeAccepted.min)} - {formatCurrency(segment.priceRangeAccepted.max)}
            </span>
          </div>
          <div>
            <span className="text-zinc-500 block">Willingness to Pay</span>
            <span className="text-emerald-400 font-medium">{formatCurrency(segment.willingnessToPay)}</span>
          </div>
        </div>

        {segment.recommendations.length > 0 && (
          <div className="pt-3 border-t border-zinc-800">
            <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Recommendations</h4>
            <ul className="space-y-1">
              {segment.recommendations.map((rec, i) => (
                <li key={i} className="text-sm text-zinc-300 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Price simulation modal/card
function SimulationCard({
  simulation,
  onClose,
}: {
  simulation: PriceSimulation;
  onClose: () => void;
}) {
  const isPositive = simulation.projectedOutcomes.netMRRChange > 0;

  return (
    <Card className="bg-gradient-to-br from-zinc-900 to-zinc-900/50 border-zinc-700 shadow-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-400" />
            Price Simulation Results
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            ✕
          </Button>
        </div>
        <CardDescription>{simulation.scenario}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-center gap-4 py-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-zinc-400">{formatCurrency(simulation.currentPrice)}</div>
            <div className="text-sm text-zinc-500">Current</div>
          </div>
          <ArrowRight className="w-6 h-6 text-zinc-600" />
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{formatCurrency(simulation.newPrice)}</div>
            <div className="text-sm text-zinc-500">New Price</div>
          </div>
          <div className={`text-lg font-medium ${simulation.priceChangePercent > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
            {simulation.priceChangePercent > 0 ? '+' : ''}{simulation.priceChangePercent.toFixed(1)}%
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className={`p-4 rounded-lg ${isPositive ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
            <div className="text-sm text-zinc-400 mb-1">Net MRR Change</div>
            <div className={`text-2xl font-bold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {isPositive ? '+' : ''}{formatCurrency(simulation.projectedOutcomes.netMRRChange)}
            </div>
          </div>
          <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <div className="text-sm text-zinc-400 mb-1">Projected Churn</div>
            <div className="text-2xl font-bold text-amber-400">
              {simulation.projectedOutcomes.churnedSubscriptions} subs
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm p-3 rounded-lg bg-zinc-800/50">
          <div>
            <span className="text-zinc-500">Break-even in</span>
            <span className="text-white font-medium ml-2">{simulation.projectedOutcomes.breakEvenDays} days</span>
          </div>
          <div>
            <span className="text-zinc-500">Confidence</span>
            <span className="text-white font-medium ml-2">{(simulation.confidence * 100).toFixed(0)}%</span>
          </div>
        </div>

        <p className="text-xs text-zinc-500 text-center">
          Projections based on historical price elasticity data. Actual results may vary.
        </p>
      </CardContent>
    </Card>
  );
}

// AI Narrative Card
function NarrativeCard({ narrative }: { narrative: PricingNarrative }) {
  const importanceColors = {
    critical: 'text-red-400 bg-red-500/10 border-red-500/30',
    high: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    medium: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    low: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/30',
  };

  return (
    <div className="space-y-6">
      {/* Headline & Health Score */}
      <div className="flex items-start gap-6">
        <div className="flex-1">
          <h3 className="text-2xl font-bold text-white mb-2">{narrative.headline}</h3>
          <p className="text-zinc-400">{narrative.summary}</p>
        </div>
        <div className="text-center">
          <div className="relative w-24 h-24">
            <svg className="w-24 h-24 transform -rotate-90">
              <circle cx="48" cy="48" r="40" stroke="#27272a" strokeWidth="8" fill="none" />
              <circle
                cx="48" cy="48" r="40"
                stroke={narrative.healthScore >= 70 ? '#10b981' : narrative.healthScore >= 50 ? '#f59e0b' : '#ef4444'}
                strokeWidth="8"
                fill="none"
                strokeDasharray={251.2}
                strokeDashoffset={251.2 - (narrative.healthScore / 100) * 251.2}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-white">{narrative.healthScore}</span>
              <span className="text-xs text-zinc-500">Health</span>
            </div>
          </div>
        </div>
      </div>

      {/* Executive Summary */}
      <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/30">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Quote className="w-5 h-5 text-purple-400 flex-shrink-0 mt-1" />
            <p className="text-zinc-300 text-sm leading-relaxed italic">
              {narrative.executiveSummary}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* SWOT Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
          <h4 className="text-sm font-semibold text-emerald-400 mb-2 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" /> Strengths
          </h4>
          <ul className="space-y-1">
            {narrative.strengths.map((s, i) => (
              <li key={i} className="text-sm text-zinc-300">• {s}</li>
            ))}
          </ul>
        </div>
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
          <h4 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Weaknesses
          </h4>
          <ul className="space-y-1">
            {narrative.weaknesses.map((w, i) => (
              <li key={i} className="text-sm text-zinc-300">• {w}</li>
            ))}
          </ul>
        </div>
        <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
          <h4 className="text-sm font-semibold text-blue-400 mb-2 flex items-center gap-2">
            <Target className="w-4 h-4" /> Opportunities
          </h4>
          <ul className="space-y-1">
            {narrative.opportunities.map((o, i) => (
              <li key={i} className="text-sm text-zinc-300">• {o}</li>
            ))}
          </ul>
        </div>
        <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <h4 className="text-sm font-semibold text-amber-400 mb-2 flex items-center gap-2">
            <Zap className="w-4 h-4" /> Threats
          </h4>
          <ul className="space-y-1">
            {narrative.threats.map((t, i) => (
              <li key={i} className="text-sm text-zinc-300">• {t}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Key Insights */}
      {narrative.keyInsights.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-zinc-400 mb-3">Key Insights</h4>
          <div className="space-y-2">
            {narrative.keyInsights.map((insight, i) => (
              <div
                key={i}
                className={`p-3 rounded-lg border ${importanceColors[insight.importance]} flex items-start gap-3`}
              >
                {insight.actionRequired && (
                  <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-white font-medium">
                    Action Required
                  </span>
                )}
                <p className="text-sm flex-1">{insight.insight}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Optimal Prices Card
function OptimalPricesCard({ optimalPrices }: { optimalPrices: OptimalPriceResult[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {optimalPrices.map((price) => {
        const priceDiff = price.optimalPrice - price.currentPrice;
        const priceDiffPercent = (priceDiff / price.currentPrice) * 100;
        const isIncrease = priceDiff > 0;

        return (
          <Card key={price.planId} className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="font-semibold text-white">{price.planName}</h4>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-zinc-400">{formatCurrency(price.currentPrice)}</span>
                    <ArrowRight className="w-4 h-4 text-zinc-600" />
                    <span className={`font-semibold ${isIncrease ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {formatCurrency(price.optimalPrice)}
                    </span>
                    <Badge
                      variant="outline"
                      className={isIncrease ? 'border-emerald-500/30 text-emerald-400' : 'border-amber-500/30 text-amber-400'}
                    >
                      {isIncrease ? '+' : ''}{priceDiffPercent.toFixed(0)}%
                    </Badge>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-zinc-500">Confidence</div>
                  <div className="text-lg font-bold text-white">{(price.confidence * 100).toFixed(0)}%</div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500">Range:</span>
                  <span className="text-zinc-300">
                    {formatCurrency(price.optimalRange.min)} - {formatCurrency(price.optimalRange.max)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500">Net Impact:</span>
                  <span className={price.projectedOutcome.netImpact > 0 ? 'text-emerald-400' : 'text-red-400'}>
                    {price.projectedOutcome.netImpact > 0 ? '+' : ''}{formatCurrency(price.projectedOutcome.netImpact)}/mo
                  </span>
                </div>
              </div>

              <p className="text-sm text-zinc-400 mb-3">{price.methodology}</p>

              <button
                onClick={() => setExpanded(expanded === price.planId ? null : price.planId)}
                className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1"
              >
                {expanded === price.planId ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {expanded === price.planId ? 'Hide factors' : 'View factors'}
              </button>

              {expanded === price.planId && price.factors.length > 0 && (
                <div className="mt-4 pt-4 border-t border-zinc-800 space-y-2">
                  {price.factors.map((factor, i) => (
                    <div key={i} className="flex items-start gap-3 text-sm">
                      <span className={`mt-0.5 ${
                        factor.impact === 'positive' ? 'text-emerald-400' :
                        factor.impact === 'negative' ? 'text-red-400' : 'text-zinc-500'
                      }`}>
                        {factor.impact === 'positive' ? '↑' : factor.impact === 'negative' ? '↓' : '→'}
                      </span>
                      <div className="flex-1">
                        <span className="text-zinc-300">{factor.factor}</span>
                        <span className="text-zinc-500 ml-2">({(factor.weight * 100).toFixed(0)}% weight)</span>
                        <p className="text-zinc-500 text-xs mt-0.5">{factor.explanation}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// Experiments Card
function ExperimentsCard({ experiments }: { experiments: PricingExperiment[] }) {
  return (
    <div className="space-y-4">
      {experiments.map((exp) => (
        <Card key={exp.id} className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge
                    variant="outline"
                    className="border-purple-500/30 text-purple-400 bg-purple-500/10"
                  >
                    Priority {exp.priority}/10
                  </Badge>
                  <span className="text-sm text-zinc-500">{exp.targetPlan}</span>
                </div>
                <h4 className="font-semibold text-white">{exp.name}</h4>
              </div>
              <div className="text-right">
                <div className="text-sm text-zinc-500">Expected Lift</div>
                <div className="text-lg font-bold text-emerald-400">+{exp.expectedLift}%</div>
              </div>
            </div>

            <p className="text-sm text-zinc-400 mb-4">{exp.hypothesis}</p>

            <div className="grid grid-cols-3 gap-3 text-sm mb-4">
              <div className="p-2 rounded bg-zinc-800/50">
                <span className="text-zinc-500 block">Duration</span>
                <span className="text-white font-medium">{exp.duration}</span>
              </div>
              <div className="p-2 rounded bg-zinc-800/50">
                <span className="text-zinc-500 block">Sample Size</span>
                <span className="text-white font-medium">{exp.sampleSize.toLocaleString()}</span>
              </div>
              <div className="p-2 rounded bg-zinc-800/50">
                <span className="text-zinc-500 block">Confidence</span>
                <span className="text-white font-medium">{(exp.confidence * 100).toFixed(0)}%</span>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              <h5 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Variants</h5>
              <div className="flex gap-2">
                <div className="flex-1 p-2 rounded bg-zinc-800/50 text-center">
                  <span className="text-xs text-zinc-500 block">Control</span>
                  <span className="text-white font-medium">{formatCurrency(exp.controlPrice)}</span>
                </div>
                {exp.variants.map((v, i) => (
                  <div key={i} className="flex-1 p-2 rounded bg-purple-500/10 border border-purple-500/30 text-center">
                    <span className="text-xs text-purple-400 block">{v.name}</span>
                    <span className="text-white font-medium">{formatCurrency(v.price)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-4 text-xs">
              <div className="flex-1">
                <span className="text-zinc-500">Success Metrics: </span>
                <span className="text-zinc-400">{exp.successMetrics.join(', ')}</span>
              </div>
            </div>

            {exp.risks.length > 0 && (
              <div className="mt-3 pt-3 border-t border-zinc-800">
                <span className="text-xs text-amber-400">Risks: {exp.risks.join(' • ')}</span>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Main component
export function PricingOptimizer() {
  const [analysis, setAnalysis] = useState<PricingAnalysis | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AIPricingAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'plans' | 'segments' | 'recommendations' | 'ai'>('overview');
  const [simulation, setSimulation] = useState<PriceSimulation | null>(null);
  const [simulating, setSimulating] = useState(false);

  useEffect(() => {
    fetchAnalysis();
  }, []);

  const fetchAIAnalysis = async () => {
    try {
      setAiLoading(true);
      const response = await fetch('/api/pricing/ai');
      if (!response.ok) throw new Error('Failed to fetch AI analysis');
      const data = await response.json();
      setAiAnalysis(data);
    } catch (err) {
      console.error('AI analysis error:', err);
    } finally {
      setAiLoading(false);
    }
  };

  const fetchAnalysis = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/pricing');
      if (!response.ok) throw new Error('Failed to fetch pricing analysis');
      const data = await response.json();
      setAnalysis(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSimulate = async (planId: string) => {
    // Simulate a 10% price increase
    const plan = analysis?.planPerformance.find(p => p.planId === planId);
    if (!plan) return;

    try {
      setSimulating(true);
      const response = await fetch('/api/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          newPrice: Math.round(plan.pricePerMonth * 1.1),
        }),
      });
      if (!response.ok) throw new Error('Simulation failed');
      const data = await response.json();
      setSimulation(data);
    } catch (err) {
      console.error('Simulation error:', err);
    } finally {
      setSimulating(false);
    }
  };

  if (loading) {
    return (
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardContent className="flex items-center justify-center py-20">
          <div className="text-center">
            <Spinner className="w-8 h-8 mx-auto mb-4" />
            <p className="text-zinc-400">Analyzing your pricing data...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-red-500/10 border-red-500/30">
        <CardContent className="py-10 text-center">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-red-400">{error}</p>
          <Button variant="outline" className="mt-4" onClick={fetchAnalysis}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!analysis) return null;

  const pricingPowerColors = {
    WEAK: 'text-red-400 bg-red-500/10 border-red-500/30',
    MODERATE: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    STRONG: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30">
              <DollarSign className="w-6 h-6 text-purple-400" />
            </div>
            Pricing Optimizer
          </h2>
          <p className="text-zinc-400 mt-1">AI-powered insights to maximize your revenue</p>
        </div>
        <Button onClick={fetchAnalysis} variant="outline" size="sm" className="border-zinc-700">
          <Sparkles className="w-4 h-4 mr-2" />
          Refresh Analysis
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <DollarSign className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-zinc-500">Total MRR</p>
                <p className="text-xl font-bold text-white">
                  <AnimatedCurrency cents={analysis.summary.totalMRR} />
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-zinc-500">Avg ARPU</p>
                <p className="text-xl font-bold text-white">{formatCurrency(analysis.summary.avgARPU)}/mo</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Layers className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-zinc-500">Price Spread</p>
                <p className="text-xl font-bold text-white">
                  {formatCurrency(analysis.summary.priceSpread.min)} - {formatCurrency(analysis.summary.priceSpread.max)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${pricingPowerColors[analysis.summary.pricingPower].split(' ')[1]}`}>
                <Zap className={`w-5 h-5 ${pricingPowerColors[analysis.summary.pricingPower].split(' ')[0]}`} />
              </div>
              <div>
                <p className="text-sm text-zinc-500">Pricing Power</p>
                <Badge
                  variant="outline"
                  className={pricingPowerColors[analysis.summary.pricingPower]}
                >
                  {analysis.summary.pricingPower}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-zinc-800 pb-3 overflow-x-auto">
        {[
          { id: 'overview', label: 'Overview', icon: BarChart3 },
          { id: 'ai', label: 'AI Insights', icon: Brain },
          { id: 'plans', label: 'Plan Performance', icon: Layers },
          { id: 'segments', label: 'Customer Segments', icon: Users },
          { id: 'recommendations', label: 'Recommendations', icon: Sparkles },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.id === 'recommendations' && analysis.recommendations.length > 0 && (
                <span className="ml-1 px-2 py-0.5 rounded-full bg-purple-500 text-white text-xs">
                  {analysis.recommendations.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Simulation overlay */}
      {simulation && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="max-w-lg w-full">
            <SimulationCard simulation={simulation} onClose={() => setSimulation(null)} />
          </div>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top performing plans */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                Top Performing Plans
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {analysis.planPerformance.slice(0, 3).map((plan) => (
                <div key={plan.planId} className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50">
                  <ScoreRing score={plan.performanceScore} size={50} strokeWidth={5} />
                  <div className="flex-1">
                    <div className="font-medium text-white">{plan.planName}</div>
                    <div className="text-sm text-zinc-500">{formatCurrency(plan.pricePerMonth)}/mo</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-emerald-400">{plan.mrrShare.toFixed(1)}% MRR</div>
                    <div className="text-xs text-zinc-500">{plan.activeSubscriptions} active</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Top recommendations preview */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                Quick Wins
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {analysis.recommendations.slice(0, 3).map((rec, i) => (
                <div key={i} className="p-3 rounded-lg bg-zinc-800/50 border-l-2 border-purple-500">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs border-purple-500/30 text-purple-400">
                      {rec.type}
                    </Badge>
                    <span className="text-xs text-zinc-500">{rec.planName}</span>
                  </div>
                  <p className="text-sm text-zinc-300 line-clamp-2">{rec.reasoning}</p>
                  <div className="text-xs text-emerald-400 mt-1">
                    Est. impact: {rec.estimatedImpact.mrrChange > 0 ? '+' : ''}{formatCurrency(rec.estimatedImpact.mrrChange)}/mo
                  </div>
                </div>
              ))}
              {analysis.recommendations.length > 3 && (
                <Button
                  variant="ghost"
                  className="w-full text-purple-400 hover:text-purple-300"
                  onClick={() => setActiveTab('recommendations')}
                >
                  View all {analysis.recommendations.length} recommendations
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'plans' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {analysis.planPerformance.map((plan) => (
            <PlanCard key={plan.planId} plan={plan} onSimulate={handleSimulate} />
          ))}
        </div>
      )}

      {activeTab === 'segments' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {analysis.segmentInsights.map((segment) => (
            <SegmentCard key={segment.segment} segment={segment} />
          ))}
        </div>
      )}

      {activeTab === 'recommendations' && (
        <div className="space-y-4">
          {analysis.recommendations.map((rec, i) => (
            <RecommendationCard key={i} rec={rec} index={i} />
          ))}
          {analysis.recommendations.length === 0 && (
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardContent className="py-10 text-center">
                <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-zinc-400">Your pricing looks optimized! No immediate recommendations.</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'ai' && (
        <div className="space-y-6">
          {!aiAnalysis && !aiLoading && (
            <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/30">
              <CardContent className="py-12 text-center">
                <div className="p-4 rounded-2xl bg-purple-500/20 border border-purple-500/30 w-fit mx-auto mb-4">
                  <Brain className="w-10 h-10 text-purple-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">AI-Powered Pricing Analysis</h3>
                <p className="text-zinc-400 mb-6 max-w-md mx-auto">
                  Get deep AI insights including optimal price predictions, experiment designs, 
                  and a comprehensive pricing health narrative.
                </p>
                <Button
                  onClick={fetchAIAnalysis}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Run AI Analysis
                </Button>
              </CardContent>
            </Card>
          )}

          {aiLoading && (
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardContent className="py-16 text-center">
                <Spinner className="w-10 h-10 mx-auto mb-4" />
                <p className="text-zinc-400">Running deep AI analysis...</p>
                <p className="text-zinc-500 text-sm mt-1">This may take 30-60 seconds</p>
              </CardContent>
            </Card>
          )}

          {aiAnalysis && !aiLoading && (
            <>
              {/* Top Opportunity Banner */}
              <Card className="bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border-emerald-500/30">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30">
                        <DollarSign className="w-6 h-6 text-emerald-400" />
                      </div>
                      <div>
                        <div className="text-sm text-emerald-400 font-medium">Total Pricing Opportunity</div>
                        <div className="text-3xl font-bold text-white">
                          {formatCurrency(aiAnalysis.totalOpportunity)}/mo
                        </div>
                      </div>
                    </div>
                    <div className="text-right max-w-md">
                      <p className="text-sm text-zinc-300">{aiAnalysis.topRecommendation}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* AI Narrative */}
              <Card className="bg-zinc-900/50 border-zinc-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Gauge className="w-5 h-5 text-purple-400" />
                    Pricing Health Report
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <NarrativeCard narrative={aiAnalysis.narrative} />
                </CardContent>
              </Card>

              {/* Optimal Prices */}
              {aiAnalysis.optimalPrices.length > 0 && (
                <Card className="bg-zinc-900/50 border-zinc-800">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="w-5 h-5 text-blue-400" />
                      AI Optimal Price Predictions
                    </CardTitle>
                    <CardDescription>
                      Data-driven price recommendations for each plan
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <OptimalPricesCard optimalPrices={aiAnalysis.optimalPrices} />
                  </CardContent>
                </Card>
              )}

              {/* Experiments */}
              {aiAnalysis.experiments.length > 0 && (
                <Card className="bg-zinc-900/50 border-zinc-800">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FlaskConical className="w-5 h-5 text-amber-400" />
                      AI-Designed Experiments
                    </CardTitle>
                    <CardDescription>
                      Statistically valid pricing tests to run
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ExperimentsCard experiments={aiAnalysis.experiments} />
                  </CardContent>
                </Card>
              )}

              <div className="text-center">
                <Button
                  variant="outline"
                  onClick={fetchAIAnalysis}
                  className="border-zinc-700"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Refresh AI Analysis
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

