/**
 * Database Seed Script
 * Run via: npm run db:seed
 * 
 * Creates realistic demo data for a fast-growing developer tools SaaS
 */

import { PrismaClient, InsightCategory, InsightSeverity, RiskLevel } from '@prisma/client';
import { subDays, format, getDay, startOfDay } from 'date-fns';

const prisma = new PrismaClient();

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
  'Hightouch', 'Census Data', 'Amplitude', 'Mixpanel', 'PostHog',
  'Plausible', 'Fathom Analytics', 'SimpleAnalytics', 'Pirsch', 'Umami'
];

const firstNames = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Quinn', 'Avery', 'Cameron', 'Drew'];
const lastNames = ['Park', 'Kim', 'Lee', 'Nakamura', 'Singh', 'Patel', 'Andersen', 'Müller', 'Costa', 'Russo'];

function generateId(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function main() {
  console.log('🌱 Seeding database with growth-stage SaaS data...');

  // Create demo organization
  const org = await prisma.organization.upsert({
    where: { id: 'demo-org-001' },
    update: {},
    create: {
      id: 'demo-org-001',
      name: 'DevTools Pro',
      users: {
        create: {
          email: 'demo@revai.com',
          name: 'Demo User',
          hashedPassword: 'demo123',
        },
      },
    },
    include: { users: true },
  });

  console.log(`✓ Created organization: ${org.name}`);
  console.log(`  User: ${org.users[0].email}`);

  // Clean existing data for fresh seed
  await prisma.aIRecommendation.deleteMany({ where: { organizationId: org.id } });
  await prisma.aIInsight.deleteMany({ where: { organizationId: org.id } });
  await prisma.dailyMetrics.deleteMany({ where: { organizationId: org.id } });
  await prisma.subscriptionEvent.deleteMany({ where: { organizationId: org.id } });
  await prisma.stripePayment.deleteMany({ where: { organizationId: org.id } });
  await prisma.stripeInvoice.deleteMany({ where: { organizationId: org.id } });
  await prisma.stripeSubscription.deleteMany({ where: { organizationId: org.id } });
  await prisma.stripeCustomer.deleteMany({ where: { organizationId: org.id } });
  await prisma.stripeConnection.deleteMany({ where: { organizationId: org.id } });

  // Stripe connection
  await prisma.stripeConnection.create({
    data: {
      organizationId: org.id,
      stripeAccountId: `acct_demo_${generateId(8)}`,
      accessToken: 'demo_access_token',
      livemode: false,
      scope: 'read_only',
      lastSyncAt: new Date(),
      lastSyncStatus: 'success',
    },
  });

  console.log('✓ Created Stripe connection');

  // Usage-based pricing tiers
  const plans = [
    { id: 'price_hobby', name: 'Hobby', amount: 0, weight: 0.25 },           // Free tier
    { id: 'price_pro', name: 'Pro', amount: 2000, weight: 0.42 },            // $20/mo
    { id: 'price_team', name: 'Team', amount: 7500, weight: 0.22 },          // $75/mo
    { id: 'price_scale', name: 'Scale', amount: 25000, weight: 0.08 },       // $250/mo
    { id: 'price_enterprise', name: 'Enterprise', amount: 100000, weight: 0.03 }, // $1000/mo
  ];

  // Create 100 customers
  const customers = [];
  for (let i = 0; i < 100; i++) {
    const companyName = companyNames[i % companyNames.length];
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const domain = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    const customer = await prisma.stripeCustomer.create({
      data: {
        organizationId: org.id,
        stripeId: `cus_${generateId(14)}`,
        email: `${firstName.toLowerCase()}@${domain}.dev`,
        stripeCreatedAt: subDays(new Date(), Math.floor(Math.pow(Math.random(), 0.5) * 90)),
        currency: 'usd',
        delinquent: Math.random() < 0.02,
        metadata: { company: companyName, contact: `${firstName} ${lastName}` },
      },
    });
    customers.push(customer);
  }

  console.log(`✓ Created ${customers.length} customers`);

  // Create subscriptions
  const subscriptions = [];
  for (const customer of customers) {
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

    let quantity = 1;
    if (selectedPlan.name === 'Team') quantity = Math.floor(Math.random() * 5) + 3;
    if (selectedPlan.name === 'Scale') quantity = Math.floor(Math.random() * 8) + 5;
    if (selectedPlan.name === 'Enterprise') quantity = Math.floor(Math.random() * 15) + 10;

    const amount = selectedPlan.amount * quantity;
    const startDaysAgo = Math.floor(Math.pow(Math.random(), 0.5) * 90);
    
    // Status distribution
    const statusRand = Math.random();
    let status = 'active';
    if (selectedPlan.name === 'Hobby') {
      status = statusRand < 0.12 ? 'canceled' : 'active';
    } else {
      status = statusRand < 0.05 ? 'canceled' : statusRand < 0.08 ? 'past_due' : 'active';
    }

    const mrr = status === 'canceled' || selectedPlan.amount === 0 ? 0 : amount;
    const hasDiscount = Math.random() < 0.15;
    const discountPercent = hasDiscount ? [10, 15, 20][Math.floor(Math.random() * 3)] : null;
    const effectiveMrr = discountPercent ? Math.round(mrr * (1 - discountPercent / 100)) : mrr;

    const sub = await prisma.stripeSubscription.create({
      data: {
        organizationId: org.id,
        customerId: customer.id,
        stripeId: `sub_${generateId(14)}`,
        status,
        currentPeriodStart: subDays(new Date(), startDaysAgo % 30),
        currentPeriodEnd: subDays(new Date(), (startDaysAgo % 30) - 30),
        cancelAtPeriodEnd: Math.random() < 0.04,
        startDate: subDays(new Date(), startDaysAgo),
        billingCycleAnchor: subDays(new Date(), startDaysAgo),
        planId: selectedPlan.id,
        planNickname: selectedPlan.name,
        planAmount: selectedPlan.amount,
        planInterval: 'month',
        discountPercent,
        quantity,
        mrr: effectiveMrr,
        arr: effectiveMrr * 12,
        stripeCreatedAt: subDays(new Date(), startDaysAgo),
        canceledAt: status === 'canceled' ? subDays(new Date(), Math.floor(Math.random() * 20)) : null,
      },
    });
    subscriptions.push({ ...sub, plan: selectedPlan });

    // Create NEW event for paid subscriptions
    if (selectedPlan.amount > 0) {
      await prisma.subscriptionEvent.create({
        data: {
          organizationId: org.id,
          subscriptionId: sub.id,
          type: 'NEW',
          previousMrr: 0,
          newMrr: amount,
          mrrDelta: amount,
          newPlanId: selectedPlan.id,
          newPlanNickname: selectedPlan.name,
          newQuantity: quantity,
          occurredAt: subDays(new Date(), startDaysAgo),
        },
      });
    }
  }

  console.log(`✓ Created ${subscriptions.length} subscriptions`);

  // Create payments for last 60 days
  let paymentCount = 0;
  for (let day = 60; day >= 0; day--) {
    const date = subDays(new Date(), day);
    const dayOfWeek = getDay(date);
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const dailyTransactions = isWeekend ? Math.floor(Math.random() * 4) + 2 : Math.floor(Math.random() * 10) + 5;

    for (let t = 0; t < dailyTransactions; t++) {
      const sub = subscriptions[Math.floor(Math.random() * subscriptions.length)];
      if (!sub || sub.status === 'canceled' || sub.plan.amount === 0) continue;

      const amount = sub.planAmount * (sub.quantity || 1);
      const paymentFailed = Math.random() < 0.02;

      await prisma.stripeInvoice.create({
        data: {
          organizationId: org.id,
          stripeId: `in_${generateId(14)}`,
          status: paymentFailed ? 'open' : 'paid',
          amountDue: amount,
          amountPaid: paymentFailed ? 0 : amount,
          amountRemaining: paymentFailed ? amount : 0,
          subtotal: amount,
          total: amount,
          tax: 0,
          discountAmount: Math.random() < 0.1 ? Math.floor(amount * 0.15) : 0,
          periodStart: subDays(date, 30),
          periodEnd: date,
          stripeCreatedAt: date,
          customerId: sub.customerId,
          subscriptionId: sub.id,
        },
      });

      await prisma.stripePayment.create({
        data: {
          organizationId: org.id,
          stripeId: `pi_${generateId(14)}`,
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
      paymentCount++;
    }
  }

  console.log(`✓ Created ${paymentCount} payments`);

  // Create upgrade events
  const activeSubscriptions = subscriptions.filter(s => s.status === 'active' && s.plan.amount > 0);
  let eventCount = 0;

  for (let i = 0; i < 15; i++) {
    const sub = activeSubscriptions[Math.floor(Math.random() * activeSubscriptions.length)];
    if (!sub) continue;
    
    const currentIndex = plans.findIndex(p => p.id === sub.planId);
    if (currentIndex > 0 && currentIndex < plans.length - 1) {
      const newPlan = plans[currentIndex + 1];
      await prisma.subscriptionEvent.create({
        data: {
          organizationId: org.id,
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
          occurredAt: subDays(new Date(), Math.floor(Math.random() * 30) + 1),
        },
      });
      eventCount++;
    }
  }

  // Downgrades
  for (let i = 0; i < 3; i++) {
    const sub = activeSubscriptions[Math.floor(Math.random() * activeSubscriptions.length)];
    if (!sub) continue;
    
    const currentIndex = plans.findIndex(p => p.id === sub.planId);
    if (currentIndex > 1) {
      const newPlan = plans[currentIndex - 1];
      await prisma.subscriptionEvent.create({
        data: {
          organizationId: org.id,
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
      eventCount++;
    }
  }

  // Cancellations
  const canceledSubs = subscriptions.filter(s => s.status === 'canceled' && s.plan.amount > 0);
  for (const sub of canceledSubs.slice(0, 4)) {
    await prisma.subscriptionEvent.create({
      data: {
        organizationId: org.id,
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
    eventCount++;
  }

  console.log(`✓ Created ${eventCount} subscription events`);

  // Daily metrics with growth trajectory
  const paidSubs = subscriptions.filter(s => s.status === 'active' && s.plan.amount > 0);
  const baseMrr = paidSubs.reduce((sum, sub) => sum + sub.mrr, 0);
  const baseCount = paidSubs.length;

  for (let day = 60; day >= 0; day--) {
    const date = startOfDay(subDays(new Date(), day));
    const dayOfWeek = getDay(date);
    const dayIndex = 60 - day;
    
    // ~7% monthly growth
    const growthFactor = Math.pow(1.0023, dayIndex);
    const mrr = Math.round(baseMrr * growthFactor * 0.72);
    const noise = mrr * (Math.random() * 0.015 - 0.0075);
    const weekendDip = (dayOfWeek === 0 || dayOfWeek === 6) ? -mrr * 0.002 : 0;
    const finalMrr = Math.round(mrr + noise + weekendDip);
    
    const activeSubsCount = Math.round(baseCount * growthFactor * 0.78);
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    await prisma.dailyMetrics.upsert({
      where: { organizationId_date: { organizationId: org.id, date } },
      update: {},
      create: {
        organizationId: org.id,
        date,
        mrr: finalMrr,
        arr: finalMrr * 12,
        arpu: activeSubsCount > 0 ? Math.round(finalMrr / activeSubsCount) : 0,
        activeSubscriptions: activeSubsCount,
        newSubscriptions: isWeekend ? Math.floor(Math.random() * 3) + 2 : Math.floor(Math.random() * 5) + 3,
        canceledSubscriptions: Math.random() < 0.35 ? Math.floor(Math.random() * 2) + 1 : 0,
        upgrades: Math.random() < 0.45 ? Math.floor(Math.random() * 3) + 1 : 0,
        downgrades: Math.random() < 0.1 ? 1 : 0,
        grossChurnRate: 2.2 + Math.random() * 0.5,
        revenueChurnRate: 1.8 + Math.random() * 0.4,
        netRevenueRetention: 115 + Math.random() * 12,
        failedPayments: Math.floor(Math.random() * 3),
        successfulPayments: isWeekend ? Math.floor(Math.random() * 15) + 8 : Math.floor(Math.random() * 30) + 18,
        failedPaymentRate: 1.5 + Math.random() * 1,
        totalPaymentVolume: finalMrr + Math.floor(Math.random() * 150000),
        averageDiscount: 6 + Math.random() * 4,
        effectivePrice: activeSubsCount > 0 ? Math.round(finalMrr / activeSubsCount * 0.94) : 0,
        discountLeakage: Math.round(finalMrr * 0.04),
        planDistribution: {
          Hobby: 0.25 + Math.random() * 0.03 - 0.015,
          Pro: 0.42 + Math.random() * 0.04 - 0.02,
          Team: 0.22 + Math.random() * 0.02 - 0.01,
          Scale: 0.08 + Math.random() * 0.01,
          Enterprise: 0.03 + Math.random() * 0.005,
        },
      },
    });
  }

  console.log('✓ Created 60 days of metrics');

  // AI Insights
  const insights = [
    {
      category: 'GROWTH' as InsightCategory,
      severity: 'LOW' as InsightSeverity,
      title: 'Strong MRR growth at 7% monthly',
      description: 'Your MRR is growing at ~7% month-over-month, above the 5% SaaS benchmark. Pro tier drives 42% of paid customers.',
      confidence: 0.92,
    },
    {
      category: 'CHURN' as InsightCategory,
      severity: 'HIGH' as InsightSeverity,
      title: 'Free-to-paid conversion below benchmark',
      description: 'Only 14% of Hobby users convert to Pro within 30 days. Industry benchmark is 18-22%. Consider adding usage limits or feature gates.',
      confidence: 0.86,
    },
    {
      category: 'REVENUE' as InsightCategory,
      severity: 'MEDIUM' as InsightSeverity,
      title: 'Expansion revenue opportunity',
      description: 'Your 115% NRR is solid, but 32% of Team customers hit usage limits monthly. Auto-upgrade prompts could capture $6K+ MRR.',
      confidence: 0.78,
    },
    {
      category: 'PRICING' as InsightCategory,
      severity: 'MEDIUM' as InsightSeverity,
      title: 'Pro tier may be underpriced',
      description: 'Pro customers show 2.1x engagement vs Team but pay 3.75x less. Consider a Pro Plus tier at $45/mo.',
      confidence: 0.72,
    },
    {
      category: 'EFFICIENCY' as InsightCategory,
      severity: 'LOW' as InsightSeverity,
      title: 'Payment failure rate is excellent',
      description: 'Your 2% payment failure rate is well below the 2.8% industry average. Current dunning setup works well.',
      confidence: 0.91,
    },
  ];

  for (const insight of insights) {
    await prisma.aIInsight.create({
      data: {
        organizationId: org.id,
        ...insight,
        dataPoints: { source: 'seed', analyzedPeriod: '60 days' },
      },
    });
  }

  console.log(`✓ Created ${insights.length} insights`);

  // Recommendations
  const recommendations = [
    {
      title: 'Implement usage-based upgrade prompts',
      description: 'Show upgrade prompts at 80% plan limits. Include real-time usage and one-click upgrade.',
      reasoning: '32% of Team users hit limits but don\'t upgrade. 15% conversion = $9K ARR.',
      riskLevel: 'LOW' as RiskLevel,
      estimatedImpact: 900_00,
      impactTimeframe: '30 days',
      impactConfidence: 0.76,
      priorityScore: 92,
    },
    {
      title: 'Launch Pro Plus tier at $45/mo',
      description: 'Add tier between Pro ($20) and Team ($75) with 3x Pro limits. Target power users.',
      reasoning: 'Price gap is too large. 20% of Pro users show Team-level usage patterns.',
      riskLevel: 'MEDIUM' as RiskLevel,
      estimatedImpact: 7200_00,
      impactTimeframe: '60 days',
      impactConfidence: 0.62,
      priorityScore: 84,
    },
    {
      title: 'Improve Hobby to Pro conversion',
      description: '14-day Pro trial for Hobby users after 7 days of activity. Feature comparison emails.',
      reasoning: 'Current 14% conversion is 30% below benchmark. Each 1% = ~$1.5K MRR.',
      riskLevel: 'LOW' as RiskLevel,
      estimatedImpact: 4500_00,
      impactTimeframe: '45 days',
      impactConfidence: 0.70,
      priorityScore: 88,
    },
    {
      title: 'Enterprise self-serve pricing',
      description: 'Public Enterprise pricing with volume discounts, ROI calculator, and case studies.',
      reasoning: 'Enterprise is 3% of customers but 12% of MRR. Lower friction could 2x signups.',
      riskLevel: 'LOW' as RiskLevel,
      estimatedImpact: 20000_00,
      impactTimeframe: '90 days',
      impactConfidence: 0.52,
      priorityScore: 72,
    },
  ];

  for (const rec of recommendations) {
    await prisma.aIRecommendation.create({
      data: {
        organizationId: org.id,
        ...rec,
        baselineMetrics: {
          mrr: baseMrr,
          churnRate: 2.4,
          activeSubscriptions: baseCount,
          nrr: 115,
        },
      },
    });
  }

  console.log(`✓ Created ${recommendations.length} recommendations`);

  console.log('\n✨ Seeding completed!');
  console.log('\n📋 Demo credentials:');
  console.log('   Email: demo@revai.com');
  console.log('   Password: demo123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
