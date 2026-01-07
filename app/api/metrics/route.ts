import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithOrg } from '@/lib/supabase/auth-helpers';
import { getCurrentMetricsSnapshot, getMetricsHistory } from '@/lib/metrics/compute';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
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

