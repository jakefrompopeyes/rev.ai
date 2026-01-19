import { prisma } from '@/lib/db';
import { OpenAI } from 'openai';
import { subDays, addDays, format, differenceInDays } from 'date-fns';

const DEFAULT_FORECAST_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

// Lazy load OpenAI client
function getOpenAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

export interface ForecastPoint {
  date: string;
  actual?: number;
  predicted: number;
  optimistic: number;
  pessimistic: number;
  confidence: number;
}

export interface ForecastScenario {
  name: string;
  description: string;
  probability: number;
  endMrr: number;
  growthRate: number;
  keyDrivers: string[];
}

export interface AIForecastInsight {
  type: 'trend' | 'risk' | 'opportunity' | 'anomaly';
  title: string;
  description: string;
  impact: 'positive' | 'negative' | 'neutral';
  confidence: number;
}

export interface ForecastResult {
  dataPoints: ForecastPoint[];
  scenarios: ForecastScenario[];
  insights: AIForecastInsight[];
  summary: {
    currentMrr: number;
    projectedMrr: number;
    projectedGrowth: number;
    confidenceInterval: { low: number; high: number };
    forecastHorizon: number; // days
    modelAccuracy: number;
  };
  generatedAt: string;
}

function getForecastCacheTtlMs(): number {
  const raw = process.env.FORECAST_CACHE_TTL_MS;
  if (!raw) return DEFAULT_FORECAST_CACHE_TTL_MS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_FORECAST_CACHE_TTL_MS;
}

async function getCachedForecast(
  organizationId: string,
  cacheKey: string
): Promise<ForecastResult | null> {
  const cached = await prisma.forecastCache.findUnique({
    where: {
      organizationId_cacheKey: { organizationId, cacheKey },
    },
  });

  if (!cached) {
    return null;
  }

  const now = Date.now();
  if (cached.expiresAt.getTime() <= now) {
    await prisma.forecastCache
      .delete({
        where: { organizationId_cacheKey: { organizationId, cacheKey } },
      })
      .catch(() => null);
    return null;
  }

  return cached.data as unknown as ForecastResult;
}

async function setCachedForecast(
  organizationId: string,
  cacheKey: string,
  daysAhead: number,
  result: ForecastResult
): Promise<void> {
  const ttlMs = getForecastCacheTtlMs();
  const expiresAt = new Date(Date.now() + ttlMs);

  await prisma.forecastCache.upsert({
    where: { organizationId_cacheKey: { organizationId, cacheKey } },
    create: {
      organizationId,
      cacheKey,
      daysAhead,
      data: result,
      expiresAt,
    },
    update: {
      data: result,
      daysAhead,
      expiresAt,
    },
  });
}

/**
 * Statistical forecasting using exponential smoothing + trend analysis
 */
