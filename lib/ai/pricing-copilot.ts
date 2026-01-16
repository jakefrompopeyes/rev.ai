import { prisma } from '@/lib/db';
import { OpenAI } from 'openai';
import { 
  runPricingAnalysis, 
  PricingAnalysis,
  PlanPerformance,
  SegmentPricingInsight 
} from './pricing-optimizer';

// Lazy load OpenAI client
function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

// ============================================================================
// TYPES
// ============================================================================

export interface PricingCopilotMessage {
  role: 'user' | 'assistant';
  content: string;
  data?: Record<string, unknown>;
  suggestions?: string[];
}

export interface OptimalPriceResult {
  planId: string;
  planName: string;
  currentPrice: number;
  optimalPrice: number;
  optimalRange: { min: number; max: number };
  confidence: number;
  methodology: string;
  factors: Array<{
    factor: string;
    impact: 'positive' | 'negative' | 'neutral';
    weight: number;
    explanation: string;
  }>;
  projectedOutcome: {
    revenueChange: number;
    churnChange: number;
    netImpact: number;
  };
}

export interface PricingExperiment {
  id: string;
  name: string;
  hypothesis: string;
  targetPlan: string;
  controlPrice: number;
  variants: Array<{
    name: string;
    price: number;
    expectedConversionChange: number;
    expectedChurnChange: number;
  }>;
  sampleSize: number;
  duration: string;
  expectedLift: number;
  confidence: number;
  priority: number;
  risks: string[];
  successMetrics: string[];
}

export interface PricingNarrative {
  headline: string;
  summary: string;
  healthScore: number;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
  keyInsights: Array<{
    insight: string;
    importance: 'critical' | 'high' | 'medium' | 'low';
    actionRequired: boolean;
  }>;
  executiveSummary: string;
}

export interface CustomerWTPScore {
  segment: string;
  currentAvgPrice: number;
  estimatedWTP: number;
  wtpRange: { min: number; max: number };
  priceGap: number; // Difference between WTP and current price
  captureOpportunity: number; // Revenue opportunity from closing gap
  confidence: number;
  signals: Array<{
    signal: string;
    strength: 'strong' | 'moderate' | 'weak';
    direction: 'higher_wtp' | 'lower_wtp';
  }>;
}

// ============================================================================
// AI PRICING COPILOT - CHAT INTERFACE
// ============================================================================

/**
 * Process a natural language question about pricing
 */
export async function askPricingCopilot(
  organizationId: string,
  question: string,
  conversationHistory: PricingCopilotMessage[] = []
): Promise<PricingCopilotMessage> {
  const openai = getOpenAIClient();

  // Fetch current pricing data for context
  const analysis = await runPricingAnalysis(organizationId);
  
  // Build context from current data
  const dataContext = buildDataContext(analysis);

  const systemPrompt = `You are an expert SaaS pricing strategist and analyst for a revenue intelligence platform called discovred. You help companies optimize their subscription pricing to maximize revenue while maintaining healthy customer relationships.

You have access to the following real-time pricing data for this company:

${dataContext}

Guidelines:
1. Be specific and quantitative - always reference actual numbers from the data
2. Provide actionable recommendations, not just observations
3. Consider both revenue optimization AND customer retention
4. Explain your reasoning in plain English
5. When suggesting price changes, always include risk assessment
6. Reference industry benchmarks when relevant (SaaS average churn: 5-7%, healthy NRR: 100-120%)
7. Be concise but thorough - executives are busy
8. If asked about something not in the data, say so honestly

When making recommendations:
- Conservative estimates (assume 30-50% of projected impact)
- Consider implementation complexity
- Account for customer communication needs
- Think about competitive positioning`;

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: question },
  ];

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages,
    temperature: 0.4,
    max_tokens: 1500,
  });

  const content = response.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response.';

  // Generate follow-up suggestions
  const suggestions = await generateFollowUpSuggestions(question, content, analysis);

  return {
    role: 'assistant',
    content,
    suggestions,
  };
}

