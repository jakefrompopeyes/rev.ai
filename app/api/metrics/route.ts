import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { requireAuthWithOrg } = await import('@/lib/supabase/auth-helpers');
    const { getCurrentMetricsSnapshot, getMetricsHistory, getWaterfallData, getCohortRetentionData, getAtRiskCustomers } = await import('@/lib/metrics/compute');
    
    const { organizationId } = await requireAuthWithOrg();

    const searchParams = request.nextUrl.searchParams;
    const view = searchParams.get('view') || 'snapshot';
    const days = parseInt(searchParams.get('days') || '30');

    if (view === 'history') {
      const history = await getMetricsHistory(organizationId, days);
      return NextResponse.json({ history });
    }

    if (view === 'waterfall') {
      const waterfall = await getWaterfallData(organizationId);
      return NextResponse.json({ waterfall });
    }

    if (view === 'activities') {
      const limit = parseInt(searchParams.get('limit') || '20');
      const activities = await getRecentActivities(organizationId, limit);
      return NextResponse.json({ activities });
    }

    if (view === 'cohorts') {
      const months = parseInt(searchParams.get('months') || '12');
      const cohorts = await getCohortRetentionData(organizationId, months);
      return NextResponse.json({ cohorts });
    }

    if (view === 'at-risk') {
      const limit = parseInt(searchParams.get('limit') || '20');
      const atRiskCustomers = await getAtRiskCustomers(organizationId, limit);
      return NextResponse.json({ atRiskCustomers });
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

/**
 * Fetch recent subscription events and format them as activities
 */
async function getRecentActivities(organizationId: string, limit: number = 20) {
  const events = await prisma.subscriptionEvent.findMany({
    where: { organizationId },
    orderBy: { occurredAt: 'desc' },
    take: limit,
    include: {
      subscription: {
        include: {
          customer: {
            select: {
              email: true,
            },
          },
        },
      },
    },
  });

  return events.map((event) => {
    const customerEmail = event.subscription.customer?.email || 'Customer';
    const planName = event.newPlanNickname || event.previousPlanNickname || 'Unknown plan';
    
    let type: string;
    let title: string;
    let description: string;
    let amount: number;

    switch (event.type) {
      case 'NEW':
        type = 'new_subscription';
        title = 'New subscription';
        description = `${customerEmail} subscribed to ${planName}`;
        amount = event.newMrr;
        break;
      case 'CANCELED':
        type = 'cancellation';
        title = 'Subscription canceled';
        description = `${customerEmail} canceled ${planName}`;
        amount = event.previousMrr;
        break;
      case 'UPGRADE':
        type = 'upgrade';
        title = 'Plan upgrade';
        description = `${customerEmail}: ${event.previousPlanNickname} → ${event.newPlanNickname}`;
        amount = event.mrrDelta;
        break;
      case 'DOWNGRADE':
        type = 'downgrade';
        title = 'Plan downgrade';
        description = `${customerEmail}: ${event.previousPlanNickname} → ${event.newPlanNickname}`;
        amount = Math.abs(event.mrrDelta);
        break;
      case 'REACTIVATED':
        type = 'new_subscription';
        title = 'Subscription reactivated';
        description = `${customerEmail} reactivated ${planName}`;
        amount = event.newMrr;
        break;
      default:
        type = 'new_subscription';
        title = 'Subscription event';
        description = customerEmail;
        amount = Math.abs(event.mrrDelta);
    }

    return {
      id: event.id,
      type,
      title,
      description,
      amount,
      timestamp: event.occurredAt.toISOString(),
    };
  });
}

