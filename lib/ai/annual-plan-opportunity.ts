import { prisma } from '@/lib/db';
import { OpenAI } from 'openai';
import { subMonths, differenceInMonths } from 'date-fns';

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

const ANNUAL_OPPORTUNITY_CONFIG = {
  // Minimum tenure to consider for annual conversion (months)
  MIN_TENURE_MONTHS: 6,
  
  // Optimal tenure range for conversion (months)
  OPTIMAL_MIN_TENURE: 6,
  OPTIMAL_MAX_TENURE: 18,
  
  // Maximum failed payments allowed
  MAX_FAILED_PAYMENTS: 1,
  
  // Annual discount to offer (percentage)
  DEFAULT_ANNUAL_DISCOUNT: 10,
  
  // Expected conversion rate
  EXPECTED_CONVERSION_RATE: 0.25,
  
  // Minimum customers for statistical relevance
  MIN_SAMPLE_SIZE: 3,
};

export interface AnnualPlanCandidate {
  customerId: string;
  subscriptionId: string;
  email: string | null;
  
  // Current plan info
  planId: string | null;
  planName: string | null;
  monthlyAmount: number;      // What they pay monthly (cents)
  
  // Tenure signals
  customerSince: Date;
  tenureMonths: number;
  consecutivePayments: number;
  
  // Health signals
  status: string;
  paymentFailureCount: number;
  hasDiscount: boolean;
  
  // Value calculation
  monthlyLTV: number;          // Monthly amount × tenure
  currentAnnualValue: number;  // What they pay yearly at current rate
  discountedAnnualValue: number; // What they'd pay with annual discount
  cashFlowGain: number;        // Upfront cash gained vs monthly
  
  // Scoring
  conversionLikelihood: 'HIGH' | 'MEDIUM' | 'LOW';
  conversionScore: number;     // 0-100
}

export interface PlanAnnualOpportunity {
  planId: string;
  planName: string | null;
  monthlyPrice: number;
  
  // Candidate counts
  eligibleCustomers: number;
  highLikelihood: number;
  mediumLikelihood: number;
  lowLikelihood: number;
  
  // Value metrics
  totalMonthlyRevenue: number;
  potentialAnnualCashFlow: number;
  potentialGain: number;
}

export interface AnnualOpportunitySummary {
  analyzedAt: Date;
  
  // Headline metrics
  eligibleCustomers: number;
  totalMonthlyCustomers: number;
  eligiblePercent: number;
  
  // Revenue opportunity
  totalCurrentMonthlyRevenue: number;
  projectedAnnualCashFlow: number;
  cashFlowGain: number;
  
  // Annual discount assumption
  annualDiscountPercent: number;
  
  // Conversion estimates (conservative)
  expectedConversions: number;
  expectedCashFlowGain: number;
  
  // Segmentation
  highLikelihoodCount: number;
  mediumLikelihoodCount: number;
  lowLikelihoodCount: number;
  
  // Health check
  avgTenureMonths: number;
  avgConsecutivePayments: number;
  percentWithPerfectHistory: number;
}

export interface AIRecommendation {
  priority: number;
  title: string;
  description: string;
  expectedImpact: number;        // Cash flow gain
  customers: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  dataSupport: string;
}

export interface AnnualPlanOpportunityReport {
  summary: AnnualOpportunitySummary;
  
  // Detailed breakdowns
  candidates: AnnualPlanCandidate[];
  planBreakdown: PlanAnnualOpportunity[];
  
  // AI-generated content
  aiNarrative: string | null;
  aiRecommendations: AIRecommendation[];
  
