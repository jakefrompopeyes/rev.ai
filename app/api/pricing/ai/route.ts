import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/pricing/ai
 * Get comprehensive AI pricing analysis
 */
export async function GET(req: NextRequest) {
  try {
    const { requireAuthWithOrg } = await import('@/lib/supabase/auth-helpers');
    const { 
      runAIPricingAnalysis,
      predictOptimalPrices,
      designPricingExperiments,
      generatePricingNarrative,
      scoreCustomerWTP,
    } = await import('@/lib/ai/pricing-copilot');

    const { organizationId } = await requireAuthWithOrg();

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'full';

    switch (type) {
      case 'optimal-prices':
        const prices = await predictOptimalPrices(organizationId);
        return NextResponse.json({ optimalPrices: prices });

      case 'experiments':
        const experiments = await designPricingExperiments(organizationId);
        return NextResponse.json({ experiments });

      case 'narrative':
        const narrative = await generatePricingNarrative(organizationId);
        return NextResponse.json({ narrative });

      case 'wtp':
        const wtpScores = await scoreCustomerWTP(organizationId);
        return NextResponse.json({ wtpScores });

      case 'full':
      default:
        const analysis = await runAIPricingAnalysis(organizationId);
        return NextResponse.json(analysis);
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'OpenAI API key not configured') {
      return NextResponse.json({ error: 'AI features require OpenAI API key' }, { status: 503 });
    }
    console.error('AI pricing analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to run AI pricing analysis' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/pricing/ai
 * Chat with the pricing copilot
 */
export async function POST(req: NextRequest) {
  try {
    const { requireAuthWithOrg } = await import('@/lib/supabase/auth-helpers');
    const { askPricingCopilot } = await import('@/lib/ai/pricing-copilot');

    const { organizationId } = await requireAuthWithOrg();

    const body = await req.json();
    const { question, history = [] } = body;

    if (!question || typeof question !== 'string') {
      return NextResponse.json(
        { error: 'Question is required' },
        { status: 400 }
      );
    }

    const response = await askPricingCopilot(organizationId, question, history);
    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message === 'OpenAI API key not configured') {
      return NextResponse.json({ error: 'AI features require OpenAI API key' }, { status: 503 });
    }
    console.error('Pricing copilot error:', error);
    return NextResponse.json(
      { error: 'Failed to process question' },
      { status: 500 }
    );
  }
}

