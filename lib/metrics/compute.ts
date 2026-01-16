import { prisma } from '@/lib/db';
import { startOfDay, subDays, startOfMonth, endOfMonth, format } from 'date-fns';

export interface ComputedMetrics {
  // Revenue
  mrr: number;
  arr: number;
  arpu: number;

  // Subscriptions
  activeSubscriptions: number;
  newSubscriptions: number;
  canceledSubscriptions: number;
  upgrades: number;
  downgrades: number;

  // Churn
  grossChurnRate: number;
  revenueChurnRate: number;
  netRevenueRetention: number;

  // Payments
  failedPayments: number;
  successfulPayments: number;
  failedPaymentRate: number;
  totalPaymentVolume: number;

  // Pricing
  averageDiscount: number;
  effectivePrice: number;
  discountLeakage: number;

  // Plan Distribution
  planDistribution: Record<string, number>;
}

/**
 * Compute all metrics for an organization for a specific date
 */
export async function computeDailyMetrics(
  organizationId: string,
  date: Date = new Date()
): Promise<ComputedMetrics> {
  const targetDate = startOfDay(date);
  const previousDate = subDays(targetDate, 1);
  const monthStart = startOfMonth(targetDate);
  const monthEnd = endOfMonth(targetDate);

  // Get active subscriptions
  const activeSubscriptions = await prisma.stripeSubscription.findMany({
    where: {
      organizationId,
      status: { in: ['active', 'trialing'] },
      startDate: { lte: targetDate },
      OR: [
        { endedAt: null },
        { endedAt: { gt: targetDate } },
      ],
    },
    include: {
      customer: true,
    },
  });

  // Calculate MRR (sum of all active subscription MRRs)
  const mrr = activeSubscriptions.reduce((sum, sub) => {
    // Apply any discounts
    let effectiveMrr = sub.mrr;
    if (sub.discountPercent) {
      effectiveMrr = Math.round(effectiveMrr * (1 - sub.discountPercent / 100));
    } else if (sub.discountAmountOff) {
      // Convert discount to monthly equivalent
      const monthlyDiscount = sub.planInterval === 'year' 
        ? Math.round(sub.discountAmountOff / 12) 
        : sub.discountAmountOff;
      effectiveMrr = Math.max(0, effectiveMrr - monthlyDiscount);
    }
    return sum + effectiveMrr;
  }, 0);

  const arr = mrr * 12;
  const activeCount = activeSubscriptions.length;
  const arpu = activeCount > 0 ? Math.round(mrr / activeCount) : 0;

  // New subscriptions today
  const newSubscriptions = await prisma.stripeSubscription.count({
    where: {
      organizationId,
      stripeCreatedAt: {
        gte: targetDate,
        lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000),
      },
    },
  });

  // Canceled subscriptions today
  const canceledSubscriptions = await prisma.stripeSubscription.count({
    where: {
      organizationId,
      canceledAt: {
        gte: targetDate,
        lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000),
      },
    },
  });

  // Count upgrades and downgrades from subscription events
  const todayStart = targetDate;
  const todayEnd = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000);

  const upgradesCount = await prisma.subscriptionEvent.count({
    where: {
      organizationId,
      type: 'UPGRADE',
      occurredAt: {
        gte: todayStart,
        lt: todayEnd,
      },
    },
  });

  const downgradesCount = await prisma.subscriptionEvent.count({
    where: {
      organizationId,
      type: 'DOWNGRADE',
      occurredAt: {
        gte: todayStart,
        lt: todayEnd,
      },
    },
  });

  // Get previous month's data for churn calculation
  const prevMonthStart = startOfMonth(subDays(monthStart, 1));
  const prevMonthEnd = endOfMonth(subDays(monthStart, 1));

  const previousActiveSubscriptions = await prisma.stripeSubscription.count({
    where: {
      organizationId,
      status: { in: ['active', 'trialing'] },
      startDate: { lte: prevMonthEnd },
      OR: [
        { endedAt: null },
        { endedAt: { gt: prevMonthEnd } },
      ],
    },
  });

  const churnedThisMonth = await prisma.stripeSubscription.count({
    where: {
      organizationId,
      canceledAt: {
        gte: monthStart,
        lte: monthEnd,
      },
    },
  });

  // Gross churn rate (customers lost / starting customers)
  const grossChurnRate = previousActiveSubscriptions > 0 
    ? (churnedThisMonth / previousActiveSubscriptions) * 100 
    : 0;

  // Revenue churn calculation
  const churnedSubscriptions = await prisma.stripeSubscription.findMany({
    where: {
      organizationId,
      canceledAt: {
        gte: monthStart,
        lte: monthEnd,
      },
    },
  });

  const lostMrr = churnedSubscriptions.reduce((sum, sub) => sum + sub.mrr, 0);
  const previousMrr = await getPreviousMonthMrr(organizationId, prevMonthEnd);
  const revenueChurnRate = previousMrr > 0 ? (lostMrr / previousMrr) * 100 : 0;

  // Net Revenue Retention (needs expansion revenue too)
  // For MVP, we'll estimate based on current vs previous MRR
  const netRevenueRetention = previousMrr > 0 ? (mrr / previousMrr) * 100 : 100;

  // Payment metrics for today
  const todayPayments = await prisma.stripePayment.findMany({
    where: {
      organizationId,
      stripeCreatedAt: {
        gte: targetDate,
        lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000),
      },
    },
  });

  const successfulPayments = todayPayments.filter(p => p.status === 'succeeded').length;
  const failedPayments = todayPayments.filter(p => p.status === 'failed').length;
  const totalPayments = todayPayments.length;
  const failedPaymentRate = totalPayments > 0 ? (failedPayments / totalPayments) * 100 : 0;
  const totalPaymentVolume = todayPayments
    .filter(p => p.status === 'succeeded')
    .reduce((sum, p) => sum + p.amount, 0);

  // Discount analysis
  const subscriptionsWithDiscounts = activeSubscriptions.filter(
    s => s.discountPercent || s.discountAmountOff
  );

  const averageDiscount = subscriptionsWithDiscounts.length > 0
    ? subscriptionsWithDiscounts.reduce((sum, s) => {
        if (s.discountPercent) return sum + s.discountPercent;
        if (s.discountAmountOff && s.planAmount > 0) {
          return sum + (s.discountAmountOff / s.planAmount) * 100;
        }
        return sum;
      }, 0) / subscriptionsWithDiscounts.length
    : 0;

  // Effective price (what customers actually pay vs list price)
  const totalListPrice = activeSubscriptions.reduce((sum, s) => sum + s.planAmount * s.quantity, 0);
  const totalActualPrice = activeSubscriptions.reduce((sum, s) => {
    let actual = s.planAmount * s.quantity;
    if (s.discountPercent) {
      actual = Math.round(actual * (1 - s.discountPercent / 100));
    } else if (s.discountAmountOff) {
      actual = Math.max(0, actual - s.discountAmountOff);
    }
    return sum + actual;
  }, 0);

  const effectivePrice = activeCount > 0 ? Math.round(totalActualPrice / activeCount) : 0;
  const discountLeakage = totalListPrice - totalActualPrice;

  // Plan distribution
  const planDistribution: Record<string, number> = {};
  for (const sub of activeSubscriptions) {
    const planKey = sub.planNickname || sub.planId || 'Unknown';
    planDistribution[planKey] = (planDistribution[planKey] || 0) + 1;
  }

  const metrics: ComputedMetrics = {
    mrr,
    arr,
    arpu,
    activeSubscriptions: activeCount,
    newSubscriptions,
    canceledSubscriptions,
    upgrades: upgradesCount,
    downgrades: downgradesCount,
    grossChurnRate,
    revenueChurnRate,
    netRevenueRetention,
    failedPayments,
    successfulPayments,
    failedPaymentRate,
    totalPaymentVolume,
    averageDiscount,
    effectivePrice,
    discountLeakage,
    planDistribution,
  };

  // Store the metrics
  await prisma.dailyMetrics.upsert({
    where: {
      organizationId_date: {
        organizationId,
        date: targetDate,
      },
    },
    create: {
      organizationId,
      date: targetDate,
      ...metrics,
    },
    update: metrics,
  });

  return metrics;
}

