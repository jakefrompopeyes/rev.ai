import { prisma } from '@/lib/db';
import { OpenAI } from 'openai';
import { subMonths, differenceInMonths, differenceInDays } from 'date-fns';

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

const LEGACY_CONFIG = {
  // Minimum tenure to be considered "legacy" (months)
  MIN_LEGACY_TENURE_MONTHS: 12,
  
  // Minimum pricing gap to flag (percentage)
  MIN_PRICING_GAP_PERCENT: 10,
  
  // Tenure thresholds for segmentation
  DEEP_LEGACY_MONTHS: 24,      // 2+ years
  MODERATE_LEGACY_MONTHS: 18,  // 18+ months
  
  // Churn window for comparison (days)
  CHURN_COMPARISON_WINDOW_DAYS: 365,
  
  // Minimum customers for statistical relevance
  MIN_SAMPLE_SIZE: 3,
};

export interface LegacyCustomer {
  customerId: string;
  subscriptionId: string;
  email: string | null;
  
  // Plan info
  planId: string | null;
  planName: string | null;
  
  // Pricing gap
  currentPayingPrice: number;      // What they pay (cents/month)
  currentMarketPrice: number;      // What new customers pay (cents/month)
  pricingGap: number;              // Gap in cents
  pricingGapPercent: number;       // % they're underpaying
  annualGap: number;               // Yearly revenue left on table
  
  // Tenure signals
  customerSince: Date;
  tenureMonths: number;
  
  // Value signals
  totalLifetimeRevenue: number;
  invoiceCount: number;
  averageInvoiceValue: number;
  
  // Health signals
  status: string;
  paymentFailureCount: number;
  hasDiscount: boolean;
  
  // Classification
  legacyTier: 'deep_legacy' | 'moderate_legacy' | 'recent_legacy';
  migrationRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  
  // Recommendation
  recommendedAction: 'migrate_now' | 'gradual_increase' | 'offer_upgrade' | 'hold';
}

export interface PlanLegacyInfo {
  planId: string;
  planName: string | null;
  
  // Pricing info
  currentMarketPrice: number;  // What new customers pay
  lowestLegacyPrice: number;   // Lowest price among legacy customers
  averageLegacyPrice: number;  // Average legacy customer pays
  pricingSpread: number;       // % difference between lowest legacy and current
  
  // Customer counts
  totalCustomers: number;
  legacyCustomers: number;
  legacyPercent: number;
  
  // Revenue opportunity
  annualGapTotal: number;
  averageGapPerCustomer: number;
}

export interface ChurnComparison {
  // Legacy customer churn (tenure > threshold)
  legacyCustomerCount: number;
  legacyChurnedCount: number;
  legacyChurnRate: number;
  
  // New customer churn (tenure < threshold)
  newCustomerCount: number;
  newChurnedCount: number;
  newCustomerChurnRate: number;
  
  // The key insight
  churnAdvantage: number;        // How much LOWER legacy churn is (negative = legacy churns less)
  legacyMoreStable: boolean;     // True if legacy customers churn less
  
  // Statistical confidence
  sampleSizeAdequate: boolean;
  confidenceLevel: number;       // 0-1
}

export interface LegacyPlanSummary {
  // Analysis period
  analyzedAt: Date;
  
  // Headline metrics
  customersOnLegacyPricing: number;
  totalActiveCustomers: number;
  legacyPercent: number;
  
  // Revenue opportunity
  totalAnnualRevenueGap: number;       // $ left on table per year
  averagePricingGapPercent: number;    // Avg % below market
  projectedRecoveryWithMigration: number;  // Conservative estimate
  
  // The killer insight (churn comparison)
  churnComparison: ChurnComparison;
  
  // Segmentation
  deepLegacyCount: number;       // 2+ years
  moderateLegacyCount: number;   // 18-24 months
  recentLegacyCount: number;     // 12-18 months
  
  // Risk assessment
  safeToMigrateCount: number;
  needsCarefulHandlingCount: number;
  
  // Recommendation
  recommendedMigrationPath: 'gradual' | 'immediate' | 'offer_upgrade' | 'hold';
  migrationConfidence: number;
}

