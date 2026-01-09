import { subDays, format, getDay, startOfDay } from 'date-fns';
import { prisma } from '@/lib/db';

// Modern startup/tech company names
const companyNames = [
  'Vercel Labs', 'Supabase Co', 'Railway Inc', 'Planetscale', 'Neon Database',
  'Resend HQ', 'Clerk Auth', 'Upstash', 'Axiom Data', 'Tinybird Analytics',
  'Inngest', 'Trigger.dev', 'Dub Links', 'Cal.com', 'Documenso',
  'Papermark', 'Formbricks', 'Hanko Auth', 'Unkey API', 'OpenStatus',
  'Polar.sh', 'Midday Finance', 'Twenty CRM', 'Infisical Secrets', 'Hoppscotch',
  'Appwrite Cloud', 'Convex Backend', 'Turso Edge', 'Xata DB', 'CockroachDB',
  'TimescaleDB', 'Questdb', 'ClickHouse Inc', 'Materialize', 'RisingWave',
  'Redpanda Data', 'Warpstream', 'Estuary Flow', 'Airbyte Cloud', 'Fivetran',
  'Hightouch', 'Census Data', 'Segment CDP', 'Amplitude', 'Mixpanel',
  'PostHog', 'Plausible', 'Fathom Analytics', 'SimpleAnalytics', 'Pirsch'
];

const firstNames = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Quinn', 'Avery', 'Cameron', 'Drew'];
const lastNames = ['Park', 'Kim', 'Lee', 'Nakamura', 'Singh', 'Patel', 'Andersen', 'Müller', 'Costa', 'Russo'];

/**
 * Seed demo data - Fast-growing developer tools SaaS
 * ~$45K MRR with strong 8% month-over-month growth
 * Higher volume, lower ARPU, usage-based pricing
 */