function buildDataContext(analysis: PricingAnalysis): string {
  const { summary, planPerformance, segmentInsights, recommendations } = analysis;

  let context = `=== PRICING SUMMARY ===
Total MRR: $${(summary.totalMRR / 100).toLocaleString()}
Average ARPU: $${(summary.avgARPU / 100).toFixed(0)}/month
Price Range: $${(summary.priceSpread.min / 100).toFixed(0)} - $${(summary.priceSpread.max / 100).toFixed(0)}
Pricing Power: ${summary.pricingPower}
Top Plan: ${summary.dominantPlan}
${summary.underperformingPlans.length > 0 ? `Underperforming Plans: ${summary.underperformingPlans.join(', ')}` : ''}

=== PLAN PERFORMANCE ===
`;

  for (const plan of planPerformance.slice(0, 6)) {
    context += `
${plan.planName} ($${(plan.pricePerMonth / 100).toFixed(0)}/mo):
  - Score: ${plan.performanceScore.toFixed(0)}/100
  - Active: ${plan.activeSubscriptions} subscriptions
  - MRR Share: ${plan.mrrShare.toFixed(1)}%
  - Churn: ${plan.churnRate.toFixed(1)}%
  - LTV: $${(plan.ltv / 100).toFixed(0)}
  - 90-day Retention: ${plan.retentionAt90Days.toFixed(0)}%
  - Upgrade Rate: ${plan.upgradeRate.toFixed(1)}%
  - Discount Usage: ${plan.discountFrequency.toFixed(0)}% of customers
`;
  }

  context += `\n=== CUSTOMER SEGMENTS ===\n`;
  for (const segment of segmentInsights.slice(0, 5)) {
    context += `
${segment.segment} (${segment.size} customers):
  - Avg Price: $${(segment.avgPrice / 100).toFixed(0)}/mo
  - Willingness to Pay: $${(segment.willingnessToPay / 100).toFixed(0)}/mo
  - Churn Sensitivity: ${segment.churnSensitivity}
`;
  }

  if (recommendations.length > 0) {
    context += `\n=== TOP RECOMMENDATIONS ===\n`;
    for (const rec of recommendations.slice(0, 3)) {
      context += `
- ${rec.type}: ${rec.planName}
  ${rec.reasoning}
  Impact: ${rec.estimatedImpact.mrrChange > 0 ? '+' : ''}$${(rec.estimatedImpact.mrrChange / 100).toFixed(0)}/mo (${rec.estimatedImpact.churnRisk} risk)
`;
    }
  }

  return context;
}

async function generateFollowUpSuggestions(
  question: string,
  answer: string,
  analysis: PricingAnalysis
): Promise<string[]> {
  // Smart suggestions based on context
  const suggestions: string[] = [];

  if (question.toLowerCase().includes('price') || question.toLowerCase().includes('increase')) {
    suggestions.push('What would happen if I raised prices by 15%?');
    suggestions.push('Which customer segment is least price sensitive?');
  }

  if (question.toLowerCase().includes('churn')) {
    suggestions.push('How do discounts affect churn rates?');
    suggestions.push('What price point minimizes churn?');
  }

  if (analysis.summary.underperformingPlans.length > 0) {
    suggestions.push(`Why is ${analysis.summary.underperformingPlans[0]} underperforming?`);
  }

  if (analysis.summary.pricingPower === 'STRONG') {
    suggestions.push('How much room do I have to raise prices?');
  }

  // Default suggestions
  if (suggestions.length < 3) {
    suggestions.push('What\'s my optimal pricing strategy?');
    suggestions.push('Design a pricing experiment for me');
    suggestions.push('Summarize my pricing health');
  }

  return suggestions.slice(0, 4);
}

// ============================================================================
// AI OPTIMAL PRICE PREDICTION
// ============================================================================

/**
 * Use AI to predict optimal price for each plan
 */
