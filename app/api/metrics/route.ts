import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { requireAuthWithOrg } = await import('@/lib/supabase/auth-helpers');
    const { getCurrentMetricsSnapshot, getMetricsHistory } = await import('@/lib/metrics/compute');
    
    const { organizationId } = await requireAuthWithOrg();

    const searchParams = request.nextUrl.searchParams;
    const view = searchParams.get('view') || 'snapshot';
    const days = parseInt(searchParams.get('days') || '30');

    if (view === 'history') {
      const history = await getMetricsHistory(organizationId, days);
      return NextResponse.json({ history });
    }

    const snapshot = await getCurrentMetricsSnapshot(organizationId);
    return NextResponse.json(snapshot);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Metrics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}

