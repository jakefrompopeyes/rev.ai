import { prisma } from '@/lib/db';
import { OpenAI } from 'openai';
import { subDays, differenceInDays } from 'date-fns';

// Lazy load OpenAI client
function getOpenAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

// ============================================================================
// TYPES
// ============================================================================

export interface PlanPerformance {
  planId: string;
  planName: string;
  pricePerMonth: number;
  
  // Volume metrics
  activeSubscriptions: number;
  totalEverSubscribed: number;
  
  // Conversion metrics
  conversionFromTrial: number; // % of trials that convert
  
  // Retention metrics
  averageLifetimeDays: number;
  churnRate: number; // monthly
  retentionAt30Days: number;
  retentionAt90Days: number;
  
  // Revenue metrics
  ltv: number; // Lifetime value
  mrr: number;
  mrrShare: number; // % of total MRR
  
  // Expansion metrics
  upgradeRate: number; // % that upgrade to higher plan
  downgradeRate: number; // % that downgrade from this plan
  
  // Efficiency metrics
  revenuePerEffort: number; // Proxy for how "easy" this revenue is
  discountFrequency: number; // How often discounts are needed
  avgDiscountPercent: number;
  
  // Overall score (0-100)
  performanceScore: number;
  scoreBreakdown: {
    retention: number;
    revenue: number;
    growth: number;
    efficiency: number;
  };
}

export interface PriceElasticityPoint {
  pricePoint: number;
  subscriptionCount: number;
  churnRate: number;
  conversionRate: number;
  estimatedDemand: number;
  estimatedRevenue: number;
}

