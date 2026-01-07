/**
 * Database Seed Script
 * Run via: npm run db:seed
 * 
 * Creates sample data for development and testing.
 */

import { PrismaClient, InsightCategory, InsightSeverity, RiskLevel } from '@prisma/client';
import { subDays, format } from 'date-fns';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create a demo organization and user
  const org = await prisma.organization.upsert({
    where: { id: 'demo-org-001' },
    update: {},
    create: {
      id: 'demo-org-001',
      name: 'Demo Company',
      users: {
        create: {
          email: 'demo@revai.com',
          name: 'Demo User',
          hashedPassword: 'demo123', // In production, use bcrypt
        },
      },
    },
    include: { users: true },
  });

  console.log(`✓ Created organization: ${org.name}`);
  console.log(`  User: ${org.users[0].email}`);

  // Create mock Stripe connection (for UI testing without actual Stripe)
  await prisma.stripeConnection.upsert({
    where: { organizationId: org.id },
    update: {},
    create: {
      organizationId: org.id,
      stripeAccountId: 'acct_demo_123456',
      accessToken: 'demo_access_token',
      livemode: false,
      lastSyncAt: new Date(),
      lastSyncStatus: 'success',
    },
  });

  console.log('✓ Created mock Stripe connection');

  // Create mock customers
  const customers = [];
  for (let i = 0; i < 50; i++) {
    const customer = await prisma.stripeCustomer.upsert({
      where: {
        organizationId_stripeId: {
          organizationId: org.id,
          stripeId: `cus_demo_${i.toString().padStart(3, '0')}`,
        },
      },
      update: {},
      create: {
        organizationId: org.id,
        stripeId: `cus_demo_${i.toString().padStart(3, '0')}`,
        email: `cu***@example${i}.com`,
        stripeCreatedAt: subDays(new Date(), Math.floor(Math.random() * 365)),
        currency: 'usd',
        delinquent: Math.random() < 0.05,
      },
    });
    customers.push(customer);
  }

  console.log(`✓ Created ${customers.length} mock customers`);

  // Create mock subscriptions with different plans
  const plans = [
    { id: 'price_starter', name: 'Starter', amount: 2900, interval: 'month' },
    { id: 'price_pro', name: 'Pro', amount: 9900, interval: 'month' },
    { id: 'price_enterprise', name: 'Enterprise', amount: 29900, interval: 'month' },
    { id: 'price_pro_annual', name: 'Pro (Annual)', amount: 99900, interval: 'year' },
  ];

  let subscriptionCount = 0;
  for (const customer of customers) {
    const plan = plans[Math.floor(Math.random() * plans.length)];
    const hasDiscount = Math.random() < 0.3;
    const discountPercent = hasDiscount ? [10, 15, 20, 25, 30][Math.floor(Math.random() * 5)] : null;
    
    const isCanceled = Math.random() < 0.15;
    const startDate = subDays(new Date(), Math.floor(Math.random() * 300) + 30);

    const mrr = plan.interval === 'year' 
      ? Math.round(plan.amount / 12)
      : plan.amount;

    await prisma.stripeSubscription.upsert({
      where: {
        organizationId_stripeId: {
          organizationId: org.id,
          stripeId: `sub_demo_${subscriptionCount.toString().padStart(3, '0')}`,
        },
      },
      update: {},
      create: {
        organizationId: org.id,
        customerId: customer.id,
        stripeId: `sub_demo_${subscriptionCount.toString().padStart(3, '0')}`,
        status: isCanceled ? 'canceled' : 'active',
        currentPeriodStart: subDays(new Date(), Math.floor(Math.random() * 30)),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        startDate,
        billingCycleAnchor: startDate,
        planId: plan.id,
        planNickname: plan.name,
        planAmount: plan.amount,
        planInterval: plan.interval,
        discountPercent,
        quantity: 1,
        mrr: discountPercent ? Math.round(mrr * (1 - discountPercent / 100)) : mrr,
        arr: discountPercent ? Math.round(mrr * 12 * (1 - discountPercent / 100)) : mrr * 12,
        stripeCreatedAt: startDate,
        canceledAt: isCanceled ? subDays(new Date(), Math.floor(Math.random() * 30)) : null,
      },
    });
    subscriptionCount++;
  }

  console.log(`✓ Created ${subscriptionCount} mock subscriptions`);

  // Create mock daily metrics for the past 90 days
  let baseMrr = 3500000; // $35,000 starting MRR
  
  for (let i = 90; i >= 0; i--) {
    const date = subDays(new Date(), i);
    
    // Add some growth with variance
    baseMrr += Math.floor(Math.random() * 50000 - 10000);
    baseMrr = Math.max(baseMrr, 3000000); // Floor at $30k
    
    const activeSubscriptions = Math.floor(baseMrr / 7500); // Approx $75 ARPU
    const churnRate = 2.5 + (Math.random() * 2 - 1);
    const discountLeakage = Math.floor(baseMrr * (Math.random() * 0.12 + 0.05));

    await prisma.dailyMetrics.upsert({
      where: {
        organizationId_date: {
          organizationId: org.id,
          date,
        },
      },
      update: {},
      create: {
        organizationId: org.id,
        date,
        mrr: baseMrr,
        arr: baseMrr * 12,
        arpu: Math.floor(baseMrr / activeSubscriptions),
        activeSubscriptions,
        newSubscriptions: Math.floor(Math.random() * 8 + 2),
        canceledSubscriptions: Math.floor(Math.random() * 4),
        upgrades: Math.floor(Math.random() * 3),
        downgrades: Math.floor(Math.random() * 2),
        grossChurnRate: churnRate,
        revenueChurnRate: churnRate * 1.2,
        netRevenueRetention: 100 + (Math.random() * 20 - 5),
        failedPayments: Math.floor(Math.random() * 5),
        successfulPayments: Math.floor(Math.random() * 30 + 20),
        failedPaymentRate: Math.random() * 4 + 1,
        totalPaymentVolume: Math.floor(baseMrr * 0.9),
        averageDiscount: 8 + Math.random() * 4,
        effectivePrice: Math.floor(baseMrr / activeSubscriptions * 0.92),
        discountLeakage,
        planDistribution: {
          Starter: Math.floor(activeSubscriptions * 0.4),
          Pro: Math.floor(activeSubscriptions * 0.35),
          Enterprise: Math.floor(activeSubscriptions * 0.15),
          'Pro (Annual)': Math.floor(activeSubscriptions * 0.1),
        },
      },
    });
  }

  console.log('✓ Created 90 days of mock metrics');

  // Create sample insights
  const sampleInsights = [
    {
      category: 'CHURN' as InsightCategory,
      severity: 'HIGH' as InsightSeverity,
      title: 'Starter plan has elevated churn',
      description: 'Customers on Starter churn 2.4x faster than those on Pro. This suggests the Starter plan may not deliver enough value to retain customers long-term.',
      confidence: 0.85,
    },
    {
      category: 'PRICING' as InsightCategory,
      severity: 'MEDIUM' as InsightSeverity,
      title: 'Significant discount leakage detected',
      description: "You're losing 11.2% of potential revenue to discounts ($3,920/month). Review your discounting strategy to ensure discounts are driving conversions.",
      confidence: 0.9,
    },
    {
      category: 'REVENUE' as InsightCategory,
      severity: 'LOW' as InsightSeverity,
      title: 'Annual plan adoption is low',
      description: 'Only 22% of customers are on annual plans. Annual plans typically have higher LTV and lower churn. Consider incentivizing annual upgrades.',
      confidence: 0.88,
    },
    {
      category: 'PRICING' as InsightCategory,
      severity: 'MEDIUM' as InsightSeverity,
      title: 'Heavy discounts correlate with higher churn',
      description: 'Customers who received >20% discounts churn 1.8x more often than those with smaller or no discounts. Consider qualifying discounts more carefully.',
      confidence: 0.75,
    },
    {
      category: 'GROWTH' as InsightCategory,
      severity: 'LOW' as InsightSeverity,
      title: 'Strong MRR growth trajectory',
      description: 'Your MRR has grown 8.3% over the past 30 days. This positive momentum indicates healthy customer acquisition and retention.',
      confidence: 0.95,
    },
  ];

  for (const insight of sampleInsights) {
    await prisma.aIInsight.create({
      data: {
        organizationId: org.id,
        ...insight,
        dataPoints: { source: 'seed' },
      },
    });
  }

  console.log(`✓ Created ${sampleInsights.length} sample insights`);

  // Create sample recommendations
  const insights = await prisma.aIInsight.findMany({
    where: { organizationId: org.id },
    take: 3,
  });

  const sampleRecommendations = [
    {
      title: 'Implement proactive churn prevention program',
      description: 'Deploy automated health scoring for at-risk customers and trigger intervention workflows when risk indicators appear.',
      reasoning: 'With a 3.2% churn rate, you are losing approximately $1,120/month. A well-executed retention program typically reduces churn by 20-40%.',
      riskLevel: 'LOW' as RiskLevel,
      estimatedImpact: 403200, // $4,032 over 6 months
      impactTimeframe: '6 months',
      impactConfidence: 0.6,
      priorityScore: 85,
      insightId: insights[0]?.id,
    },
    {
      title: 'Implement discount governance policy',
      description: 'Create approval workflows for discounts above 15%, set expiration dates on all discounts, and track which sales reps use discounts most frequently.',
      reasoning: "You're losing $3,920/month to discounts. Many of these may not be driving conversions that wouldn't happen anyway.",
      riskLevel: 'MEDIUM' as RiskLevel,
      estimatedImpact: 940800, // $9,408 over 6 months (40% reduction)
      impactTimeframe: '6 months',
      impactConfidence: 0.65,
      priorityScore: 70,
      insightId: insights[1]?.id,
    },
    {
      title: 'Launch annual plan upgrade campaign',
      description: 'Email monthly subscribers offering 2 months free when switching to annual. Highlight the savings and position annual as the "smart choice".',
      reasoning: 'Only 22% of customers are on annual plans. Annual customers typically have 50-80% lower churn.',
      riskLevel: 'LOW' as RiskLevel,
      estimatedImpact: 252000, // $2,520 impact
      impactTimeframe: '6 months',
      impactConfidence: 0.7,
      priorityScore: 75,
      insightId: insights[2]?.id,
    },
    {
      title: 'Review Starter plan value proposition',
      description: 'Analyze what makes Pro customers stick around and either add those features to Starter or create a migration path for high-value customers.',
      reasoning: 'Starter customers churn significantly faster, suggesting a value mismatch.',
      riskLevel: 'MEDIUM' as RiskLevel,
      estimatedImpact: 175000,
      impactTimeframe: '6 months',
      impactConfidence: 0.5,
      priorityScore: 65,
    },
  ];

  for (const rec of sampleRecommendations) {
    await prisma.aIRecommendation.create({
      data: {
        organizationId: org.id,
        ...rec,
        baselineMetrics: {
          mrr: baseMrr,
          churnRate: 3.2,
          activeSubscriptions: 467,
        },
      },
    });
  }

  console.log(`✓ Created ${sampleRecommendations.length} sample recommendations`);

  console.log('\n✨ Seeding completed!');
  console.log('\n📋 Demo credentials:');
  console.log('   Email: demo@revai.com');
  console.log('   Password: demo123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

