import { NextResponse } from 'next/server';
import { getForecast } from '@/lib/ai/forecast';
import { 
  generateEnhancedForecast, 
  getQuickForecast,
  forecastPriceChange,
  type ForecastScenarioInput,
  type PriceChangeScenario,
  type EnhancedForecastResult,
  type AIForecastResult,
} from '@/lib/ai/enhanced-forecast';
import { requireAuthWithOrg } from '@/lib/supabase/auth-helpers';
import { prisma } from '@/lib/db';
import { subDays, addDays, format } from 'date-fns';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ============================================================================
// TRANSFORM ENHANCED FORECAST TO COMPONENT FORMAT
// ============================================================================
// The component expects: { dataPoints, scenarios, insights, summary, generatedAt }
// Enhanced returns: { baseCase, scenarios, comparison, planInsights, generatedAt }

interface ComponentForecastPoint {
  date: string;
  actual?: number;
  predicted: number;
  optimistic: number;
  pessimistic: number;
  confidence: number;
}

interface ComponentForecastScenario {
  name: string;
  description: string;
  probability: number;
  endMrr: number;
  growthRate: number;
  keyDrivers: string[];
}

interface ComponentForecastInsight {
  type: 'trend' | 'risk' | 'opportunity' | 'anomaly';
  title: string;
  description: string;
  impact: 'positive' | 'negative' | 'neutral';
  confidence: number;
}

interface ComponentForecastResult {
  dataPoints: ComponentForecastPoint[];
  scenarios: ComponentForecastScenario[];
  insights: ComponentForecastInsight[];
  summary: {
    currentMrr: number;
    projectedMrr: number;
    projectedGrowth: number;
    confidenceInterval: { low: number; high: number };
    forecastHorizon: number;
    modelAccuracy: number;
  };
  generatedAt: string;
}