export interface PricingRecommendation {
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

export interface PricingAnalysis {
  summary: {
    totalMRR: number;
    avgARPU: number;
    priceSpread: { min: number; max: number };
    dominantPlan: string;
    underperformingPlans: string[];
    pricingPower: 'WEAK' | 'MODERATE' | 'STRONG'; // Can you raise prices?
  };
  planPerformance: PlanPerformance[];
  elasticityCurve: PriceElasticityPoint[];
  recommendations: PricingRecommendation[];
  segmentInsights: SegmentPricingInsight[];
  simulationResults?: PriceSimulation[];
}

export interface SegmentPricingInsight {
  segment: string;
  description: string;
  size: number;
  avgPrice: number;
  priceRangeAccepted: { min: number; max: number };
  churnSensitivity: 'LOW' | 'MEDIUM' | 'HIGH';
  willingnessToPay: number; // Estimated max price
  recommendations: string[];
}

export interface PriceSimulation {
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

// ============================================================================
// PLAN PERFORMANCE ANALYSIS
// ============================================================================

/**
 * Analyze performance of each pricing plan
 */
export async function analyzePlanPerformance(
  organizationId: string
): Promise<PlanPerformance[]> {
  const plans: PlanPerformance[] = [];

  // Get all subscriptions with their history
  const subscriptions = await prisma.stripeSubscription.findMany({
    where: { organizationId },
    include: {
      events: true,
      customer: true,
    },
    orderBy: { stripeCreatedAt: 'desc' },
  });

  // Group by plan
  const planGroups: Record<string, typeof subscriptions> = {};
  for (const sub of subscriptions) {
    const planKey = sub.planId || 'unknown';
    if (!planGroups[planKey]) {
      planGroups[planKey] = [];
    }
    planGroups[planKey].push(sub);
  }

  // Calculate total MRR for share calculation
  const totalMRR = subscriptions
    .filter(s => s.status === 'active' || s.status === 'trialing')
    .reduce((sum, s) => sum + s.mrr, 0);

  // Analyze each plan
  for (const [planId, planSubs] of Object.entries(planGroups)) {
    const activeSubs = planSubs.filter(s => s.status === 'active' || s.status === 'trialing');
    const canceledSubs = planSubs.filter(s => s.status === 'canceled');
    const trialingSubs = planSubs.filter(s => s.status === 'trialing');
    
    // Get a representative subscription for plan info
    const sample = planSubs[0];
    const planName = sample.planNickname || planId;
    const pricePerMonth = sample.mrr;

    // Calculate lifetime
    const lifetimes = canceledSubs.map(s => {
      const end = s.endedAt || s.canceledAt || new Date();
      return differenceInDays(end, s.stripeCreatedAt);
    });
    const avgLifetime = lifetimes.length > 0 
      ? lifetimes.reduce((a, b) => a + b, 0) / lifetimes.length 
      : 365; // Default to 1 year if no churn data

    // Calculate churn rate
    const churnRate = planSubs.length > 0 
      ? (canceledSubs.length / planSubs.length) * 100 
      : 0;

    // Calculate retention rates
    const thirtyDaysAgo = subDays(new Date(), 30);
    const ninetyDaysAgo = subDays(new Date(), 90);
    
    const subsOlderThan30 = planSubs.filter(s => s.stripeCreatedAt < thirtyDaysAgo);
    const subsOlderThan90 = planSubs.filter(s => s.stripeCreatedAt < ninetyDaysAgo);
    
    const retainedAt30 = subsOlderThan30.filter(s => 
      s.status === 'active' || (s.canceledAt && s.canceledAt > thirtyDaysAgo)
    ).length;
    const retainedAt90 = subsOlderThan90.filter(s => 
      s.status === 'active' || (s.canceledAt && s.canceledAt > ninetyDaysAgo)
    ).length;

    const retentionAt30Days = subsOlderThan30.length > 0 
      ? (retainedAt30 / subsOlderThan30.length) * 100 
      : 100;
    const retentionAt90Days = subsOlderThan90.length > 0 
      ? (retainedAt90 / subsOlderThan90.length) * 100 
      : 100;

    // Calculate LTV
    const monthlyChurnDecimal = churnRate / 100;
    const ltv = monthlyChurnDecimal > 0 
      ? pricePerMonth / monthlyChurnDecimal 
      : pricePerMonth * 36; // Cap at 3 years if no churn

    // Calculate MRR
    const planMRR = activeSubs.reduce((sum, s) => sum + s.mrr, 0);
    const mrrShare = totalMRR > 0 ? (planMRR / totalMRR) * 100 : 0;

    // Calculate upgrade/downgrade rates from events
    const allEvents = planSubs.flatMap(s => s.events);
    const upgrades = allEvents.filter(e => e.type === 'UPGRADE' && e.previousPlanId === planId);
    const downgrades = allEvents.filter(e => e.type === 'DOWNGRADE' && e.previousPlanId === planId);
    
    const upgradeRate = planSubs.length > 0 ? (upgrades.length / planSubs.length) * 100 : 0;
    const downgradeRate = planSubs.length > 0 ? (downgrades.length / planSubs.length) * 100 : 0;

    // Calculate discount metrics
    const discountedSubs = planSubs.filter(s => s.discountPercent && s.discountPercent > 0);
    const discountFrequency = planSubs.length > 0 
      ? (discountedSubs.length / planSubs.length) * 100 
      : 0;
    const avgDiscountPercent = discountedSubs.length > 0
      ? discountedSubs.reduce((sum, s) => sum + (s.discountPercent || 0), 0) / discountedSubs.length
      : 0;

    // Calculate trial conversion (for trialing subs that became active)
    const convertedFromTrial = planSubs.filter(s => 
      s.trialEnd && s.status === 'active'
    ).length;
    const totalTrials = planSubs.filter(s => s.trialStart).length;
    const conversionFromTrial = totalTrials > 0 
      ? (convertedFromTrial / totalTrials) * 100 
      : 0;

    // Revenue per effort (higher price with lower discount = better)
    const revenuePerEffort = pricePerMonth * (1 - avgDiscountPercent / 100);

    // Calculate performance score
    const scoreBreakdown = {
      retention: calculateRetentionScore(retentionAt30Days, retentionAt90Days, churnRate),
      revenue: calculateRevenueScore(ltv, pricePerMonth, mrrShare),
      growth: calculateGrowthScore(upgradeRate, downgradeRate, conversionFromTrial),
      efficiency: calculateEfficiencyScore(discountFrequency, avgDiscountPercent),
    };
    
    const performanceScore = (
      scoreBreakdown.retention * 0.35 +
      scoreBreakdown.revenue * 0.30 +
      scoreBreakdown.growth * 0.20 +
      scoreBreakdown.efficiency * 0.15
    );

    plans.push({
      planId,
      planName,
      pricePerMonth,
      activeSubscriptions: activeSubs.length,
      totalEverSubscribed: planSubs.length,
      conversionFromTrial,
      averageLifetimeDays: avgLifetime,
      churnRate,
      retentionAt30Days,
      retentionAt90Days,
      ltv,
      mrr: planMRR,
      mrrShare,
      upgradeRate,
      downgradeRate,
      revenuePerEffort,
      discountFrequency,
      avgDiscountPercent,
      performanceScore,
      scoreBreakdown,
    });
  }

  return plans.sort((a, b) => b.performanceScore - a.performanceScore);
}

function calculateRetentionScore(retention30: number, retention90: number, churnRate: number): number {
  // Weight: 30-day retention (40%), 90-day retention (40%), inverse churn (20%)
  const r30Score = Math.min(100, retention30);
  const r90Score = Math.min(100, retention90);
  const churnScore = Math.max(0, 100 - churnRate * 10); // 10% churn = 0 score
  
  return r30Score * 0.4 + r90Score * 0.4 + churnScore * 0.2;
}

function calculateRevenueScore(ltv: number, price: number, mrrShare: number): number {
  // Normalize LTV (assuming $5000 is excellent LTV)
  const ltvScore = Math.min(100, (ltv / 500000) * 100); // In cents
  // Price premium (higher price plans often indicate value)
  const priceScore = Math.min(100, (price / 20000) * 100); // $200/mo = 100
  // MRR share (contribution to business)
  const shareScore = Math.min(100, mrrShare * 3); // 33% share = 100
  
  return ltvScore * 0.5 + priceScore * 0.25 + shareScore * 0.25;
}

function calculateGrowthScore(upgradeRate: number, downgradeRate: number, conversion: number): number {
  // Upgrade potential
  const upgradeScore = Math.min(100, upgradeRate * 5); // 20% upgrade rate = 100
  // Inverse downgrade
  const downgradeScore = Math.max(0, 100 - downgradeRate * 10);
  // Trial conversion
  const conversionScore = Math.min(100, conversion);
  
  return upgradeScore * 0.4 + downgradeScore * 0.3 + conversionScore * 0.3;
}

function calculateEfficiencyScore(discountFreq: number, avgDiscount: number): number {
  // Lower discount frequency is better
  const freqScore = Math.max(0, 100 - discountFreq);
  // Lower average discount is better
  const discountScore = Math.max(0, 100 - avgDiscount * 2);
  
  return freqScore * 0.5 + discountScore * 0.5;
}

// ============================================================================
// PRICE ELASTICITY ANALYSIS
// ============================================================================

/**
 * Analyze price elasticity based on historical data
 */
export async function analyzePriceElasticity(
  organizationId: string
): Promise<PriceElasticityPoint[]> {
  const subscriptions = await prisma.stripeSubscription.findMany({
    where: { organizationId },
    include: {
      events: true,
    },
  });

  // Group subscriptions by price point (bucket by $10 increments)
  const pricePoints: Record<number, {
    total: number;
    active: number;
    churned: number;
    converted: number;
    trials: number;
  }> = {};

  for (const sub of subscriptions) {
    // Round to nearest $10 (in cents, so $1000)
    const bucket = Math.round(sub.mrr / 1000) * 1000;
    
    if (!pricePoints[bucket]) {
      pricePoints[bucket] = { total: 0, active: 0, churned: 0, converted: 0, trials: 0 };
    }
    
    pricePoints[bucket].total++;
    if (sub.status === 'active') pricePoints[bucket].active++;
    if (sub.status === 'canceled') pricePoints[bucket].churned++;
    if (sub.trialStart) pricePoints[bucket].trials++;
    if (sub.trialEnd && sub.status === 'active') pricePoints[bucket].converted++;
  }

  // Calculate elasticity curve
  const elasticityCurve: PriceElasticityPoint[] = [];
  const sortedPrices = Object.keys(pricePoints).map(Number).sort((a, b) => a - b);

  for (const price of sortedPrices) {
    const data = pricePoints[price];
    const churnRate = data.total > 0 ? (data.churned / data.total) * 100 : 0;
    const conversionRate = data.trials > 0 ? (data.converted / data.trials) * 100 : 0;
    
    // Estimate demand at this price (normalized)
    const maxTotal = Math.max(...Object.values(pricePoints).map(p => p.total));
    const estimatedDemand = data.total / maxTotal;
    
    // Estimate revenue at this price point
    const estimatedRevenue = price * data.active;

    elasticityCurve.push({
      pricePoint: price,
      subscriptionCount: data.total,
      churnRate,
      conversionRate,
      estimatedDemand,
      estimatedRevenue,
    });
  }

  return elasticityCurve;
}

// ============================================================================
// CUSTOMER SEGMENTATION BY PRICE SENSITIVITY
// ============================================================================

/**
 * Segment customers by their pricing behavior
 */
export async function analyzeCustomerPricingSegments(
  organizationId: string
): Promise<SegmentPricingInsight[]> {
  const subscriptions = await prisma.stripeSubscription.findMany({
    where: { organizationId },
    include: {
      customer: true,
      events: true,
    },
  });

  // Define segments based on behavior patterns
  const segments: Record<string, {
    subscriptions: typeof subscriptions;
    description: string;
  }> = {
    'Price Champions': {
      subscriptions: subscriptions.filter(s => 
        s.status === 'active' && 
        (!s.discountPercent || s.discountPercent < 10) &&
        s.planInterval === 'year'
      ),
      description: 'Customers who pay full price on annual plans - highest LTV',
    },
    'Value Seekers': {
      subscriptions: subscriptions.filter(s =>
        s.discountPercent && s.discountPercent >= 20 && s.status === 'active'
      ),
      description: 'Customers who only buy with significant discounts',
    },
    'Monthly Flexers': {
      subscriptions: subscriptions.filter(s =>
        s.planInterval === 'month' && s.status === 'active'
      ),
      description: 'Monthly subscribers - flexible but lower commitment',
    },
    'Upgraders': {
      subscriptions: subscriptions.filter(s =>
        s.events.some(e => e.type === 'UPGRADE')
      ),
      description: 'Customers who have upgraded - strong product-value fit',
    },
    'Downgraders': {
      subscriptions: subscriptions.filter(s =>
        s.events.some(e => e.type === 'DOWNGRADE')
      ),
      description: 'Customers who downgraded - may indicate price sensitivity',
    },
    'At-Risk Premium': {
      subscriptions: subscriptions.filter(s =>
        s.mrr > 10000 && // $100+/mo
        (s.status === 'canceled' || s.cancelAtPeriodEnd)
      ),
      description: 'High-value customers who churned or are canceling',
    },
  };

  const insights: SegmentPricingInsight[] = [];

  for (const [segmentName, data] of Object.entries(segments)) {
    const subs = data.subscriptions;
    if (subs.length < 3) continue; // Skip tiny segments

    const prices = subs.map(s => s.mrr);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    // Estimate churn sensitivity
    const churned = subs.filter(s => s.status === 'canceled').length;
    const churnRate = churned / subs.length;
    const churnSensitivity: 'LOW' | 'MEDIUM' | 'HIGH' = 
      churnRate < 0.1 ? 'LOW' : churnRate < 0.25 ? 'MEDIUM' : 'HIGH';

    // Estimate willingness to pay based on behavior
    let willingnessToPay = maxPrice;
    if (segmentName === 'Value Seekers') {
      willingnessToPay = avgPrice * 1.2; // They won't pay much more
    } else if (segmentName === 'Price Champions') {
      willingnessToPay = maxPrice * 1.15; // Could potentially pay 15% more
    } else if (segmentName === 'Upgraders') {
      willingnessToPay = maxPrice * 1.25; // Proven expansion capacity
    }

    // Generate recommendations
    const recommendations: string[] = [];
    if (segmentName === 'Value Seekers') {
      recommendations.push('Consider value-add bundles instead of pure discounts');
      recommendations.push('Test time-limited discounts to create urgency');
    } else if (segmentName === 'Price Champions') {
      recommendations.push('Offer early access to new features as loyalty reward');
      recommendations.push('Consider grandfathering if raising prices');
    } else if (segmentName === 'Monthly Flexers') {
      recommendations.push('Create incentives for annual conversion');
      recommendations.push('Test billing flexibility (quarterly option)');
    } else if (segmentName === 'At-Risk Premium') {
      recommendations.push('Proactive outreach before cancellation');
      recommendations.push('Consider creating a "pause" option');
    }

    insights.push({
      segment: segmentName,
      description: data.description,
      size: subs.length,
      avgPrice,
      priceRangeAccepted: { min: minPrice, max: maxPrice },
      churnSensitivity,
      willingnessToPay,
      recommendations,
    });
  }

  return insights.sort((a, b) => b.size - a.size);
}

// ============================================================================
// PRICE SIMULATION
// ============================================================================

/**
 * Simulate the impact of a price change
 */
export async function simulatePriceChange(
  organizationId: string,
  planId: string,
  newPriceCents: number
): Promise<PriceSimulation> {
  // Get current plan data
  const planSubscriptions = await prisma.stripeSubscription.findMany({
    where: {
      organizationId,
      planId,
    },
    include: {
      events: true,
    },
  });

  if (planSubscriptions.length === 0) {
    throw new Error('No subscriptions found for this plan');
  }

  const currentPrice = planSubscriptions[0].mrr;
  const activeSubs = planSubscriptions.filter(s => s.status === 'active' || s.status === 'trialing');
  const priceChangePercent = ((newPriceCents - currentPrice) / currentPrice) * 100;

  // Get elasticity data to estimate impact
  const elasticity = await analyzePriceElasticity(organizationId);
  
  // Find closest price points to estimate behavior
  const closestPoint = elasticity.reduce((closest, point) => {
    return Math.abs(point.pricePoint - newPriceCents) < Math.abs(closest.pricePoint - newPriceCents)
      ? point
      : closest;
  }, elasticity[0]);

  // Estimate churn impact based on price increase
  // Rule of thumb: 10% price increase = ~5-15% churn increase for price-sensitive products
  const churnMultiplier = priceChangePercent > 0
    ? 1 + (priceChangePercent / 100) * 0.5 // Conservative: 10% increase = 5% more churn
    : 1 - (Math.abs(priceChangePercent) / 100) * 0.3; // Price decrease reduces churn less

  const currentChurnRate = planSubscriptions.filter(s => s.status === 'canceled').length / planSubscriptions.length;
  const projectedChurnRate = Math.min(0.5, currentChurnRate * churnMultiplier);

  // Calculate projected outcomes
  const currentMRR = activeSubs.reduce((sum, s) => sum + s.mrr, 0);
  const projectedChurned = Math.round(activeSubs.length * projectedChurnRate);
  const remainingSubs = activeSubs.length - projectedChurned;
  const newMRR = remainingSubs * newPriceCents;
  const netMRRChange = newMRR - currentMRR;

  // Estimate break-even (how long until price change is profitable)
  const monthlyMRRGain = priceChangePercent > 0 
    ? remainingSubs * (newPriceCents - currentPrice)
    : 0;
  const churnLoss = projectedChurned * newPriceCents;
  const breakEvenDays = monthlyMRRGain > 0 
    ? Math.ceil((churnLoss / monthlyMRRGain) * 30)
    : priceChangePercent < 0 ? 0 : 365;

  // Confidence based on data quantity
  const confidence = Math.min(0.8, 0.3 + (planSubscriptions.length / 100) * 0.5);

  return {
    scenario: priceChangePercent > 0 ? 'Price Increase' : 'Price Decrease',
    planId,
    currentPrice,
    newPrice: newPriceCents,
    priceChangePercent,
    projectedOutcomes: {
      newSubscriptions: 0, // New subs harder to project
      churnedSubscriptions: projectedChurned,
      netMRRChange,
      breakEvenDays,
    },
    confidence,
  };
}

// ============================================================================
// AI-POWERED PRICING RECOMMENDATIONS
// ============================================================================

/**
 * Generate AI-powered pricing recommendations
 */
export async function generatePricingRecommendations(
  organizationId: string
): Promise<PricingRecommendation[]> {
  const recommendations: PricingRecommendation[] = [];

  // Get all the analysis data
  const [planPerformance, elasticity, segments] = await Promise.all([
    analyzePlanPerformance(organizationId),
    analyzePriceElasticity(organizationId),
    analyzeCustomerPricingSegments(organizationId),
  ]);

  // Get latest metrics for context
  const latestMetrics = await prisma.dailyMetrics.findFirst({
    where: { organizationId },
    orderBy: { date: 'desc' },
  });

  // Heuristic recommendations
  recommendations.push(...generateHeuristicPricingRecs(planPerformance, segments, latestMetrics));

  // LLM-enhanced recommendations
  const llmRecs = await generateLLMPricingRecs(planPerformance, elasticity, segments, latestMetrics);
  recommendations.push(...llmRecs);

  return recommendations.sort((a, b) => b.estimatedImpact.confidenceScore - a.estimatedImpact.confidenceScore);
}

function generateHeuristicPricingRecs(
  plans: PlanPerformance[],
  segments: SegmentPricingInsight[],
  metrics: { mrr: number; averageDiscount: number; discountLeakage: number } | null
): PricingRecommendation[] {
  const recs: PricingRecommendation[] = [];

  // Find underperforming plans (low score, high churn)
  const underperformers = plans.filter(p => 
    p.performanceScore < 50 && p.activeSubscriptions > 5
  );

  for (const plan of underperformers) {
    if (plan.churnRate > 15 && plan.avgDiscountPercent < 10) {
      // High churn, low discount - might be overpriced
      recs.push({
        type: 'DECREASE',
        planId: plan.planId,
        planName: plan.planName,
        currentPrice: plan.pricePerMonth,
        recommendedPrice: Math.round(plan.pricePerMonth * 0.85), // 15% decrease
        reasoning: `${plan.planName} has ${plan.churnRate.toFixed(1)}% churn rate which is significantly above healthy benchmarks. The high churn combined with low discount usage suggests customers may not perceive sufficient value at the current price point.`,
        estimatedImpact: {
          mrrChange: Math.round(plan.mrr * 0.1), // Net positive from retention
          churnRisk: 'LOW',
          confidenceScore: 0.6,
          timeToRealize: '3-6 months',
        },
        implementationSteps: [
          'Announce price reduction to existing customers as a "loyalty benefit"',
          'Update pricing page and billing system',
          'Monitor churn rate changes over 90 days',
        ],
        riskFactors: [
          'Existing customers may feel they overpaid',
          'May attract more price-sensitive customers',
        ],
      });
    }
  }

  // Find high-performers that could support price increases
  const topPerformers = plans.filter(p => 
    p.performanceScore > 75 && 
    p.churnRate < 5 && 
    p.activeSubscriptions > 10
  );

  for (const plan of topPerformers) {
    if (plan.upgradeRate > 10) {
      // High upgrade rate indicates customers want more - strong pricing power
      recs.push({
        type: 'INCREASE',
        planId: plan.planId,
        planName: plan.planName,
        currentPrice: plan.pricePerMonth,
        recommendedPrice: Math.round(plan.pricePerMonth * 1.15), // 15% increase
        reasoning: `${plan.planName} shows strong performance with ${plan.retentionAt90Days.toFixed(0)}% 90-day retention and ${plan.upgradeRate.toFixed(1)}% upgrade rate. This indicates high perceived value and potential pricing power.`,
        estimatedImpact: {
          mrrChange: Math.round(plan.mrr * 0.12), // 15% increase minus some churn
          churnRisk: 'MEDIUM',
          confidenceScore: 0.7,
          timeToRealize: '1-3 months',
        },
        implementationSteps: [
          'Consider grandfathering existing customers for 6-12 months',
          'Communicate value additions with price increase',
          'Test new price on new customers first',
          'Monitor conversion rate closely',
        ],
        riskFactors: [
          'May increase churn slightly in short term',
          'Competitors may undercut on price',
        ],
      });
    }
  }

  // Check for pricing gap opportunities
  if (plans.length >= 2) {
    const sorted = [...plans].sort((a, b) => a.pricePerMonth - b.pricePerMonth);
    for (let i = 1; i < sorted.length; i++) {
      const priceDiff = sorted[i].pricePerMonth - sorted[i - 1].pricePerMonth;
      if (priceDiff > sorted[i - 1].pricePerMonth * 2) {
        // Big gap between tiers - opportunity for new tier
        recs.push({
          type: 'NEW_TIER',
          planId: 'new',
          planName: 'Suggested New Tier',
          currentPrice: 0,
          recommendedPrice: Math.round((sorted[i].pricePerMonth + sorted[i - 1].pricePerMonth) / 2),
          reasoning: `There's a ${(priceDiff / 100).toFixed(0)}$ gap between ${sorted[i - 1].planName} and ${sorted[i].planName}. This may cause customers to choose lower tier when they might pay more for intermediate features.`,
          estimatedImpact: {
            mrrChange: Math.round(sorted[i - 1].mrr * 0.1),
            churnRisk: 'LOW',
            confidenceScore: 0.5,
            timeToRealize: '6-12 months',
          },
          implementationSteps: [
            'Define feature set between existing tiers',
            'Create new pricing page with 3-tier layout',
            'Offer upgrade paths for existing customers',
          ],
          riskFactors: [
            'May cannibalize higher tier',
            'Added complexity in pricing page',
          ],
        });
      }
    }
  }

  // Discount optimization
  if (metrics && metrics.discountLeakage > metrics.mrr * 0.1) {
    const leakagePercent = (metrics.discountLeakage / metrics.mrr) * 100;
    recs.push({
      type: 'RESTRUCTURE',
      planId: 'all',
      planName: 'Discount Policy',
      currentPrice: 0,
      reasoning: `You're losing ${leakagePercent.toFixed(1)}% of potential revenue to discounts ($${(metrics.discountLeakage / 100).toLocaleString()}/month). Analysis shows heavily discounted customers often have higher churn.`,
      estimatedImpact: {
        mrrChange: Math.round(metrics.discountLeakage * 0.3), // Recover 30%
        churnRisk: 'MEDIUM',
        confidenceScore: 0.65,
        timeToRealize: '3-6 months',
      },
      implementationSteps: [
        'Cap standard discounts at 15%',
        'Require manager approval for 20%+ discounts',
        'Replace discounts with value-adds (extra months, features)',
        'Set automatic discount expiration dates',
      ],
      riskFactors: [
        'Sales team may resist',
        'May slow deal velocity initially',
      ],
    });
  }

  return recs;
}

async function generateLLMPricingRecs(
  plans: PlanPerformance[],
  elasticity: PriceElasticityPoint[],
  segments: SegmentPricingInsight[],
  metrics: { mrr: number; arpu: number; grossChurnRate: number } | null
): Promise<PricingRecommendation[]> {
  const openai = getOpenAIClient();
  if (!openai || !metrics) return [];

  try {
    const prompt = `Analyze this SaaS pricing data and provide 2-3 specific pricing optimization recommendations.

CURRENT METRICS:
- MRR: $${(metrics.mrr / 100).toLocaleString()}
- ARPU: $${(metrics.arpu / 100).toFixed(0)}/month
- Churn Rate: ${metrics.grossChurnRate.toFixed(1)}%

PLAN PERFORMANCE:
${plans.slice(0, 5).map(p => `
- ${p.planName}: $${(p.pricePerMonth / 100).toFixed(0)}/mo
  Active: ${p.activeSubscriptions}, Churn: ${p.churnRate.toFixed(1)}%, Score: ${p.performanceScore.toFixed(0)}/100
  LTV: $${(p.ltv / 100).toFixed(0)}, Upgrade Rate: ${p.upgradeRate.toFixed(1)}%
  Discount Freq: ${p.discountFrequency.toFixed(0)}%, Avg Discount: ${p.avgDiscountPercent.toFixed(1)}%
`).join('')}

PRICE ELASTICITY CURVE:
${elasticity.slice(0, 5).map(e => 
  `- $${(e.pricePoint / 100).toFixed(0)}: ${e.subscriptionCount} subs, ${e.churnRate.toFixed(1)}% churn`
).join('\n')}

CUSTOMER SEGMENTS:
${segments.slice(0, 4).map(s =>
  `- ${s.segment}: ${s.size} customers, avg $${(s.avgPrice / 100).toFixed(0)}, churn sensitivity: ${s.churnSensitivity}`
).join('\n')}

Return JSON with array of recommendations. Each must have:
{
  "type": "INCREASE" | "DECREASE" | "NEW_TIER" | "BUNDLE" | "RESTRUCTURE",
  "planName": string,
  "currentPriceCents": number,
  "recommendedPriceCents": number (if applicable),
  "reasoning": string (2-3 sentences, specific and quantitative),
  "mrrChangeEstimate": number (in cents, conservative),
  "churnRisk": "LOW" | "MEDIUM" | "HIGH",
  "confidence": number (0.4-0.8),
  "implementationSteps": string[] (2-3 steps),
  "riskFactors": string[] (1-2 risks)
}

Focus on non-obvious insights. Be specific and conservative.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a SaaS pricing strategist. Provide specific, data-driven pricing recommendations. Be conservative with estimates. Return only valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      const llmRecs = parsed.recommendations || parsed;
      
      if (Array.isArray(llmRecs)) {
        return llmRecs.map((rec: {
          type: 'INCREASE' | 'DECREASE' | 'NEW_TIER' | 'BUNDLE' | 'RESTRUCTURE';
          planName: string;
          currentPriceCents?: number;
          recommendedPriceCents?: number;
          reasoning: string;
          mrrChangeEstimate?: number;
          churnRisk: 'LOW' | 'MEDIUM' | 'HIGH';
          confidence?: number;
          implementationSteps?: string[];
          riskFactors?: string[];
        }) => ({
          type: rec.type,
          planId: 'llm-suggested',
          planName: rec.planName,
          currentPrice: rec.currentPriceCents || 0,
          recommendedPrice: rec.recommendedPriceCents,
          reasoning: rec.reasoning,
          estimatedImpact: {
            mrrChange: rec.mrrChangeEstimate || 0,
            churnRisk: rec.churnRisk,
            confidenceScore: rec.confidence || 0.5,
            timeToRealize: '3-6 months',
          },
          implementationSteps: rec.implementationSteps || [],
          riskFactors: rec.riskFactors || [],
        }));
      }
    }
  } catch (error) {
    console.error('LLM pricing recommendations failed:', error);
  }

  return [];
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Run complete pricing analysis for an organization
 */
export async function runPricingAnalysis(organizationId: string): Promise<PricingAnalysis> {
  // Run all analyses in parallel
  const [planPerformance, elasticityCurve, segmentInsights, recommendations] = await Promise.all([
    analyzePlanPerformance(organizationId),
    analyzePriceElasticity(organizationId),
    analyzeCustomerPricingSegments(organizationId),
    generatePricingRecommendations(organizationId),
  ]);

  // Get latest metrics for summary
  const latestMetrics = await prisma.dailyMetrics.findFirst({
    where: { organizationId },
    orderBy: { date: 'desc' },
  });

  // Calculate summary
  const prices = planPerformance.map(p => p.pricePerMonth);
  const underperformingPlans = planPerformance
    .filter(p => p.performanceScore < 50)
    .map(p => p.planName);

  // Determine pricing power based on churn sensitivity and discount usage
  const avgChurn = planPerformance.reduce((sum, p) => sum + p.churnRate, 0) / planPerformance.length;
  const avgDiscount = planPerformance.reduce((sum, p) => sum + p.avgDiscountPercent, 0) / planPerformance.length;
  
  let pricingPower: 'WEAK' | 'MODERATE' | 'STRONG';
  if (avgChurn < 5 && avgDiscount < 10) {
    pricingPower = 'STRONG';
  } else if (avgChurn > 15 || avgDiscount > 25) {
    pricingPower = 'WEAK';
  } else {
    pricingPower = 'MODERATE';
  }

  return {
    summary: {
      totalMRR: latestMetrics?.mrr || 0,
      avgARPU: latestMetrics?.arpu || 0,
      priceSpread: {
        min: Math.min(...prices),
        max: Math.max(...prices),
      },
      dominantPlan: planPerformance[0]?.planName || 'Unknown',
      underperformingPlans,
      pricingPower,
    },
    planPerformance,
    elasticityCurve,
    recommendations,
    segmentInsights,
  };
}

