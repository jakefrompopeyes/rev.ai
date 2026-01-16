import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { requireAuthWithOrg } = await import('@/lib/supabase/auth-helpers');
    const { analyzePriceIncreaseSafety, getPriceIncreaseSafetyQuickStats } = await import('@/lib/ai/price-increase-safety');
    
    const { organizationId } = await requireAuthWithOrg();

    // Check if quick stats only requested
    const { searchParams } = new URL(request.url);
    const quickStats = searchParams.get('mode') === 'quick';

    if (quickStats) {
      const stats = await getPriceIncreaseSafetyQuickStats(organizationId);
      return NextResponse.json({ success: true, data: stats });
    }

    // Full analysis
    const report = await analyzePriceIncreaseSafety(organizationId);
    
    // Serialize dates for JSON response
    const serializedReport = {
      summary: {
        ...report.summary,
        analyzedFrom: report.summary.analyzedFrom.toISOString(),
        analyzedTo: report.summary.analyzedTo.toISOString(),
      },
      planSafety: report.planSafety.map(plan => ({
        ...plan,
        priceIncreases: plan.priceIncreases.map(pi => ({
          ...pi,
          date: pi.date.toISOString(),
        })),
      })),
      segmentSensitivity: report.segmentSensitivity,
      priceIncreaseEvents: report.priceIncreaseEvents.map(event => ({
        ...event,
        occurredAt: event.occurredAt.toISOString(),
      })),
      aiNarrative: report.aiNarrative,
      aiRecommendations: report.aiRecommendations,
      generatedAt: report.generatedAt.toISOString(),
    };
    
    return NextResponse.json({
      success: true,
      data: serializedReport,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Price increase safety analysis failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Analysis failed' 
      },
      { status: 500 }
    );
  }
}