export async function predictOptimalPrices(
  organizationId: string
): Promise<OptimalPriceResult[]> {
  const openai = getOpenAIClient();
  const analysis = await runPricingAnalysis(organizationId);
  const results: OptimalPriceResult[] = [];

  for (const plan of analysis.planPerformance) {
    // Find relevant segment data
    const relevantSegments = analysis.segmentInsights.filter(s => 
      s.avgPrice >= plan.pricePerMonth * 0.7 && 
      s.avgPrice <= plan.pricePerMonth * 1.3
    );

    const prompt = `Analyze this SaaS pricing plan and predict the optimal price point.

PLAN DATA:
- Name: ${plan.planName}
- Current Price: $${(plan.pricePerMonth / 100).toFixed(2)}/month
- Active Subscriptions: ${plan.activeSubscriptions}
- MRR: $${(plan.mrr / 100).toFixed(0)}
- Churn Rate: ${plan.churnRate.toFixed(2)}%
- 30-day Retention: ${plan.retentionAt30Days.toFixed(1)}%
- 90-day Retention: ${plan.retentionAt90Days.toFixed(1)}%
- LTV: $${(plan.ltv / 100).toFixed(0)}
- Upgrade Rate: ${plan.upgradeRate.toFixed(1)}%
- Downgrade Rate: ${plan.downgradeRate.toFixed(1)}%
- Discount Usage: ${plan.discountFrequency.toFixed(1)}% of customers use discounts
- Avg Discount: ${plan.avgDiscountPercent.toFixed(1)}%
- Performance Score: ${plan.performanceScore.toFixed(0)}/100

SEGMENT INSIGHTS:
${relevantSegments.map(s => `- ${s.segment}: ${s.size} customers, WTP $${(s.willingnessToPay / 100).toFixed(0)}, sensitivity: ${s.churnSensitivity}`).join('\n')}

MARKET CONTEXT:
- Total Company MRR: $${(analysis.summary.totalMRR / 100).toLocaleString()}
- Price Range in Portfolio: $${(analysis.summary.priceSpread.min / 100).toFixed(0)} - $${(analysis.summary.priceSpread.max / 100).toFixed(0)}
- Company Pricing Power: ${analysis.summary.pricingPower}

Using pricing optimization principles, predict the optimal price. Consider:
1. Price elasticity (how volume changes with price)
2. Customer willingness to pay signals
3. Retention and churn patterns
4. Competitive positioning within the portfolio
5. Revenue maximization vs. market share tradeoffs

Return JSON:
{
  "optimalPriceCents": number,
  "optimalRangeMin": number,
  "optimalRangeMax": number,
  "confidence": number (0.4-0.9),
  "methodology": string (explain your approach),
  "factors": [
    {
      "factor": string,
      "impact": "positive" | "negative" | "neutral",
      "weight": number (0-1),
      "explanation": string
    }
  ],
  "projectedRevenueChangePct": number,
  "projectedChurnChangePct": number
}`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a pricing optimization AI. Analyze SaaS pricing data and predict optimal prices. Be conservative - pricing changes have real business impact. Return only valid JSON.',
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        
        results.push({
          planId: plan.planId,
          planName: plan.planName,
          currentPrice: plan.pricePerMonth,
          optimalPrice: parsed.optimalPriceCents,
          optimalRange: {
            min: parsed.optimalRangeMin,
            max: parsed.optimalRangeMax,
          },
          confidence: parsed.confidence,
          methodology: parsed.methodology,
          factors: parsed.factors || [],
          projectedOutcome: {
            revenueChange: Math.round(plan.mrr * (parsed.projectedRevenueChangePct / 100)),
            churnChange: parsed.projectedChurnChangePct,
            netImpact: Math.round(
              plan.mrr * (parsed.projectedRevenueChangePct / 100) * (1 - Math.abs(parsed.projectedChurnChangePct) / 100)
            ),
          },
        });
      }
    } catch (error) {
      console.error(`Failed to predict optimal price for ${plan.planName}:`, error);
    }
  }

  return results.sort((a, b) => {
    // Sort by potential impact
    const aImpact = Math.abs(a.optimalPrice - a.currentPrice) / a.currentPrice;
    const bImpact = Math.abs(b.optimalPrice - b.currentPrice) / b.currentPrice;
    return bImpact - aImpact;
  });
}

// ============================================================================
// AI EXPERIMENT DESIGNER
// ============================================================================

/**
 * AI designs pricing experiments
 */
