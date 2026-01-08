import { subDays } from 'date-fns';
import { prisma } from '@/lib/db';

/**
 * Seed demo data for a specific organization.
 * Clears existing data for that org and inserts mock Stripe connection,
 * customers, subscriptions, metrics, insights, and recommendations.
 */
export async function seedDemoDataForOrg(organizationId: string) {
  // Clean existing data for this org (order matters for FK)
  await prisma.aIRecommendation.deleteMany({ where: { organizationId } });
  await prisma.aIInsight.deleteMany({ where: { organizationId } });
  await prisma.dailyMetrics.deleteMany({ where: { organizationId } });
  await prisma.stripePayment.deleteMany({ where: { organizationId } });
  await prisma.stripeInvoice.deleteMany({ where: { organizationId } });
  await prisma.stripeSubscription.deleteMany({ where: { organizationId } });
  await prisma.stripeCustomer.deleteMany({ where: { organizationId } });
  await prisma.stripeConnection.deleteMany({ where: { organizationId } });

  // Mock Stripe connection
  await prisma.stripeConnection.create({
    data: {
      organizationId,
      stripeAccountId: 'acct_demo_123456',
      accessToken: 'demo_access_token',
      livemode: false,
      scope: 'read_only',
      lastSyncAt: new Date(),
      lastSyncStatus: 'success',
    },
  });

  // Customers
  const customers = Array.from({ length: 20 }).map((_, idx) => ({
    externalId: `cus_demo_${idx + 1}`,
    email: `customer${idx + 1}@example.com`,
    name: `Demo Customer ${idx + 1}`,
  }));

  await prisma.stripeCustomer.createMany({
    data: customers.map((c) => ({
      organizationId,
      stripeCustomerId: c.externalId,
      email: c.email,
      name: c.name,
      createdAt: subDays(new Date(), 30),
    })),
  });

  // Subscriptions + invoices + payments
  const planAmounts = [2900, 9900, 19900]; // $29, $99, $199
  const planNames = ['Starter', 'Growth', 'Scale'];

  const createdSubs = [];
  for (let i = 0; i < customers.length; i++) {
    const planIndex = i % planAmounts.length;
    const amount = planAmounts[planIndex];
    const planNickname = planNames[planIndex];
    const subId = `sub_demo_${i + 1}`;
    const customerId = customers[i].externalId;

    const sub = await prisma.stripeSubscription.create({
      data: {
        organizationId,
        stripeSubscriptionId: subId,
        status: 'active',
        planId: `price_demo_${planIndex + 1}`,
        planNickname,
        planAmount: amount,
        planInterval: 'month',
        mrr: amount,
        discountPercent: null,
        discountAmountOff: null,
        customer: {
          connect: { stripeCustomerId_organizationId: { stripeCustomerId: customerId, organizationId } },
        },
        stripeCreatedAt: subDays(new Date(), 20),
      },
      include: { customer: true },
    });
    createdSubs.push(sub);

    // Invoice + payment for the sub
    const invoiceId = `in_demo_${i + 1}`;
    await prisma.stripeInvoice.create({
      data: {
        organizationId,
        stripeInvoiceId: invoiceId,
        customerId: customerId,
        subscriptionId: subId,
        amountDue: amount,
        amountPaid: amount,
        status: 'paid',
        stripeCreatedAt: subDays(new Date(), 10),
      },
    });

    await prisma.stripePayment.create({
      data: {
        organizationId,
        stripePaymentId: `pay_demo_${i + 1}`,
        customerId,
        amount: amount,
        status: 'succeeded',
        stripeCreatedAt: subDays(new Date(), 9),
      },
    });
  }

  // 60 days of daily metrics with gentle growth
  const days = 60;
  const baseMrr = 82000;
  for (let i = days; i >= 0; i--) {
    const date = subDays(new Date(), i);
    const trend = (days - i) * 35; // linear growth
    const mrr = baseMrr + trend;
    const activeSubscriptions = 420 + Math.floor((days - i) / 3);
    const churnRate = 3.1 + Math.random() * 0.5;
    const nrr = 112 + Math.random() * 4;
    const failedPaymentRate = 1.6 + Math.random() * 0.6;

    await prisma.dailyMetrics.create({
      data: {
        organizationId,
        date,
        mrr,
        arr: mrr * 12,
        arpu: mrr / activeSubscriptions,
        activeSubscriptions,
        newSubscriptions: 6 + Math.floor(Math.random() * 3),
        canceledSubscriptions: 3 + Math.floor(Math.random() * 2),
        grossChurnRate: churnRate,
        revenueChurnRate: churnRate * 0.8,
        netRevenueRetention: nrr,
        failedPaymentRate,
        averageDiscount: 12 + Math.random() * 4,
        discountLeakage: 8 + Math.random() * 3,
        planDistribution: {
          Starter: 0.55,
          Growth: 0.32,
          Scale: 0.13,
        },
      },
    });
  }

  // Sample insights
  const sampleInsights = [
    {
      category: 'CHURN',
      severity: 'HIGH',
      title: 'Starter plan shows elevated churn',
      description: 'Starter customers churn 2.1x faster than Growth. Consider improving onboarding or nudging to Growth.',
      confidence: 0.83,
    },
    {
      category: 'REVENUE',
      severity: 'MEDIUM',
      title: 'MRR trending up +6.8% over last 30 days',
      description: 'Healthy growth driven by consistent new signups and low downgrade rates.',
      confidence: 0.9,
    },
    {
      category: 'PAYMENTS',
      severity: 'LOW',
      title: 'Failed payments at 2.0%',
      description: 'Add card update nudges and smart retries to recover revenue.',
      confidence: 0.78,
    },
  ] as const;

  for (const insight of sampleInsights) {
    await prisma.aIInsight.create({
      data: {
        organizationId,
        category: insight.category,
        severity: insight.severity,
        title: insight.title,
        description: insight.description,
        dataPoints: { source: 'demo' },
        confidence: insight.confidence,
      },
    });
  }

  // Sample recommendations
  const sampleRecommendations = [
    {
      title: 'Add card updater + dunning',
      description: 'Recover failed payments with pre-dunning emails and card updater before retry cycle.',
      reasoning: 'Failed payments are at ~2%; small decrease yields meaningful uplift.',
      riskLevel: 'LOW',
      estimatedImpact: 45000,
      impactTimeframe: '30 days',
      impactConfidence: 0.55,
      priorityScore: 80,
    },
    {
      title: 'Nudge Starter to Growth at 30/60 days',
      description: 'Introduce in-app prompts and usage-based milestones to upgrade sticky Starter users.',
      reasoning: 'Starter churn is elevated; early upgrade path can improve retention and ARPU.',
      riskLevel: 'MEDIUM',
      estimatedImpact: 120000,
      impactTimeframe: '60 days',
      impactConfidence: 0.5,
      priorityScore: 72,
    },
    {
      title: 'Annual plan incentive',
      description: 'Offer 10% incentive for annual prepay to boost cash and reduce churn.',
      reasoning: 'Converts healthy cohort into longer-term commitment with lower churn.',
      riskLevel: 'LOW',
      estimatedImpact: 90000,
      impactTimeframe: '90 days',
      impactConfidence: 0.6,
      priorityScore: 70,
    },
  ] as const;

  for (const rec of sampleRecommendations) {
    await prisma.aIRecommendation.create({
      data: {
        organizationId,
        ...rec,
        baselineMetrics: {
          mrr: baseMrr,
          churnRate: 3.2,
          activeSubscriptions: 420,
        },
      },
    });
  }
}

