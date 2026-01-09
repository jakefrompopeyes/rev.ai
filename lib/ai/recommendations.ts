import { prisma } from '@/lib/db';
import { OpenAI } from 'openai';
import { RiskLevel, RecommendationStatus, InsightCategory } from '@prisma/client';

// Lazy load OpenAI client to avoid build-time errors
function getOpenAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

interface RecommendationData {
  title: string;
  description: string;
  reasoning: string;
  riskLevel: RiskLevel;
  estimatedImpact: number;
  impactTimeframe: string;
  impactConfidence: number;
  priorityScore: number;
  insightId?: string;
}

/**
 * Generate recommendations from insights
 */
export async function generateRecommendations(organizationId: string): Promise<RecommendationData[]> {
  const recommendations: RecommendationData[] = [];

  // Get active insights
  const insights = await prisma.aIInsight.findMany({
    where: {
      organizationId,
      isActive: true,
      dismissedAt: null,
    },
    orderBy: { severity: 'desc' },
  });

  // Get current metrics for context
  const latestMetrics = await prisma.dailyMetrics.findFirst({
    where: { organizationId },
    orderBy: { date: 'desc' },
  });

  if (!latestMetrics) {
    return [];
  }

  // Generate recommendations for each insight using heuristics + LLM
  for (const insight of insights) {
    const recs = await generateRecommendationsForInsight(insight, latestMetrics);
    recommendations.push(...recs);
  }

  // Store recommendations
  for (const rec of recommendations) {
    await prisma.aIRecommendation.create({
      data: {
        organizationId,
        ...rec,
        baselineMetrics: {
          mrr: latestMetrics.mrr,
          arr: latestMetrics.arr,
          churnRate: latestMetrics.grossChurnRate,
          activeSubscriptions: latestMetrics.activeSubscriptions,
        },
      },
    });
  }

  return recommendations;
}

/**
 * Generate recommendations for a specific insight
 */
async function generateRecommendationsForInsight(
  insight: {
    id: string;
    category: InsightCategory;
    severity: string;
    title: string;
    description: string;
    dataPoints: unknown;
  },
  metrics: {
    mrr: number;
    arr: number;
    grossChurnRate: number;
    activeSubscriptions: number;
    averageDiscount: number;
    discountLeakage: number;
    failedPaymentRate: number;
  }
): Promise<RecommendationData[]> {
  const recommendations: RecommendationData[] = [];
  const dataPoints = insight.dataPoints as Record<string, unknown>;

  // Heuristic recommendations based on insight category
  switch (insight.category) {
    case 'CHURN':
      recommendations.push(...generateChurnRecommendations(insight, dataPoints, metrics));
      break;
    case 'PRICING':
      recommendations.push(...generatePricingRecommendations(insight, dataPoints, metrics));
      break;
    case 'REVENUE':
      recommendations.push(...generateRevenueRecommendations(insight, dataPoints, metrics));
      break;
    case 'EFFICIENCY':
      recommendations.push(...generateEfficiencyRecommendations(insight, dataPoints, metrics));
      break;
    case 'GROWTH':
      // Growth insights typically don't need action recommendations
      break;
  }

  // Use LLM for more nuanced recommendations
  if (process.env.OPENAI_API_KEY && recommendations.length === 0) {
    const llmRecs = await generateLLMRecommendation(insight, metrics);
    if (llmRecs) {
      recommendations.push(llmRecs);
    }
  }

  // Add insight reference
  return recommendations.map(r => ({ ...r, insightId: insight.id }));
}

/**
 * Generate churn-related recommendations
 */
