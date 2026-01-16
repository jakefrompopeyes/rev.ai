import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const { requireAuthWithOrg } = await import('@/lib/supabase/auth-helpers');
    const { analyzeLegacyPlans } = await import('@/lib/ai/legacy-plan-detection');
    
    const { organizationId } = await requireAuthWithOrg();

    // Analyze legacy plans
    const report = await analyzeLegacyPlans(organizationId);

    // Convert dates to ISO strings for JSON serialization
    const serializedReport = {
      ...report,
      summary: {
        ...report.summary,
        analyzedAt: report.summary.analyzedAt.toISOString(),
      },
      legacyCustomers: report.legacyCustomers.map(c => ({
        ...c,
        customerSince: c.customerSince.toISOString(),
      })),
      generatedAt: report.generatedAt.toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: serializedReport,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    console.error('Legacy plans analysis error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to analyze legacy plans' 
      },
      { status: 500 }
    );
  }
}