  generatedAt: Date;
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

export async function analyzeAnnualPlanOpportunity(
  organizationId: string,
  annualDiscountPercent: number = ANNUAL_OPPORTUNITY_CONFIG.DEFAULT_ANNUAL_DISCOUNT
): Promise<AnnualPlanOpportunityReport> {
  const now = new Date();
  const tenureThreshold = subMonths(now, ANNUAL_OPPORTUNITY_CONFIG.MIN_TENURE_MONTHS);
  const paymentFailureWindowStart = subMonths(now, 12);
  
  // Get all active MONTHLY subscriptions with customer data
  const subscriptions = await prisma.stripeSubscription.findMany({
    where: {
      organizationId,
      status: { in: ['active', 'trialing'] },
      planInterval: 'month',        // Only monthly plans
      planIntervalCount: 1,         // Monthly billing
      startDate: { lte: tenureThreshold }, // At least 6 months old
    },
    include: {
      customer: true,
    },
    orderBy: { startDate: 'asc' },
  });

  // Get all invoices for payment history
  const invoices = await prisma.stripeInvoice.findMany({
    where: {
      organizationId,
      status: 'paid',
    },
    select: {
      customerId: true,
      total: true,
      stripeCreatedAt: true,
      subscriptionId: true,
    },
    orderBy: { stripeCreatedAt: 'asc' },
  });

  // Get failed payments for health scoring
  const failedPayments = await prisma.stripePayment.findMany({
    where: {
      organizationId,
      status: 'failed',
      stripeCreatedAt: { gte: paymentFailureWindowStart },
    },
    select: {
      customerId: true,
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

  // Calculate the annual discount multiplier
  const annualMultiplier = (100 - annualDiscountPercent) / 100;
  
  // Identify annual plan candidates
  const candidates: AnnualPlanCandidate[] = [];
  
  for (const sub of subscriptions) {
    const tenureMonths = differenceInMonths(now, sub.startDate);
    
    // Skip if already has a discount (might be price-sensitive)
    const hasDiscount = sub.discountId !== null;
    
    // Get payment history
    const custInvoices = customerInvoices.get(sub.customerId) || [];
    const subscriptionInvoices = custInvoices.filter(
      inv => inv.subscriptionId === sub.stripeId
    );
    const consecutivePayments = subscriptionInvoices.length;
    
    // Get payment failures
    const paymentFailureCount = customerFailedPayments.get(sub.customerId) || 0;
    
    // Apply filters: no failed payments, no active discounts
    if (paymentFailureCount > ANNUAL_OPPORTUNITY_CONFIG.MAX_FAILED_PAYMENTS) continue;
    if (hasDiscount) continue;
    
    // Calculate values
    const monthlyAmount = sub.planAmount;
    const monthlyLTV = monthlyAmount * tenureMonths;
    const currentAnnualValue = monthlyAmount * 12;
    const discountedAnnualValue = Math.round(currentAnnualValue * annualMultiplier);
    const cashFlowGain = discountedAnnualValue - monthlyAmount; // Upfront gain vs next month
    
    // Score conversion likelihood
    let conversionScore = 50; // Base score
    
    // Tenure bonus (longer tenure = more committed)
    if (tenureMonths >= 12) conversionScore += 20;
    else if (tenureMonths >= 9) conversionScore += 15;
    else if (tenureMonths >= 6) conversionScore += 10;
    
    // Payment history bonus
    if (consecutivePayments >= 12) conversionScore += 15;
    else if (consecutivePayments >= 6) conversionScore += 10;
    else if (consecutivePayments >= 3) conversionScore += 5;
    
    // Plan amount factor (higher value = more invested)
    if (monthlyAmount >= 10000) conversionScore += 15; // $100+/month
    else if (monthlyAmount >= 5000) conversionScore += 10; // $50+/month
    else if (monthlyAmount >= 2000) conversionScore += 5; // $20+/month
    
    // Cap at 100
    conversionScore = Math.min(100, conversionScore);
    
    // Classify likelihood
    let conversionLikelihood: AnnualPlanCandidate['conversionLikelihood'];
    if (conversionScore >= 75) {
      conversionLikelihood = 'HIGH';
    } else if (conversionScore >= 50) {
      conversionLikelihood = 'MEDIUM';
    } else {
      conversionLikelihood = 'LOW';
    }
    
    candidates.push({
      customerId: sub.customerId,
      subscriptionId: sub.id,
      email: sub.customer.email,
      
      planId: sub.planId,
      planName: sub.planNickname,
      monthlyAmount,
      
      customerSince: sub.startDate,
      tenureMonths,
      consecutivePayments,
      
      status: sub.status,
      paymentFailureCount,
      hasDiscount,
      
      monthlyLTV,
      currentAnnualValue,
      discountedAnnualValue,
      cashFlowGain,
      
      conversionLikelihood,
      conversionScore,
    });
  }

  // Sort by conversion score (highest opportunity first)
  candidates.sort((a, b) => b.conversionScore - a.conversionScore);

  // Get all monthly subscriptions for comparison
  const allMonthlySubscriptions = await prisma.stripeSubscription.findMany({
    where: {
      organizationId,
      status: { in: ['active', 'trialing'] },
      planInterval: 'month',
      planIntervalCount: 1,
    },
    select: { id: true },
  });

  // Aggregate by plan
  const planBreakdown = aggregateByPlan(candidates, annualDiscountPercent);

  // Calculate summary
  const summary = calculateSummary(
    candidates,
    allMonthlySubscriptions.length,
    annualDiscountPercent,
    now
  );

  // Generate AI narrative
  const { narrative, recommendations } = await generateAINarrative(
    summary,
    candidates,
    planBreakdown,
    annualDiscountPercent
  );

  return {
    summary,
    candidates: candidates.slice(0, 100), // Limit for performance
    planBreakdown,
    aiNarrative: narrative,
    aiRecommendations: recommendations,
    generatedAt: now,
  };
}

// ============================================================================
// PLAN AGGREGATION
// ============================================================================

function aggregateByPlan(
  candidates: AnnualPlanCandidate[],
  annualDiscountPercent: number
): PlanAnnualOpportunity[] {
  const planGroups = new Map<string, AnnualPlanCandidate[]>();
  
  for (const candidate of candidates) {
    if (!candidate.planId) continue;
    const existing = planGroups.get(candidate.planId) || [];
    existing.push(candidate);
    planGroups.set(candidate.planId, existing);
  }
  
  const results: PlanAnnualOpportunity[] = [];
  
  for (const [planId, customers] of planGroups) {
    const eligibleCustomers = customers.length;
    const highLikelihood = customers.filter(c => c.conversionLikelihood === 'HIGH').length;
    const mediumLikelihood = customers.filter(c => c.conversionLikelihood === 'MEDIUM').length;
    const lowLikelihood = customers.filter(c => c.conversionLikelihood === 'LOW').length;
    
    const totalMonthlyRevenue = customers.reduce((sum, c) => sum + c.monthlyAmount, 0);
    const potentialAnnualCashFlow = customers.reduce((sum, c) => sum + c.discountedAnnualValue, 0);
    const potentialGain = customers.reduce((sum, c) => sum + c.cashFlowGain, 0);
    
    results.push({
      planId,
      planName: customers[0]?.planName || null,
      monthlyPrice: customers[0]?.monthlyAmount || 0,
      
      eligibleCustomers,
      highLikelihood,
      mediumLikelihood,
      lowLikelihood,
      
      totalMonthlyRevenue,
      potentialAnnualCashFlow,
      potentialGain,
    });
  }
  
  // Sort by potential gain (biggest opportunity first)
  return results.sort((a, b) => b.potentialGain - a.potentialGain);
}

// ============================================================================
// SUMMARY CALCULATION
// ============================================================================

function calculateSummary(
  candidates: AnnualPlanCandidate[],
  totalMonthlyCustomers: number,
  annualDiscountPercent: number,
  now: Date
): AnnualOpportunitySummary {
  const eligibleCustomers = candidates.length;
  const eligiblePercent = totalMonthlyCustomers > 0
    ? (eligibleCustomers / totalMonthlyCustomers) * 100
    : 0;
  
  // Revenue calculations
  const totalCurrentMonthlyRevenue = candidates.reduce((sum, c) => sum + c.monthlyAmount, 0);
  const projectedAnnualCashFlow = candidates.reduce((sum, c) => sum + c.discountedAnnualValue, 0);
  const cashFlowGain = candidates.reduce((sum, c) => sum + c.cashFlowGain, 0);
  
  // Conversion estimates (conservative: expect 25% of eligible to convert)
  const expectedConversions = Math.round(eligibleCustomers * ANNUAL_OPPORTUNITY_CONFIG.EXPECTED_CONVERSION_RATE);
  const topCandidates = candidates.slice(0, expectedConversions);
  const expectedCashFlowGain = topCandidates.reduce((sum, c) => sum + c.cashFlowGain, 0);
  
  // Segmentation
  const highLikelihoodCount = candidates.filter(c => c.conversionLikelihood === 'HIGH').length;
  const mediumLikelihoodCount = candidates.filter(c => c.conversionLikelihood === 'MEDIUM').length;
  const lowLikelihoodCount = candidates.filter(c => c.conversionLikelihood === 'LOW').length;
  
  // Health metrics
  const tenures = candidates.map(c => c.tenureMonths);
  const avgTenureMonths = tenures.length > 0
    ? tenures.reduce((a, b) => a + b, 0) / tenures.length
    : 0;
  
  const payments = candidates.map(c => c.consecutivePayments);
  const avgConsecutivePayments = payments.length > 0
    ? payments.reduce((a, b) => a + b, 0) / payments.length
    : 0;
  
  const perfectHistory = candidates.filter(c => c.paymentFailureCount === 0).length;
  const percentWithPerfectHistory = eligibleCustomers > 0
    ? (perfectHistory / eligibleCustomers) * 100
    : 0;
  
  return {
    analyzedAt: now,
    
    eligibleCustomers,
    totalMonthlyCustomers,
    eligiblePercent: Math.round(eligiblePercent * 10) / 10,
    
    totalCurrentMonthlyRevenue,
    projectedAnnualCashFlow,
    cashFlowGain,
    
    annualDiscountPercent,
    
    expectedConversions,
    expectedCashFlowGain,
    
    highLikelihoodCount,
    mediumLikelihoodCount,
    lowLikelihoodCount,
    
    avgTenureMonths: Math.round(avgTenureMonths * 10) / 10,
    avgConsecutivePayments: Math.round(avgConsecutivePayments * 10) / 10,
    percentWithPerfectHistory: Math.round(percentWithPerfectHistory * 10) / 10,
  };
}

// ============================================================================
// AI NARRATIVE GENERATION
// ============================================================================

async function generateAINarrative(
  summary: AnnualOpportunitySummary,
  candidates: AnnualPlanCandidate[],
  planBreakdown: PlanAnnualOpportunity[],
  annualDiscountPercent: number
): Promise<{ narrative: string | null; recommendations: AIRecommendation[] }> {
  const openai = getOpenAIClient();
  
  // Format numbers for narrative
  const cashFlowGainDollars = Math.round(summary.expectedCashFlowGain / 100);
  const totalEligibleCashFlow = Math.round(summary.cashFlowGain / 100);
  
  // Build fallback narrative
  let narrative = '';
  
  if (summary.eligibleCustomers === 0) {
    narrative = `No monthly subscribers eligible for annual plan conversion.\n`;
    narrative += `Most customers either have discounts, payment issues, or haven't reached the 6-month tenure threshold.\n`;
    narrative += `Check back as more customers mature.`;
  } else {
    narrative = `${summary.eligibleCustomers} monthly subscribers would likely commit to annual plans.\n`;
    narrative += `These customers have ${summary.avgTenureMonths.toFixed(0)}+ months tenure and ${summary.percentWithPerfectHistory.toFixed(0)}% have perfect payment history.\n`;
    
    if (cashFlowGainDollars > 0) {
      narrative += `Offering a ${annualDiscountPercent}% annual discount could increase cash flow by $${cashFlowGainDollars.toLocaleString()}.`;
    }
  }
  
  // Build recommendations
  const recommendations: AIRecommendation[] = [];
  
  // Recommendation 1: High-likelihood candidates
  const highLikelihood = candidates.filter(c => c.conversionLikelihood === 'HIGH');
  if (highLikelihood.length > 0) {
    const highGain = highLikelihood.reduce((sum, c) => sum + c.cashFlowGain, 0);
    const avgTenure = highLikelihood.reduce((s, c) => s + c.tenureMonths, 0) / highLikelihood.length;
    
    recommendations.push({
      priority: 100,
      title: `Offer annual plans to ${highLikelihood.length} high-likelihood customers`,
      description: `These customers have been with you an average of ${Math.round(avgTenure)} months with perfect payment history. They're your most committed monthly subscribers.`,
      expectedImpact: highGain,
      customers: highLikelihood.length,
      riskLevel: 'LOW',
      dataSupport: `${summary.percentWithPerfectHistory.toFixed(0)}% have zero payment failures`,
    });
  }
  
  // Recommendation 2: Top plan opportunity
  if (planBreakdown.length > 0) {
    const topPlan = planBreakdown[0];
    recommendations.push({
      priority: 90,
      title: `Focus on ${topPlan.planName || topPlan.planId} plan first`,
      description: `${topPlan.eligibleCustomers} eligible customers, ${topPlan.highLikelihood} with high conversion likelihood.`,
      expectedImpact: topPlan.potentialGain,
      customers: topPlan.eligibleCustomers,
      riskLevel: 'LOW',
      dataSupport: `$${Math.round(topPlan.potentialGain / 100).toLocaleString()} potential cash flow gain`,
    });
  }
  
  // Recommendation 3: Long-tenured customers
  const longTenure = candidates.filter(c => c.tenureMonths >= 12);
  if (longTenure.length > 0) {
    const longGain = longTenure.reduce((sum, c) => sum + c.cashFlowGain, 0);
    
    recommendations.push({
      priority: 85,
      title: `Prioritize ${longTenure.length} customers with 12+ months tenure`,
      description: `These customers have demonstrated long-term commitment and are unlikely to churn after converting to annual.`,
      expectedImpact: longGain,
      customers: longTenure.length,
      riskLevel: 'LOW',
      dataSupport: `Average ${Math.round(longTenure.reduce((s, c) => s + c.consecutivePayments, 0) / longTenure.length)} consecutive payments`,
    });
  }
  
  // Recommendation 4: Consider custom discount tiers
  if (summary.eligibleCustomers >= 10 && summary.highLikelihoodCount >= 5) {
    recommendations.push({
      priority: 80,
      title: `Test tiered annual discounts`,
      description: `With ${summary.eligibleCustomers} eligible customers, consider offering ${annualDiscountPercent - 5}% for high-likelihood and ${annualDiscountPercent + 5}% for others.`,
      expectedImpact: Math.round(summary.expectedCashFlowGain * 1.1),
      customers: summary.eligibleCustomers,
      riskLevel: 'MEDIUM',
      dataSupport: `${summary.highLikelihoodCount} high-likelihood may convert with smaller discount`,
    });
  }
  
  // Try AI-enhanced narrative if available
  if (openai && summary.eligibleCustomers > 0) {
    try {
      const prompt = `Write exactly 3 sentences about annual plan conversion opportunity. Each sentence on its own line. No paragraphs, no bullet points, no headers.

DATA:
- ${summary.eligibleCustomers} monthly subscribers eligible for annual conversion
- Average tenure: ${summary.avgTenureMonths.toFixed(0)} months
- ${summary.percentWithPerfectHistory.toFixed(0)}% with perfect payment history
- ${summary.highLikelihoodCount} high-likelihood conversions
- Potential cash flow gain: $${cashFlowGainDollars.toLocaleString()} (with ${annualDiscountPercent}% discount)
- Total eligible cash flow: $${totalEligibleCashFlow.toLocaleString()}

Line 1: The opportunity (who are these customers, why they're good candidates)
Line 2: The evidence (tenure + payment history that supports conversion)
Line 3: The recommendation (offer X% discount, expected gain)

Example format:
47 monthly subscribers would probably commit to annual plans if asked.
These customers have 9+ months tenure and zero payment failures—clear signals of commitment.
Offering a 10% annual discount could increase cash flow by $48k.`;

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

export async function getAnnualPlanOpportunityQuickStats(organizationId: string): Promise<{
  eligibleCustomers: number;
  expectedCashFlowGain: number;
  highLikelihoodCount: number;
  avgTenureMonths: number;
}> {
  const report = await analyzeAnnualPlanOpportunity(organizationId);

  return {
    eligibleCustomers: report.summary.eligibleCustomers,
    expectedCashFlowGain: report.summary.expectedCashFlowGain,
    highLikelihoodCount: report.summary.highLikelihoodCount,
    avgTenureMonths: report.summary.avgTenureMonths,
  };
}