function generateChurnRecommendations(
  insight: { title: string; severity: string },
  dataPoints: Record<string, unknown>,
  metrics: { mrr: number; grossChurnRate: number }
): RecommendationData[] {
  const recommendations: RecommendationData[] = [];

  if (insight.title.toLowerCase().includes('elevated') || metrics.grossChurnRate > 5) {
    // High churn recommendation
    const monthlyLoss = Math.round(metrics.mrr * (metrics.grossChurnRate / 100));
    const sixMonthImpact = Math.round(monthlyLoss * 6 * 0.3); // Conservative 30% reduction target

    recommendations.push({
      title: 'Implement proactive churn prevention program',
      description: 'Deploy automated health scoring for at-risk customers and trigger intervention workflows when risk indicators appear. Start with customers approaching renewal or showing decreased usage.',
      reasoning: `With a ${metrics.grossChurnRate.toFixed(1)}% churn rate, you're losing approximately $${(monthlyLoss / 100).toLocaleString()}/month. A well-executed retention program typically reduces churn by 20-40%.`,
      riskLevel: 'LOW',
      estimatedImpact: sixMonthImpact,
      impactTimeframe: '6 months',
      impactConfidence: 0.6,
      priorityScore: insight.severity === 'CRITICAL' ? 95 : 80,
    });

    recommendations.push({
      title: 'Add cancellation flow survey and save offers',
      description: 'Before completing cancellation, show a brief survey to understand reasons and offer targeted retention deals (pause, downgrade, or discount) based on their feedback.',
      reasoning: 'Exit surveys reveal why customers leave and save offers can rescue 10-20% of cancelling customers. This is low effort with immediate impact.',
      riskLevel: 'LOW',
      estimatedImpact: Math.round(monthlyLoss * 3 * 0.15),
      impactTimeframe: '3 months',
      impactConfidence: 0.7,
      priorityScore: 75,
    });
  }

  if (insight.title.toLowerCase().includes('plan') && dataPoints.highChurnPlan) {
    const highChurnPlan = dataPoints.highChurnPlan as string;
    const lowChurnPlan = dataPoints.lowChurnPlan as string;

    recommendations.push({
      title: `Review ${highChurnPlan} plan value proposition`,
      description: `Analyze what makes ${lowChurnPlan} customers stick around and either add those features to ${highChurnPlan} or create a migration path for high-value customers.`,
      reasoning: `${highChurnPlan} customers churn significantly faster, suggesting a value mismatch. Either the plan doesn't deliver enough value or it's attracting the wrong customers.`,
      riskLevel: 'MEDIUM',
      estimatedImpact: Math.round(metrics.mrr * 0.05),
      impactTimeframe: '6 months',
      impactConfidence: 0.5,
      priorityScore: 65,
    });
  }

  return recommendations;
}

/**
 * Generate pricing-related recommendations
 */
function generatePricingRecommendations(
  insight: { title: string },
  dataPoints: Record<string, unknown>,
  metrics: { mrr: number; discountLeakage: number; averageDiscount: number }
): RecommendationData[] {
  const recommendations: RecommendationData[] = [];

  if (insight.title.toLowerCase().includes('discount leakage')) {
    const leakage = metrics.discountLeakage;
    const reducedLeakage = Math.round(leakage * 0.4); // Target 40% reduction

    recommendations.push({
      title: 'Implement discount governance policy',
      description: 'Create approval workflows for discounts above 15%, set expiration dates on all discounts, and track which sales reps use discounts most frequently. Tie compensation to net (not gross) revenue.',
      reasoning: `You're losing $${(leakage / 100).toLocaleString()}/month to discounts. Many of these may not be driving conversions that wouldn't happen anyway.`,
      riskLevel: 'MEDIUM',
      estimatedImpact: reducedLeakage * 6,
      impactTimeframe: '6 months',
      impactConfidence: 0.65,
      priorityScore: 70,
    });

    recommendations.push({
      title: 'A/B test reduced discount levels',
      description: 'Run a controlled test offering 10% discounts instead of 20%+ on a segment of prospects. Measure conversion rate difference to calculate true discount ROI.',
      reasoning: 'Most SaaS companies over-discount. Testing reveals the actual price sensitivity of your market without committing to permanent changes.',
      riskLevel: 'LOW',
      estimatedImpact: Math.round(reducedLeakage * 3),
      impactTimeframe: '3 months',
      impactConfidence: 0.5,
      priorityScore: 60,
    });
  }

  if (insight.title.toLowerCase().includes('correlate with higher churn')) {
    recommendations.push({
      title: 'Qualify discount recipients more carefully',
      description: 'Only offer large discounts to customers who show strong engagement signals (completed onboarding, high usage in trial, multiple stakeholders involved). Discount-hunters who won\'t use the product will churn anyway.',
      reasoning: 'Customers attracted primarily by price tend to have lower commitment and higher churn. Better to lose the sale than acquire a customer who will churn.',
      riskLevel: 'MEDIUM',
      estimatedImpact: Math.round(metrics.mrr * 0.03 * 6),
      impactTimeframe: '6 months',
      impactConfidence: 0.55,
      priorityScore: 55,
    });
  }

  return recommendations;
}

/**
 * Generate revenue-related recommendations
 */
