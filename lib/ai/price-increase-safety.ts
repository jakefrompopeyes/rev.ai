import { prisma } from '@/lib/db';
import { OpenAI } from 'openai';
import { subDays, differenceInDays, format } from 'date-fns';

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

const ANALYSIS_CONFIG = {
  LOOKBACK_DAYS: 365,           // How far back to look for price increases
  CHURN_WINDOW_DAYS: 90,        // Days after increase to monitor churn
  MIN_SAMPLE_SIZE: 5,           // Minimum customers affected for statistical relevance
  SIGNIFICANT_INCREASE_PERCENT: 5, // Minimum % increase to count as a "price increase"
};

export interface PriceIncreaseEvent {
  id: string;
  subscriptionId: string;
  customerId: string;
  customerEmail: string | null;
  
  // Price change details
  previousPrice: number;      // cents
  newPrice: number;           // cents
  increaseAmount: number;     // cents
  increasePercent: number;    // %
  
  // Plan info
  planId: string | null;
  planName: string | null;
  
  // Timing
  occurredAt: Date;
  
  // Outcome (after churn window)
  outcome: 'stayed' | 'churned' | 'pending';
  daysUntilChurn: number | null;  // If churned, how many days after increase
  
  // Current status
  currentStatus: string;
  
  // Later behavior
  totalRevenueAfter: number;   // Revenue collected after the increase
  monthsRetainedAfter: number; // How many months they stayed after
}

export interface PlanPriceIncreaseSafety {
  planId: string;
  planName: string | null;
  currentPrice: number;
  
  // Historical price increases for this plan
  priceIncreases: {
    date: Date;
    fromPrice: number;
    toPrice: number;
    increasePercent: number;
  }[];
  
  // Customers affected by increases
  customersAffected: number;
  
  // Outcomes
  customersStayed: number;
  customersChurned: number;
  customersPending: number;  // Still in observation window
  
  // Key metrics
  churnRateAfterIncrease: number;  // % who churned after increase
  baselineChurnRate: number;       // % who churn without price increase
  churnDelta: number;              // Difference (positive = more churn after increase)
  
  // Revenue impact
  revenueRetainedAfterIncrease: number;
  averageMonthsRetainedAfter: number;
  
  // Safety assessment
  safetyScore: number;         // 0-100 (100 = very safe to increase)
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  
  // Recommendation
  safeToIncrease: boolean;
  maxSafeIncrease: number;     // % increase that's historically safe
  confidence: number;          // 0-1 confidence in the assessment
}

export interface SegmentPriceSensitivity {
  segment: string;
  description: string;
  size: number;
  
  // How they responded to past increases
  experiencedIncrease: number;
  stayedAfterIncrease: number;
  churnedAfterIncrease: number;
  retentionRate: number;
  
  // Price sensitivity
  sensitivity: 'LOW' | 'MEDIUM' | 'HIGH';
  
  // Recommendation
  recommendation: string;
}

export interface PriceIncreaseSafetySummary {
  // Analysis period
  periodDays: number;
  analyzedFrom: Date;
  analyzedTo: Date;
  
  // Overall numbers
  totalPriceIncreases: number;
  customersAffected: number;
  
  // Overall outcomes
  overallRetentionRate: number;  // % who stayed after any increase
  overallChurnRate: number;      // % who churned after any increase
  baselineChurnRate: number;     // % who churn normally (no increase)
  
  // Key insight
  priceIncreaseChurnImpact: number;  // How much extra churn from increases (can be negative!)
  
  // Revenue
  revenueGainedFromIncreases: number;
  revenueLostToChurn: number;
  netRevenueImpact: number;
  
  // Overall safety
  overallSafetyScore: number;
  overallRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  
  // Best opportunity
  safestPlanToIncrease: string | null;
  safestPlanIncreasePotential: number;  // $ potential from safe increase
}

export interface AIRecommendation {
  priority: number;
  title: string;
  description: string;
  expectedImpact: number;
  confidence: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  dataSupport: string;
}

export interface PriceIncreaseSafetyReport {
  summary: PriceIncreaseSafetySummary;
  
  // Detailed breakdowns
  planSafety: PlanPriceIncreaseSafety[];
  segmentSensitivity: SegmentPriceSensitivity[];
  priceIncreaseEvents: PriceIncreaseEvent[];
  
