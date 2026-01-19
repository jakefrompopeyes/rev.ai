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

// Configuration for leakage detection
const LEAKAGE_CONFIG = {
  CHURN_WINDOW_DAYS: 60, // Customer must not churn within X days to count as "stayed"
  LOOKBACK_DAYS: 365,    // How far back to analyze discounted invoices
  MIN_INVOICES_FOR_ANALYSIS: 2, // Customer needs at least 2 invoices to analyze
  UPGRADE_THRESHOLD_PERCENT: 0.1, // Require a meaningful increase to count as upgrade
  UPGRADE_THRESHOLD_CENTS: 1000, // $10 minimum increase to avoid noise
};

const QUALIFYING_BILLING_REASONS = new Set([
  'subscription_create',
  'subscription_cycle',
  'subscription_update',
]);

export interface LeakedDiscount {
  invoiceId: string;
  invoiceStripeId: string;
  customerId: string;
  customerEmail: string | null;
  invoiceDate: Date;
  
  // Pricing details
  fullPrice: number;       // subtotal (before discount)
  paidPrice: number;       // total (after discount)
  leakageAmount: number;   // fullPrice - paidPrice
  discountPercent: number;
  
  // Evidence of unnecessary discount
  evidence: {
    didRenew: boolean;           // Check 1: Another invoice exists
    paidFullPriceLater: boolean; // Check 2: Later invoice at full price
    upgraded: boolean;           // Check 3: Later invoice with higher amount
  };
  
  // Details about later behavior
  laterInvoices: {
    count: number;
  totalPaid: number;
    highestPaid: number;
    lastInvoiceDate: Date | null;
  };
  
  // Plan info
  planId: string | null;
  planName: string | null;
  
  // Coupon/discount info
  discountId: string | null;
}

export interface CouponLeakage {
  discountId: string;
  discountPercent: number | null;
  discountAmountOff: number | null;
  
  // Usage stats
  timesUsed: number;
  uniqueCustomers: number;
  
  // Leakage stats
  leakedCount: number;        // How many times this coupon leaked
  leakedPercent: number;      // leakedCount / timesUsed
  totalLeakage: number;       // Sum of all leakage amounts
  
  // Customer behavior after using this coupon
  customersWhoRenewed: number;
  customersWhoPaidFullLater: number;
  customersWhoUpgraded: number;
  customersWhoChurned: number;
  
  // Calculated
  churnRate: number;
  renewalRate: number;
  
  // Verdict
  verdict: 'unnecessary' | 'questionable' | 'justified';
}

export interface CustomerLeakage {
  customerId: string;
  email: string | null;
  
  // Discount history
  totalInvoices: number;
  discountedInvoices: number;
  fullPriceInvoices: number;
  
  // Leakage
  leakedDiscountCount: number;
  totalLeakage: number;
  averageLeakagePerInvoice: number;
  
  // Behavior pattern
  pattern: 'always_pays_full_later' | 'mixed' | 'discount_dependent';
}

export interface PlanLeakage {
  planId: string;
  planName: string | null;
  planAmount: number;
  
  // Stats
  totalDiscountedInvoices: number;
  leakedCount: number;
  leakedPercent: number;
  totalLeakage: number;
}

export interface LeakageSummary {
  // Time period
  periodDays: number;
  analyzedFrom: Date;
  analyzedTo: Date;
  
  // Total numbers
  totalDiscountedInvoices: number;
  totalLeakedDiscounts: number;
  leakageRate: number; // % of discounts that were unnecessary
  
  // Financial impact
  totalLeakage: number;           // All time in period
  leakageLast30Days: number;      // Last 30 days
  averageLeakagePerInvoice: number;
  
  // Breakdown counts
  renewedWithoutNeedingDiscount: number;  // Check 1
  paidFullPriceLater: number;             // Check 2
  upgradedLater: number;                  // Check 3
  
  // Projections
  projectedAnnualLeakage: number;
  potentialRecoveryWithFix: number;
}

export interface DiscountLeakageReport {
  summary: LeakageSummary;
  
  // Detailed breakdowns
  leakedDiscounts: LeakedDiscount[];
  couponLeakage: CouponLeakage[];
  customerLeakage: CustomerLeakage[];
  planLeakage: PlanLeakage[];
  
  // AI-generated content (storytelling, not calculation)
  aiNarrative: string | null;
  aiRecommendations: AIRecommendation[];
  