/**
 * Get MRR from a previous date
 */
async function getPreviousMonthMrr(organizationId: string, date: Date): Promise<number> {
  const metrics = await prisma.dailyMetrics.findFirst({
    where: {
      organizationId,
      date: { lte: date },
    },
    orderBy: { date: 'desc' },
  });

  return metrics?.mrr ?? 0;
}

/**
 * Get historical metrics for trending
 */
export async function getMetricsHistory(
  organizationId: string,
  days: number = 30
): Promise<Array<{ date: string } & Partial<ComputedMetrics>>> {
  const metrics = await prisma.dailyMetrics.findMany({
    where: {
      organizationId,
      date: { gte: subDays(new Date(), days) },
    },
    orderBy: { date: 'asc' },
  });

  return metrics.map(m => ({
    date: format(m.date, 'yyyy-MM-dd'),
    mrr: m.mrr,
    arr: m.arr,
    arpu: m.arpu,
    activeSubscriptions: m.activeSubscriptions,
    newSubscriptions: m.newSubscriptions,
    canceledSubscriptions: m.canceledSubscriptions,
    grossChurnRate: m.grossChurnRate,
    revenueChurnRate: m.revenueChurnRate,
    netRevenueRetention: m.netRevenueRetention,
    failedPaymentRate: m.failedPaymentRate,
    averageDiscount: m.averageDiscount,
    discountLeakage: m.discountLeakage,
    planDistribution: m.planDistribution as Record<string, number>,
  }));
}