function statisticalForecast(
  historicalData: { date: Date; mrr: number }[],
  daysAhead: number = 90
): { points: ForecastPoint[]; metrics: { avgGrowth: number; volatility: number; trend: number } } {
  if (historicalData.length < 7) {
    return { points: [], metrics: { avgGrowth: 0, volatility: 0, trend: 0 } };
  }

  // Sort by date
  const sorted = [...historicalData].sort((a, b) => a.date.getTime() - b.date.getTime());
  
  // Calculate daily growth rates
  const growthRates: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i - 1].mrr > 0) {
      const dailyGrowth = (sorted[i].mrr - sorted[i - 1].mrr) / sorted[i - 1].mrr;
      growthRates.push(dailyGrowth);
    }
  }

  // Calculate statistics
  const avgGrowth = growthRates.length > 0 
    ? growthRates.reduce((a, b) => a + b, 0) / growthRates.length 
    : 0;
  
  const volatility = growthRates.length > 1
    ? Math.sqrt(growthRates.reduce((sum, r) => sum + Math.pow(r - avgGrowth, 2), 0) / growthRates.length)
    : 0.02;

  // Calculate recent trend (last 14 days vs previous 14 days)
  const recentData = sorted.slice(-14);
  const previousData = sorted.slice(-28, -14);
  const recentAvg = recentData.reduce((sum, d) => sum + d.mrr, 0) / recentData.length;
  const previousAvg = previousData.length > 0 
    ? previousData.reduce((sum, d) => sum + d.mrr, 0) / previousData.length 
    : recentAvg;
  const trend = previousAvg > 0 ? (recentAvg - previousAvg) / previousAvg : 0;

  const points: ForecastPoint[] = [];
  const lastDate = sorted[sorted.length - 1].date;
  const lastMrr = sorted[sorted.length - 1].mrr;

  // Add historical points
  sorted.slice(-30).forEach((d, idx) => {
    points.push({
      date: format(d.date, 'yyyy-MM-dd'),
      actual: d.mrr,
      predicted: d.mrr,
      optimistic: d.mrr,
      pessimistic: d.mrr,
      confidence: 1.0,
    });
  });

  // Cap the daily growth rate at reasonable bounds
  const cappedDailyGrowth = Math.min(Math.max(avgGrowth / 30, -0.01), 0.01); // -1% to +1% daily
  const cappedVolatility = Math.min(volatility, 0.05); // Cap at 5%

  // Generate forecast points with simple exponential growth
  for (let i = 1; i <= daysAhead; i++) {
    const futureDate = addDays(lastDate, i);
    
    // Simple exponential growth with capped daily rate
    const predicted = lastMrr * Math.pow(1 + cappedDailyGrowth, i);
    
    // Confidence decreases over time
    const daysOut = i;
    const confidenceDecay = Math.exp(-0.015 * daysOut);
    const confidence = Math.max(0.4, 0.95 * confidenceDecay);
    
    // Calculate uncertainty bounds - grows with square root of time
    const uncertaintyFactor = cappedVolatility * Math.sqrt(daysOut / 7); // Weekly sqrt scaling
    const optimistic = predicted * (1 + uncertaintyFactor);
    const pessimistic = Math.max(predicted * 0.7, predicted * (1 - uncertaintyFactor));

    // Only add weekly points for readability
    if (i % 7 === 0 || i === daysAhead) {
      points.push({
        date: format(futureDate, 'yyyy-MM-dd'),
        predicted: Math.round(predicted),
        optimistic: Math.round(optimistic),
        pessimistic: Math.round(pessimistic),
        confidence,
      });
    }
  }

  return { 
    points, 
    metrics: { 
      avgGrowth: avgGrowth * 30 * 100, // Monthly growth %
      volatility: volatility * 100,
      trend: trend * 100 
    } 
  };
}

/**
 * Generate AI-powered forecast insights using LLM
 */
