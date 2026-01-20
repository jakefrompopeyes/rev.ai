import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { subMonths } from 'date-fns';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export interface MigrationPath {
  fromPlan: string | null; // null = new customer
  toPlan: string;
  count: number;
  totalMrrDelta: number;
  avgMrrDelta: number;
  conversionRate?: number; // % of customers who made this transition
  avgDaysToMigrate?: number;
}

export interface PlanMigrationAnalysis {
  paths: MigrationPath[];
  funnel: {
    plan: string;
    totalCustomers: number;
    upgradeCount: number;
    downgradeCount: number;
    churnCount: number;
    upgradeRate: number;
    downgradeRate: number;
    churnRate: number;
  }[];
  insights: string[];
  frictionPoints: {
    fromPlan: string;
    toPlan: string;
    issue: string;
    severity: 'low' | 'medium' | 'high';
  }[];
}

/**
 * GET /api/migration-paths
 * Analyze plan migration patterns
 * 
 * Query params:
 * - months: number (default: 12) - How many months to analyze
 * - includeNew: boolean (default: true) - Include new customer signups
 */
export async function GET(request: NextRequest) {
  try {
    const { requireAuthWithOrg } = await import('@/lib/supabase/auth-helpers');
    const { organizationId } = await requireAuthWithOrg();

    const { searchParams } = new URL(request.url);
    const months = parseInt(searchParams.get('months') || '12', 10);
    const includeNew = searchParams.get('includeNew') !== 'false';

    const startDate = subMonths(new Date(), months);

    // Get all subscription events in the time period
    const events = await prisma.subscriptionEvent.findMany({
      where: {
        organizationId,
        occurredAt: { gte: startDate },
        type: { in: ['UPGRADE', 'DOWNGRADE', 'NEW'] },
      },
      orderBy: { occurredAt: 'asc' },
      include: {
        subscription: {
          include: {
            customer: true,
          },
        },
      },
    });

    // Analyze migration paths
    const pathMap = new Map<string, {
      count: number;
      totalMrrDelta: number;
      daysToMigrate: number[];
    }>();

    // Track plan funnels
    const planStats = new Map<string, {
      totalCustomers: number;
      upgrades: number;
      downgrades: number;
      churns: number;
    }>();

    // Track customer journeys
    const customerJourneys = new Map<string, Array<{
      plan: string | null;
      date: Date;
      type: string;
    }>>();

    for (const event of events) {
      const fromPlan = event.previousPlanNickname || event.previousPlanId || null;
      const toPlan = event.newPlanNickname || event.newPlanId || 'Unknown';
      const key = `${fromPlan || 'NEW'} → ${toPlan}`;

      // Track path
      if (!pathMap.has(key)) {
        pathMap.set(key, { count: 0, totalMrrDelta: 0, daysToMigrate: [] });
      }
      const path = pathMap.get(key)!;
      path.count++;
      path.totalMrrDelta += event.mrrDelta;

      // Calculate days to migrate (for upgrades/downgrades)
      if (event.type === 'UPGRADE' || event.type === 'DOWNGRADE') {
        // Find when customer first had the "from" plan
        const customerId = event.subscription.customerId;
        const customerEvents = await prisma.subscriptionEvent.findMany({
          where: {
            organizationId,
            subscription: { customerId },
            occurredAt: { lte: event.occurredAt },
            OR: [
              { newPlanId: event.previousPlanId },
              { newPlanNickname: event.previousPlanNickname },
            ],
          },
          orderBy: { occurredAt: 'desc' },
          take: 1,
        });

        if (customerEvents.length > 0) {
          const daysDiff = Math.floor(
            (event.occurredAt.getTime() - customerEvents[0].occurredAt.getTime()) / (1000 * 60 * 60 * 24)
          );
          path.daysToMigrate.push(daysDiff);
        }
      }

      // Track plan stats
      if (fromPlan) {
        if (!planStats.has(fromPlan)) {
          planStats.set(fromPlan, { totalCustomers: 0, upgrades: 0, downgrades: 0, churns: 0 });
        }
        const stats = planStats.get(fromPlan)!;
        stats.totalCustomers++;
        if (event.type === 'UPGRADE') stats.upgrades++;
        if (event.type === 'DOWNGRADE') stats.downgrades++;
      }

      // Track churns
      const churnEvents = await prisma.subscriptionEvent.findMany({
        where: {
          organizationId,
          subscription: { customerId: event.subscription.customerId },
          type: 'CANCELED',
          occurredAt: { gte: event.occurredAt, lte: new Date(event.occurredAt.getTime() + 90 * 24 * 60 * 60 * 1000) },
        },
      });
      if (churnEvents.length > 0 && fromPlan) {
        const stats = planStats.get(fromPlan)!;
        stats.churns++;
      }
    }

    // Convert path map to array
    const paths: MigrationPath[] = Array.from(pathMap.entries())
      .filter(([key]) => includeNew || !key.startsWith('NEW →'))
      .map(([key, data]) => {
        const [fromPlan, toPlan] = key.split(' → ');
        return {
          fromPlan: fromPlan === 'NEW' ? null : fromPlan,
          toPlan,
          count: data.count,
          totalMrrDelta: data.totalMrrDelta,
          avgMrrDelta: Math.round(data.totalMrrDelta / data.count),
          avgDaysToMigrate: data.daysToMigrate.length > 0
            ? Math.round(data.daysToMigrate.reduce((a, b) => a + b, 0) / data.daysToMigrate.length)
            : undefined,
        };
      })
      .sort((a, b) => b.count - a.count);

    // Calculate conversion rates
    const totalCustomersByPlan = new Map<string, number>();
    for (const event of events) {
      const plan = event.previousPlanNickname || event.previousPlanId;
      if (plan) {
        totalCustomersByPlan.set(plan, (totalCustomersByPlan.get(plan) || 0) + 1);
      }
    }

    for (const path of paths) {
      if (path.fromPlan) {
        const totalFromPlan = totalCustomersByPlan.get(path.fromPlan) || 0;
        path.conversionRate = totalFromPlan > 0 ? (path.count / totalFromPlan) * 100 : 0;
      }
    }

    // Build funnel analysis
    const funnel = Array.from(planStats.entries()).map(([plan, stats]) => {
      const total = stats.totalCustomers || 1;
      return {
        plan,
        totalCustomers: stats.totalCustomers,
        upgradeCount: stats.upgrades,
        downgradeCount: stats.downgrades,
        churnCount: stats.churns,
        upgradeRate: (stats.upgrades / total) * 100,
        downgradeRate: (stats.downgrades / total) * 100,
        churnRate: (stats.churns / total) * 100,
      };
    }).sort((a, b) => b.totalCustomers - a.totalCustomers);

    // Generate insights
    const insights: string[] = [];
    const topUpgrade = paths.filter(p => p.fromPlan && p.avgMrrDelta > 0).sort((a, b) => b.count - a.count)[0];
    const topDowngrade = paths.filter(p => p.fromPlan && p.avgMrrDelta < 0).sort((a, b) => b.count - a.count)[0];
    
    if (topUpgrade) {
      insights.push(
        `Most common upgrade: ${topUpgrade.fromPlan} → ${topUpgrade.toPlan} (${topUpgrade.count} customers, +${(topUpgrade.avgMrrDelta / 100).toFixed(0)}/mo avg)`
      );
    }
    
    if (topDowngrade) {
      insights.push(
        `Most common downgrade: ${topDowngrade.fromPlan} → ${topDowngrade.toPlan} (${topDowngrade.count} customers, ${(topDowngrade.avgMrrDelta / 100).toFixed(0)}/mo avg)`
      );
    }

    const highChurnPlan = funnel.find(f => f.churnRate > 20);
    if (highChurnPlan) {
      insights.push(
        `High churn risk: ${highChurnPlan.plan} has ${highChurnPlan.churnRate.toFixed(1)}% churn rate`
      );
    }

    // Identify friction points
    const frictionPoints: PlanMigrationAnalysis['frictionPoints'] = [];
    
    // Low conversion rates indicate friction
    for (const path of paths) {
      if (path.fromPlan && path.conversionRate && path.conversionRate < 5 && path.count > 3) {
        frictionPoints.push({
          fromPlan: path.fromPlan,
          toPlan: path.toPlan,
          issue: `Only ${path.conversionRate.toFixed(1)}% of ${path.fromPlan} customers upgrade to ${path.toPlan}`,
          severity: path.conversionRate < 2 ? 'high' : path.conversionRate < 3 ? 'medium' : 'low',
        });
      }
    }

    // Long migration times indicate friction
    for (const path of paths) {
      if (path.avgDaysToMigrate && path.avgDaysToMigrate > 180 && path.count > 5) {
        frictionPoints.push({
          fromPlan: path.fromPlan || 'New',
          toPlan: path.toPlan,
          issue: `Takes ${Math.round(path.avgDaysToMigrate / 30)} months on average to migrate from ${path.fromPlan || 'signup'} to ${path.toPlan}`,
          severity: path.avgDaysToMigrate > 365 ? 'high' : 'medium',
        });
      }
    }

    const analysis: PlanMigrationAnalysis = {
      paths,
      funnel,
      insights,
      frictionPoints,
    };

    return NextResponse.json(analysis);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Migration paths analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze migration paths' },
      { status: 500 }
    );
  }
}