export async function designPricingExperiments(
  organizationId: string
): Promise<PricingExperiment[]> {
  const openai = getOpenAIClient();
  const analysis = await runPricingAnalysis(organizationId);
  const optimalPrices = await predictOptimalPrices(organizationId);

  const prompt = `Design 3-4 pricing experiments based on this data.

CURRENT PRICING ANALYSIS:
${analysis.planPerformance.map(p => `- ${p.planName}: $${(p.pricePerMonth / 100).toFixed(0)}/mo, ${p.activeSubscriptions} active, ${p.churnRate.toFixed(1)}% churn, score ${p.performanceScore.toFixed(0)}/100`).join('\n')}

AI OPTIMAL PRICE PREDICTIONS:
${optimalPrices.map(p => `- ${p.planName}: Current $${(p.currentPrice / 100).toFixed(0)} → Optimal $${(p.optimalPrice / 100).toFixed(0)} (${p.confidence * 100}% confidence)`).join('\n')}

SEGMENTS:
${analysis.segmentInsights.map(s => `- ${s.segment}: ${s.size} customers, ${s.churnSensitivity} price sensitivity`).join('\n')}

Design experiments that:
1. Test high-value hypotheses first
2. Are statistically valid (adequate sample size)
3. Have clear success metrics
4. Consider business risks
5. Can be run in parallel where possible

Return JSON array of experiments:
{
  "experiments": [
    {
      "name": string,
      "hypothesis": string,
      "targetPlan": string,
      "controlPriceCents": number,
      "variants": [
        {
          "name": string,
          "priceCents": number,
          "expectedConversionChange": number (percent),
          "expectedChurnChange": number (percent)
        }
      ],
      "sampleSize": number,
      "durationWeeks": number,
      "expectedLiftPct": number,
      "confidence": number (0.5-0.9),
      "priority": number (1-10, 10 = highest),
      "risks": [string],
      "successMetrics": [string]
    }
  ]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a pricing experimentation expert. Design statistically valid A/B tests for pricing. Be practical - consider implementation effort and business risk. Return only valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.4,
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      const experiments = parsed.experiments || [];
      
      return experiments.map((exp: {
        name: string;
        hypothesis: string;
        targetPlan: string;
        controlPriceCents: number;
        variants: Array<{
          name: string;
          priceCents: number;
          expectedConversionChange: number;
          expectedChurnChange: number;
        }>;
        sampleSize: number;
        durationWeeks: number;
        expectedLiftPct: number;
        confidence: number;
        priority: number;
        risks: string[];
        successMetrics: string[];
      }, index: number) => ({
        id: `exp-${Date.now()}-${index}`,
        name: exp.name,
        hypothesis: exp.hypothesis,
        targetPlan: exp.targetPlan,
        controlPrice: exp.controlPriceCents,
        variants: exp.variants.map((v: { name: string; priceCents: number; expectedConversionChange: number; expectedChurnChange: number }) => ({
          name: v.name,
          price: v.priceCents,
          expectedConversionChange: v.expectedConversionChange,
          expectedChurnChange: v.expectedChurnChange,
        })),
        sampleSize: exp.sampleSize,
        duration: `${exp.durationWeeks} weeks`,
        expectedLift: exp.expectedLiftPct,
        confidence: exp.confidence,
        priority: exp.priority,
        risks: exp.risks,
        successMetrics: exp.successMetrics,
      })).sort((a: PricingExperiment, b: PricingExperiment) => b.priority - a.priority);
    }
  } catch (error) {
    console.error('Failed to design experiments:', error);
  }

  return [];
}

// ============================================================================
// AI PRICING NARRATIVE
// ============================================================================

/**
 * Generate a comprehensive AI narrative about pricing health
 */
export async function generatePricingNarrative(
  organizationId: string
): Promise<PricingNarrative> {
  const openai = getOpenAIClient();
  const analysis = await runPricingAnalysis(organizationId);
  const dataContext = buildDataContext(analysis);

  const prompt = `Generate a comprehensive pricing health narrative for this SaaS company.

${dataContext}

Create an executive-level assessment that includes:
1. A compelling headline summarizing the pricing situation
2. A 2-3 sentence summary
3. SWOT analysis (strengths, weaknesses, opportunities, threats)
4. Key insights ranked by importance
5. An executive summary paragraph

Be specific, quantitative, and actionable. This will be read by the CEO/CFO.

Return JSON:
{
  "headline": string (max 80 chars, impactful),
  "summary": string (2-3 sentences),
  "healthScore": number (0-100),
  "strengths": [string] (2-4 items),
  "weaknesses": [string] (2-4 items),
  "opportunities": [string] (2-4 items),
  "threats": [string] (2-4 items),
  "keyInsights": [
    {
      "insight": string,
      "importance": "critical" | "high" | "medium" | "low",
      "actionRequired": boolean
    }
  ],
  "executiveSummary": string (one paragraph, executive-level)
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a SaaS pricing consultant presenting to executives. Be direct, quantitative, and strategic. Avoid fluff - every sentence should add value. Return only valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.4,
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('Failed to generate narrative:', error);
  }

  // Fallback narrative
  return {
    headline: 'Pricing Analysis Complete',
    summary: `Your pricing portfolio has ${analysis.planPerformance.length} plans generating $${(analysis.summary.totalMRR / 100).toLocaleString()} MRR.`,
    healthScore: Math.round(
      analysis.planPerformance.reduce((sum, p) => sum + p.performanceScore, 0) / 
      analysis.planPerformance.length
    ),
    strengths: ['Data analysis complete'],
    weaknesses: ['Unable to generate AI insights'],
    opportunities: ['Review recommendations tab'],
    threats: ['Manual analysis required'],
    keyInsights: [],
    executiveSummary: 'Please review the detailed analysis in the dashboard.',
  };
}

// ============================================================================
// CUSTOMER WILLINGNESS-TO-PAY SCORING
// ============================================================================

/**
 * Score customer segments by willingness to pay
 */
