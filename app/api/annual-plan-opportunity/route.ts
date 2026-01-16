import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { requireAuthWithOrg } = await import('@/lib/supabase/auth-helpers');
    const { analyzeAnnualPlanOpportunity, getAnnualPlanOpportunityQuickStats } = await import('@/lib/ai/annual-plan-opportunity');
    
    const { organizationId } = await requireAuthWithOrg();

    // Check if quick stats only requested
    const { searchParams } = new URL(request.url);
    const quickStats = searchParams.get('quick') === 'true';
    const discountParam = searchParams.get('discount');
    const annualDiscount = discountParam ? parseInt(discountParam, 10) : undefined;

    if (quickStats) {
      const stats = await getAnnualPlanOpportunityQuickStats(organizationId);
      return NextResponse.json({ success: true, data: stats });
    }

    // Full analysis
    const report = await analyzeAnnualPlanOpportunity(organizationId, annualDiscount);
    
    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Annual plan opportunity analysis failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Analysis failed' 
      },
      { status: 500 }
    );
  }
}

