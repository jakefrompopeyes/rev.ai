import { NextResponse } from 'next/server';
import { requireAuthWithOrg } from '@/lib/supabase/auth-helpers';
import { syncStripeData } from '@/lib/stripe/sync';
import { computeDailyMetrics } from '@/lib/metrics/compute';
import { generateInsights } from '@/lib/ai/insights';
import { generateRecommendations } from '@/lib/ai/recommendations';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const { organizationId } = await requireAuthWithOrg();

    // Step 1: Sync Stripe data
    const syncResult = await syncStripeData(organizationId);

    // Step 2: Compute metrics
    const metrics = await computeDailyMetrics(organizationId);

    // Step 3: Generate insights
    const insights = await generateInsights(organizationId);

    // Step 4: Generate recommendations
    const recommendations = await generateRecommendations(organizationId);

    return NextResponse.json({
      success: true,
      sync: syncResult,
      metrics: {
        mrr: metrics.mrr,
        activeSubscriptions: metrics.activeSubscriptions,
      },
      insightsGenerated: insights.length,
      recommendationsGenerated: recommendations.length,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Sync error:', error);
    const message = error instanceof Error ? error.message : 'Sync failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

