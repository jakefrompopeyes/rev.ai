import { prisma } from '@/lib/db';
import { OpenAI } from 'openai';
import { InsightCategory, InsightSeverity } from '@prisma/client';
import { subDays, format } from 'date-fns';

// Lazy load OpenAI client to avoid build-time errors
function getOpenAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

interface InsightData {
  category: InsightCategory;
  severity: InsightSeverity;
  title: string;
  description: string;
  dataPoints: Record<string, unknown>;
  confidence: number;
}

/**
 * Generate AI insights for an organization
 */
export async function generateInsights(organizationId: string): Promise<InsightData[]> {
  const insights: InsightData[] = [];

  // Get historical metrics
  const metrics = await prisma.dailyMetrics.findMany({
    where: {
      organizationId,
      date: { gte: subDays(new Date(), 90) },
    },
    orderBy: { date: 'asc' },
  });

  if (metrics.length < 7) {
    // Not enough data
    return [];
  }

  // Get subscription data for plan analysis
  const subscriptions = await prisma.stripeSubscription.findMany({
    where: {
      organizationId,
      status: { in: ['active', 'trialing', 'canceled'] },
    },
    include: {
      customer: true,
    },
  });

  // Run heuristic analysis
  const heuristicInsights = await runHeuristicAnalysis(metrics, subscriptions, organizationId);
  insights.push(...heuristicInsights);

  // Run LLM-based analysis for deeper insights
  const llmInsights = await runLLMAnalysis(metrics, subscriptions, organizationId);
  insights.push(...llmInsights);

  // Store insights in database
  for (const insight of insights) {
    await prisma.aIInsight.create({
      data: {
        organizationId,
        category: insight.category,
        severity: insight.severity,
        title: insight.title,
        description: insight.description,
        dataPoints: insight.dataPoints as object,
        confidence: insight.confidence,
      },
    });
  }

  return insights;
}

/**
 * Heuristic-based analysis for common patterns
 */