function generateRevenueRecommendations(
  insight: { title: string },
  dataPoints: Record<string, unknown>,
  metrics: { mrr: number; arr: number }
): RecommendationData[] {
  const recommendations: RecommendationData[] = [];

  if (insight.title.toLowerCase().includes('annual')) {
    const annualPercent = (dataPoints.annualPercent as number) || 20;
    const monthlyCount = (dataPoints.monthlyCount as number) || 100;
    const targetConversions = Math.round(monthlyCount * 0.2); // Target 20% conversion
    const avgMrr = metrics.mrr / (metrics.mrr > 0 ? monthlyCount : 1);
    const annualDiscount = 0.17; // Typical annual discount
    const impact = Math.round(targetConversions * avgMrr * 12 * (1 - annualDiscount) * 0.8); // 80% retention improvement value

    recommendations.push({
      title: 'Launch annual plan upgrade campaign',
      description: 'Email monthly subscribers offering 2 months free when switching to annual. Highlight the savings and position annual as the "smart choice". Time around renewal dates.',
      reasoning: `Only ${annualPercent.toFixed(0)}% of customers are on annual plans. Annual customers typically have 50-80% lower churn. Even with a discount, the improved retention makes this profitable.`,
      riskLevel: 'LOW',
      estimatedImpact: impact,
      impactTimeframe: '6 months',
      impactConfidence: 0.7,
      priorityScore: 75,
    });
  }

  if (insight.title.toLowerCase().includes('mrr') && insight.title.toLowerCase().includes('declining')) {
    recommendations.push({
      title: 'Audit recent churns and implement quick wins',
      description: 'Interview the last 10 customers who churned to understand patterns. Look for product gaps, pricing concerns, or support issues that can be addressed quickly.',
      reasoning: 'Understanding why revenue is declining is the first step to stopping it. Often there are 2-3 fixable issues driving most of the churn.',
      riskLevel: 'LOW',
      estimatedImpact: Math.round(Math.abs((dataPoints.lostMrr as number) || metrics.mrr * 0.1) * 0.3 * 3),
      impactTimeframe: '3 months',
      impactConfidence: 0.5,
      priorityScore: 90,
    });
  }

  if (insight.title.toLowerCase().includes('net revenue retention')) {
    recommendations.push({
      title: 'Build expansion revenue motion',
      description: 'Identify your most successful customers and understand what drives their higher usage. Create upsell triggers based on usage thresholds and proactive outreach when customers hit expansion opportunities.',
      reasoning: 'NRR below 100% means churn exceeds expansion. Building systematic expansion revenue is the path to sustainable growth.',
      riskLevel: 'MEDIUM',
      estimatedImpact: Math.round(metrics.mrr * 0.15 * 6),
      impactTimeframe: '6 months',
      impactConfidence: 0.5,
      priorityScore: 70,
    });
  }

  return recommendations;
}

/**
 * Generate efficiency-related recommendations
 */
function generateEfficiencyRecommendations(
  insight: { title: string },
  dataPoints: Record<string, unknown>,
  metrics: { mrr: number; failedPaymentRate: number }
): RecommendationData[] {
  const recommendations: RecommendationData[] = [];

  if (insight.title.toLowerCase().includes('failed payment')) {
    const estimatedRecovery = Math.round(metrics.mrr * metrics.failedPaymentRate / 100 * 0.5); // 50% recovery rate

    recommendations.push({
      title: 'Implement smart payment retry with dunning',
      description: 'Configure automatic payment retries at optimal intervals (days 1, 3, 5, 7) and send personalized dunning emails. Update card on file reminders before expiration.',
      reasoning: `${metrics.failedPaymentRate.toFixed(1)}% of payments are failing. Smart dunning recovers 30-70% of failed payments that would otherwise be lost.`,
      riskLevel: 'LOW',
      estimatedImpact: estimatedRecovery * 6,
      impactTimeframe: '3 months',
      impactConfidence: 0.75,
      priorityScore: 85,
    });

    recommendations.push({
      title: 'Add backup payment method collection',
      description: 'Ask customers to add a secondary payment method during onboarding or after a failed payment. Automatically fall back to this method when primary fails.',
      reasoning: 'Having a backup payment method dramatically reduces involuntary churn from payment failures.',
      riskLevel: 'LOW',
      estimatedImpact: Math.round(estimatedRecovery * 0.3 * 6),
      impactTimeframe: '6 months',
      impactConfidence: 0.6,
      priorityScore: 60,
    });
  }

  return recommendations;
}

/**
 * Use LLM to generate custom recommendation
 */
