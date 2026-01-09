import { prisma } from '@/lib/db';
import { OpenAI } from 'openai';
import { subDays, addDays, format } from 'date-fns';

// Get OpenAI client - throws if not configured
function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured. AI forecasting requires OpenAI.');
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

// ============================================================================
// TYPES
// ============================================================================

export interface PlanMetrics {
  planId: string;
  planName: string;
  currentCount: number;
  currentMrr: number;
  avgPrice: number;
  churnRate: number;
  growthRate: number;
  mrrContribution: number;
}

export interface DailyRevenuePoint {
  date: string;
  totalMrr: number;
  planBreakdown: Record<string, number>;
  newSubscriptions: number;
  churned: number;
  upgrades: number;
  downgrades: number;
}

export interface PriceChangeScenario {
  planName: string;
  currentPrice: number;
  newPrice: number;
  effectiveDate?: string;
  applyToExisting: boolean;
}

export interface GrowthScenario {
  planName: string;
  expectedMonthlyGrowthRate: number;
}

export interface ForecastScenarioInput {
  name: string;
  description?: string;
  priceChanges?: PriceChangeScenario[];
  growthAssumptions?: GrowthScenario[];
  churnReduction?: number;
}

export interface ForecastedMonth {
  month: string;
  totalMrr: number;
  totalArr: number;
  planBreakdown: Record<string, { count: number; mrr: number }>;
  newMrr: number;
  churnedMrr: number;
  expansionMrr: number;
  contractionMrr: number;
  netNewMrr: number;
}

export interface AIForecastResult {
  scenarioName: string;
  forecastedMonths: ForecastedMonth[];
  summary: {
    startingMrr: number;
    endingMrr: number;
    totalGrowth: number;
    avgMonthlyGrowthRate: number;
    projectedArr: number;
    confidenceScore: number;
  };
  keyAssumptions: string[];
  risks: string[];
  opportunities: string[];
  reasoning: string;
}

export interface EnhancedForecastResult {
  baseCase: AIForecastResult;
  scenarios: AIForecastResult[];
  comparison: {
    bestCase: string;
    worstCase: string;
    mrrSpread: { min: number; max: number };
  };
  planInsights: Array<{
    planName: string;
    insight: string;
    recommendation: string;
  }>;
  generatedAt: string;
}

// ============================================================================
// DATA PREPARATION
// ============================================================================

