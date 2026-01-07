import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithOrg } from '@/lib/supabase/auth-helpers';
import { getActiveInsights, dismissInsight } from '@/lib/ai/insights';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { organizationId } = await requireAuthWithOrg();

    const insights = await getActiveInsights(organizationId);
    return NextResponse.json({ insights });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Insights error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch insights' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { organizationId } = await requireAuthWithOrg();

    const body = await request.json();
    const { insightId, action } = body;

    if (!insightId) {
      return NextResponse.json({ error: 'Insight ID required' }, { status: 400 });
    }

    if (action === 'dismiss') {
      await dismissInsight(insightId, organizationId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Insight update error:', error);
    return NextResponse.json(
      { error: 'Failed to update insight' },
      { status: 500 }
    );
  }
}