async function transformEnhancedForecast(
  enhanced: EnhancedForecastResult,
  organizationId: string,
  daysAhead: number = 90
): Promise<ComponentForecastResult> {
  const { baseCase, scenarios: aiScenarios, comparison, planInsights, generatedAt } = enhanced;
  
  // Fetch historical data to build dataPoints with actuals
  const historicalMetrics = await prisma.dailyMetrics.findMany({
    where: {
      organizationId,
      date: { gte: subDays(new Date(), 30) },
    },
    orderBy: { date: 'asc' },
    select: { date: true, mrr: true },
  });
  
  const dataPoints: ComponentForecastPoint[] = [];
  
  // Add historical points (last 30 days as actuals)
  for (const metric of historicalMetrics) {
    dataPoints.push({
      date: format(metric.date, 'yyyy-MM-dd'),
      actual: metric.mrr,
      predicted: metric.mrr,
      optimistic: metric.mrr,
      pessimistic: metric.mrr,
      confidence: 1.0,
    });
  }
  
  // Convert monthly forecasted data to weekly data points for the chart
  const lastHistoricalDate = historicalMetrics.length > 0 
    ? historicalMetrics[historicalMetrics.length - 1].date 
    : new Date();
  const currentMrr = baseCase.summary.startingMrr;
  const endMrr = baseCase.summary.endingMrr;
  
  // Find optimistic and conservative scenarios for confidence bands
  const optimisticScenario = aiScenarios.find(s => s.scenarioName === 'Optimistic') || aiScenarios[0];
  const conservativeScenario = aiScenarios.find(s => s.scenarioName === 'Conservative') || aiScenarios[aiScenarios.length - 1];
  
  const optimisticEnd = optimisticScenario?.summary.endingMrr || endMrr * 1.15;
  const conservativeEnd = conservativeScenario?.summary.endingMrr || endMrr * 0.85;
  
  // Generate weekly forecast points
  const weeksAhead = Math.ceil(daysAhead / 7);
  for (let week = 1; week <= weeksAhead; week++) {
    const progress = week / weeksAhead;
    const futureDate = addDays(lastHistoricalDate, week * 7);
    
    // Interpolate MRR values with compound growth
    const predicted = Math.round(currentMrr + (endMrr - currentMrr) * progress);
    const optimistic = Math.round(currentMrr + (optimisticEnd - currentMrr) * progress);
    const pessimistic = Math.round(currentMrr + (conservativeEnd - currentMrr) * progress);
    
    // Confidence decreases over time
    const confidence = Math.max(0.5, baseCase.summary.confidenceScore * (1 - progress * 0.3));
    
    dataPoints.push({
      date: format(futureDate, 'yyyy-MM-dd'),
      predicted,
      optimistic,
      pessimistic,
      confidence,
    });
  }
  
  // Transform AI scenarios to component format
  const allScenarios = [baseCase, ...aiScenarios];
  const scenarios: ComponentForecastScenario[] = [];
  
  // Calculate total growth for probability weighting
  const scenariosByName = new Map<string, AIForecastResult>();
  for (const scenario of allScenarios) {
    scenariosByName.set(scenario.scenarioName, scenario);
  }
  
  // Create the three expected scenarios: Optimistic, Base Case, Conservative
  const baseScenario = scenariosByName.get('Base Case') || baseCase;
  const optScenario = scenariosByName.get('Optimistic');
  const consScenario = scenariosByName.get('Conservative');
  
  if (optScenario) {
    scenarios.push({
      name: 'Optimistic',
      description: optScenario.reasoning || 'Strong execution with favorable market conditions',
      probability: 0.20,
      endMrr: optScenario.summary.endingMrr,
      growthRate: optScenario.summary.totalGrowth,
      keyDrivers: optScenario.keyAssumptions.slice(0, 3).length > 0 
        ? optScenario.keyAssumptions.slice(0, 3)
        : ['Successful new feature launch', 'Expansion in key accounts', 'Lower-than-expected churn'],
    });
  }
  
  scenarios.push({
    name: 'Base Case',
    description: baseScenario.reasoning || 'Current trajectory continues with normal variation',
    probability: 0.55,
    endMrr: baseScenario.summary.endingMrr,
    growthRate: baseScenario.summary.totalGrowth,
    keyDrivers: baseScenario.keyAssumptions.slice(0, 3).length > 0
      ? baseScenario.keyAssumptions.slice(0, 3)
      : ['Steady new customer acquisition', 'Stable retention rates', 'Incremental upsells'],
  });
  
  if (consScenario) {
    scenarios.push({
      name: 'Conservative',
      description: consScenario.reasoning || 'Headwinds from market or execution challenges',
      probability: 0.25,
      endMrr: consScenario.summary.endingMrr,
      growthRate: consScenario.summary.totalGrowth,
      keyDrivers: consScenario.keyAssumptions.slice(0, 3).length > 0
        ? consScenario.keyAssumptions.slice(0, 3)
        : ['Increased competition', 'Economic headwinds', 'Slower sales cycles'],
    });
  }
  
  // Generate insights from AI analysis
  const insights: ComponentForecastInsight[] = [];
  
  // Add insights from risks
  for (const risk of baseCase.risks.slice(0, 2)) {
    insights.push({
      type: 'risk',
      title: extractTitle(risk),
      description: risk,
      impact: 'negative',
      confidence: 0.8,
    });
  }
  
  // Add insights from opportunities
  for (const opportunity of baseCase.opportunities.slice(0, 2)) {
    insights.push({
      type: 'opportunity',
      title: extractTitle(opportunity),
      description: opportunity,
      impact: 'positive',
      confidence: 0.75,
    });
  }
  
  // Add plan insights as trends
  for (const planInsight of planInsights.slice(0, 2)) {
    insights.push({
      type: 'trend',
      title: `${planInsight.planName} Analysis`,
      description: `${planInsight.insight} ${planInsight.recommendation}`,
      impact: planInsight.insight.includes('risk') || planInsight.insight.includes('higher churn') 
        ? 'negative' 
        : planInsight.insight.includes('growing') || planInsight.insight.includes('momentum')
          ? 'positive'
          : 'neutral',
      confidence: 0.85,
    });
  }
  
  // Calculate model accuracy from confidence score
  const modelAccuracy = Math.min(0.95, Math.max(0.6, baseCase.summary.confidenceScore));
  
  return {
    dataPoints,
    scenarios,
    insights,
    summary: {
      currentMrr: baseCase.summary.startingMrr,
      projectedMrr: baseCase.summary.endingMrr,
      projectedGrowth: baseCase.summary.totalGrowth,
      confidenceInterval: {
        low: comparison.mrrSpread.min,
        high: comparison.mrrSpread.max,
      },
      forecastHorizon: daysAhead,
      modelAccuracy,
    },
    generatedAt,
  };
}

function extractTitle(text: string): string {
  // Extract first ~40 chars as title, cutting at word boundary
  const words = text.split(' ');
  let title = '';
  for (const word of words) {
    if (title.length + word.length > 40) break;
    title += (title ? ' ' : '') + word;
  }
  return title || text.slice(0, 40);
}

/**
 * GET /api/forecast
 * 
 * Query params:
 * - mode: 'ai' | 'classic' | 'enhanced-raw' | 'quick' (default: 'ai')
 *   - 'ai': Uses enhanced AI forecast, transformed to component format (recommended)
 *   - 'classic': Original statistical forecast (deprecated)
 *   - 'enhanced-raw': Raw enhanced forecast format
 *   - 'quick': Quick forecast with plan breakdown
 * - months: number (for enhanced modes, default: 3)
 * - days: number (for forecast horizon, default: 90)
 */
