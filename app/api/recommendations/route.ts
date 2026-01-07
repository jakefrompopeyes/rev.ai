import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const { requireAuthWithOrg } = await import('@/lib/supabase/auth-helpers');
    const { getRecommendations } = await import('@/lib/ai/recommendations');
    
    const { organizationId } = await requireAuthWithOrg();
    const recommendations = await getRecommendations(organizationId);
    return NextResponse.json({ recommendations });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Recommendations error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recommendations' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { requireAuthWithOrg } = await import('@/lib/supabase/auth-helpers');
    const { 
      markRecommendationImplemented, 
      dismissRecommendation,
      updateRecommendationResults 
    } = await import('@/lib/ai/recommendations');
    
    const { organizationId } = await requireAuthWithOrg();
    const body = await request.json();
    const { recommendationId, action } = body;

    if (!recommendationId) {
      return NextResponse.json({ error: 'Recommendation ID required' }, { status: 400 });
    }

    switch (action) {
      case 'implement':
        await markRecommendationImplemented(recommendationId, organizationId);
        break;
      case 'dismiss':
        await dismissRecommendation(recommendationId, organizationId);
        break;
      case 'update_results':
        await updateRecommendationResults(recommendationId, organizationId);
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Recommendation update error:', error);
    return NextResponse.json(
      { error: 'Failed to update recommendation' },
      { status: 500 }
    );
  }
}