async function prepareHistoricalData(
  organizationId: string,
  lookbackDays: number = 90
): Promise<{
  dailyRevenue: DailyRevenuePoint[];
  planMetrics: PlanMetrics[];
  subscriptionEvents: Array<{
    type: string;
    date: string;
    planName: string;
    mrrDelta: number;
  }>;
  currentState: {
    totalMrr: number;
    totalSubscriptions: number;
    avgChurnRate: number;
  };
}> {
  const startDate = subDays(new Date(), lookbackDays);

  const dailyMetrics = await prisma.dailyMetrics.findMany({
    where: {
      organizationId,
      date: { gte: startDate },
    },
    orderBy: { date: 'asc' },
  });

  const subscriptions = await prisma.stripeSubscription.findMany({
    where: {
      organizationId,
      status: { in: ['active', 'trialing'] },
    },
    select: {
      planId: true,
      planNickname: true,
      planAmount: true,
      mrr: true,
      quantity: true,
      stripeCreatedAt: true,
      canceledAt: true,
    },
  });

  const events = await prisma.subscriptionEvent.findMany({
    where: {
      organizationId,
      occurredAt: { gte: startDate },
    },
    orderBy: { occurredAt: 'asc' },
    select: {
      type: true,
      occurredAt: true,
      previousPlanNickname: true,
      newPlanNickname: true,
      mrrDelta: true,
    },
  });

  // Calculate plan-level metrics
  const planGroups: Record<string, {
    count: number;
    totalMrr: number;
    prices: number[];
    churned30d: number;
    new30d: number;
  }> = {};

  for (const sub of subscriptions) {
    const planName = sub.planNickname || 'Unknown';
    if (!planGroups[planName]) {
      planGroups[planName] = { count: 0, totalMrr: 0, prices: [], churned30d: 0, new30d: 0 };
    }
    planGroups[planName].count++;
    planGroups[planName].totalMrr += sub.mrr;
    planGroups[planName].prices.push(sub.planAmount);
  }

  const thirtyDaysAgo = subDays(new Date(), 30);
  for (const event of events) {
    if (event.occurredAt >= thirtyDaysAgo) {
      const planName = event.newPlanNickname || event.previousPlanNickname || 'Unknown';
      if (planGroups[planName]) {
        if (event.type === 'CANCELED') planGroups[planName].churned30d++;
        else if (event.type === 'NEW') planGroups[planName].new30d++;
      }
    }
  }

  const totalMrr = subscriptions.reduce((sum, s) => sum + s.mrr, 0);
  const planMetrics: PlanMetrics[] = Object.entries(planGroups).map(([name, data]) => ({
    planId: name,
    planName: name,
    currentCount: data.count,
    currentMrr: data.totalMrr,
    avgPrice: data.prices.length > 0 
      ? Math.round(data.prices.reduce((a, b) => a + b, 0) / data.prices.length) 
      : 0,
    churnRate: data.count > 0 ? (data.churned30d / data.count) * 100 : 0,
    growthRate: data.count > 0 ? ((data.new30d - data.churned30d) / data.count) * 100 : 0,
    mrrContribution: totalMrr > 0 ? (data.totalMrr / totalMrr) * 100 : 0,
  }));

  const dailyRevenue: DailyRevenuePoint[] = dailyMetrics.map(m => ({
    date: format(m.date, 'yyyy-MM-dd'),
    totalMrr: m.mrr,
    planBreakdown: m.planDistribution as Record<string, number>,
    newSubscriptions: m.newSubscriptions,
    churned: m.canceledSubscriptions,
    upgrades: m.upgrades,
    downgrades: m.downgrades,
  }));

  const subscriptionEvents = events.map(e => ({
    type: e.type,
    date: format(e.occurredAt, 'yyyy-MM-dd'),
    planName: e.newPlanNickname || e.previousPlanNickname || 'Unknown',
    mrrDelta: e.mrrDelta,
  }));

  const avgChurnRate = dailyMetrics.length > 0
    ? dailyMetrics.reduce((sum, m) => sum + m.grossChurnRate, 0) / dailyMetrics.length
    : 3;

  return {
    dailyRevenue,
    planMetrics,
    subscriptionEvents,
    currentState: { totalMrr, totalSubscriptions: subscriptions.length, avgChurnRate },
  };
}

// ============================================================================
// AI FORECASTING
// ============================================================================