async function runHeuristicAnalysis(
  metrics: Array<{
    date: Date;
    mrr: number;
    arr: number;
    arpu: number;
    activeSubscriptions: number;
    newSubscriptions: number;
    canceledSubscriptions: number;
    grossChurnRate: number;
    revenueChurnRate: number;
    netRevenueRetention: number;
    failedPaymentRate: number;
    averageDiscount: number;
    discountLeakage: number;
    planDistribution: unknown;
  }>,
  subscriptions: Array<{
    id: string;
    status: string;
    planId: string | null;
    planNickname: string | null;
    planAmount: number;
    planInterval: string;
    mrr: number;
    discountPercent: number | null;
    discountAmountOff: number | null;
    canceledAt: Date | null;
    stripeCreatedAt: Date;
  }>,
  organizationId: string
): Promise<InsightData[]> {
  const insights: InsightData[] = [];
  const latest = metrics[metrics.length - 1];
  const thirtyDaysAgo = metrics.find(m => 
    format(m.date, 'yyyy-MM-dd') === format(subDays(new Date(), 30), 'yyyy-MM-dd')
  ) || metrics[0];

  // 1. Churn Rate Analysis
  if (latest.grossChurnRate > 5) {
    insights.push({
      category: 'CHURN',
      severity: latest.grossChurnRate > 10 ? 'CRITICAL' : 'HIGH',
      title: 'Elevated customer churn detected',
      description: `Your monthly churn rate is ${latest.grossChurnRate.toFixed(1)}%, which is ${latest.grossChurnRate > 10 ? 'critically' : 'significantly'} above the SaaS benchmark of 3-5%. This is costing you approximately $${Math.round(latest.mrr * latest.grossChurnRate / 100 / 100).toLocaleString()} in MRR each month.`,
      dataPoints: {
        currentChurnRate: latest.grossChurnRate,
        benchmark: 5,
        monthlyMrrLoss: Math.round(latest.mrr * latest.grossChurnRate / 100),
      },
      confidence: 0.95,
    });
  }

  // 2. Plan-based churn analysis
  const planChurnRates = calculatePlanChurnRates(subscriptions);
  const planEntries = Object.entries(planChurnRates);
  
  if (planEntries.length >= 2) {
    const sorted = planEntries.sort((a, b) => b[1].churnRate - a[1].churnRate);
    const highest = sorted[0];
    const lowest = sorted[sorted.length - 1];
    
    if (highest[1].churnRate > lowest[1].churnRate * 1.5 && highest[1].total >= 10) {
      insights.push({
        category: 'CHURN',
        severity: 'MEDIUM',
        title: `${highest[0]} plan has elevated churn`,
        description: `Customers on ${highest[0]} churn ${(highest[1].churnRate / lowest[1].churnRate).toFixed(1)}x faster than those on ${lowest[0]}. Consider analyzing what ${lowest[0]} offers that reduces churn.`,
        dataPoints: {
          highChurnPlan: highest[0],
          highChurnRate: highest[1].churnRate,
          lowChurnPlan: lowest[0],
          lowChurnRate: lowest[1].churnRate,
        },
        confidence: 0.8,
      });
    }
  }

  // 3. Discount Leakage Analysis
  if (latest.discountLeakage > latest.mrr * 0.1) {
    const leakagePercent = (latest.discountLeakage / (latest.mrr + latest.discountLeakage)) * 100;
    insights.push({
      category: 'PRICING',
      severity: leakagePercent > 20 ? 'HIGH' : 'MEDIUM',
      title: 'Significant discount leakage detected',
      description: `You're losing ${leakagePercent.toFixed(1)}% of potential revenue to discounts ($${Math.round(latest.discountLeakage / 100).toLocaleString()}/month). Review your discounting strategy to ensure discounts are driving conversions.`,
      dataPoints: {
        discountLeakage: latest.discountLeakage,
        leakagePercent,
        potentialMrr: latest.mrr + latest.discountLeakage,
      },
      confidence: 0.9,
    });
  }

  // 4. High Discount Churn Correlation
  const discountedSubs = subscriptions.filter(s => s.discountPercent && s.discountPercent > 20);
  const discountedChurned = discountedSubs.filter(s => s.canceledAt);
  const regularSubs = subscriptions.filter(s => !s.discountPercent || s.discountPercent <= 20);
  const regularChurned = regularSubs.filter(s => s.canceledAt);

  if (discountedSubs.length >= 10 && regularSubs.length >= 10) {
    const discountedChurnRate = (discountedChurned.length / discountedSubs.length) * 100;
    const regularChurnRate = (regularChurned.length / regularSubs.length) * 100;

    if (discountedChurnRate > regularChurnRate * 1.3) {
      insights.push({
        category: 'PRICING',
        severity: 'MEDIUM',
        title: 'Heavy discounts correlate with higher churn',
        description: `Customers who received >20% discounts churn ${(discountedChurnRate / regularChurnRate).toFixed(1)}x more often than those with smaller or no discounts. Consider qualifying discounts more carefully.`,
        dataPoints: {
          discountedChurnRate,
          regularChurnRate,
          discountedCount: discountedSubs.length,
          regularCount: regularSubs.length,
        },
        confidence: 0.75,
      });
    }
  }

  // 5. Annual vs Monthly Analysis
  const annualSubs = subscriptions.filter(s => s.planInterval === 'year' && s.status === 'active');
  const monthlySubs = subscriptions.filter(s => s.planInterval === 'month' && s.status === 'active');
  
  if (annualSubs.length + monthlySubs.length >= 20) {
    const annualPercent = (annualSubs.length / (annualSubs.length + monthlySubs.length)) * 100;
    
    if (annualPercent < 30) {
      const avgAnnualMrr = annualSubs.length > 0 
        ? annualSubs.reduce((sum, s) => sum + s.mrr, 0) / annualSubs.length 
        : 0;
      const avgMonthlyMrr = monthlySubs.length > 0 
        ? monthlySubs.reduce((sum, s) => sum + s.mrr, 0) / monthlySubs.length 
        : 0;

      insights.push({
        category: 'REVENUE',
        severity: 'LOW',
        title: 'Annual plan adoption is low',
        description: `Only ${annualPercent.toFixed(0)}% of customers are on annual plans. Annual plans typically have higher LTV and lower churn. Consider incentivizing annual upgrades.`,
        dataPoints: {
          annualPercent,
          annualCount: annualSubs.length,
          monthlyCount: monthlySubs.length,
          avgAnnualMrr,
          avgMonthlyMrr,
        },
        confidence: 0.85,
      });
    }
  }

  // 6. Failed Payment Rate
  if (latest.failedPaymentRate > 3) {
    insights.push({
      category: 'EFFICIENCY',
      severity: latest.failedPaymentRate > 8 ? 'HIGH' : 'MEDIUM',
      title: 'Failed payment rate is concerning',
      description: `${latest.failedPaymentRate.toFixed(1)}% of payment attempts are failing. Industry benchmark is under 3%. Implement dunning emails and payment retry logic to recover revenue.`,
      dataPoints: {
        failedPaymentRate: latest.failedPaymentRate,
        benchmark: 3,
        estimatedLostRevenue: Math.round(latest.mrr * latest.failedPaymentRate / 100),
      },
      confidence: 0.9,
    });
  }

  // 7. MRR Trend Analysis
  const mrrTrend = calculateTrend(metrics.map(m => m.mrr));
  if (mrrTrend < -5) {
    insights.push({
      category: 'REVENUE',
      severity: mrrTrend < -10 ? 'CRITICAL' : 'HIGH',
      title: 'MRR is declining',
      description: `Your MRR has decreased by ${Math.abs(mrrTrend).toFixed(1)}% over the past 30 days. This trend requires immediate attention.`,
      dataPoints: {
        trend: mrrTrend,
        startMrr: thirtyDaysAgo.mrr,
        currentMrr: latest.mrr,
        lostMrr: thirtyDaysAgo.mrr - latest.mrr,
      },
      confidence: 0.95,
    });
  } else if (mrrTrend > 10) {
    insights.push({
      category: 'GROWTH',
      severity: 'LOW',
      title: 'Strong MRR growth',
      description: `Your MRR has grown ${mrrTrend.toFixed(1)}% over the past 30 days. This is excellent momentum.`,
      dataPoints: {
        trend: mrrTrend,
        startMrr: thirtyDaysAgo.mrr,
        currentMrr: latest.mrr,
        addedMrr: latest.mrr - thirtyDaysAgo.mrr,
      },
      confidence: 0.95,
    });
  }

  // 8. Net Revenue Retention
  if (latest.netRevenueRetention < 100) {
    insights.push({
      category: 'REVENUE',
      severity: latest.netRevenueRetention < 90 ? 'HIGH' : 'MEDIUM',
      title: 'Net Revenue Retention is below 100%',
      description: `Your NRR is ${latest.netRevenueRetention.toFixed(0)}%, meaning you're losing more revenue to churn than you're gaining from expansions. Best-in-class SaaS companies target 120%+ NRR.`,
      dataPoints: {
        nrr: latest.netRevenueRetention,
        benchmark: 100,
        targetBenchmark: 120,
      },
      confidence: 0.9,
    });
  }

  return insights;
}

