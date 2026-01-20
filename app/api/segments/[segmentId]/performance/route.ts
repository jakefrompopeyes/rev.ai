import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/segments/[segmentId]/performance
 * Get performance metrics for a specific segment
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { segmentId: string } }
) {
  try {
    const { requireAuthWithOrg } = await import('@/lib/supabase/auth-helpers');
    const { organizationId } = await requireAuthWithOrg();

    const segment = await prisma.customerSegment.findFirst({
      where: {
        id: params.segmentId,
        organizationId,
      },
      include: {
        customers: {
          include: {
            subscriptions: {
              where: { status: { in: ['active', 'trialing'] } },
            },
          },
        },
      },
    });

    if (!segment) {
      return NextResponse.json({ error: 'Segment not found' }, { status: 404 });
    }

    // Calculate metrics
    const customers = segment.customers;
    const totalCustomers = customers.length;
    
    let totalMrr = 0;
    let totalArr = 0;
    const planDistribution: Record<string, number> = {};
    let churnRiskCount = 0;
    let delinquentCount = 0;

    for (const customer of customers) {
      const activeSub = customer.subscriptions[0];
      if (activeSub) {
        totalMrr += activeSub.mrr;
        totalArr += activeSub.arr;
        
        const planName = activeSub.planNickname || activeSub.planId || 'Unknown';
        planDistribution[planName] = (planDistribution[planName] || 0) + 1;
        
        if (activeSub.cancelAtPeriodEnd) churnRiskCount++;
      }
      
      if (customer.delinquent) delinquentCount++;
    }

    const avgMrr = totalCustomers > 0 ? Math.round(totalMrr / totalCustomers) : 0;
    const avgArr = totalCustomers > 0 ? Math.round(totalArr / totalCustomers) : 0;
    const churnRiskRate = totalCustomers > 0 ? (churnRiskCount / totalCustomers) * 100 : 0;
    const delinquentRate = totalCustomers > 0 ? (delinquentCount / totalCustomers) * 100 : 0;

    // Get churn rate (customers who canceled in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const churnedCustomers = await prisma.stripeCustomer.findMany({
      where: {
        organizationId,
        id: { in: customers.map(c => c.id) },
        subscriptions: {
          some: {
            canceledAt: { gte: thirtyDaysAgo },
            status: 'canceled',
          },
        },
      },
    });

    const churnRate = totalCustomers > 0 ? (churnedCustomers.length / totalCustomers) * 100 : 0;

    // Get growth (new customers in segment in last 30 days)
    const newCustomers = await prisma.segmentCustomerAssignment.count({
      where: {
        segmentId: segment.id,
        organizationId,
        assignedAt: { gte: thirtyDaysAgo },
      },
    });

    return NextResponse.json({
      segment: {
        id: segment.id,
        name: segment.name,
        description: segment.description,
        color: segment.color,
      },
      metrics: {
        totalCustomers,
        totalMrr,
        totalArr,
        avgMrr,
        avgArr,
        churnRate: Math.round(churnRate * 10) / 10,
        churnRiskRate: Math.round(churnRiskRate * 10) / 10,
        delinquentRate: Math.round(delinquentRate * 10) / 10,
        newCustomersLast30Days: newCustomers,
        planDistribution,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Segment performance error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch segment performance' },
      { status: 500 }
    );
  }
}