export async function scoreCustomerWTP(
  organizationId: string
): Promise<CustomerWTPScore[]> {
  const openai = getOpenAIClient();
  const analysis = await runPricingAnalysis(organizationId);
  const scores: CustomerWTPScore[] = [];

  for (const segment of analysis.segmentInsights) {
    const prompt = `Analyze this customer segment's willingness to pay (WTP).

SEGMENT: ${segment.segment}
Description: ${segment.description}
Size: ${segment.size} customers
Current Avg Price: $${(segment.avgPrice / 100).toFixed(0)}/month
Price Range: $${(segment.priceRangeAccepted.min / 100).toFixed(0)} - $${(segment.priceRangeAccepted.max / 100).toFixed(0)}
Churn Sensitivity: ${segment.churnSensitivity}
Initial WTP Estimate: $${(segment.willingnessToPay / 100).toFixed(0)}/month

COMPANY CONTEXT:
- Pricing Power: ${analysis.summary.pricingPower}
- Avg ARPU: $${(analysis.summary.avgARPU / 100).toFixed(0)}

Analyze the signals that indicate this segment's true willingness to pay. Consider:
1. Their current price point vs. company average
2. Churn sensitivity level
3. Behavior patterns (discounts, upgrades, etc.)
4. Segment characteristics

Return JSON:
{
  "estimatedWTPCents": number,
  "wtpRangeMin": number,
  "wtpRangeMax": number,
  "confidence": number (0.5-0.9),
  "signals": [
    {
      "signal": string,
      "strength": "strong" | "moderate" | "weak",
      "direction": "higher_wtp" | "lower_wtp"
    }
  ]
}`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a pricing analyst specializing in customer willingness-to-pay analysis. Be analytical and evidence-based. Return only valid JSON.',
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        const priceGap = parsed.estimatedWTPCents - segment.avgPrice;
        
        scores.push({
          segment: segment.segment,
          currentAvgPrice: segment.avgPrice,
          estimatedWTP: parsed.estimatedWTPCents,
          wtpRange: {
            min: parsed.wtpRangeMin,
            max: parsed.wtpRangeMax,
          },
          priceGap,
          captureOpportunity: priceGap > 0 ? Math.round(priceGap * segment.size * 0.5) : 0, // 50% capture rate
          confidence: parsed.confidence,
          signals: parsed.signals,
        });
      }
    } catch (error) {
      console.error(`Failed to score WTP for ${segment.segment}:`, error);
    }
  }

  return scores.sort((a, b) => b.captureOpportunity - a.captureOpportunity);
}

// ============================================================================
// COMPREHENSIVE AI PRICING ANALYSIS
// ============================================================================

export interface AIPricingAnalysis {
  narrative: PricingNarrative;
  optimalPrices: OptimalPriceResult[];
  experiments: PricingExperiment[];
  wtpScores: CustomerWTPScore[];
  totalOpportunity: number;
  topRecommendation: string;
}

/**
 * Run complete AI-powered pricing analysis
 */
export async function runAIPricingAnalysis(
  organizationId: string
): Promise<AIPricingAnalysis> {
  // Run all AI analyses in parallel
  const [narrative, optimalPrices, experiments, wtpScores] = await Promise.all([
    generatePricingNarrative(organizationId),
    predictOptimalPrices(organizationId),
    designPricingExperiments(organizationId),
    scoreCustomerWTP(organizationId),
  ]);

  // Calculate total opportunity
  const priceOptimizationOpportunity = optimalPrices.reduce(
    (sum, p) => sum + Math.max(0, p.projectedOutcome.netImpact),
    0
  );
  const wtpCaptureOpportunity = wtpScores.reduce(
    (sum, s) => sum + s.captureOpportunity,
    0
  );
  const totalOpportunity = priceOptimizationOpportunity + wtpCaptureOpportunity;

  // Generate top recommendation
  let topRecommendation = 'Review the AI analysis for pricing opportunities.';
  
  if (optimalPrices.length > 0 && optimalPrices[0].optimalPrice !== optimalPrices[0].currentPrice) {
    const top = optimalPrices[0];
    const direction = top.optimalPrice > top.currentPrice ? 'increase' : 'decrease';
    const percent = Math.abs((top.optimalPrice - top.currentPrice) / top.currentPrice * 100);
    topRecommendation = `Consider a ${percent.toFixed(0)}% price ${direction} on ${top.planName} - projected ${top.projectedOutcome.netImpact > 0 ? '+' : ''}$${(top.projectedOutcome.netImpact / 100).toFixed(0)}/mo impact.`;
  }

  return {
    narrative,
    optimalPrices,
    experiments,
    wtpScores,
    totalOpportunity,
    topRecommendation,
  };
}

