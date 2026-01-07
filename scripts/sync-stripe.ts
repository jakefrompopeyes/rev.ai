/**
 * Stripe Data Sync Script
 * Run via: npm run sync:stripe
 * 
 * This script syncs Stripe data for all connected organizations.
 * Designed to be run as a daily cron job.
 */

import { prisma } from '../lib/db';
import { syncStripeData } from '../lib/stripe/sync';
import { computeDailyMetrics } from '../lib/metrics/compute';
import { generateInsights } from '../lib/ai/insights';
import { generateRecommendations } from '../lib/ai/recommendations';

async function main() {
  console.log('🔄 Starting Stripe sync job...');
  console.log(`   Time: ${new Date().toISOString()}`);

  // Get all organizations with active Stripe connections
  const connections = await prisma.stripeConnection.findMany({
    where: {
      disconnectedAt: null,
    },
    include: {
      organization: true,
    },
  });

  console.log(`📊 Found ${connections.length} connected organization(s)`);

  for (const connection of connections) {
    const orgName = connection.organization.name;
    const orgId = connection.organizationId;

    console.log(`\n--- Processing: ${orgName} (${orgId}) ---`);

    try {
      // Step 1: Sync Stripe data
      console.log('   📥 Syncing Stripe data...');
      const syncResult = await syncStripeData(orgId);
      console.log(`   ✓ Synced: ${syncResult.customers} customers, ${syncResult.subscriptions} subscriptions`);
      console.log(`            ${syncResult.invoices} invoices, ${syncResult.payments} payments`);

      // Step 2: Compute daily metrics
      console.log('   📈 Computing metrics...');
      const metrics = await computeDailyMetrics(orgId);
      console.log(`   ✓ MRR: $${(metrics.mrr / 100).toLocaleString()}, Active: ${metrics.activeSubscriptions}`);

      // Step 3: Generate AI insights
      console.log('   🧠 Generating insights...');
      const insights = await generateInsights(orgId);
      console.log(`   ✓ Generated ${insights.length} insight(s)`);

      // Step 4: Generate recommendations
      console.log('   💡 Generating recommendations...');
      const recommendations = await generateRecommendations(orgId);
      console.log(`   ✓ Generated ${recommendations.length} recommendation(s)`);

      console.log(`   ✅ ${orgName} completed successfully`);
    } catch (error) {
      console.error(`   ❌ Error processing ${orgName}:`, error);
    }
  }

  console.log('\n✨ Sync job completed');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());