  generatedAt: Date;
}

export interface AIRecommendation {
  priority: number;
  title: string;
  description: string;
  expectedImpact: number;
  dataSupport: string; // The data that supports this recommendation
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

export async function analyzeDiscountLeakage(
  organizationId: string,
  options?: { strict?: boolean }
): Promise<DiscountLeakageReport> {
  const strict = options?.strict ?? true;
  const endDate = new Date();
  const startDate = subDays(endDate, LEAKAGE_CONFIG.LOOKBACK_DAYS);
  
  // Get all paid invoices with customer and subscription info
  const invoices = await prisma.stripeInvoice.findMany({
    where: {
      organizationId,
      status: 'paid',
      stripeCreatedAt: { gte: startDate },
      subscriptionId: { not: null },
      billingReason: { in: Array.from(QUALIFYING_BILLING_REASONS) },
    },
    include: {
      customer: true,
    },
    orderBy: { stripeCreatedAt: 'asc' },
  });

  // Get subscriptions for plan info
  const subscriptions = await prisma.stripeSubscription.findMany({
    where: {
      organizationId,
    },
    select: {
      id: true,
      stripeId: true,
      customerId: true,
      planId: true,
      planNickname: true,
      planAmount: true,
      discountId: true,
      discountPercent: true,
      discountAmountOff: true,
      status: true,
      canceledAt: true,
      endedAt: true,
    },
  });

  // Create lookup maps
  const subscriptionMap = new Map(subscriptions.map(s => [s.stripeId, s]));
  
  // Group invoices by customer
  const customerInvoices = new Map<string, typeof invoices>();
  for (const invoice of invoices) {
    const existing = customerInvoices.get(invoice.customerId) || [];
    existing.push(invoice);
    customerInvoices.set(invoice.customerId, existing);
  }

  // Sort each customer's invoices by date
  for (const [customerId, invs] of customerInvoices) {
    invs.sort((a, b) => a.stripeCreatedAt.getTime() - b.stripeCreatedAt.getTime());
  }

  // Analyze each discounted invoice for leakage
  const leakedDiscounts: LeakedDiscount[] = [];
  
  for (const invoice of invoices) {
    // Only analyze discounted invoices
    if (invoice.discountAmount <= 0) continue;
    
    const customerInvs = customerInvoices.get(invoice.customerId) || [];
    const invoiceIndex = customerInvs.findIndex(i => i.id === invoice.id);
    const laterInvoices = customerInvs.slice(invoiceIndex + 1);
    const laterInvoicesSameSub = invoice.subscriptionId
      ? laterInvoices.filter(i => i.subscriptionId === invoice.subscriptionId)
      : [];
    
    // Get subscription info for this invoice
    const subscription = invoice.subscriptionId 
      ? subscriptionMap.get(invoice.subscriptionId) 
      : null;
    
    // Check 1: Did they renew the same subscription?
    const didRenew = laterInvoicesSameSub.length > 0;
    
    // Check if churned within window
    const lastInvoiceDate = laterInvoicesSameSub.length > 0 
      ? laterInvoicesSameSub[laterInvoicesSameSub.length - 1].stripeCreatedAt 
      : null;
    const canceledAt = subscription?.canceledAt || subscription?.endedAt || null;
    const churnedWithinWindow = canceledAt
      ? differenceInDays(canceledAt, invoice.stripeCreatedAt) <= LEAKAGE_CONFIG.CHURN_WINDOW_DAYS
      : false;
    
    // Skip if churned within window - discount may have been needed
    if (churnedWithinWindow) continue;
    
    // Check 2: Did they pay full price later on the same subscription?
    const paidFullPriceLater = laterInvoicesSameSub.some(inv => 
      inv.discountAmount === 0 && inv.subtotal >= invoice.subtotal
    );
    
    // Check 3: Did they upgrade? (Later invoice with meaningfully higher subtotal)
    const upgradeDeltaThreshold = Math.max(
      Math.round(invoice.subtotal * LEAKAGE_CONFIG.UPGRADE_THRESHOLD_PERCENT),
      LEAKAGE_CONFIG.UPGRADE_THRESHOLD_CENTS
    );
    const upgraded = laterInvoicesSameSub.some(inv => (inv.subtotal - invoice.subtotal) >= upgradeDeltaThreshold);
    
    // Only count as leakage with strong evidence of willingness to pay in strict mode
    const isLeaked = strict ? (paidFullPriceLater || upgraded) : (didRenew || paidFullPriceLater || upgraded);
    
    if (!isLeaked) continue;
    
    // Calculate leakage
    const fullPrice = invoice.subtotal;
    const paidPrice = invoice.total;
    const leakageAmount = fullPrice - paidPrice;
    const discountPercent = fullPrice > 0 
      ? ((fullPrice - paidPrice) / fullPrice) * 100 
      : 0;
    
    leakedDiscounts.push({
      invoiceId: invoice.id,
      invoiceStripeId: invoice.stripeId,
      customerId: invoice.customerId,
      customerEmail: invoice.customer.email,
      invoiceDate: invoice.stripeCreatedAt,
      
      fullPrice,
      paidPrice,
      leakageAmount,
      discountPercent,
      
      evidence: {
        didRenew,
        paidFullPriceLater,
        upgraded,
      },
      
      laterInvoices: {
        count: laterInvoicesSameSub.length,
        totalPaid: laterInvoicesSameSub.reduce((sum, i) => sum + i.total, 0),
        highestPaid: Math.max(...laterInvoicesSameSub.map(i => i.total), 0),
        lastInvoiceDate,
      },
      
      planId: subscription?.planId || null,
      planName: subscription?.planNickname || null,
      discountId: subscription?.discountId || null,
    });
  }

  // Calculate summary
  const summary = calculateSummary(invoices, leakedDiscounts, startDate, endDate);
  
  // Aggregate by coupon
  const couponLeakage = aggregateByCoupon(leakedDiscounts, subscriptions, customerInvoices);
  
  // Aggregate by customer
  const customerLeakage = aggregateByCustomer(leakedDiscounts, customerInvoices);
  
  // Aggregate by plan
  const planLeakage = aggregateByPlan(leakedDiscounts, subscriptions);
  
  // Generate AI narrative and recommendations (storytelling, not calculation)
  const { narrative, recommendations } = await generateAINarrative(
    summary,
    couponLeakage,
    customerLeakage,
    planLeakage,
    strict
  );

  return {
    summary,
    leakedDiscounts: leakedDiscounts.slice(0, 100), // Limit for performance
    couponLeakage,
    customerLeakage: customerLeakage.slice(0, 50),
    planLeakage,
    aiNarrative: narrative,
    aiRecommendations: recommendations,
    generatedAt: new Date(),
  };
}

// ============================================================================
// SUMMARY CALCULATION
// ============================================================================

function calculateSummary(
  allInvoices: Array<{ discountAmount: number; total: number; stripeCreatedAt: Date }>,
  leakedDiscounts: LeakedDiscount[],
  startDate: Date,
  endDate: Date
): LeakageSummary {
  const discountedInvoices = allInvoices.filter(i => i.discountAmount > 0);
  const totalDiscountedInvoices = discountedInvoices.length;
  const totalLeakedDiscounts = leakedDiscounts.length;
  
  const leakageRate = totalDiscountedInvoices > 0
    ? (totalLeakedDiscounts / totalDiscountedInvoices) * 100
    : 0;
  
  const totalLeakage = leakedDiscounts.reduce((sum, l) => sum + l.leakageAmount, 0);
  
  // Calculate last 30 days leakage
  const thirtyDaysAgo = subDays(new Date(), 30);
  const leakageLast30Days = leakedDiscounts
    .filter(l => l.invoiceDate >= thirtyDaysAgo)
    .reduce((sum, l) => sum + l.leakageAmount, 0);
  
  const averageLeakagePerInvoice = totalLeakedDiscounts > 0
    ? totalLeakage / totalLeakedDiscounts
    : 0;
  
  // Count by evidence type
  const renewedWithoutNeedingDiscount = leakedDiscounts.filter(l => l.evidence.didRenew).length;
  const paidFullPriceLater = leakedDiscounts.filter(l => l.evidence.paidFullPriceLater).length;
  const upgradedLater = leakedDiscounts.filter(l => l.evidence.upgraded).length;
  
  // Projections
  const daysInPeriod = differenceInDays(endDate, startDate);
  const dailyLeakage = totalLeakage / Math.max(daysInPeriod, 1);
  const projectedAnnualLeakage = dailyLeakage * 365;
  
  // Conservative recovery estimate: 60% of leakage could be recovered
  const potentialRecoveryWithFix = Math.round(projectedAnnualLeakage * 0.6);

  return {
    periodDays: daysInPeriod,
    analyzedFrom: startDate,
    analyzedTo: endDate,
    
    totalDiscountedInvoices,
    totalLeakedDiscounts,
    leakageRate: Math.round(leakageRate * 10) / 10,
    
    totalLeakage,
    leakageLast30Days,
    averageLeakagePerInvoice: Math.round(averageLeakagePerInvoice),
    
    renewedWithoutNeedingDiscount,
    paidFullPriceLater,
    upgradedLater,
    
    projectedAnnualLeakage: Math.round(projectedAnnualLeakage),
    potentialRecoveryWithFix,
  };
}

// ============================================================================
// AGGREGATION FUNCTIONS
// ============================================================================

function aggregateByCoupon(
  leakedDiscounts: LeakedDiscount[],
  subscriptions: Array<{
    customerId: string;
    discountId: string | null;
    discountPercent: number | null;
    discountAmountOff: number | null;
    status: string;
    canceledAt: Date | null;
  }>,
  customerInvoices: Map<string, Array<{ discountAmount: number; total: number }>>
): CouponLeakage[] {
  // Group by discount ID
  const couponGroups = new Map<string, LeakedDiscount[]>();
  
  for (const leaked of leakedDiscounts) {
    if (!leaked.discountId) continue;
    const existing = couponGroups.get(leaked.discountId) || [];
    existing.push(leaked);
    couponGroups.set(leaked.discountId, existing);
  }
  
  // Get all subscriptions with discounts for total usage count
  const discountUsage = new Map<string, typeof subscriptions>();
  for (const sub of subscriptions) {
    if (!sub.discountId) continue;
    const existing = discountUsage.get(sub.discountId) || [];
    existing.push(sub);
    discountUsage.set(sub.discountId, existing);
  }
  
  const results: CouponLeakage[] = [];
  
  for (const [discountId, leakedList] of couponGroups) {
    const allUsages = discountUsage.get(discountId) || [];
    const firstUsage = allUsages[0];
    
    const timesUsed = allUsages.length;
    const uniqueCustomers = new Set(allUsages.map(u => u.customerId)).size;
    
    const leakedCount = leakedList.length;
    const leakedPercent = timesUsed > 0 ? (leakedCount / timesUsed) * 100 : 0;
    const totalLeakage = leakedList.reduce((sum, l) => sum + l.leakageAmount, 0);
    
    // Customer behavior stats
    const customersWhoRenewed = leakedList.filter(l => l.evidence.didRenew).length;
    const customersWhoPaidFullLater = leakedList.filter(l => l.evidence.paidFullPriceLater).length;
    const customersWhoUpgraded = leakedList.filter(l => l.evidence.upgraded).length;
    const customersWhoChurned = allUsages.filter(u => u.canceledAt !== null).length;
    
    const churnRate = timesUsed > 0 ? (customersWhoChurned / timesUsed) * 100 : 0;
    const renewalRate = timesUsed > 0 ? (customersWhoRenewed / timesUsed) * 100 : 0;
    
    // Determine verdict based on leakage rate
    let verdict: CouponLeakage['verdict'];
    if (leakedPercent >= 60) {
      verdict = 'unnecessary'; // Most customers didn't need this discount
    } else if (leakedPercent >= 30) {
      verdict = 'questionable'; // Mixed results
    } else {
      verdict = 'justified'; // Most customers needed the discount
    }
    
    results.push({
      discountId,
      discountPercent: firstUsage?.discountPercent || null,
      discountAmountOff: firstUsage?.discountAmountOff || null,
      
      timesUsed,
      uniqueCustomers,
      
      leakedCount,
      leakedPercent: Math.round(leakedPercent * 10) / 10,
      totalLeakage,
      
      customersWhoRenewed,
      customersWhoPaidFullLater,
      customersWhoUpgraded,
      customersWhoChurned,
      
      churnRate: Math.round(churnRate * 10) / 10,
      renewalRate: Math.round(renewalRate * 10) / 10,
      
      verdict,
    });
  }
  
  // Sort by total leakage (highest first)
  return results.sort((a, b) => b.totalLeakage - a.totalLeakage);
}

function aggregateByCustomer(
  leakedDiscounts: LeakedDiscount[],
  customerInvoices: Map<string, Array<{ discountAmount: number; total: number }>>
): CustomerLeakage[] {
  // Group by customer
  const customerGroups = new Map<string, LeakedDiscount[]>();
  
  for (const leaked of leakedDiscounts) {
    const existing = customerGroups.get(leaked.customerId) || [];
    existing.push(leaked);
    customerGroups.set(leaked.customerId, existing);
  }
  
  const results: CustomerLeakage[] = [];
  
  for (const [customerId, leakedList] of customerGroups) {
    const allInvoices = customerInvoices.get(customerId) || [];
    const totalInvoices = allInvoices.length;
    const discountedInvoices = allInvoices.filter(i => i.discountAmount > 0).length;
    const fullPriceInvoices = totalInvoices - discountedInvoices;
    
    const leakedDiscountCount = leakedList.length;
    const totalLeakage = leakedList.reduce((sum, l) => sum + l.leakageAmount, 0);
    const averageLeakagePerInvoice = leakedDiscountCount > 0
      ? totalLeakage / leakedDiscountCount
      : 0;
    
    // Determine pattern
    let pattern: CustomerLeakage['pattern'];
    if (fullPriceInvoices > discountedInvoices) {
      pattern = 'always_pays_full_later'; // Clearly didn't need discounts
    } else if (fullPriceInvoices > 0) {
      pattern = 'mixed';
    } else {
      pattern = 'discount_dependent'; // Always uses discounts
    }
    
    results.push({
      customerId,
      email: leakedList[0]?.customerEmail || null,
      
      totalInvoices,
      discountedInvoices,
      fullPriceInvoices,
      
      leakedDiscountCount,
      totalLeakage,
      averageLeakagePerInvoice: Math.round(averageLeakagePerInvoice),
      
      pattern,
    });
  }
  
  // Sort by total leakage (highest first)
  return results.sort((a, b) => b.totalLeakage - a.totalLeakage);
}

function aggregateByPlan(
  leakedDiscounts: LeakedDiscount[],
  subscriptions: Array<{
    planId: string | null;
    planNickname: string | null;
    planAmount: number;
    discountId: string | null;
  }>
): PlanLeakage[] {
  // Group by plan
  const planGroups = new Map<string, LeakedDiscount[]>();
  
  for (const leaked of leakedDiscounts) {
    if (!leaked.planId) continue;
    const existing = planGroups.get(leaked.planId) || [];
    existing.push(leaked);
    planGroups.set(leaked.planId, existing);
  }
  
  // Get total discounted invoices per plan
  const planDiscountedCounts = new Map<string, number>();
  for (const sub of subscriptions) {
    if (!sub.planId || !sub.discountId) continue;
    const count = planDiscountedCounts.get(sub.planId) || 0;
    planDiscountedCounts.set(sub.planId, count + 1);
  }
  
  const results: PlanLeakage[] = [];
  
  for (const [planId, leakedList] of planGroups) {
    const firstLeak = leakedList[0];
    const planSub = subscriptions.find(s => s.planId === planId);
    
    const totalDiscountedInvoices = planDiscountedCounts.get(planId) || leakedList.length;
    const leakedCount = leakedList.length;
    const leakedPercent = totalDiscountedInvoices > 0 
      ? (leakedCount / totalDiscountedInvoices) * 100 
      : 0;
    const totalLeakage = leakedList.reduce((sum, l) => sum + l.leakageAmount, 0);
    
    results.push({
      planId,
      planName: firstLeak?.planName || planSub?.planNickname || null,
      planAmount: planSub?.planAmount || 0,
      
      totalDiscountedInvoices,
      leakedCount,
      leakedPercent: Math.round(leakedPercent * 10) / 10,
      totalLeakage,
    });
  }
  
  // Sort by total leakage (highest first)
  return results.sort((a, b) => b.totalLeakage - a.totalLeakage);
}

// ============================================================================
// AI NARRATIVE GENERATION (Simple, Direct Storytelling)
// ============================================================================

async function generateAINarrative(
  summary: LeakageSummary,
  couponLeakage: CouponLeakage[],
  customerLeakage: CustomerLeakage[],
  planLeakage: PlanLeakage[],
  strict: boolean
): Promise<{ narrative: string | null; recommendations: AIRecommendation[] }> {
  const openai = getOpenAIClient();
  
  // Calculate churn rate (customers who churned vs total)
  const totalChurned = couponLeakage.reduce((sum, c) => sum + c.customersWhoChurned, 0);
  const totalCustomers = couponLeakage.reduce((sum, c) => sum + c.uniqueCustomers, 0);
  const churnRate = totalCustomers > 0 ? (totalChurned / totalCustomers) * 100 : 0;
  
  // Calculate recovery range (60-80% of annual leakage)
  const recoveryLow = Math.round((summary.projectedAnnualLeakage * 0.6) / 100);
  const recoveryHigh = Math.round((summary.projectedAnnualLeakage * 0.8) / 100);
  
  // Format leakage amount
  const leakageAmount = Math.round(summary.totalLeakage / 100);
  
  // Build simple narrative without AI
  const evidenceLabel = strict
    ? 'later pay full price or upgrade'
    : 'renew, pay full price, or upgrade';
  let narrative = `Discounts are being applied where customers ${evidenceLabel}.\n`;
  narrative += `Over the last ${summary.periodDays} days, you discounted away ~$${leakageAmount.toLocaleString()} on invoices that ${evidenceLabel}.\n`;
  
  if (recoveryLow > 0) {
    narrative += `Restricting discounts to first-time purchases would likely recover $${recoveryLow.toLocaleString()}–$${recoveryHigh.toLocaleString()} annually.`;
  }
  
  // Simple recommendations based on data
  const recommendations: AIRecommendation[] = [];
  
  // Main recommendation: restrict discounts
  if (summary.totalLeakedDiscounts > 0) {
    recommendations.push({
      priority: 100,
      title: 'Restrict discounts to first-time customers',
      description: `${summary.totalLeakedDiscounts} discounted invoices later paid full price or upgraded. Discounts weren’t necessary.`,
      expectedImpact: Math.round(summary.projectedAnnualLeakage * 0.7),
      dataSupport: `${summary.leakageRate.toFixed(0)}% of discounted invoices showed ${evidenceLabel}`,
    });
  }
  
  // Top leaky coupon
  const topLeakyCoupon = couponLeakage.find(c => c.verdict === 'unnecessary');
  if (topLeakyCoupon) {
    recommendations.push({
      priority: 90,
      title: `Remove or restrict "${topLeakyCoupon.discountId.slice(0, 15)}..." coupon`,
      description: `${topLeakyCoupon.renewalRate.toFixed(0)}% of customers who used this coupon renewed. It's not driving conversions.`,
      expectedImpact: topLeakyCoupon.totalLeakage,
      dataSupport: `${topLeakyCoupon.leakedCount} of ${topLeakyCoupon.timesUsed} uses were unnecessary`,
    });
  }
  
  // If AI is available, generate a more tailored narrative
  if (openai) {
    try {
      const prompt = `Write exactly 3 sentences about this discount data. Each sentence on its own line. No paragraphs, no bullet points, no headers.

DATA:
- ${summary.totalDiscountedInvoices} discounted invoices
- ${summary.totalLeakedDiscounts} invoices that ${evidenceLabel}
- $${leakageAmount.toLocaleString()} discounted away
- Churn after discount: ${churnRate.toFixed(0)}%

Line 1: The problem (who is getting discounts that don't need them)
Line 2: The cost (how much lost over ${summary.periodDays} days)
Line 3: The fix (one action + expected recovery $${recoveryLow.toLocaleString()}–$${recoveryHigh.toLocaleString()}/yr)

Example format:
Discounts are being applied where customers later pay full price or upgrade.
Over the last 90 days, you lost ~$19k discounting invoices that later paid full price.
Restricting discounts to first-time purchases would likely recover $14k–$16k annually.`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 150,
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
    recommendations: recommendations.slice(0, 3),
  };
}

// ============================================================================
// QUICK STATS FOR DASHBOARD
// ============================================================================

export async function getDiscountLeakageQuickStats(organizationId: string): Promise<{
  leakageRate: number;
  totalLeakage: number;
  leakageLast30Days: number;
  unnecessaryCoupons: number;
  topLeakyCoupon: string | null;
}> {
  const report = await analyzeDiscountLeakage(organizationId);

  return {
    leakageRate: report.summary.leakageRate,
    totalLeakage: report.summary.totalLeakage,
    leakageLast30Days: report.summary.leakageLast30Days,
    unnecessaryCoupons: report.couponLeakage.filter(c => c.verdict === 'unnecessary').length,
    topLeakyCoupon: report.couponLeakage[0]?.discountId || null,
  };
}