async function generateLLMRecommendation(
  insight: {
    category: string;
    title: string;
    description: string;
    dataPoints: unknown;
  },
  metrics: {
    mrr: number;
    grossChurnRate: number;
    averageDiscount: number;
  }
): Promise<RecommendationData | null> {
  const openai = getOpenAIClient();
  if (!openai) return null;

  try {
    const prompt = `Based on this SaaS insight, generate ONE specific, actionable recommendation:

INSIGHT:
Category: ${insight.category}
Title: ${insight.title}
Details: ${insight.description}
Data: ${JSON.stringify(insight.dataPoints)}

CONTEXT:
- Monthly Recurring Revenue: $${(metrics.mrr / 100).toLocaleString()}
- Churn Rate: ${metrics.grossChurnRate.toFixed(1)}%
- Average Discount: ${metrics.averageDiscount.toFixed(1)}%

Return JSON with:
- title: action-oriented headline (max 50 chars)
- description: specific steps to take (2-3 sentences)
- reasoning: why this will work (1-2 sentences)
- riskLevel: "LOW" | "MEDIUM" | "HIGH"
- estimatedImpactPercent: conservative % of MRR impact (1-15)
- impactTimeframe: "3 months" | "6 months" | "12 months"
- priorityScore: 1-100

Be specific and conservative with estimates.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a SaaS growth advisor. Generate specific, actionable recommendations. Be conservative with impact estimates. Return only valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      const impactPercent = Math.min(parsed.estimatedImpactPercent || 5, 15);
      
      return {
        title: parsed.title,
        description: parsed.description,
        reasoning: parsed.reasoning,
        riskLevel: (parsed.riskLevel?.toUpperCase() || 'MEDIUM') as RiskLevel,
        estimatedImpact: Math.round(metrics.mrr * (impactPercent / 100) * 6),
        impactTimeframe: parsed.impactTimeframe || '6 months',
        impactConfidence: 0.5,
        priorityScore: Math.min(parsed.priorityScore || 50, 100),
      };
    }
  } catch (error) {
    console.error('LLM recommendation generation failed:', error);
  }

  return null;
}

/**
 * Get recommendations for an organization
 */
export async function getRecommendations(organizationId: string) {
  return prisma.aIRecommendation.findMany({
    where: {
      organizationId,
      status: { in: ['PENDING', 'IMPLEMENTED'] },
    },
    include: {
      insight: true,
    },
    orderBy: [
      { priorityScore: 'desc' },
      { generatedAt: 'desc' },
    ],
    take: 20,
  });
}

/**
 * Mark a recommendation as implemented
 */
export async function markRecommendationImplemented(
  recommendationId: string,
  organizationId: string
) {
  // Get current metrics to store as baseline for comparison
  const latestMetrics = await prisma.dailyMetrics.findFirst({
    where: { organizationId },
    orderBy: { date: 'desc' },
  });

  return prisma.aIRecommendation.update({
    where: {
      id: recommendationId,
      organizationId,
    },
    data: {
      status: 'IMPLEMENTED',
      implementedAt: new Date(),
      baselineMetrics: latestMetrics ? {
        mrr: latestMetrics.mrr,
        arr: latestMetrics.arr,
        churnRate: latestMetrics.grossChurnRate,
        activeSubscriptions: latestMetrics.activeSubscriptions,
        measuredAt: new Date().toISOString(),
      } : undefined,
    },
  });
}

/**
 * Dismiss a recommendation
 */
export async function dismissRecommendation(
  recommendationId: string,
  organizationId: string
) {
  return prisma.aIRecommendation.update({
    where: {
      id: recommendationId,
      organizationId,
    },
    data: {
      status: 'DISMISSED',
    },
  });
}

/**
 * Update result metrics for an implemented recommendation
 */
export async function updateRecommendationResults(
  recommendationId: string,
  organizationId: string
) {
  const latestMetrics = await prisma.dailyMetrics.findFirst({
    where: { organizationId },
    orderBy: { date: 'desc' },
  });

  if (!latestMetrics) return null;

  return prisma.aIRecommendation.update({
    where: {
      id: recommendationId,
      organizationId,
    },
    data: {
      resultMetrics: {
        mrr: latestMetrics.mrr,
        arr: latestMetrics.arr,
        churnRate: latestMetrics.grossChurnRate,
        activeSubscriptions: latestMetrics.activeSubscriptions,
        measuredAt: new Date().toISOString(),
      },
    },
  });
}