async function generateAIScenarioForecast(
  historicalData: Awaited<ReturnType<typeof prepareHistoricalData>>,
  scenario: ForecastScenarioInput,
  monthsAhead: number = 6
): Promise<AIForecastResult> {
  const openai = getOpenAIClient();
  const { dailyRevenue, planMetrics, subscriptionEvents, currentState } = historicalData;

  const prompt = buildForecastPrompt(
    dailyRevenue,
    planMetrics,
    subscriptionEvents,
    currentState,
    scenario,
    monthsAhead
  );

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are a SaaS revenue forecasting expert. You analyze subscription data to produce accurate, data-driven revenue forecasts. 

Your forecasts should:
1. Be grounded in the historical data provided
2. Account for seasonality and trends
3. Consider plan-level dynamics (different plans have different growth/churn patterns)
4. Factor in any scenario assumptions (price changes, growth targets)
5. Provide confidence-adjusted estimates

Always return valid JSON matching the exact schema requested. Be conservative with confidence scores - only high confidence (>0.8) when trends are very clear.`,
      },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Empty response from OpenAI');
  }

  const parsed = JSON.parse(content);
  return validateAndNormalizeForecast(parsed, scenario.name, currentState.totalMrr);
}

function buildForecastPrompt(
  dailyRevenue: DailyRevenuePoint[],
  planMetrics: PlanMetrics[],
  subscriptionEvents: Array<{ type: string; date: string; planName: string; mrrDelta: number }>,
  currentState: { totalMrr: number; totalSubscriptions: number; avgChurnRate: number },
  scenario: ForecastScenarioInput,
  monthsAhead: number
): string {
  const safeRevenue = dailyRevenue || [];
  const safePlanMetrics = planMetrics || [];
  const safeEvents = subscriptionEvents || [];
  
  const recentRevenue = safeRevenue.slice(-30);
  const olderRevenue = safeRevenue.length > 30 ? safeRevenue.slice(0, -30) : [];
  
  const weeklyOlder: { week: string; avgMrr: number }[] = [];
  for (let i = 0; i < olderRevenue.length; i += 7) {
    const weekData = olderRevenue.slice(i, i + 7);
    if (weekData.length > 0) {
      weeklyOlder.push({
        week: weekData[0].date,
        avgMrr: Math.round(weekData.reduce((s, d) => s + d.totalMrr, 0) / weekData.length),
      });
    }
  }

  const eventSummary = safeEvents.reduce(
    (acc, e) => { acc[e.type] = (acc[e.type] || 0) + 1; return acc; },
    {} as Record<string, number>
  );

  const firstWeekData = safeRevenue.slice(0, 7);
  const lastWeekData = safeRevenue.slice(-7);
  const firstWeekMrr = firstWeekData.length > 0 
    ? firstWeekData.reduce((s, d) => s + d.totalMrr, 0) / firstWeekData.length 
    : currentState.totalMrr;
  const lastWeekMrr = lastWeekData.length > 0 
    ? lastWeekData.reduce((s, d) => s + d.totalMrr, 0) / lastWeekData.length 
    : currentState.totalMrr;
  const overallTrend = firstWeekMrr > 0 ? ((lastWeekMrr - firstWeekMrr) / firstWeekMrr) * 100 : 0;

  return `Generate a ${monthsAhead}-month revenue forecast for a SaaS business.

## CURRENT STATE
- Current MRR: $${(currentState.totalMrr / 100).toLocaleString()}
- Current ARR: $${(currentState.totalMrr * 12 / 100).toLocaleString()}
- Active Subscriptions: ${currentState.totalSubscriptions}
- Average Monthly Churn Rate: ${currentState.avgChurnRate.toFixed(1)}%

## HISTORICAL TRENDS (${safeRevenue.length} days)
- Overall MRR trend: ${overallTrend > 0 ? '+' : ''}${overallTrend.toFixed(1)}%
- First week average MRR: $${(firstWeekMrr / 100).toLocaleString()}
- Last week average MRR: $${(lastWeekMrr / 100).toLocaleString()}

${weeklyOlder.length > 0 ? `Weekly historical MRR (older data):
${weeklyOlder.map(w => `- Week of ${w.week}: $${(w.avgMrr / 100).toLocaleString()}`).join('\n')}` : ''}

${recentRevenue.length > 0 ? `Recent ${Math.min(30, recentRevenue.length)} days (sample):
${recentRevenue.filter((_, i) => i % 5 === 0).map(d => 
  `- ${d.date}: MRR $${(d.totalMrr / 100).toLocaleString()}, +${d.newSubscriptions} new, -${d.churned} churned`
).join('\n')}` : 'No recent daily data available.'}

## PLAN-LEVEL BREAKDOWN
${safePlanMetrics.length > 0 ? safePlanMetrics.map(p => 
  `- ${p.planName}: ${p.currentCount} subscribers, $${(p.currentMrr / 100).toLocaleString()} MRR (${p.mrrContribution.toFixed(1)}% of total), avg $${(p.avgPrice / 100).toFixed(0)}/mo, ${p.churnRate.toFixed(1)}% churn, ${p.growthRate > 0 ? '+' : ''}${p.growthRate.toFixed(1)}% growth`
).join('\n') : 'No plan data available.'}

## SUBSCRIPTION EVENTS (last ${safeRevenue.length} days)
- New subscriptions: ${eventSummary.NEW || 0}
- Upgrades: ${eventSummary.UPGRADE || 0}
- Downgrades: ${eventSummary.DOWNGRADE || 0}
- Cancellations: ${eventSummary.CANCELED || 0}
- Reactivations: ${eventSummary.REACTIVATED || 0}

## SCENARIO: "${scenario.name}"
${scenario.description || 'Base case forecast continuing current trends.'}

${scenario.priceChanges && scenario.priceChanges.length > 0 ? `
### PRICE CHANGES TO MODEL:
${scenario.priceChanges.map(pc => 
  `- ${pc.planName}: $${(pc.currentPrice / 100).toFixed(0)} → $${(pc.newPrice / 100).toFixed(0)} (${pc.applyToExisting ? 'all customers' : 'new customers only'})`
).join('\n')}
` : ''}

${scenario.growthAssumptions && scenario.growthAssumptions.length > 0 ? `
### GROWTH ASSUMPTIONS:
${scenario.growthAssumptions.map(ga => 
  `- ${ga.planName}: ${ga.expectedMonthlyGrowthRate > 0 ? '+' : ''}${ga.expectedMonthlyGrowthRate}% monthly growth in subscriber count`
).join('\n')}
` : ''}

${scenario.churnReduction ? `
### CHURN REDUCTION:
- Assume ${scenario.churnReduction}% reduction in monthly churn rate
` : ''}

## OUTPUT FORMAT
IMPORTANT: All monetary values must be in CENTS (e.g., $90,000 = 9000000 cents).
Current MRR in cents: ${currentState.totalMrr}

Return a JSON object with this exact structure:
{
  "forecastedMonths": [
    {
      "month": "YYYY-MM",
      "totalMrr": number (in cents, e.g., 9500000 for $95,000),
      "totalArr": number (in cents),
      "planBreakdown": { "PlanName": { "count": number, "mrr": number (in cents) } },
      "newMrr": number (in cents),
      "churnedMrr": number (in cents),
      "expansionMrr": number (in cents),
      "contractionMrr": number (in cents),
      "netNewMrr": number (in cents)
    }
  ],
  "summary": {
    "startingMrr": number (in cents, should match current: ${currentState.totalMrr}),
    "endingMrr": number (in cents, projected final month),
    "totalGrowth": number (percentage, e.g., 15.5 for 15.5%),
    "avgMonthlyGrowthRate": number (percentage per month),
    "projectedArr": number (in cents, = endingMrr * 12),
    "confidenceScore": number (0.0 to 1.0)
  },
  "keyAssumptions": ["string"],
  "risks": ["string"],
  "opportunities": ["string"],
  "reasoning": "Brief explanation of forecast logic"
}

Base your forecast on the historical data patterns, plan-level dynamics, and scenario assumptions. Be specific with numbers and realistic about uncertainty.`;
}

function validateAndNormalizeForecast(
  raw: unknown,
  scenarioName: string,
  currentMrr: number
): AIForecastResult {
  const parsed = raw as Record<string, unknown>;
  
  const rawSummary = (parsed.summary as Record<string, unknown>) || {};
  let rawStartingMrr = Number(rawSummary.startingMrr) || 0;
  let rawEndingMrr = Number(rawSummary.endingMrr) || 0;
  
  // Detect if AI returned values in dollars instead of cents
  // If the AI's starting value is less than 1% of our known current MRR,
  // it likely returned dollars instead of cents - convert by multiplying by 100
  const needsConversion = rawStartingMrr > 0 && rawStartingMrr < currentMrr * 0.02;
  const conversionFactor = needsConversion ? 100 : 1;
  
  if (needsConversion) {
    console.log(`[AI Forecast] Detected dollar values, converting to cents (factor: ${conversionFactor})`);
  }
  
  const forecastedMonths: ForecastedMonth[] = [];
  const rawMonths = parsed.forecastedMonths as Array<Record<string, unknown>> || [];
  
  for (const month of rawMonths) {
    forecastedMonths.push({
      month: String(month.month || ''),
      totalMrr: Math.round((Number(month.totalMrr) || 0) * conversionFactor),
      totalArr: Math.round((Number(month.totalArr) || 0) * conversionFactor),
      planBreakdown: (month.planBreakdown as Record<string, { count: number; mrr: number }>) || {},
      newMrr: Math.round((Number(month.newMrr) || 0) * conversionFactor),
      churnedMrr: Math.round((Number(month.churnedMrr) || 0) * conversionFactor),
      expansionMrr: Math.round((Number(month.expansionMrr) || 0) * conversionFactor),
      contractionMrr: Math.round((Number(month.contractionMrr) || 0) * conversionFactor),
      netNewMrr: Math.round((Number(month.netNewMrr) || 0) * conversionFactor),
    });
  }

  // Apply conversion to summary values
  const startingMrr = rawStartingMrr > 0 
    ? Math.round(rawStartingMrr * conversionFactor)
    : currentMrr;
  const endingMrr = rawEndingMrr > 0 
    ? Math.round(rawEndingMrr * conversionFactor)
    : currentMrr;
  const projectedArr = Number(rawSummary.projectedArr) || 0;
  
  const summary = {
    startingMrr,
    endingMrr,
    totalGrowth: Number(rawSummary.totalGrowth) || 0,
    avgMonthlyGrowthRate: Number(rawSummary.avgMonthlyGrowthRate) || 0,
    projectedArr: projectedArr > 0 
      ? Math.round(projectedArr * conversionFactor)
      : endingMrr * 12,
    confidenceScore: Math.min(1, Math.max(0, Number(rawSummary.confidenceScore) || 0.6)),
  };

  return {
    scenarioName,
    forecastedMonths,
    summary,
    keyAssumptions: (parsed.keyAssumptions as string[]) || [],
    risks: (parsed.risks as string[]) || [],
    opportunities: (parsed.opportunities as string[]) || [],
    reasoning: String(parsed.reasoning || 'Forecast generated by AI based on historical data.'),
  };
}

// ============================================================================
// MAIN EXPORT FUNCTIONS
// ============================================================================

export async function generateEnhancedForecast(
  organizationId: string,
  options: {
    monthsAhead?: number;
    scenarios?: ForecastScenarioInput[];
  } = {}
): Promise<EnhancedForecastResult> {
  const monthsAhead = options.monthsAhead || 6;
  console.log(`[AI Forecast] Preparing historical data for org: ${organizationId}`);
  const historicalData = await prepareHistoricalData(organizationId);
  const safePlanMetrics = historicalData.planMetrics || [];
  
  console.log(`[AI Forecast] Daily revenue data points: ${historicalData.dailyRevenue.length}`);
  console.log(`[AI Forecast] Current state:`, JSON.stringify(historicalData.currentState));
  
  if (historicalData.dailyRevenue.length < 7) {
    console.log(`[AI Forecast] Not enough data - only ${historicalData.dailyRevenue.length} days found`);
    throw new Error('Insufficient data for forecasting. Need at least 7 days of metrics.');
  }

  const scenarios = options.scenarios || [
    {
      name: 'Conservative',
      description: 'Assumes current trends continue with slight headwinds',
      churnReduction: -10,
    },
    {
      name: 'Optimistic',
      description: 'Assumes successful execution and favorable conditions',
      churnReduction: 15,
      growthAssumptions: safePlanMetrics.map(p => ({
        planName: p.planName,
        expectedMonthlyGrowthRate: Math.max(5, p.growthRate * 1.3),
      })),
    },
  ];

  const baseCase = await generateAIScenarioForecast(
    historicalData,
    { name: 'Base Case', description: 'Forecast assuming current trends continue' },
    monthsAhead
  );

  const scenarioResults = await Promise.all(
    scenarios.map(scenario => generateAIScenarioForecast(historicalData, scenario, monthsAhead))
  );

  const allForecasts = [baseCase, ...scenarioResults];
  const endingMrrs = allForecasts.map(f => f.summary.endingMrr);
  const minMrr = Math.min(...endingMrrs);
  const maxMrr = Math.max(...endingMrrs);
  
  const bestCase = allForecasts.find(f => f.summary.endingMrr === maxMrr)?.scenarioName || 'Base Case';
  const worstCase = allForecasts.find(f => f.summary.endingMrr === minMrr)?.scenarioName || 'Conservative';

  const planInsights = safePlanMetrics.map(plan => ({
    planName: plan.planName,
    insight: generatePlanInsight(plan, safePlanMetrics),
    recommendation: generatePlanRecommendation(plan),
  }));

  return {
    baseCase,
    scenarios: scenarioResults,
    comparison: { bestCase, worstCase, mrrSpread: { min: minMrr, max: maxMrr } },
    planInsights,
    generatedAt: new Date().toISOString(),
  };
}

export async function forecastPriceChange(
  organizationId: string,
  priceChanges: PriceChangeScenario[],
  monthsAhead: number = 6
): Promise<AIForecastResult> {
  const historicalData = await prepareHistoricalData(organizationId);
  
  return generateAIScenarioForecast(
    historicalData,
    {
      name: 'Price Change Analysis',
      description: `Impact analysis for price changes: ${priceChanges.map(pc => 
        `${pc.planName} $${(pc.currentPrice / 100).toFixed(0)} → $${(pc.newPrice / 100).toFixed(0)}`
      ).join(', ')}`,
      priceChanges,
    },
    monthsAhead
  );
}

export async function getQuickForecast(
  organizationId: string,
  monthsAhead: number = 3
): Promise<{
  current: { mrr: number; arr: number; subscriptions: number };
  projected: { mrr: number; arr: number; growth: number };
  byPlan: Array<{ name: string; currentMrr: number; projectedMrr: number; growth: number }>;
  confidence: number;
}> {
  const historicalData = await prepareHistoricalData(organizationId, 60);
  const safePlanMetrics = historicalData.planMetrics || [];
  
  const forecast = await generateAIScenarioForecast(
    historicalData,
    { name: 'Quick Forecast', description: 'Base case projection' },
    monthsAhead
  );

  const safeMonths = forecast?.forecastedMonths || [];
  const lastMonth = safeMonths.length > 0 ? safeMonths[safeMonths.length - 1] : null;

  return {
    current: {
      mrr: historicalData.currentState.totalMrr,
      arr: historicalData.currentState.totalMrr * 12,
      subscriptions: historicalData.currentState.totalSubscriptions,
    },
    projected: {
      mrr: lastMonth?.totalMrr || historicalData.currentState.totalMrr,
      arr: (lastMonth?.totalMrr || historicalData.currentState.totalMrr) * 12,
      growth: forecast.summary.totalGrowth,
    },
    byPlan: safePlanMetrics.map(plan => {
      const projectedPlan = lastMonth?.planBreakdown?.[plan.planName];
      return {
        name: plan.planName,
        currentMrr: plan.currentMrr,
        projectedMrr: projectedPlan?.mrr || plan.currentMrr,
        growth: projectedPlan?.mrr && plan.currentMrr > 0
          ? ((projectedPlan.mrr - plan.currentMrr) / plan.currentMrr) * 100
          : 0,
      };
    }),
    confidence: forecast.summary.confidenceScore,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generatePlanInsight(plan: PlanMetrics, allPlans: PlanMetrics[]): string {
  if (allPlans.length === 0) return `${plan.planName} performance data is being collected.`;
  
  const avgChurn = allPlans.reduce((s, p) => s + p.churnRate, 0) / allPlans.length;
  const avgGrowth = allPlans.reduce((s, p) => s + p.growthRate, 0) / allPlans.length;

  if (avgChurn > 0 && plan.churnRate > avgChurn * 1.5) {
    return `${plan.planName} has ${(plan.churnRate / avgChurn).toFixed(1)}x higher churn than average. This is a risk to MRR retention.`;
  }
  if (avgGrowth > 0 && plan.growthRate > avgGrowth * 1.3) {
    return `${plan.planName} is growing ${(plan.growthRate / avgGrowth).toFixed(1)}x faster than other plans. Strong momentum.`;
  }
  if (plan.mrrContribution > 40) {
    return `${plan.planName} contributes ${plan.mrrContribution.toFixed(0)}% of total MRR. High concentration risk.`;
  }
  return `${plan.planName} is performing in line with overall trends.`;
}

function generatePlanRecommendation(plan: PlanMetrics): string {
  if (plan.churnRate > 5) {
    return `Consider adding retention features or check onboarding quality for ${plan.planName} customers.`;
  }
  if (plan.growthRate < 0) {
    return `${plan.planName} is shrinking. Consider repositioning or sunsetting this tier.`;
  }
  if (plan.avgPrice < 5000 && plan.mrrContribution > 30) {
    return `Many customers on low-priced ${plan.planName}. Test upgrade prompts to higher tiers.`;
  }
  return `Continue monitoring ${plan.planName} performance metrics.`;
}