export interface AIRecommendation {
  priority: number;
  title: string;
  description: string;
  expectedImpact: number;        // Annual revenue
  customers: number;             // Customers affected
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  dataSupport: string;
}

export interface LegacyPlanReport {
  summary: LegacyPlanSummary;
  
  // Detailed breakdowns
  legacyCustomers: LegacyCustomer[];
  planBreakdown: PlanLegacyInfo[];
  
  // AI-generated content
  aiNarrative: string | null;
  aiRecommendations: AIRecommendation[];
  
  generatedAt: Date;
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

export async function analyzeLegacyPlans(
  organizationId: string
): Promise<LegacyPlanReport> {
  const now = new Date();
  const legacyThreshold = subMonths(now, LEGACY_CONFIG.MIN_LEGACY_TENURE_MONTHS);
  
  // Get all active subscriptions with customer data
  const subscriptions = await prisma.stripeSubscription.findMany({
    where: {
      organizationId,
      status: { in: ['active', 'trialing', 'past_due'] },
    },
    include: {
      customer: true,
    },
    orderBy: { startDate: 'asc' },
  });

  // Get all invoices for LTV calculation
  const invoices = await prisma.stripeInvoice.findMany({
    where: {
      organizationId,
      status: 'paid',
    },
    select: {
      customerId: true,
      total: true,
      stripeCreatedAt: true,
    },
  });

  // Get failed payments for health scoring
  const failedPayments = await prisma.stripePayment.findMany({
    where: {
      organizationId,
      status: 'failed',
    },
    select: {
      customerId: true,
    },
  });

  // Get canceled subscriptions for churn analysis
  const canceledSubscriptions = await prisma.stripeSubscription.findMany({
    where: {
      organizationId,
      canceledAt: { not: null },
    },
    select: {
      customerId: true,
      startDate: true,
      canceledAt: true,
    },
  });

  // Build lookup maps
  const customerInvoices = new Map<string, typeof invoices>();
  for (const invoice of invoices) {
    const existing = customerInvoices.get(invoice.customerId) || [];
    existing.push(invoice);
    customerInvoices.set(invoice.customerId, existing);
  }

  const customerFailedPayments = new Map<string, number>();
  for (const payment of failedPayments) {
    if (payment.customerId) {
      const count = customerFailedPayments.get(payment.customerId) || 0;
      customerFailedPayments.set(payment.customerId, count + 1);
    }
  }

  // Determine current market prices per plan
  // Strategy: Prefer the most recent price per plan to avoid overstating "current"
  // prices when there have been price decreases. Fall back to max price if needed.
  const recentThreshold = subMonths(now, 6);
  const mostRecentPrice = new Map<string, { price: number; startDate: Date }>();
  const maxPriceByPlan = new Map<string, number>();
  
  for (const sub of subscriptions) {
    if (!sub.planId) continue;
    
    const maxExisting = maxPriceByPlan.get(sub.planId) || 0;
    if (sub.planAmount > maxExisting) {
      maxPriceByPlan.set(sub.planId, sub.planAmount);
    }
    
    if (sub.startDate >= recentThreshold) {
      const existing = mostRecentPrice.get(sub.planId);
      if (!existing || sub.startDate > existing.startDate) {
        mostRecentPrice.set(sub.planId, { price: sub.planAmount, startDate: sub.startDate });
      }
    }
  }
  
  const currentPrices = new Map<string, number>();
  for (const [planId, info] of mostRecentPrice.entries()) {
    currentPrices.set(planId, info.price);
  }
  
  // If no recent subs, use the max price for each plan
  for (const [planId, maxPrice] of maxPriceByPlan.entries()) {
    if (!currentPrices.has(planId)) {
      currentPrices.set(planId, maxPrice);
    }
  }

  // Identify legacy customers
  const legacyCustomers: LegacyCustomer[] = [];
  
  for (const sub of subscriptions) {
    if (!sub.planId) continue;
    
    const tenureMonths = differenceInMonths(now, sub.startDate);
    const currentMarketPrice = currentPrices.get(sub.planId) || sub.planAmount;
    const pricingGap = currentMarketPrice - sub.planAmount;
    const pricingGapPercent = currentMarketPrice > 0 
      ? (pricingGap / currentMarketPrice) * 100 
      : 0;
    
    // Must meet tenure AND pricing gap thresholds
    if (tenureMonths < LEGACY_CONFIG.MIN_LEGACY_TENURE_MONTHS) continue;
    if (pricingGapPercent < LEGACY_CONFIG.MIN_PRICING_GAP_PERCENT) continue;
    
    // Calculate LTV
    const custInvoices = customerInvoices.get(sub.customerId) || [];
    const totalLifetimeRevenue = custInvoices.reduce((sum, inv) => sum + inv.total, 0);
    const invoiceCount = custInvoices.length;
    const averageInvoiceValue = invoiceCount > 0 ? totalLifetimeRevenue / invoiceCount : 0;
    
    // Get payment failures
    const paymentFailureCount = customerFailedPayments.get(sub.customerId) || 0;
    
    // Classify legacy tier
    let legacyTier: LegacyCustomer['legacyTier'];
    if (tenureMonths >= LEGACY_CONFIG.DEEP_LEGACY_MONTHS) {
      legacyTier = 'deep_legacy';
    } else if (tenureMonths >= LEGACY_CONFIG.MODERATE_LEGACY_MONTHS) {
      legacyTier = 'moderate_legacy';
    } else {
      legacyTier = 'recent_legacy';
    }
    
    // Assess migration risk
    // Low risk: long tenure, no payment issues, high LTV
    // High risk: shorter tenure, payment issues, or high discount dependency
    let migrationRisk: LegacyCustomer['migrationRisk'];
    const hasDiscount = sub.discountId !== null;
    
    if (tenureMonths >= 24 && paymentFailureCount === 0 && !hasDiscount) {
      migrationRisk = 'LOW';
    } else if (paymentFailureCount > 2 || hasDiscount) {
      migrationRisk = 'HIGH';
    } else {
      migrationRisk = 'MEDIUM';
    }
    
    // Determine recommended action
    let recommendedAction: LegacyCustomer['recommendedAction'];
    if (migrationRisk === 'LOW' && pricingGapPercent >= 20) {
      recommendedAction = 'migrate_now';
    } else if (migrationRisk === 'LOW') {
      recommendedAction = 'gradual_increase';
    } else if (migrationRisk === 'MEDIUM') {
      recommendedAction = 'offer_upgrade';
    } else {
      recommendedAction = 'hold';
    }
    
    legacyCustomers.push({
      customerId: sub.customerId,
      subscriptionId: sub.id,
      email: sub.customer.email,
      
      planId: sub.planId,
      planName: sub.planNickname,
      
      currentPayingPrice: sub.planAmount,
      currentMarketPrice,
      pricingGap,
      pricingGapPercent: Math.round(pricingGapPercent * 10) / 10,
      annualGap: pricingGap * 12,
      
      customerSince: sub.startDate,
      tenureMonths,
      
      totalLifetimeRevenue,
      invoiceCount,
      averageInvoiceValue: Math.round(averageInvoiceValue),
      
      status: sub.status,
      paymentFailureCount,
      hasDiscount,
      
      legacyTier,
      migrationRisk,
      recommendedAction,
    });
  }

  // Sort by annual gap (biggest opportunity first)
  legacyCustomers.sort((a, b) => b.annualGap - a.annualGap);

  // Calculate churn comparison
  const churnComparison = calculateChurnComparison(
    subscriptions,
    canceledSubscriptions,
    now
  );

  // Aggregate by plan
  const planBreakdown = aggregateByPlan(legacyCustomers, currentPrices, subscriptions);

  // Calculate summary
  const summary = calculateSummary(
    legacyCustomers,
    subscriptions.length,
    churnComparison,
    now
  );

  // Generate AI narrative
  const { narrative, recommendations } = await generateAINarrative(
    summary,
    legacyCustomers,
    planBreakdown,
    churnComparison
  );

  return {
    summary,
    legacyCustomers: legacyCustomers.slice(0, 100), // Limit for performance
    planBreakdown,
    aiNarrative: narrative,
    aiRecommendations: recommendations,
    generatedAt: now,
  };
}

// ============================================================================
// CHURN COMPARISON
// ============================================================================

function calculateChurnComparison(
  activeSubscriptions: Array<{ customerId: string; startDate: Date }>,
  canceledSubscriptions: Array<{ customerId: string; startDate: Date; canceledAt: Date | null }>,
  now: Date
): ChurnComparison {
  const legacyThreshold = subMonths(now, LEGACY_CONFIG.MIN_LEGACY_TENURE_MONTHS);
  const churnWindow = subMonths(now, 12); // Look at churn in last 12 months
  
  // Get unique customers
  const allCustomers = new Set<string>();
  const legacyCustomers = new Set<string>();
  const newCustomers = new Set<string>();
  
  for (const sub of activeSubscriptions) {
    allCustomers.add(sub.customerId);
    if (sub.startDate <= legacyThreshold) {
      legacyCustomers.add(sub.customerId);
    } else {
      newCustomers.add(sub.customerId);
    }
  }
  
  // Also add churned customers to their respective groups
  for (const sub of canceledSubscriptions) {
    if (!sub.canceledAt || sub.canceledAt < churnWindow) continue;
    
    allCustomers.add(sub.customerId);
    if (sub.startDate <= legacyThreshold) {
      legacyCustomers.add(sub.customerId);
    } else {
      newCustomers.add(sub.customerId);
    }
  }
  
  // Count churned in each group (churned within last 12 months)
  let legacyChurned = 0;
  let newChurned = 0;
  
  for (const sub of canceledSubscriptions) {
    if (!sub.canceledAt || sub.canceledAt < churnWindow) continue;
    
    if (sub.startDate <= legacyThreshold) {
      legacyChurned++;
    } else {
      newChurned++;
    }
  }
  
  const legacyCustomerCount = legacyCustomers.size;
  const newCustomerCount = newCustomers.size;
  
  // Calculate rates
  const legacyChurnRate = legacyCustomerCount > 0 
    ? (legacyChurned / legacyCustomerCount) * 100 
    : 0;
  const newCustomerChurnRate = newCustomerCount > 0 
    ? (newChurned / newCustomerCount) * 100 
    : 0;
  
  // Churn advantage: positive means legacy churns MORE, negative means legacy churns LESS
  const churnAdvantage = legacyChurnRate - newCustomerChurnRate;
  const legacyMoreStable = churnAdvantage < 0;
  
  // Statistical confidence
  const sampleSizeAdequate = legacyCustomerCount >= LEGACY_CONFIG.MIN_SAMPLE_SIZE 
    && newCustomerCount >= LEGACY_CONFIG.MIN_SAMPLE_SIZE;
  
  // Simple confidence based on sample size
  const minSample = Math.min(legacyCustomerCount, newCustomerCount);
  const confidenceLevel = Math.min(0.95, 0.5 + (minSample / 50));
  
  return {
    legacyCustomerCount,
    legacyChurnedCount: legacyChurned,
    legacyChurnRate: Math.round(legacyChurnRate * 10) / 10,
    
    newCustomerCount,
    newChurnedCount: newChurned,
    newCustomerChurnRate: Math.round(newCustomerChurnRate * 10) / 10,
    
    churnAdvantage: Math.round(churnAdvantage * 10) / 10,
    legacyMoreStable,
    
    sampleSizeAdequate,
    confidenceLevel: Math.round(confidenceLevel * 100) / 100,
  };
}

// ============================================================================
// PLAN AGGREGATION
// ============================================================================

function aggregateByPlan(
  legacyCustomers: LegacyCustomer[],
  currentPrices: Map<string, number>,
  allSubscriptions: Array<{ planId: string | null; planNickname: string | null }>
): PlanLegacyInfo[] {
  // Group legacy customers by plan
  const planGroups = new Map<string, LegacyCustomer[]>();
  
  for (const customer of legacyCustomers) {
    if (!customer.planId) continue;
    const existing = planGroups.get(customer.planId) || [];
    existing.push(customer);
    planGroups.set(customer.planId, existing);
  }
  
  // Count total customers per plan
  const planTotalCustomers = new Map<string, number>();
  for (const sub of allSubscriptions) {
    if (!sub.planId) continue;
    const count = planTotalCustomers.get(sub.planId) || 0;
    planTotalCustomers.set(sub.planId, count + 1);
  }
  
  const results: PlanLegacyInfo[] = [];
  
  for (const [planId, customers] of planGroups) {
    const currentMarketPrice = currentPrices.get(planId) || 0;
    const legacyPrices = customers.map(c => c.currentPayingPrice);
    const lowestLegacyPrice = Math.min(...legacyPrices);
    const averageLegacyPrice = legacyPrices.reduce((a, b) => a + b, 0) / legacyPrices.length;
    
    const pricingSpread = currentMarketPrice > 0
      ? ((currentMarketPrice - lowestLegacyPrice) / currentMarketPrice) * 100
      : 0;
    
    const totalCustomers = planTotalCustomers.get(planId) || customers.length;
    const legacyCustomerCount = customers.length;
    const legacyPercent = (legacyCustomerCount / totalCustomers) * 100;
    
    const annualGapTotal = customers.reduce((sum, c) => sum + c.annualGap, 0);
    const averageGapPerCustomer = annualGapTotal / legacyCustomerCount;
    
    results.push({
      planId,
      planName: customers[0]?.planName || null,
      
      currentMarketPrice,
      lowestLegacyPrice,
      averageLegacyPrice: Math.round(averageLegacyPrice),
      pricingSpread: Math.round(pricingSpread * 10) / 10,
      
      totalCustomers,
      legacyCustomers: legacyCustomerCount,
      legacyPercent: Math.round(legacyPercent * 10) / 10,
      
      annualGapTotal,
      averageGapPerCustomer: Math.round(averageGapPerCustomer),
    });
  }
  
  // Sort by annual gap (biggest opportunity first)
  return results.sort((a, b) => b.annualGapTotal - a.annualGapTotal);
}

// ============================================================================
// SUMMARY CALCULATION
// ============================================================================

function calculateSummary(
  legacyCustomers: LegacyCustomer[],
  totalActiveCustomers: number,
  churnComparison: ChurnComparison,
  now: Date
): LegacyPlanSummary {
  const customersOnLegacyPricing = legacyCustomers.length;
  const legacyPercent = totalActiveCustomers > 0
    ? (customersOnLegacyPricing / totalActiveCustomers) * 100
    : 0;
  
  // Revenue opportunity
  const totalAnnualRevenueGap = legacyCustomers.reduce((sum, c) => sum + c.annualGap, 0);
  const gapPercents = legacyCustomers.map(c => c.pricingGapPercent);
  const averagePricingGapPercent = gapPercents.length > 0
    ? gapPercents.reduce((a, b) => a + b, 0) / gapPercents.length
    : 0;
  
  // Conservative recovery estimate: 70% of gap from low-risk customers
  const lowRiskGap = legacyCustomers
    .filter(c => c.migrationRisk === 'LOW')
    .reduce((sum, c) => sum + c.annualGap, 0);
  const projectedRecoveryWithMigration = Math.round(lowRiskGap * 0.7);
  
  // Segmentation counts
  const deepLegacyCount = legacyCustomers.filter(c => c.legacyTier === 'deep_legacy').length;
  const moderateLegacyCount = legacyCustomers.filter(c => c.legacyTier === 'moderate_legacy').length;
  const recentLegacyCount = legacyCustomers.filter(c => c.legacyTier === 'recent_legacy').length;
  
  // Risk segmentation
  const safeToMigrateCount = legacyCustomers.filter(c => c.migrationRisk === 'LOW').length;
  const needsCarefulHandlingCount = legacyCustomers.filter(c => c.migrationRisk !== 'LOW').length;
  
  // Determine overall recommendation
  let recommendedMigrationPath: LegacyPlanSummary['recommendedMigrationPath'];
  let migrationConfidence: number;
  
  if (churnComparison.legacyMoreStable && safeToMigrateCount > 0) {
    // Legacy customers are more stable than new ones - safe to migrate
    if (averagePricingGapPercent >= 25) {
      recommendedMigrationPath = 'immediate';
      migrationConfidence = 0.85;
    } else {
      recommendedMigrationPath = 'gradual';
      migrationConfidence = 0.8;
    }
  } else if (safeToMigrateCount > needsCarefulHandlingCount) {
    recommendedMigrationPath = 'offer_upgrade';
    migrationConfidence = 0.65;
  } else {
    recommendedMigrationPath = 'hold';
    migrationConfidence = 0.5;
  }
  
  // Adjust confidence based on sample size
  if (!churnComparison.sampleSizeAdequate) {
    migrationConfidence *= 0.7;
  }
  
  return {
    analyzedAt: now,
    
    customersOnLegacyPricing,
    totalActiveCustomers,
    legacyPercent: Math.round(legacyPercent * 10) / 10,
    
    totalAnnualRevenueGap,
    averagePricingGapPercent: Math.round(averagePricingGapPercent * 10) / 10,
    projectedRecoveryWithMigration,
    
    churnComparison,
    
    deepLegacyCount,
    moderateLegacyCount,
    recentLegacyCount,
    
    safeToMigrateCount,
    needsCarefulHandlingCount,
    
    recommendedMigrationPath,
    migrationConfidence: Math.round(migrationConfidence * 100) / 100,
  };
}

// ============================================================================
// AI NARRATIVE GENERATION
// ============================================================================

async function generateAINarrative(
  summary: LegacyPlanSummary,
  legacyCustomers: LegacyCustomer[],
  planBreakdown: PlanLegacyInfo[],
  churnComparison: ChurnComparison
): Promise<{ narrative: string | null; recommendations: AIRecommendation[] }> {
  const openai = getOpenAIClient();
  
  // Format numbers for narrative
  const gapAmount = Math.round(summary.totalAnnualRevenueGap / 100);
  const recoveryAmount = Math.round(summary.projectedRecoveryWithMigration / 100);
  const churnDiff = Math.abs(churnComparison.churnAdvantage);
  
  // Build fallback narrative
  let narrative = '';
  
  if (summary.customersOnLegacyPricing === 0) {
    narrative = `No customers on legacy pricing detected.\n`;
    narrative += `All active customers are paying current market rates.\n`;
    narrative += `Continue monitoring as you adjust pricing over time.`;
  } else {
    narrative = `${summary.customersOnLegacyPricing} customers are on legacy pricing, paying ${summary.averagePricingGapPercent.toFixed(0)}% below current rates.\n`;
    
    if (churnComparison.legacyMoreStable) {
      narrative += `These legacy customers show ${churnDiff.toFixed(1)}% lower churn than newer customers—strong signal they can handle a price increase.\n`;
    } else {
      narrative += `Legacy customers have similar churn to newer customers—proceed carefully with any migration.\n`;
    }
    
    if (recoveryAmount > 0) {
      narrative += `Migrating low-risk customers could recover ~$${recoveryAmount.toLocaleString()}/year.`;
    }
  }
  
  // Build recommendations
  const recommendations: AIRecommendation[] = [];
  
  // Recommendation 1: Safe migrations
  const safeCustomers = legacyCustomers.filter(c => c.migrationRisk === 'LOW');
  if (safeCustomers.length > 0) {
    const safeGap = safeCustomers.reduce((sum, c) => sum + c.annualGap, 0);
    
    recommendations.push({
      priority: 100,
      title: `Migrate ${safeCustomers.length} low-risk legacy customers`,
      description: churnComparison.legacyMoreStable
        ? `These customers have been with you 12+ months with no payment issues. Their cohort churns ${churnDiff.toFixed(1)}% less than newer customers.`
        : `Long-tenured customers with clean payment history. Gradual migration recommended.`,
      expectedImpact: Math.round(safeGap * 0.8),
      customers: safeCustomers.length,
      riskLevel: 'LOW',
      dataSupport: `${safeCustomers.length} customers paying avg ${safeCustomers.reduce((s, c) => s + c.pricingGapPercent, 0) / safeCustomers.length | 0}% below market`,
    });
  }
  
  // Recommendation 2: Top plan opportunity
  if (planBreakdown.length > 0) {
    const topPlan = planBreakdown[0];
    recommendations.push({
      priority: 90,
      title: `Focus on ${topPlan.planName || topPlan.planId} plan first`,
      description: `${topPlan.legacyCustomers} legacy customers on this plan, with ${topPlan.pricingSpread.toFixed(0)}% pricing spread.`,
      expectedImpact: Math.round(topPlan.annualGapTotal * 0.7),
      customers: topPlan.legacyCustomers,
      riskLevel: 'LOW',
      dataSupport: `$${Math.round(topPlan.annualGapTotal / 100).toLocaleString()}/year opportunity`,
    });
  }
  
  // Recommendation 3: Deep legacy customers
  const deepLegacy = legacyCustomers.filter(c => c.legacyTier === 'deep_legacy');
  if (deepLegacy.length > 0) {
    const avgTenure = deepLegacy.reduce((s, c) => s + c.tenureMonths, 0) / deepLegacy.length;
    const deepGap = deepLegacy.reduce((s, c) => s + c.annualGap, 0);
    
    recommendations.push({
      priority: 85,
      title: `Offer upgrade path to ${deepLegacy.length} long-tenured customers`,
      description: `These customers have been with you ~${Math.round(avgTenure / 12)} years. Consider a loyalty discount on current pricing rather than full market rate.`,
      expectedImpact: Math.round(deepGap * 0.5), // Lower estimate since offering partial discount
      customers: deepLegacy.length,
      riskLevel: 'LOW',
      dataSupport: `Avg tenure: ${Math.round(avgTenure)} months`,
    });
  }
  
  // Recommendation 4: High-risk warning
  const highRiskCustomers = legacyCustomers.filter(c => c.migrationRisk === 'HIGH');
  if (highRiskCustomers.length > 0) {
    recommendations.push({
      priority: 70,
      title: `Hold on ${highRiskCustomers.length} high-risk customers`,
      description: `These customers have payment issues or active discounts. Migration could trigger churn.`,
      expectedImpact: 0,
      customers: highRiskCustomers.length,
      riskLevel: 'HIGH',
      dataSupport: `${highRiskCustomers.filter(c => c.hasDiscount).length} with active discounts, ${highRiskCustomers.filter(c => c.paymentFailureCount > 0).length} with payment failures`,
    });
  }
  
  // Try AI-enhanced narrative if available
  if (openai && summary.customersOnLegacyPricing > 0) {
    try {
      const prompt = `Write exactly 3 sentences about legacy plan pricing. Each sentence on its own line. No paragraphs, no bullet points, no headers.

DATA:
- ${summary.customersOnLegacyPricing} customers on legacy pricing (${summary.legacyPercent.toFixed(0)}% of base)
- Paying avg ${summary.averagePricingGapPercent.toFixed(0)}% below current rates
- Annual gap: $${gapAmount.toLocaleString()}
- Legacy customer churn: ${churnComparison.legacyChurnRate.toFixed(1)}%
- New customer churn: ${churnComparison.newCustomerChurnRate.toFixed(1)}%
- Legacy churn is ${churnComparison.legacyMoreStable ? 'LOWER' : 'HIGHER'} by ${churnDiff.toFixed(1)}%
- ${summary.safeToMigrateCount} safe to migrate

Line 1: The finding (how many customers, how much below market)
Line 2: The key insight (compare legacy vs new customer churn—this is the "aha!")
Line 3: The recommendation (what to do, how much to recover)

Example format:
37 customers are on legacy pricing, paying 23% below current rates.
These legacy customers show lower churn than newer customers—strong evidence they can handle a price increase.
Gradual migration of low-risk customers could recover ~$18,000/year.`;

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
    recommendations: recommendations.slice(0, 4),
  };
}

// ============================================================================
// QUICK STATS FOR DASHBOARD
// ============================================================================

export async function getLegacyPlanQuickStats(organizationId: string): Promise<{
  legacyCustomerCount: number;
  totalAnnualGap: number;
  legacyChurnLower: boolean;
  churnAdvantage: number;
  safeToMigrateCount: number;
}> {
  const report = await analyzeLegacyPlans(organizationId);

  return {
    legacyCustomerCount: report.summary.customersOnLegacyPricing,
    totalAnnualGap: report.summary.totalAnnualRevenueGap,
    legacyChurnLower: report.summary.churnComparison.legacyMoreStable,
    churnAdvantage: report.summary.churnComparison.churnAdvantage,
    safeToMigrateCount: report.summary.safeToMigrateCount,
  };
}