export async function seedDemoDataForOrg(organizationId: string) {
  // Ensure the organization exists (create if it doesn't)
  const existingOrg = await prisma.organization.findUnique({
    where: { id: organizationId },
  });

  if (!existingOrg) {
    await prisma.organization.create({
      data: {
        id: organizationId,
        name: 'Demo Organization',
      },
    });
    console.log(`Created demo organization: ${organizationId}`);
  }

  // Clean existing data
  await prisma.aIRecommendation.deleteMany({ where: { organizationId } });
  await prisma.aIInsight.deleteMany({ where: { organizationId } });
  await prisma.dailyMetrics.deleteMany({ where: { organizationId } });
  await prisma.subscriptionEvent.deleteMany({ where: { organizationId } });
  await prisma.stripePayment.deleteMany({ where: { organizationId } });
  await prisma.stripeInvoice.deleteMany({ where: { organizationId } });
  await prisma.stripeSubscription.deleteMany({ where: { organizationId } });
  await prisma.stripeCustomer.deleteMany({ where: { organizationId } });
  await prisma.stripeConnection.deleteMany({ where: { organizationId } });

  await prisma.stripeConnection.create({
    data: {
      organizationId,
      stripeAccountId: `acct_demo_${organizationId}`,
      accessToken: 'demo_access_token',
      livemode: false,
      scope: 'read_only',
      lastSyncAt: new Date(),
      lastSyncStatus: 'success',
    },
  });

  // Usage-based pricing tiers
  const plans = [
    { id: 'price_hobby', name: 'Hobby', amount: 0, weight: 0.30 },           // Free tier
    { id: 'price_pro', name: 'Pro', amount: 2000, weight: 0.40 },            // $20/mo
    { id: 'price_team', name: 'Team', amount: 7500, weight: 0.20 },          // $75/mo
    { id: 'price_scale', name: 'Scale', amount: 25000, weight: 0.08 },       // $250/mo
    { id: 'price_enterprise', name: 'Enterprise', amount: 100000, weight: 0.02 }, // $1000/mo
  ];

  // Create 120 customers (high volume)
  const customerRecords: { id: string; stripeId: string; email: string; createdDaysAgo: number }[] = [];
  
  for (let i = 0; i < 120; i++) {
    const companyName = companyNames[i % companyNames.length];
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const domain = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const email = `${firstName.toLowerCase()}@${domain}.dev`;
    const stripeId = `cus_${generateId(14)}`;
    
    // More recent signups (growth)
    const createdDaysAgo = Math.floor(Math.pow(Math.random(), 0.5) * 90);
    
    const customer = await prisma.stripeCustomer.create({
      data: {
        organizationId,
        stripeId,
        email,
        stripeCreatedAt: subDays(new Date(), createdDaysAgo),
        currency: 'usd',
        delinquent: Math.random() < 0.02,
        metadata: { company: companyName, contact: `${firstName} ${lastName}` },
      },
    });
    customerRecords.push({ id: customer.id, stripeId: customer.stripeId, email, createdDaysAgo });
  }

  const subscriptionRecords = [];
  for (let i = 0; i < customerRecords.length; i++) {
    const customer = customerRecords[i];
    
    const rand = Math.random();
    let cumWeight = 0;
    let selectedPlan = plans[0];
    for (const plan of plans) {
      cumWeight += plan.weight;
      if (rand <= cumWeight) {
        selectedPlan = plan;
        break;
      }
    }
    
    // Usage-based quantity for paid plans
    let quantity = 1;
    if (selectedPlan.name === 'Team') quantity = Math.floor(Math.random() * 5) + 3;
    if (selectedPlan.name === 'Scale') quantity = Math.floor(Math.random() * 10) + 5;
    if (selectedPlan.name === 'Enterprise') quantity = Math.floor(Math.random() * 20) + 10;
    
    const amount = selectedPlan.amount * quantity;
    const startDaysAgo = customer.createdDaysAgo - Math.floor(Math.random() * 2);
    const subStripeId = `sub_${generateId(14)}`;
    
    // Free tier has higher churn, paid has lower
    const statusRand = Math.random();
    let status = 'active';
    if (selectedPlan.name === 'Hobby') {
      status = statusRand < 0.15 ? 'canceled' : 'active'; // 15% free tier churn
    } else {
      status = statusRand < 0.04 ? 'canceled' : statusRand < 0.06 ? 'past_due' : 'active';
    }
    
    // Skip free tier subscriptions for MRR (but track them)
    const mrr = status === 'canceled' || selectedPlan.amount === 0 ? 0 : amount;
    
    const sub = await prisma.stripeSubscription.create({
      data: {
        organizationId,
        stripeId: subStripeId,
        status,
        currentPeriodStart: subDays(new Date(), startDaysAgo % 30),
        currentPeriodEnd: subDays(new Date(), (startDaysAgo % 30) - 30),
        cancelAtPeriodEnd: Math.random() < 0.05,
        startDate: subDays(new Date(), startDaysAgo),
        billingCycleAnchor: subDays(new Date(), startDaysAgo),
        planId: selectedPlan.id,
        planNickname: selectedPlan.name,
        planAmount: selectedPlan.amount,
        planInterval: 'month',
        quantity,
        mrr,
        arr: mrr * 12,
        stripeCreatedAt: subDays(new Date(), startDaysAgo),
        customerId: customer.id,
      },
    });
    subscriptionRecords.push({ ...sub, plan: selectedPlan, customer });

    if (selectedPlan.amount > 0) {
      await prisma.subscriptionEvent.create({
        data: {
          organizationId,
          subscriptionId: sub.id,
          type: 'NEW',
          previousMrr: 0,
          newMrr: amount,
          mrrDelta: amount,
          previousPlanId: null,
          previousPlanNickname: null,
          newPlanId: selectedPlan.id,
          newPlanNickname: selectedPlan.name,
          previousQuantity: null,
          newQuantity: quantity,
          occurredAt: subDays(new Date(), startDaysAgo),
        },
      });
    }
  }

  // Payments for last 60 days
  for (let day = 60; day >= 0; day--) {
    const date = subDays(new Date(), day);
    const dayOfWeek = getDay(date);
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const dailyTransactions = isWeekend ? Math.floor(Math.random() * 5) + 2 : Math.floor(Math.random() * 12) + 6;
    
    for (let t = 0; t < dailyTransactions; t++) {
      const sub = subscriptionRecords[Math.floor(Math.random() * subscriptionRecords.length)];
      if (!sub || sub.status === 'canceled' || sub.plan.amount === 0) continue;
      
      const invoiceId = `in_${generateId(14)}`;
      const paymentId = `pi_${generateId(14)}`;
      const amount = sub.planAmount * (sub.quantity || 1);
      const paymentFailed = Math.random() < 0.018; // 1.8% failure
      
      await prisma.stripeInvoice.create({
        data: {
          organizationId,
          stripeId: invoiceId,
          status: paymentFailed ? 'open' : 'paid',
          amountDue: amount,
          amountPaid: paymentFailed ? 0 : amount,
          amountRemaining: paymentFailed ? amount : 0,
          subtotal: amount,
          total: amount,
          tax: 0,
          discountAmount: Math.random() < 0.08 ? Math.floor(amount * 0.2) : 0, // 20% discount occasionally
          periodStart: subDays(date, 30),
          periodEnd: date,
          createdAt: date,
          stripeCreatedAt: date,
          customerId: sub.customerId,
          subscriptionId: sub.id,
        },
      });

      await prisma.stripePayment.create({
        data: {
          organizationId,
          stripeId: paymentId,
          status: paymentFailed ? 'failed' : 'succeeded',
          amount,
          amountRefunded: 0,
          currency: 'usd',
          fee: Math.floor(amount * 0.029 + 30),
          net: paymentFailed ? 0 : amount - Math.floor(amount * 0.029 + 30),
          stripeCreatedAt: date,
          customerId: sub.customerId,
        },
      });
    }
  }

  // Many upgrades (growth story)
  const activeSubscriptions = subscriptionRecords.filter(s => s.status === 'active' && s.plan.amount > 0);
  
  for (let i = 0; i < 18; i++) {
    const sub = activeSubscriptions[Math.floor(Math.random() * activeSubscriptions.length)];
    if (!sub) continue;
    
    const currentPlanIndex = plans.findIndex(p => p.id === sub.planId);
    if (currentPlanIndex < plans.length - 1 && currentPlanIndex > 0) {
      const newPlan = plans[currentPlanIndex + 1];
      await prisma.subscriptionEvent.create({
        data: {
          organizationId,
          subscriptionId: sub.id,
          type: 'UPGRADE',
          previousMrr: sub.planAmount,
          newMrr: newPlan.amount,
          mrrDelta: newPlan.amount - sub.planAmount,
          previousPlanId: sub.planId,
          previousPlanNickname: sub.planNickname,
          newPlanId: newPlan.id,
          newPlanNickname: newPlan.name,
          previousQuantity: sub.quantity,
          newQuantity: sub.quantity,
          occurredAt: subDays(new Date(), Math.floor(Math.random() * 28) + 1),
        },
      });
    }
  }

  // Fewer downgrades
  for (let i = 0; i < 3; i++) {
    const sub = activeSubscriptions[Math.floor(Math.random() * activeSubscriptions.length)];
    if (!sub) continue;
    
    const currentPlanIndex = plans.findIndex(p => p.id === sub.planId);
    if (currentPlanIndex > 1) {
      const newPlan = plans[currentPlanIndex - 1];
      await prisma.subscriptionEvent.create({
        data: {
          organizationId,
          subscriptionId: sub.id,
          type: 'DOWNGRADE',
          previousMrr: sub.planAmount,
          newMrr: newPlan.amount,
          mrrDelta: newPlan.amount - sub.planAmount,
          previousPlanId: sub.planId,
          previousPlanNickname: sub.planNickname,
          newPlanId: newPlan.id,
          newPlanNickname: newPlan.name,
          previousQuantity: sub.quantity,
          newQuantity: sub.quantity,
          occurredAt: subDays(new Date(), Math.floor(Math.random() * 25) + 1),
        },
      });
    }
  }

  // Cancellations
  const canceledSubs = subscriptionRecords.filter(s => s.status === 'canceled' && s.plan.amount > 0);
  for (const sub of canceledSubs.slice(0, 5)) {
    await prisma.subscriptionEvent.create({
      data: {
        organizationId,
        subscriptionId: sub.id,
        type: 'CANCELED',
        previousMrr: sub.planAmount,
        newMrr: 0,
        mrrDelta: -sub.planAmount,
        previousPlanId: sub.planId,
        previousPlanNickname: sub.planNickname,
        newPlanId: sub.planId,
        newPlanNickname: sub.planNickname,
        previousQuantity: sub.quantity,
        newQuantity: 0,
        occurredAt: subDays(new Date(), Math.floor(Math.random() * 20) + 1),
      },
    });
  }

  // Daily metrics with growth trajectory
  const paidSubs = subscriptionRecords.filter(s => s.status === 'active' && s.plan.amount > 0);
  const baseMrr = paidSubs.reduce((sum, sub) => sum + sub.mrr, 0);
  const baseActiveCount = paidSubs.length;
  
  for (let day = 60; day >= 0; day--) {
    const date = startOfDay(subDays(new Date(), day));
    const dayOfWeek = getDay(date);
    const dayIndex = 60 - day;
    
    // Strong growth: ~8% monthly = ~0.25% daily
    const growthFactor = Math.pow(1.0025, dayIndex);
    const mrr = Math.round(baseMrr * growthFactor * 0.7); // Start at 70% of current
    
    // Add some realistic noise
    const noise = mrr * (Math.random() * 0.02 - 0.01);
    const weekendDip = (dayOfWeek === 0 || dayOfWeek === 6) ? -mrr * 0.002 : 0;
    const finalMrr = Math.round(mrr + noise + weekendDip);
    
    const activeSubsCount = Math.round(baseActiveCount * growthFactor * 0.75);
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    const newSubs = isWeekend ? Math.floor(Math.random() * 3) + 2 : Math.floor(Math.random() * 6) + 4;
    const canceledSubs = Math.random() < 0.4 ? Math.floor(Math.random() * 2) + 1 : 0;
    const upgrades = Math.random() < 0.5 ? Math.floor(Math.random() * 3) + 1 : 0;
    const downgrades = Math.random() < 0.1 ? 1 : 0;
    
    const successfulPayments = isWeekend ? Math.floor(Math.random() * 20) + 10 : Math.floor(Math.random() * 40) + 25;
    const failedPayments = Math.floor(successfulPayments * (0.015 + Math.random() * 0.01));
    const totalPayments = successfulPayments + failedPayments;
    
    const grossChurnRate = 2.0 + Math.random() * 0.6;
    const revenueChurnRate = grossChurnRate * 0.65;
    const netRevenueRetention = 118 + Math.random() * 10; // High NRR (growth)
    
    const averageDiscount = 5 + Math.random() * 4;
    const arpu = activeSubsCount > 0 ? Math.round(finalMrr / activeSubsCount) : 0;
    const effectivePrice = Math.round(arpu * (1 - averageDiscount / 100));
    const discountLeakage = Math.round(finalMrr * averageDiscount / 100 * 0.25);
    
    await prisma.dailyMetrics.upsert({
      where: { organizationId_date: { organizationId, date } },
      create: {
        organizationId,
        date,
        mrr: finalMrr,
        arr: finalMrr * 12,
        arpu,
        activeSubscriptions: activeSubsCount,
        newSubscriptions: newSubs,
        canceledSubscriptions: canceledSubs,
        upgrades,
        downgrades,
        grossChurnRate,
        revenueChurnRate,
        netRevenueRetention,
        failedPayments,
        successfulPayments,
        failedPaymentRate: totalPayments > 0 ? (failedPayments / totalPayments) * 100 : 0,
        totalPaymentVolume: finalMrr + Math.floor(Math.random() * 200000),
        averageDiscount,
        effectivePrice,
        discountLeakage,
        planDistribution: {
          Hobby: 0.30 + Math.random() * 0.04 - 0.02,
          Pro: 0.40 + Math.random() * 0.04 - 0.02,
          Team: 0.20 + Math.random() * 0.02 - 0.01,
          Scale: 0.08 + Math.random() * 0.01,
          Enterprise: 0.02 + Math.random() * 0.005,
        },
      },
      update: {
        mrr: finalMrr,
        arr: finalMrr * 12,
        arpu,
        activeSubscriptions: activeSubsCount,
        newSubscriptions: newSubs,
        canceledSubscriptions: canceledSubs,
        upgrades,
        downgrades,
        grossChurnRate,
        revenueChurnRate,
        netRevenueRetention,
        failedPayments,
        successfulPayments,
        failedPaymentRate: totalPayments > 0 ? (failedPayments / totalPayments) * 100 : 0,
        totalPaymentVolume: finalMrr + Math.floor(Math.random() * 200000),
        averageDiscount,
        effectivePrice,
        discountLeakage,
        planDistribution: {
          Hobby: 0.30 + Math.random() * 0.04 - 0.02,
          Pro: 0.40 + Math.random() * 0.04 - 0.02,
          Team: 0.20 + Math.random() * 0.02 - 0.01,
          Scale: 0.08 + Math.random() * 0.01,
          Enterprise: 0.02 + Math.random() * 0.005,
        },
      },
    });
  }

  // AI Insights for growth-stage company
  const insights: {
    category: 'CHURN' | 'PRICING' | 'REVENUE' | 'GROWTH' | 'EFFICIENCY' | 'ANOMALY';
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    title: string;
    description: string;
    confidence: number;
  }[] = [
    {
      category: 'GROWTH',
      severity: 'LOW',
      title: 'Strong MRR growth trajectory',
      description: 'Your MRR is growing at ~8% month-over-month, significantly above the 5% SaaS benchmark. The Pro tier is your biggest growth driver with 40% of paying customers.',
      confidence: 0.92,
    },
    {
      category: 'CHURN',
      severity: 'HIGH',
      title: 'Free-to-paid conversion bottleneck',
      description: 'Only 12% of Hobby (free) users convert to Pro within 30 days. Industry benchmark is 18-22%. Consider adding usage limits or premium feature gates.',
      confidence: 0.88,
    },
    {
      category: 'REVENUE',
      severity: 'MEDIUM',
      title: 'Expansion revenue opportunity',
      description: 'Your 118% NRR is strong, but 35% of Team customers hit usage limits monthly. Auto-upgrade prompts at 80% usage could capture an additional $8K MRR.',
      confidence: 0.79,
    },
    {
      category: 'PRICING',
      severity: 'MEDIUM',
      title: 'Pro tier may be underpriced',
      description: 'Pro customers show 2.3x engagement vs Team customers but pay 3.75x less. Consider adding a $45 Pro Plus tier with higher limits.',
      confidence: 0.74,
    },
    {
      category: 'EFFICIENCY',
      severity: 'LOW',
      title: 'Low payment failure rate',
      description: 'Your 1.8% payment failure rate is well below the 2.5% industry average. Your current dunning setup is working effectively.',
      confidence: 0.91,
    },
  ];

  for (const insight of insights) {
    await prisma.aIInsight.create({
      data: {
        organizationId,
        ...insight,
        dataPoints: { source: 'demo', analyzedPeriod: '60 days' },
      },
    });
  }

  const recommendations = [
    {
      title: 'Implement usage-based upgrade prompts',
      description: 'Show upgrade prompts when users hit 80% of their plan limits. Include real-time usage metrics and one-click upgrade flow.',
      reasoning: '35% of Team users hit limits but don\'t upgrade. Even 15% conversion would add $12K ARR.',
      riskLevel: 'LOW' as const,
      estimatedImpact: 1200_00,
      impactTimeframe: '30 days',
      impactConfidence: 0.78,
      priorityScore: 92,
    },
    {
      title: 'Launch Pro Plus tier at $45/mo',
      description: 'Add an intermediate tier between Pro ($20) and Team ($75) with 3x Pro limits. Target power users who don\'t need team features.',
      reasoning: 'Price gap between Pro and Team is too large. 22% of Pro users show Team-level usage patterns.',
      riskLevel: 'MEDIUM' as const,
      estimatedImpact: 8500_00,
      impactTimeframe: '60 days',
      impactConfidence: 0.65,
      priorityScore: 85,
    },
    {
      title: 'Improve Hobby to Pro conversion',
      description: 'Add 14-day Pro trial for Hobby users after 7 days of activity. Send feature comparison emails highlighting what they\'re missing.',
      reasoning: 'Current 12% conversion is 40% below benchmark. Each 1% improvement = ~$2K MRR.',
      riskLevel: 'LOW' as const,
      estimatedImpact: 6000_00,
      impactTimeframe: '45 days',
      impactConfidence: 0.72,
      priorityScore: 88,
    },
    {
      title: 'Enterprise self-serve pricing page',
      description: 'Add public Enterprise pricing with volume discounts. Include ROI calculator and case studies from similar companies.',
      reasoning: 'Enterprise tier is only 2% of customers but 15% of MRR. Reducing friction could 2x Enterprise signups.',
      riskLevel: 'LOW' as const,
      estimatedImpact: 25000_00,
      impactTimeframe: '90 days',
      impactConfidence: 0.55,
      priorityScore: 75,
    },
  ];

  for (const rec of recommendations) {
    await prisma.aIRecommendation.create({
      data: {
        organizationId,
        ...rec,
        baselineMetrics: {
          mrr: 45000,
          churnRate: 2.3,
          activeSubscriptions: 84,
          arpu: 535,
          nrr: 118,
        },
      },
    });
  }
}

function generateId(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