  // AI-generated content
  aiNarrative: string | null;
  aiRecommendations: AIRecommendation[];
  
  generatedAt: Date;
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

export async function analyzePriceIncreaseSafety(
  organizationId: string
): Promise<PriceIncreaseSafetyReport> {
  const endDate = new Date();
  const startDate = subDays(endDate, ANALYSIS_CONFIG.LOOKBACK_DAYS);
  
  // Get all subscription events (plan changes, upgrades)
  const subscriptionEvents = await prisma.subscriptionEvent.findMany({
    where: {
      organizationId,
      occurredAt: { gte: startDate },
    },
    include: {
      subscription: {
        include: {
          customer: true,
        },
      },
    },
    orderBy: { occurredAt: 'asc' },
  });

  // Get all subscriptions for baseline data
  const allSubscriptions = await prisma.stripeSubscription.findMany({
    where: {
      organizationId,
    },
    include: {
      customer: true,
    },
  });

  // Get daily metrics for baseline churn rate
  const dailyMetrics = await prisma.dailyMetrics.findMany({
    where: {
      organizationId,
      date: { gte: subDays(endDate, 90) },
    },
    orderBy: { date: 'desc' },
    take: 30,
  });

  // Calculate baseline churn rate (average over last 30 days)
  const baselineChurnRate = dailyMetrics.length > 0
    ? dailyMetrics.reduce((sum, m) => sum + m.grossChurnRate, 0) / dailyMetrics.length
    : 5; // Default 5% if no data

  // Find price increase events (where newMrr > previousMrr due to price change, not quantity)
  const priceIncreaseEvents: PriceIncreaseEvent[] = [];
  
  for (const event of subscriptionEvents) {
    // Skip if not an upgrade or if MRR didn't increase
    if (event.mrrDelta <= 0) continue;
    
    // Calculate if this was a meaningful price increase
    const previousPrice = event.previousMrr;
    const newPrice = event.newMrr;
    const increaseAmount = newPrice - previousPrice;
    const increasePercent = previousPrice > 0 
      ? (increaseAmount / previousPrice) * 100 
      : 0;
    
    // Skip small increases
    if (increasePercent < ANALYSIS_CONFIG.SIGNIFICANT_INCREASE_PERCENT) continue;
    
    // Determine outcome
    const subscription = event.subscription;
    const daysSinceIncrease = differenceInDays(endDate, event.occurredAt);
    
    let outcome: PriceIncreaseEvent['outcome'];
    let daysUntilChurn: number | null = null;
    
    if (subscription.canceledAt) {
      const churnDate = subscription.canceledAt;
      daysUntilChurn = differenceInDays(churnDate, event.occurredAt);
      
      // Only count as "churned due to increase" if within churn window
      if (daysUntilChurn <= ANALYSIS_CONFIG.CHURN_WINDOW_DAYS && daysUntilChurn >= 0) {
        outcome = 'churned';
      } else if (daysUntilChurn > ANALYSIS_CONFIG.CHURN_WINDOW_DAYS) {
        outcome = 'stayed'; // They stayed for a while, then churned later (not due to increase)
      } else {
        outcome = 'stayed'; // Churned before increase (shouldn't happen, but handle it)
      }
    } else if (daysSinceIncrease >= ANALYSIS_CONFIG.CHURN_WINDOW_DAYS) {
      outcome = 'stayed'; // Passed the churn window without churning
    } else {
      outcome = 'pending'; // Still in observation window
    }
    
    // Calculate revenue after increase
    const monthsRetainedAfter = subscription.canceledAt
      ? Math.max(0, differenceInDays(subscription.canceledAt, event.occurredAt) / 30)
      : daysSinceIncrease / 30;
    
    const totalRevenueAfter = Math.round(newPrice * monthsRetainedAfter);
    
    priceIncreaseEvents.push({
      id: event.id,
      subscriptionId: event.subscriptionId,
      customerId: subscription.customerId,
      customerEmail: subscription.customer.email,
      
      previousPrice,
      newPrice,
      increaseAmount,
      increasePercent: Math.round(increasePercent * 10) / 10,
      
      planId: event.newPlanId,
      planName: event.newPlanNickname,
      
      occurredAt: event.occurredAt,
      
      outcome,
      daysUntilChurn,
      
      currentStatus: subscription.status,
      
      totalRevenueAfter,
      monthsRetainedAfter: Math.round(monthsRetainedAfter * 10) / 10,
    });
  }

  // Calculate summary
  const summary = calculateSummary(priceIncreaseEvents, baselineChurnRate, startDate, endDate);
  
  // Aggregate by plan
  const planSafety = aggregateByPlan(priceIncreaseEvents, allSubscriptions, baselineChurnRate);
  
  // Segment analysis
  const segmentSensitivity = analyzeSegments(priceIncreaseEvents, allSubscriptions);
  
  // Generate AI narrative and recommendations
  const { narrative, recommendations } = await generateAINarrative(
    summary,
    planSafety,
    segmentSensitivity,
    priceIncreaseEvents
  );

  return {
    summary,
    planSafety,
    segmentSensitivity,
    priceIncreaseEvents: priceIncreaseEvents.slice(0, 100), // Limit for performance
    aiNarrative: narrative,
    aiRecommendations: recommendations,
    generatedAt: new Date(),
  };
}

// ============================================================================
// SUMMARY CALCULATION
// ============================================================================

function calculateSummary(
  events: PriceIncreaseEvent[],
  baselineChurnRate: number,
  startDate: Date,
  endDate: Date
): PriceIncreaseSafetySummary {
  const periodDays = differenceInDays(endDate, startDate);
  
  // Filter to completed observations only (not pending)
  const completedEvents = events.filter(e => e.outcome !== 'pending');
  const stayedEvents = events.filter(e => e.outcome === 'stayed');
  const churnedEvents = events.filter(e => e.outcome === 'churned');
  
  const totalPriceIncreases = events.length;
  const customersAffected = new Set(events.map(e => e.customerId)).size;
  
  // Calculate retention/churn rates
  const overallRetentionRate = completedEvents.length > 0
    ? (stayedEvents.length / completedEvents.length) * 100
    : 100;
  const overallChurnRate = completedEvents.length > 0
    ? (churnedEvents.length / completedEvents.length) * 100
    : 0;
  
  // Impact: how much extra churn did price increases cause?
  const priceIncreaseChurnImpact = overallChurnRate - baselineChurnRate;
  
  // Revenue calculations
  const revenueGainedFromIncreases = stayedEvents.reduce((sum, e) => {
    return sum + (e.increaseAmount * e.monthsRetainedAfter);
  }, 0);
  
  const revenueLostToChurn = churnedEvents.reduce((sum, e) => {
    // Assume they would have stayed 12 months on average
    const expectedMonths = 12;
    const actualMonths = e.monthsRetainedAfter;
    const lostMonths = expectedMonths - actualMonths;
    return sum + (e.newPrice * lostMonths);
  }, 0);
  
  const netRevenueImpact = revenueGainedFromIncreases - revenueLostToChurn;
  
  // Overall safety score (0-100)
  // Higher retention rate = higher score
  // Lower churn impact = higher score
  let overallSafetyScore = 50; // Start neutral
  
  if (completedEvents.length >= ANALYSIS_CONFIG.MIN_SAMPLE_SIZE) {
    // Retention component (0-50 points)
    overallSafetyScore += (overallRetentionRate / 100) * 40;
    
    // Churn impact component (-25 to +10 points)
    if (priceIncreaseChurnImpact <= 0) {
      // Price increases don't cause extra churn - very good!
      overallSafetyScore += 10;
    } else if (priceIncreaseChurnImpact <= 2) {
      // Minor impact - acceptable
      overallSafetyScore += 5;
    } else if (priceIncreaseChurnImpact <= 5) {
      // Moderate impact
      overallSafetyScore -= 10;
    } else {
      // Significant impact
      overallSafetyScore -= 25;
    }
  }
  
  overallSafetyScore = Math.max(0, Math.min(100, Math.round(overallSafetyScore)));
  
  // Risk level
  let overallRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  if (overallSafetyScore >= 70) {
    overallRiskLevel = 'LOW';
  } else if (overallSafetyScore >= 40) {
    overallRiskLevel = 'MEDIUM';
  } else {
    overallRiskLevel = 'HIGH';
  }
  
  // Find safest plan to increase
  const planGroups = new Map<string, PriceIncreaseEvent[]>();
  for (const event of events) {
    if (!event.planId) continue;
    const existing = planGroups.get(event.planId) || [];
    existing.push(event);
    planGroups.set(event.planId, existing);
  }
  
  let safestPlanToIncrease: string | null = null;
  let safestPlanIncreasePotential = 0;
  let highestRetention = 0;
  
  for (const [planId, planEvents] of planGroups) {
    const completed = planEvents.filter(e => e.outcome !== 'pending');
    const stayed = planEvents.filter(e => e.outcome === 'stayed');
    
    if (completed.length < ANALYSIS_CONFIG.MIN_SAMPLE_SIZE) continue;
    
    const retention = stayed.length / completed.length;
    
    if (retention > highestRetention) {
      highestRetention = retention;
      safestPlanToIncrease = planEvents[0]?.planName || planId;
      // Estimate potential: 10% increase on current subscribers
      safestPlanIncreasePotential = Math.round(
        stayed.reduce((sum, e) => sum + e.newPrice, 0) * 0.1
      );
    }
  }

  return {
    periodDays,
    analyzedFrom: startDate,
    analyzedTo: endDate,
    
    totalPriceIncreases,
    customersAffected,
    
    overallRetentionRate: Math.round(overallRetentionRate * 10) / 10,
    overallChurnRate: Math.round(overallChurnRate * 10) / 10,
    baselineChurnRate: Math.round(baselineChurnRate * 10) / 10,
    
    priceIncreaseChurnImpact: Math.round(priceIncreaseChurnImpact * 10) / 10,
    
    revenueGainedFromIncreases,
    revenueLostToChurn,
    netRevenueImpact,
    
    overallSafetyScore,
    overallRiskLevel,
    
    safestPlanToIncrease,
    safestPlanIncreasePotential,
  };
}

// ============================================================================
// PLAN AGGREGATION
// ============================================================================

function aggregateByPlan(
  events: PriceIncreaseEvent[],
  allSubscriptions: Array<{
    planId: string | null;
    planNickname: string | null;
    planAmount: number;
    status: string;
    canceledAt: Date | null;
  }>,
  baselineChurnRate: number
): PlanPriceIncreaseSafety[] {
  // Group events by plan
  const planGroups = new Map<string, PriceIncreaseEvent[]>();
  
  for (const event of events) {
    if (!event.planId) continue;
    const existing = planGroups.get(event.planId) || [];
    existing.push(event);
    planGroups.set(event.planId, existing);
  }
  
  const results: PlanPriceIncreaseSafety[] = [];
  
  for (const [planId, planEvents] of planGroups) {
    const planSubs = allSubscriptions.filter(s => s.planId === planId);
    const currentPrice = planSubs[0]?.planAmount || 0;
    const planName = planEvents[0]?.planName || planSubs[0]?.planNickname || null;
    
    // Extract unique price increases
    const priceIncreases = Array.from(
      new Map(
        planEvents.map(e => [
          `${e.previousPrice}-${e.newPrice}`,
          {
            date: e.occurredAt,
            fromPrice: e.previousPrice,
            toPrice: e.newPrice,
            increasePercent: e.increasePercent,
          },
        ])
      ).values()
    );
    
    // Outcomes
    const customersAffected = new Set(planEvents.map(e => e.customerId)).size;
    const customersStayed = planEvents.filter(e => e.outcome === 'stayed').length;
    const customersChurned = planEvents.filter(e => e.outcome === 'churned').length;
    const customersPending = planEvents.filter(e => e.outcome === 'pending').length;
    
    const completedEvents = planEvents.filter(e => e.outcome !== 'pending');
    
    // Churn rate after increase
    const churnRateAfterIncrease = completedEvents.length > 0
      ? (customersChurned / completedEvents.length) * 100
      : 0;
    
    const churnDelta = churnRateAfterIncrease - baselineChurnRate;
    
    // Revenue retained
    const revenueRetainedAfterIncrease = planEvents
      .filter(e => e.outcome === 'stayed')
      .reduce((sum, e) => sum + e.totalRevenueAfter, 0);
    
    const averageMonthsRetainedAfter = customersStayed > 0
      ? planEvents
          .filter(e => e.outcome === 'stayed')
          .reduce((sum, e) => sum + e.monthsRetainedAfter, 0) / customersStayed
      : 0;
    
    // Safety score for this plan
    let safetyScore = 50;
    
    if (completedEvents.length >= ANALYSIS_CONFIG.MIN_SAMPLE_SIZE) {
      const retention = customersStayed / completedEvents.length;
      safetyScore += retention * 40;
      
      if (churnDelta <= 0) {
        safetyScore += 10;
      } else if (churnDelta <= 3) {
        safetyScore += 5;
      } else if (churnDelta <= 7) {
        safetyScore -= 15;
      } else {
        safetyScore -= 30;
      }
    } else {
      // Not enough data - lower confidence, moderate score
      safetyScore = 50;
    }
    
    safetyScore = Math.max(0, Math.min(100, Math.round(safetyScore)));
    
    // Risk level
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    if (safetyScore >= 70) {
      riskLevel = 'LOW';
    } else if (safetyScore >= 40) {
      riskLevel = 'MEDIUM';
    } else {
      riskLevel = 'HIGH';
    }
    
    // Safe to increase?
    const safeToIncrease = riskLevel === 'LOW' && completedEvents.length >= ANALYSIS_CONFIG.MIN_SAMPLE_SIZE;
    
    // Calculate max safe increase based on historical data
    const historicalIncreases = priceIncreases.map(p => p.increasePercent);
    const maxHistoricalSafeIncrease = historicalIncreases.length > 0
      ? Math.max(...historicalIncreases.filter((_, i) => {
          // Only count increases where most customers stayed
          return customersStayed >= customersChurned;
        }))
      : 10; // Default 10% if no data
    
    const confidence = completedEvents.length >= ANALYSIS_CONFIG.MIN_SAMPLE_SIZE
      ? Math.min(0.95, 0.5 + (completedEvents.length / 100))
      : 0.3;
    
    results.push({
      planId,
      planName,
      currentPrice,
      
      priceIncreases,
      
      customersAffected,
      customersStayed,
      customersChurned,
      customersPending,
      
      churnRateAfterIncrease: Math.round(churnRateAfterIncrease * 10) / 10,
      baselineChurnRate: Math.round(baselineChurnRate * 10) / 10,
      churnDelta: Math.round(churnDelta * 10) / 10,
      
      revenueRetainedAfterIncrease,
      averageMonthsRetainedAfter: Math.round(averageMonthsRetainedAfter * 10) / 10,
      
      safetyScore,
      riskLevel,
      
      safeToIncrease,
      maxSafeIncrease: Math.round(maxHistoricalSafeIncrease * 10) / 10 || 10,
      confidence: Math.round(confidence * 100) / 100,
    });
  }
  
  // Sort by safety score (highest first)
  return results.sort((a, b) => b.safetyScore - a.safetyScore);
}

// ============================================================================
// SEGMENT ANALYSIS
// ============================================================================

function analyzeSegments(
  events: PriceIncreaseEvent[],
  allSubscriptions: Array<{
    planId: string | null;
    planAmount: number;
    status: string;
  }>
): SegmentPriceSensitivity[] {
  const segments: SegmentPriceSensitivity[] = [];
  
  // Segment by price tier
  const priceTiers = [
    { name: 'Entry Tier', min: 0, max: 2900, description: 'Customers on plans under $29/mo' },
    { name: 'Mid Tier', min: 2900, max: 9900, description: 'Customers on plans $29-99/mo' },
    { name: 'Premium Tier', min: 9900, max: 29900, description: 'Customers on plans $99-299/mo' },
    { name: 'Enterprise Tier', min: 29900, max: Infinity, description: 'Customers on plans $299+/mo' },
  ];
  
  for (const tier of priceTiers) {
    const tierEvents = events.filter(
      e => e.newPrice >= tier.min && e.newPrice < tier.max
    );
    
    const tierSubs = allSubscriptions.filter(
      s => s.planAmount >= tier.min && s.planAmount < tier.max
    );
    
    if (tierSubs.length === 0) continue;
    
    const completedEvents = tierEvents.filter(e => e.outcome !== 'pending');
    const stayedEvents = tierEvents.filter(e => e.outcome === 'stayed');
    const churnedEvents = tierEvents.filter(e => e.outcome === 'churned');
    
    const experiencedIncrease = tierEvents.length;
    const retentionRate = completedEvents.length > 0
      ? (stayedEvents.length / completedEvents.length) * 100
      : 100;
    
    // Determine sensitivity
    let sensitivity: 'LOW' | 'MEDIUM' | 'HIGH';
    let recommendation: string;
    
    if (retentionRate >= 90) {
      sensitivity = 'LOW';
      recommendation = `Safe to increase prices. ${retentionRate.toFixed(0)}% of customers stayed after increases.`;
    } else if (retentionRate >= 70) {
      sensitivity = 'MEDIUM';
      recommendation = `Moderate risk. Consider smaller, gradual increases for this segment.`;
    } else {
      sensitivity = 'HIGH';
      recommendation = `High churn risk. Avoid price increases or offer grandfathering.`;
    }
    
    segments.push({
      segment: tier.name,
      description: tier.description,
      size: tierSubs.length,
      
      experiencedIncrease,
      stayedAfterIncrease: stayedEvents.length,
      churnedAfterIncrease: churnedEvents.length,
      retentionRate: Math.round(retentionRate * 10) / 10,
      
      sensitivity,
      recommendation,
    });
  }
  
  // Segment by tenure (how long they've been a customer)
  // This would require additional data about customer start date
  
  return segments;
}

// ============================================================================
// AI NARRATIVE GENERATION
// ============================================================================

async function generateAINarrative(
  summary: PriceIncreaseSafetySummary,
  planSafety: PlanPriceIncreaseSafety[],
  segments: SegmentPriceSensitivity[],
  events: PriceIncreaseEvent[]
): Promise<{ narrative: string | null; recommendations: AIRecommendation[] }> {
  const openai = getOpenAIClient();
  
  // Build fallback narrative
  let narrative = '';
  
  if (summary.totalPriceIncreases === 0) {
    narrative = `No significant price increases detected in the last ${summary.periodDays} days.\n`;
    narrative += `Without historical data, we can't assess price increase safety.\n`;
    narrative += `Consider running a small test increase on your safest segment.`;
  } else {
    const retainedPercent = summary.overallRetentionRate;
    const churnImpact = summary.priceIncreaseChurnImpact;
    
    if (churnImpact <= 0) {
      narrative = `Great news: price increases haven't caused meaningful churn.\n`;
      narrative += `${retainedPercent.toFixed(0)}% of customers stayed after increases—matching or beating baseline retention.\n`;
    } else if (churnImpact <= 3) {
      narrative = `Price increases have a minor impact on churn.\n`;
      narrative += `${retainedPercent.toFixed(0)}% of customers stayed after increases, with only ${churnImpact.toFixed(1)}% extra churn.\n`;
    } else {
      narrative = `Caution: price increases are driving some churn.\n`;
      narrative += `Only ${retainedPercent.toFixed(0)}% stayed after increases, with ${churnImpact.toFixed(1)}% extra churn vs baseline.\n`;
    }
    
    // Add safest plan
    const safestPlan = planSafety.find(p => p.riskLevel === 'LOW');
    if (safestPlan) {
      narrative += `${safestPlan.planName || 'Your top plan'} is the safest for another increase.`;
    }
  }
  
  // Build recommendations
  const recommendations: AIRecommendation[] = [];
  
  // Recommendation 1: Safest plan to increase
  const safestPlan = planSafety.find(p => p.riskLevel === 'LOW' && p.customersAffected >= ANALYSIS_CONFIG.MIN_SAMPLE_SIZE);
  if (safestPlan) {
    const potentialRevenue = Math.round(safestPlan.currentPrice * 0.1 * safestPlan.customersStayed);
    
    recommendations.push({
      priority: 100,
      title: `Raise ${safestPlan.planName || 'plan'} prices by up to ${safestPlan.maxSafeIncrease}%`,
      description: `${safestPlan.customersStayed} of ${safestPlan.customersAffected} customers (${((safestPlan.customersStayed / Math.max(safestPlan.customersAffected - safestPlan.customersPending, 1)) * 100).toFixed(0)}%) stayed after past increases.`,
      expectedImpact: potentialRevenue,
      confidence: safestPlan.confidence,
      riskLevel: 'LOW',
      dataSupport: `Based on ${safestPlan.customersAffected} customers who experienced increases`,
    });
  }
  
  // Recommendation 2: Low-sensitivity segment
  const lowSensitivitySegment = segments.find(s => s.sensitivity === 'LOW' && s.experiencedIncrease > 0);
  if (lowSensitivitySegment) {
    recommendations.push({
      priority: 90,
      title: `Target ${lowSensitivitySegment.segment} for price optimization`,
      description: lowSensitivitySegment.recommendation,
      expectedImpact: Math.round(lowSensitivitySegment.size * 500), // Rough estimate
      confidence: 0.7,
      riskLevel: 'LOW',
      dataSupport: `${lowSensitivitySegment.retentionRate.toFixed(0)}% retention after increases`,
    });
  }
  
  // Recommendation 3: Avoid high-risk plans
  const riskyPlan = planSafety.find(p => p.riskLevel === 'HIGH' && p.customersAffected >= ANALYSIS_CONFIG.MIN_SAMPLE_SIZE);
  if (riskyPlan) {
    recommendations.push({
      priority: 80,
      title: `Avoid increasing ${riskyPlan.planName || 'plan'} prices`,
      description: `High churn risk: ${riskyPlan.churnRateAfterIncrease.toFixed(0)}% churned after past increases vs ${riskyPlan.baselineChurnRate.toFixed(0)}% baseline.`,
      expectedImpact: -riskyPlan.revenueRetainedAfterIncrease * 0.2, // Potential loss
      confidence: riskyPlan.confidence,
      riskLevel: 'HIGH',
      dataSupport: `${riskyPlan.customersChurned} of ${riskyPlan.customersAffected} customers left after increases`,
    });
  }
  
  // Try AI-enhanced narrative if available
  if (openai && summary.totalPriceIncreases > 0) {
    try {
      const prompt = `Write exactly 3 sentences about price increase safety for this SaaS. Each sentence on its own line. No paragraphs, no bullet points, no headers.

DATA:
- ${summary.totalPriceIncreases} price increases analyzed
- ${summary.overallRetentionRate.toFixed(0)}% of customers stayed after increases
- ${summary.overallChurnRate.toFixed(0)}% churned after increases (baseline: ${summary.baselineChurnRate.toFixed(0)}%)
- Churn impact: ${summary.priceIncreaseChurnImpact > 0 ? '+' : ''}${summary.priceIncreaseChurnImpact.toFixed(1)}% vs baseline
- Net revenue impact: $${Math.round(summary.netRevenueImpact / 100).toLocaleString()}
${safestPlan ? `- Safest plan: ${safestPlan.planName} (${safestPlan.safetyScore} safety score)` : ''}

Line 1: The verdict (is it safe to raise prices?)
Line 2: The evidence (what happened after past increases)
Line 3: The recommendation (which plan to increase, by how much)

Example format:
Your customers tolerate price increases well—churn barely moved.
After past increases, 94% of customers stayed on board, generating $47K in extra revenue.
Consider raising Pro plan prices 10-15%—historically the safest segment.`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 200,
      });
      
      const aiNarrative = response.choices[0]?.message?.content;
      if (aiNarrative) {
        narrative = aiNarrative;
      }
    } catch (error) {
      console.error('AI narrative generation failed, using fallback:', error);
    }
  }
  
  return {
    narrative,
    recommendations: recommendations.slice(0, 5),
  };
}

// ============================================================================
// QUICK STATS FOR DASHBOARD
// ============================================================================

export async function getPriceIncreaseSafetyQuickStats(organizationId: string): Promise<{
  safetyScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  retentionAfterIncrease: number;
  safestPlan: string | null;
  dataPoints: number;
}> {
  const report = await analyzePriceIncreaseSafety(organizationId);

  return {
    safetyScore: report.summary.overallSafetyScore,
    riskLevel: report.summary.overallRiskLevel,
    retentionAfterIncrease: report.summary.overallRetentionRate,
    safestPlan: report.summary.safestPlanToIncrease,
    dataPoints: report.summary.totalPriceIncreases,
  };
}