export async function GET(request: Request) {
  let organizationId: string | undefined;
  
  try {
    const auth = await requireAuthWithOrg();
    organizationId = auth.organizationId;
    
    // Parse query params
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'ai';
    const months = parseInt(searchParams.get('months') || '3', 10);
    const days = parseInt(searchParams.get('days') || '90', 10);
    
    // Validate parameters
    const validMonths = Math.min(Math.max(months, 1), 12);
    const validDays = Math.min(Math.max(days, 30), 180);
    
    if (mode === 'classic') {
      // Original statistical forecast method (deprecated, kept for backwards compat)
      const forecast = await getForecast(organizationId, validDays);
      return NextResponse.json(forecast);
    }
    
    if (mode === 'quick') {
      // Quick forecast with plan breakdown
      const forecast = await getQuickForecast(organizationId, validMonths);
      return NextResponse.json(forecast);
    }
    
    if (mode === 'enhanced-raw') {
      // Raw enhanced AI forecast format (for advanced use)
      const forecast = await generateEnhancedForecast(organizationId, {
        monthsAhead: validMonths,
      });
      return NextResponse.json(forecast);
    }
    
    // Default: AI-powered forecast with component-friendly format
    // This uses the full GPT-4o enhanced forecast system and transforms
    // it to the format expected by the RevenueForecast component
    const enhancedForecast = await generateEnhancedForecast(organizationId, {
      monthsAhead: validMonths,
    });
    
    const componentForecast = await transformEnhancedForecast(
      enhancedForecast,
      organizationId,
      validDays
    );
    
    return NextResponse.json(componentForecast);
  } catch (error) {
    console.error('Forecast generation error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('Unauthorized')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message.includes('Insufficient data')) {
        return NextResponse.json({ 
          error: error.message,
          dataPoints: [],
          scenarios: [],
          insights: [],
          summary: null,
        }, { status: 200 }); // Return empty result, not error
      }
      if (error.message.includes('OPENAI_API_KEY') && organizationId) {
        // Fallback to classic mode if OpenAI is not configured
        console.warn('OpenAI not configured, falling back to statistical forecast');
        try {
          const fallbackForecast = await getForecast(organizationId, 90);
          return NextResponse.json(fallbackForecast);
        } catch (fallbackError) {
          console.error('Fallback forecast also failed:', fallbackError);
        }
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to generate forecast' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/forecast
 * 
 * Generate custom scenario forecasts with what-if analysis
 * 
 * Body:
 * {
 *   "type": "scenarios" | "priceChange",
 *   "monthsAhead": number,
 *   "scenarios"?: ForecastScenarioInput[], // for type: scenarios
 *   "priceChanges"?: PriceChangeScenario[] // for type: priceChange
 * }
 */
export async function POST(request: Request) {
  try {
    const { organizationId } = await requireAuthWithOrg();
    
    const body = await request.json();
    const { type, monthsAhead = 6, scenarios, priceChanges } = body;
    
    const validMonths = Math.min(Math.max(monthsAhead, 1), 12);
    
    if (type === 'priceChange' && priceChanges && Array.isArray(priceChanges)) {
      // Price change what-if analysis
      const validatedPriceChanges: PriceChangeScenario[] = priceChanges.map((pc: PriceChangeScenario) => ({
        planName: pc.planName,
        currentPrice: pc.currentPrice,
        newPrice: pc.newPrice,
        effectiveDate: pc.effectiveDate,
        applyToExisting: pc.applyToExisting ?? false,
      }));
      
      const forecast = await forecastPriceChange(organizationId, validatedPriceChanges, validMonths);
      return NextResponse.json(forecast);
    }
    
    if (type === 'scenarios' && scenarios && Array.isArray(scenarios)) {
      // Custom scenario analysis
      const validatedScenarios: ForecastScenarioInput[] = scenarios.map((s: ForecastScenarioInput) => ({
        name: s.name,
        description: s.description,
        priceChanges: s.priceChanges,
        growthAssumptions: s.growthAssumptions,
        churnReduction: s.churnReduction,
      }));
      
      const forecast = await generateEnhancedForecast(organizationId, {
        monthsAhead: validMonths,
        scenarios: validatedScenarios,
      });
      return NextResponse.json(forecast);
    }
    
    // Default: generate enhanced forecast
    const forecast = await generateEnhancedForecast(organizationId, {
      monthsAhead: validMonths,
      scenarios: scenarios,
    });
    return NextResponse.json(forecast);
    
  } catch (error) {
    console.error('Forecast scenario error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('Unauthorized')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message.includes('Insufficient data')) {
        return NextResponse.json({ 
          error: error.message,
        }, { status: 400 });
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to generate forecast scenario' },
      { status: 500 }
    );
  }
}