/**
 * Get waterfall data for MRR movements
 */
export interface WaterfallData {
  startingMrr: number;
  newBusiness: number;
  expansion: number;
  contraction: number;
  churn: number;
  endingMrr: number;
}

export async function getWaterfallData(organizationId: string): Promise<WaterfallData> {
  const today = startOfDay(new Date());
  const monthStart = startOfMonth(today);
  const prevMonthEnd = subDays(monthStart, 1);

  // Get starting MRR (end of previous month)
  const prevMonthMetrics = await prisma.dailyMetrics.findFirst({
    where: {
      organizationId,
      date: { lte: prevMonthEnd },
    },
    orderBy: { date: 'desc' },
  });

  const startingMrr = prevMonthMetrics?.mrr ?? 0;

  // Get current MRR
  let currentMetrics = await prisma.dailyMetrics.findUnique({
    where: {
      organizationId_date: {
        organizationId,
        date: today,
      },
    },
  });

  if (!currentMetrics) {
    await computeDailyMetrics(organizationId, today);
    currentMetrics = await prisma.dailyMetrics.findUnique({
      where: {
        organizationId_date: {
          organizationId,
          date: today,
        },
      },
    });
  }

  const endingMrr = currentMetrics?.mrr ?? 0;

  // Get subscription events for this month to calculate waterfall components
  const monthlyEvents = await prisma.subscriptionEvent.findMany({
    where: {
      organizationId,
      occurredAt: {
        gte: monthStart,
        lte: today,
      },
    },
  });

  // Calculate new business from NEW events
  const newBusiness = monthlyEvents
    .filter(e => e.type === 'NEW')
    .reduce((sum, e) => sum + e.mrrDelta, 0);

  // Calculate expansion from UPGRADE events
  const expansion = monthlyEvents
    .filter(e => e.type === 'UPGRADE')
    .reduce((sum, e) => sum + e.mrrDelta, 0);

  // Calculate contraction from DOWNGRADE events (mrrDelta is negative, so we abs it)
  const contraction = Math.abs(
    monthlyEvents
      .filter(e => e.type === 'DOWNGRADE')
      .reduce((sum, e) => sum + e.mrrDelta, 0)
  );

  // Calculate churn from CANCELED events (mrrDelta is negative, so we abs it)
  const churn = Math.abs(
    monthlyEvents
      .filter(e => e.type === 'CANCELED')
      .reduce((sum, e) => sum + e.mrrDelta, 0)
  );

  // Add reactivations to expansion
  const reactivations = monthlyEvents
    .filter(e => e.type === 'REACTIVATED')
    .reduce((sum, e) => sum + e.mrrDelta, 0);

  return {
    startingMrr,
    newBusiness,
    expansion: expansion + reactivations,
    contraction,
    churn,
    endingMrr,
  };
}

