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
    upgrades: 0, // TODO: Detect upgrades
    downgrades: 0, // TODO: Detect downgrades
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

