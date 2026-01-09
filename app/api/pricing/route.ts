import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/pricing
 * Get complete pricing analysis for the organization
 */
export async function GET(req: NextRequest) {
  try {
    const { requireAuthWithOrg } = await import('@/lib/supabase/auth-helpers');
    const {
      runPricingAnalysis,
      analyzePlanPerformance,
      analyzePriceElasticity,
      analyzeCustomerPricingSegments,
      generatePricingRecommendations,
    } = await import('@/lib/ai/pricing-optimizer');

    const { organizationId } = await requireAuthWithOrg();

    // Check what type of analysis is requested
    const { searchParams } = new URL(req.url);
    const analysisType = searchParams.get('type') || 'full';

    switch (analysisType) {
      case 'plans':
        const plans = await analyzePlanPerformance(organizationId);
        return NextResponse.json({ plans });

      case 'elasticity':
        const elasticity = await analyzePriceElasticity(organizationId);
        return NextResponse.json({ elasticity });

      case 'segments':
        const segments = await analyzeCustomerPricingSegments(organizationId);
        return NextResponse.json({ segments });

      case 'recommendations':
        const recommendations = await generatePricingRecommendations(organizationId);
        return NextResponse.json({ recommendations });

      case 'full':
      default:
        const analysis = await runPricingAnalysis(organizationId);
        return NextResponse.json(analysis);
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Pricing analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze pricing' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/pricing
 * Simulate a price change
 */
export async function POST(req: NextRequest) {
  try {
    const { requireAuthWithOrg } = await import('@/lib/supabase/auth-helpers');
    const { simulatePriceChange } = await import('@/lib/ai/pricing-optimizer');

    const { organizationId } = await requireAuthWithOrg();

    const body = await req.json();
    const { planId, newPrice } = body;

    if (!planId || typeof newPrice !== 'number') {
      return NextResponse.json(
        { error: 'planId and newPrice are required' },
        { status: 400 }
      );
    }

    const simulation = await simulatePriceChange(
      organizationId,
      planId,
      newPrice
    );

    return NextResponse.json(simulation);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Price simulation error:', error);
    return NextResponse.json(
      { error: 'Failed to simulate price change' },
      { status: 500 }
    );
  }
}