/**
 * At-risk customer data structure
 */
export interface AtRiskCustomer {
  id: string;
  email: string;
  mrr: number;
  riskReason: 'past_due' | 'usage_drop' | 'downgrade_intent' | 'failed_payment';
  riskScore: number; // 0-100, higher = more at risk
  daysSinceIssue: number;
}

/**
 * Identify customers who are at risk of churning
 * Checks for: past due, failed payments, and cancel-at-period-end (downgrade intent)
 */
export async function getAtRiskCustomers(
  organizationId: string,
  limit: number = 20
): Promise<AtRiskCustomer[]> {
  const now = new Date();
  const thirtyDaysAgo = subDays(now, 30);
  const atRiskCustomers: AtRiskCustomer[] = [];

  // 1. Get customers with active subscriptions that are set to cancel (downgrade intent)
  const cancelingSubscriptions = await prisma.stripeSubscription.findMany({
    where: {
      organizationId,
      status: 'active',
      cancelAtPeriodEnd: true,
    },
    include: {
      customer: {
        select: {
          id: true,
          email: true,
          stripeId: true,
        },
      },
    },
  });

  for (const sub of cancelingSubscriptions) {
    if (!sub.customer) continue;
    
    const daysUntilCancel = Math.max(0, Math.floor(
      (sub.currentPeriodEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
    ));
    
    // Risk score: higher if cancellation is sooner and MRR is higher
    const urgencyScore = Math.max(0, 100 - daysUntilCancel * 3); // More urgent if closer
    const mrrWeight = Math.min(30, sub.mrr / 1000); // Up to 30 points for high MRR
    const riskScore = Math.min(100, Math.round(urgencyScore * 0.7 + mrrWeight));

    atRiskCustomers.push({
      id: sub.customer.id,
      email: sub.customer.email || 'Unknown',
      mrr: sub.mrr,
      riskReason: 'downgrade_intent',
      riskScore,
      daysSinceIssue: Math.max(0, Math.floor(
        (now.getTime() - sub.updatedAt.getTime()) / (24 * 60 * 60 * 1000)
      )),
    });
  }

  // 2. Get delinquent customers (past due)
  const delinquentCustomers = await prisma.stripeCustomer.findMany({
    where: {
      organizationId,
      delinquent: true,
    },
    include: {
      subscriptions: {
        where: {
          status: { in: ['active', 'past_due', 'trialing'] },
        },
        take: 1,
      },
    },
  });

  for (const customer of delinquentCustomers) {
    // Skip if already added
    if (atRiskCustomers.some(c => c.id === customer.id)) continue;
    
    const activeSub = customer.subscriptions[0];
    const mrr = activeSub?.mrr || 0;
    
    if (mrr === 0) continue; // Skip if no active revenue

    // Past due is high risk
    const riskScore = Math.min(100, 70 + Math.min(30, mrr / 1000));

    atRiskCustomers.push({
      id: customer.id,
      email: customer.email || 'Unknown',
      mrr,
      riskReason: 'past_due',
      riskScore,
      daysSinceIssue: Math.floor(
        (now.getTime() - (activeSub?.updatedAt ?? customer.createdAt).getTime()) / (24 * 60 * 60 * 1000)
      ),
    });
  }

  // 3. Get customers with recent failed payments
  const failedPayments = await prisma.stripePayment.findMany({
    where: {
      organizationId,
      status: 'failed',
      stripeCreatedAt: { gte: thirtyDaysAgo },
    },
    include: {
      customer: {
        include: {
          subscriptions: {
            where: {
              status: { in: ['active', 'past_due', 'trialing'] },
            },
            take: 1,
          },
        },
      },
    },
    orderBy: { stripeCreatedAt: 'desc' },
  });

  for (const payment of failedPayments) {
    if (!payment.customer) continue;
    // Skip if already added
    if (atRiskCustomers.some(c => c.id === payment.customer!.id)) continue;

    const activeSub = payment.customer.subscriptions[0];
    const mrr = activeSub?.mrr || 0;
    
    if (mrr === 0) continue; // Skip if no active revenue

    const daysSinceFailure = Math.floor(
      (now.getTime() - payment.stripeCreatedAt.getTime()) / (24 * 60 * 60 * 1000)
    );

    // Failed payment risk decreases over time (they may have fixed it)
    const recencyScore = Math.max(30, 80 - daysSinceFailure * 2);
    const mrrWeight = Math.min(20, mrr / 1000);
    const riskScore = Math.min(100, Math.round(recencyScore + mrrWeight));

    atRiskCustomers.push({
      id: payment.customer.id,
      email: payment.customer.email || 'Unknown',
      mrr,
      riskReason: 'failed_payment',
      riskScore,
      daysSinceIssue: daysSinceFailure,
    });
  }

  // Sort by risk score (highest first), then by MRR (highest first)
  atRiskCustomers.sort((a, b) => {
    if (b.riskScore !== a.riskScore) return b.riskScore - a.riskScore;
    return b.mrr - a.mrr;
  });

  return atRiskCustomers.slice(0, limit);
}

/**
 * Cohort retention data structure
 */
export interface CohortData {
  cohort: string; // e.g., "Jan 2025"
  startCount: number;
  months: (number | undefined)[]; // Retention percentages for each month, undefined if no data yet
}

/**
 * Compute cohort retention analysis from subscription data
 * Groups customers by signup month and tracks retention over time
 */
export async function getCohortRetentionData(
  organizationId: string,
  monthsBack: number = 12
): Promise<CohortData[]> {
  const now = new Date();
  const cohorts: CohortData[] = [];

  // Get all subscriptions for this organization
  const subscriptions = await prisma.stripeSubscription.findMany({
    where: {
      organizationId,
      stripeCreatedAt: {
        gte: subDays(now, monthsBack * 31), // Approximate, we'll filter more precisely
      },
    },
    select: {
      id: true,
      stripeCreatedAt: true,
      status: true,
      canceledAt: true,
      endedAt: true,
    },
  });

  if (subscriptions.length === 0) {
    return [];
  }

  // Group subscriptions by cohort month
  const cohortMap = new Map<string, typeof subscriptions>();

  for (const sub of subscriptions) {
    const cohortKey = format(sub.stripeCreatedAt, 'MMM yyyy');
    if (!cohortMap.has(cohortKey)) {
      cohortMap.set(cohortKey, []);
    }
    cohortMap.get(cohortKey)!.push(sub);
  }

  // Sort cohorts chronologically
  const sortedCohortKeys = Array.from(cohortMap.keys()).sort((a, b) => {
    const dateA = new Date(a);
    const dateB = new Date(b);
    return dateA.getTime() - dateB.getTime();
  });

  // Calculate retention for each cohort
  for (const cohortKey of sortedCohortKeys) {
    const cohortSubs = cohortMap.get(cohortKey)!;
    const startCount = cohortSubs.length;

    if (startCount === 0) continue;

    // Determine the cohort start date (first day of that month)
    const firstSubDate = cohortSubs[0].stripeCreatedAt;
    const cohortStartDate = startOfMonth(firstSubDate);

    // Calculate how many months have passed since this cohort started
    const monthsSinceCohort = Math.floor(
      (now.getTime() - cohortStartDate.getTime()) / (30.44 * 24 * 60 * 60 * 1000)
    );

    // Calculate retention for each month (M0 is always 100%)
    const months: (number | undefined)[] = [];

    for (let m = 0; m <= Math.min(monthsSinceCohort, 11); m++) {
      // Calculate the end of month M for this cohort
      const monthEndDate = new Date(cohortStartDate);
      monthEndDate.setMonth(monthEndDate.getMonth() + m + 1);
      monthEndDate.setDate(0); // Last day of month M

      // If this month hasn't completed yet, don't show data
      if (monthEndDate > now && m > 0) {
        months.push(undefined);
        continue;
      }

      // Count how many subscriptions were still active at the end of month M
      const activeAtMonthEnd = cohortSubs.filter((sub) => {
        // M0: count all subscriptions that started
        if (m === 0) return true;

        // For later months: check if subscription was active at end of that month
        const wasActive =
          sub.status === 'active' ||
          sub.status === 'trialing' ||
          // If canceled/ended, check if it happened after the month we're checking
          (sub.canceledAt && sub.canceledAt > monthEndDate) ||
          (sub.endedAt && sub.endedAt > monthEndDate) ||
          // If no cancellation date, it's still active
          (!sub.canceledAt && !sub.endedAt);

        return wasActive;
      }).length;

      const retentionPercent = Math.round((activeAtMonthEnd / startCount) * 100);
      months.push(retentionPercent);
    }

    cohorts.push({
      cohort: cohortKey,
      startCount,
      months,
    });
  }

  return cohorts;
}

/**
 * Get current snapshot of all key metrics
 */
export async function getCurrentMetricsSnapshot(organizationId: string): Promise<{
  current: ComputedMetrics;
  previousPeriod: Partial<ComputedMetrics>;
  changes: Record<string, number>;
}> {
  const today = startOfDay(new Date());
  const thirtyDaysAgo = subDays(today, 30);

  // Get or compute current metrics
  let current = await prisma.dailyMetrics.findUnique({
    where: {
      organizationId_date: {
        organizationId,
        date: today,
      },
    },
  });

  if (!current) {
    await computeDailyMetrics(organizationId, today);
    current = await prisma.dailyMetrics.findUnique({
      where: {
        organizationId_date: {
          organizationId,
          date: today,
        },
      },
    });
  }

  // Get 30-day-ago metrics for comparison
  const previousPeriod = await prisma.dailyMetrics.findFirst({
    where: {
      organizationId,
      date: { lte: thirtyDaysAgo },
    },
    orderBy: { date: 'desc' },
  });

  // Calculate changes
  const changes: Record<string, number> = {};
  if (current && previousPeriod) {
    changes.mrr = previousPeriod.mrr > 0 
      ? ((current.mrr - previousPeriod.mrr) / previousPeriod.mrr) * 100 
      : 0;
    changes.activeSubscriptions = previousPeriod.activeSubscriptions > 0
      ? ((current.activeSubscriptions - previousPeriod.activeSubscriptions) / previousPeriod.activeSubscriptions) * 100
      : 0;
    changes.grossChurnRate = current.grossChurnRate - previousPeriod.grossChurnRate;
    changes.arpu = previousPeriod.arpu > 0
      ? ((current.arpu - previousPeriod.arpu) / previousPeriod.arpu) * 100
      : 0;
  }

  return {
    current: current as unknown as ComputedMetrics,
    previousPeriod: (previousPeriod ?? {}) as Partial<ComputedMetrics>,
    changes,
  };
}