async function generateAIInsights(
  historicalData: { date: Date; mrr: number; churnRate?: number; newSubscriptions?: number }[],
  forecastMetrics: { avgGrowth: number; volatility: number; trend: number },
  scenarios: ForecastScenario[]
): Promise<AIForecastInsight[]> {
  const insights: AIForecastInsight[] = [];
  const openai = getOpenAIClient();

  // Generate heuristic insights first
  const sorted = [...historicalData].sort((a, b) => a.date.getTime() - b.date.getTime());
  const latestMrr = sorted[sorted.length - 1]?.mrr || 0;
  const thirtyDaysAgoMrr = sorted.find(d => 
    differenceInDays(sorted[sorted.length - 1].date, d.date) >= 28
  )?.mrr || latestMrr;

  // Trend insight
  if (forecastMetrics.trend > 5) {
    insights.push({
      type: 'trend',
      title: 'Strong upward momentum',
      description: `MRR has accelerated ${forecastMetrics.trend.toFixed(1)}% in the last 2 weeks compared to the previous period. This momentum, if sustained, suggests continued growth.`,
      impact: 'positive',
      confidence: 0.85,
    });
  } else if (forecastMetrics.trend < -5) {
    insights.push({
      type: 'trend',
      title: 'Growth is decelerating',
      description: `MRR growth has slowed ${Math.abs(forecastMetrics.trend).toFixed(1)}% compared to the previous period. This could indicate market saturation or increased competition.`,
      impact: 'negative',
      confidence: 0.85,
    });
  }

  // Volatility insight
  if (forecastMetrics.volatility > 3) {
    insights.push({
      type: 'risk',
      title: 'High revenue volatility detected',
      description: `Daily MRR fluctuates by ${forecastMetrics.volatility.toFixed(1)}% on average. This increases forecast uncertainty and may indicate unstable revenue streams.`,
      impact: 'negative',
      confidence: 0.8,
    });
  }

  // Growth rate insight
  const monthlyGrowth = ((latestMrr - thirtyDaysAgoMrr) / thirtyDaysAgoMrr) * 100;
  if (monthlyGrowth > 10) {
    insights.push({
      type: 'opportunity',
      title: 'Above-benchmark growth',
      description: `${monthlyGrowth.toFixed(1)}% monthly growth exceeds the SaaS median of 5-7%. Consider investing more in the channels driving this growth.`,
      impact: 'positive',
      confidence: 0.9,
    });
  }

  // Use LLM for deeper analysis if available
  if (openai) {
    try {
      const prompt = `Analyze this SaaS revenue forecast data and provide 2 additional insights:

HISTORICAL CONTEXT:
- Current MRR: $${(latestMrr / 100).toLocaleString()}
- 30-day MRR change: ${monthlyGrowth.toFixed(1)}%
- Average daily growth: ${forecastMetrics.avgGrowth.toFixed(2)}%
- Revenue volatility: ${forecastMetrics.volatility.toFixed(2)}%
- Recent trend: ${forecastMetrics.trend > 0 ? 'accelerating' : 'decelerating'} (${forecastMetrics.trend.toFixed(1)}%)

FORECAST SCENARIOS:
${scenarios.map(s => `- ${s.name}: ${s.description} (${(s.probability * 100).toFixed(0)}% probability)`).join('\n')}

Return JSON array with 2 insights, each having:
- type: "trend" | "risk" | "opportunity" | "anomaly"
- title: short headline (max 40 chars)
- description: 1-2 sentences explaining the insight and its implications
- impact: "positive" | "negative" | "neutral"
- confidence: 0.6-0.9

Focus on actionable, non-obvious insights about the forecast.`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a SaaS revenue analyst specializing in forecasting. Provide specific, actionable insights. Return only valid JSON.',
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.4,
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        const aiInsights = parsed.insights || parsed;
        if (Array.isArray(aiInsights)) {
          for (const insight of aiInsights.slice(0, 2)) {
            if (insight.type && insight.title && insight.description) {
              insights.push({
                type: insight.type,
                title: insight.title,
                description: insight.description,
                impact: insight.impact || 'neutral',
                confidence: insight.confidence || 0.7,
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('LLM forecast insights failed:', error);
    }
  }

  return insights;
}

/**
 * Generate forecast scenarios using statistical analysis + AI
 */
async function generateScenarios(
  latestMrr: number,
  forecastMetrics: { avgGrowth: number; volatility: number; trend: number },
  daysAhead: number
): Promise<ForecastScenario[]> {
  const monthsAhead = daysAhead / 30;
  // avgGrowth is already monthly percentage, cap it at reasonable values
  const baseGrowthPercent = Math.min(Math.max(forecastMetrics.avgGrowth, -20), 30); // Cap between -20% and 30%
  const baseGrowth = baseGrowthPercent / 100; // Convert to decimal
  
  // Calculate end MRR with monthly compound growth
  const optimisticEndMrr = Math.round(latestMrr * Math.pow(1 + Math.min(baseGrowth * 1.5, 0.15), monthsAhead));
  const baseEndMrr = Math.round(latestMrr * Math.pow(1 + Math.min(baseGrowth, 0.10), monthsAhead));
  const conservativeEndMrr = Math.round(latestMrr * Math.pow(1 + Math.max(baseGrowth * 0.3, -0.05), monthsAhead));
  
  const scenarios: ForecastScenario[] = [
    {
      name: 'Optimistic',
      description: 'Strong execution with favorable market conditions',
      probability: 0.2,
      endMrr: optimisticEndMrr,
      growthRate: ((optimisticEndMrr - latestMrr) / latestMrr) * 100,
      keyDrivers: [
        'Successful new feature launch',
        'Expansion in key accounts',
        'Lower-than-expected churn',
      ],
    },
    {
      name: 'Base Case',
      description: 'Current trajectory continues with normal variation',
      probability: 0.55,
      endMrr: baseEndMrr,
      growthRate: ((baseEndMrr - latestMrr) / latestMrr) * 100,
      keyDrivers: [
        'Steady new customer acquisition',
        'Stable retention rates',
        'Incremental upsells',
      ],
    },
    {
      name: 'Conservative',
      description: 'Headwinds from market or execution challenges',
      probability: 0.25,
      endMrr: conservativeEndMrr,
      growthRate: ((conservativeEndMrr - latestMrr) / latestMrr) * 100,
      keyDrivers: [
        'Increased competition',
        'Economic headwinds',
        'Slower sales cycles',
      ],
    },
  ];

  // Use LLM to enhance scenarios if available
  const openai = getOpenAIClient();
  if (openai) {
    try {
      const prompt = `Given a SaaS company with $${(latestMrr / 100).toLocaleString()} MRR and ${(forecastMetrics.avgGrowth).toFixed(1)}% monthly growth, enhance these forecast scenarios with specific, realistic key drivers:

${scenarios.map(s => `${s.name}: ${s.description}`).join('\n')}

For each scenario, provide 3 specific key drivers that would make that scenario happen. Be specific to SaaS business dynamics.

Return JSON with array of objects: { name, keyDrivers: string[] }`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a SaaS revenue forecasting expert. Provide realistic scenario drivers. Return only valid JSON.',
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.5,
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        const enhancedScenarios = parsed.scenarios || parsed;
        if (Array.isArray(enhancedScenarios)) {
          for (const enhanced of enhancedScenarios) {
            const scenario = scenarios.find(s => s.name === enhanced.name);
            if (scenario && Array.isArray(enhanced.keyDrivers)) {
              scenario.keyDrivers = enhanced.keyDrivers.slice(0, 3);
            }
          }
        }
      }
    } catch (error) {
      console.error('LLM scenario enhancement failed:', error);
    }
  }

  return scenarios;
}

/**
 * Main function to generate AI-powered revenue forecast
 */
export async function generateForecast(
  organizationId: string,
  daysAhead: number = 90
): Promise<ForecastResult> {
  // Fetch historical metrics
  const metrics = await prisma.dailyMetrics.findMany({
    where: {
      organizationId,
      date: { gte: subDays(new Date(), 90) },
    },
    orderBy: { date: 'asc' },
    select: {
      date: true,
      mrr: true,
      grossChurnRate: true,
      newSubscriptions: true,
    },
  });

  if (metrics.length < 7) {
    throw new Error('Insufficient data for forecasting. Need at least 7 days of metrics.');
  }

  // Convert to required format
  const historicalData = metrics.map(m => ({
    date: m.date,
    mrr: m.mrr,
    churnRate: m.grossChurnRate,
    newSubscriptions: m.newSubscriptions,
  }));

  // Generate statistical forecast
  const { points, metrics: forecastMetrics } = statisticalForecast(historicalData, daysAhead);

  const latestMrr = historicalData[historicalData.length - 1].mrr;
  const projectedMrr = points[points.length - 1]?.predicted || latestMrr;

  // Generate scenarios
  const scenarios = await generateScenarios(latestMrr, forecastMetrics, daysAhead);

  // Generate AI insights
  const insights = await generateAIInsights(historicalData, forecastMetrics, scenarios);

  // Calculate model accuracy estimate (based on volatility and data quality)
  const modelAccuracy = Math.max(0.6, Math.min(0.95, 0.9 - forecastMetrics.volatility / 100));

  return {
    dataPoints: points,
    scenarios,
    insights,
    summary: {
      currentMrr: latestMrr,
      projectedMrr,
      projectedGrowth: latestMrr > 0 ? ((projectedMrr - latestMrr) / latestMrr) * 100 : 0,
      confidenceInterval: {
        low: points[points.length - 1]?.pessimistic || projectedMrr * 0.8,
        high: points[points.length - 1]?.optimistic || projectedMrr * 1.2,
      },
      forecastHorizon: daysAhead,
      modelAccuracy,
    },
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Get cached forecast or generate new one
 */
export async function getForecast(
  organizationId: string,
  daysAhead: number = 90
): Promise<ForecastResult> {
  const cacheKey = `classic:${daysAhead}`;
  const cached = await getCachedForecast(organizationId, cacheKey);
  if (cached) {
    return cached;
  }

  const forecast = await generateForecast(organizationId, daysAhead);
  await setCachedForecast(organizationId, cacheKey, daysAhead, forecast);
  return forecast;
}

