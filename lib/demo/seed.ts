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

  // Customers (create individually to return IDs)
  const customerRecords = [];
  for (let i = 0; i < 20; i++) {
    const stripeId = `cus_demo_${i + 1}`;
    const customer = await prisma.stripeCustomer.create({
      data: {
        organizationId,
        stripeId,
        email: `customer${i + 1}@example.com`,
        stripeCreatedAt: subDays(new Date(), 30),
        currency: 'usd',
        delinquent: false,
      },
    });
    customerRecords.push(customer);
  }

  // Subscriptions + invoices + payments
  const planAmounts = [2900, 9900, 19900]; // $29, $99, $199
  const planNames = ['Starter', 'Growth', 'Scale'];

  for (let i = 0; i < customerRecords.length; i++) {
    const planIndex = i % planAmounts.length;
    const amount = planAmounts[planIndex];
    const planNickname = planNames[planIndex];
    const subStripeId = `sub_demo_${i + 1}`;
    const customer = customerRecords[i];

    const sub = await prisma.stripeSubscription.create({
      data: {
        organizationId,
        stripeId: subStripeId,
        status: 'active',
        currentPeriodStart: subDays(new Date(), 20),
        currentPeriodEnd: subDays(new Date(), -10),
        cancelAtPeriodEnd: false,
        startDate: subDays(new Date(), 20),
        billingCycleAnchor: subDays(new Date(), 20),
        planId: `price_demo_${planIndex + 1}`,
        planNickname,
        planAmount: amount,
        planInterval: 'month',
        quantity: 1,
        mrr: amount,
        arr: amount * 12,
        stripeCreatedAt: subDays(new Date(), 20),
        customerId: customer.id,
      },
    });

    // Invoice
    const invoiceStripeId = `in_demo_${i + 1}`;
    await prisma.stripeInvoice.create({
      data: {
        organizationId,
        stripeId: invoiceStripeId,
        status: 'paid',
        amountDue: amount,
        amountPaid: amount,
        amountRemaining: 0,
        subtotal: amount,
        total: amount,
        tax: 0,
        discountAmount: 0,
        periodStart: subDays(new Date(), 11),
        periodEnd: subDays(new Date(), -19),
        createdAt: new Date(),
        stripeCreatedAt: subDays(new Date(), 10),
        customerId: customer.id,
        subscriptionId: sub.id,
      },
    });

    // Payment
    const paymentStripeId = `pay_demo_${i + 1}`;
    await prisma.stripePayment.create({
      data: {
        organizationId,
        stripeId: paymentStripeId,
        status: 'succeeded',
        amount,
        amountRefunded: 0,
        currency: 'usd',
        fee: 0,
        net: amount,
        stripeCreatedAt: subDays(new Date(), 9),
        customerId: customer.id,
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
        arpu: Math.round(mrr / activeSubscriptions),
        activeSubscriptions,
        newSubscriptions: 6 + Math.floor(Math.random() * 3),
        canceledSubscriptions: 3 + Math.floor(Math.random() * 2),
        upgrades: 2 + Math.floor(Math.random() * 2),
        downgrades: 1,
        grossChurnRate: churnRate,
        revenueChurnRate: churnRate * 0.8,
        netRevenueRetention: nrr,
        failedPayments: 3 + Math.floor(Math.random() * 3),
        successfulPayments: 40 + Math.floor(Math.random() * 10),
        failedPaymentRate,
        totalPaymentVolume: mrr + 5000,
        averageDiscount: 12 + Math.random() * 4,
        effectivePrice: Math.round((mrr / activeSubscriptions) * 0.94),
        discountLeakage: 800 + Math.floor(Math.random() * 300),
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