/**
 * LLM-based analysis for nuanced insights
 */
async function runLLMAnalysis(
  metrics: Array<{
    date: Date;
    mrr: number;
    grossChurnRate: number;
    activeSubscriptions: number;
    averageDiscount: number;
    planDistribution: unknown;
  }>,
  subscriptions: Array<{
    planNickname: string | null;
    planAmount: number;
    mrr: number;
    status: string;
  }>,
  organizationId: string
): Promise<InsightData[]> {
  const insights: InsightData[] = [];

  const openai = getOpenAIClient();
  if (!openai) {
    return insights;
  }

  try {
    // Prepare data summary for LLM
    const latest = metrics[metrics.length - 1];
    const earliest = metrics[0];
    
    const planSummary: Record<string, { count: number; avgMrr: number; active: number; churned: number }> = {};
    for (const sub of subscriptions) {
      const plan = sub.planNickname || 'Unknown';
      if (!planSummary[plan]) {
        planSummary[plan] = { count: 0, avgMrr: 0, active: 0, churned: 0 };
      }
      planSummary[plan].count++;
      planSummary[plan].avgMrr += sub.mrr;
      if (sub.status === 'active') planSummary[plan].active++;
      if (sub.status === 'canceled') planSummary[plan].churned++;
    }

    for (const plan in planSummary) {
      planSummary[plan].avgMrr = Math.round(planSummary[plan].avgMrr / planSummary[plan].count);
    }

    const prompt = `Analyze this SaaS subscription data and provide 2-3 actionable insights. Focus on pricing optimization, churn patterns, and revenue opportunities.

DATA SUMMARY:
- Current MRR: $${(latest.mrr / 100).toLocaleString()}
- MRR 90 days ago: $${(earliest.mrr / 100).toLocaleString()}
- Active Subscriptions: ${latest.activeSubscriptions}
- Monthly Churn Rate: ${latest.grossChurnRate.toFixed(1)}%
- Average Discount Applied: ${latest.averageDiscount.toFixed(1)}%

PLAN BREAKDOWN:
${Object.entries(planSummary).map(([plan, data]) => 
  `- ${plan}: ${data.count} total, ${data.active} active, ${data.churned} churned, Avg MRR $${(data.avgMrr / 100).toFixed(0)}`
).join('\n')}

Return JSON array with insights. Each insight must have:
- category: "CHURN" | "PRICING" | "REVENUE" | "GROWTH" | "EFFICIENCY"
- severity: "LOW" | "MEDIUM" | "HIGH"
- title: short headline (max 60 chars)
- description: detailed explanation in plain English (2-3 sentences, actionable)
- confidence: 0.6-0.9

Focus on non-obvious insights. Be specific about numbers and recommendations.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a SaaS revenue analyst. Provide actionable insights based on subscription data. Be specific and quantitative. Return only valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      const llmInsights = parsed.insights || parsed;
      
      if (Array.isArray(llmInsights)) {
        for (const insight of llmInsights) {
          if (insight.category && insight.severity && insight.title && insight.description) {
            insights.push({
              category: insight.category.toUpperCase() as InsightCategory,
              severity: insight.severity.toUpperCase() as InsightSeverity,
              title: insight.title,
              description: insight.description,
              dataPoints: { source: 'llm', rawData: insight },
              confidence: insight.confidence || 0.7,
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('LLM analysis failed:', error);
    // Fail silently - heuristic insights are still valuable
  }

  return insights;
}

/**
 * Calculate churn rates by plan
 */
function calculatePlanChurnRates(
  subscriptions: Array<{
    planNickname: string | null;
    status: string;
    canceledAt: Date | null;
  }>
): Record<string, { total: number; churned: number; churnRate: number }> {
  const planStats: Record<string, { total: number; churned: number }> = {};

  for (const sub of subscriptions) {
    const plan = sub.planNickname || 'Unknown';
    if (!planStats[plan]) {
      planStats[plan] = { total: 0, churned: 0 };
    }
    planStats[plan].total++;
    if (sub.canceledAt) {
      planStats[plan].churned++;
    }
  }

  const result: Record<string, { total: number; churned: number; churnRate: number }> = {};
  for (const [plan, stats] of Object.entries(planStats)) {
    result[plan] = {
      ...stats,
      churnRate: stats.total > 0 ? (stats.churned / stats.total) * 100 : 0,
    };
  }

  return result;
}

/**
 * Calculate trend percentage over array of values
 */
function calculateTrend(values: number[]): number {
  if (values.length < 2) return 0;
  
  const first = values[0];
  const last = values[values.length - 1];
  
  if (first === 0) return last > 0 ? 100 : 0;
  
  return ((last - first) / first) * 100;
}

/**
 * Get active insights for an organization
 */
export async function getActiveInsights(organizationId: string) {
  return prisma.aIInsight.findMany({
    where: {
      organizationId,
      isActive: true,
      dismissedAt: null,
    },
    orderBy: [
      { severity: 'desc' },
      { generatedAt: 'desc' },
    ],
    take: 20,
  });
}

/**
 * Dismiss an insight
 */
export async function dismissInsight(insightId: string, organizationId: string) {
  return prisma.aIInsight.update({
    where: {
      id: insightId,
      organizationId,
    },
    data: {
      dismissedAt: new Date(),
      isActive: false,
    },
  });
}

