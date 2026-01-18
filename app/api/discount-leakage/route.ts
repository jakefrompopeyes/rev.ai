import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { requireAuthWithOrg } = await import('@/lib/supabase/auth-helpers');
    const { analyzeDiscountLeakage, getDiscountLeakageQuickStats } = await import('@/lib/ai/discount-leakage');
    
    const { organizationId } = await requireAuthWithOrg();

    // Check if quick stats only requested
    const { searchParams } = new URL(request.url);
    const quickStats = searchParams.get('quick') === 'true';
    const strict = searchParams.get('strict') !== 'false';

    if (quickStats) {
      const stats = await getDiscountLeakageQuickStats(organizationId);
      return NextResponse.json({ success: true, data: stats });
    }

    // Full analysis
    const report = await analyzeDiscountLeakage(organizationId, { strict });
    
    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Discount leakage analysis failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Analysis failed' 
      },
      { status: 500 }
    );
  }
}
