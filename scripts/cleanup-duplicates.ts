/**
 * Script to clean up duplicate insights and recommendations
 * 
 * Run with: npx tsx scripts/cleanup-duplicates.ts
 * 
 * Make sure you have a .env file with DATABASE_URL set, or set it as an environment variable
 */

// Load .env file manually (simple approach without dotenv dependency)
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// Try to load .env file - MUST happen before any other imports that might use env vars
const envPath = resolve(process.cwd(), '.env');
if (existsSync(envPath)) {
  try {
    const envFile = readFileSync(envPath, 'utf-8');
    envFile.split('\n').forEach(line => {
      const trimmed = line.trim();
      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) return;
      
      // Handle both KEY=value and KEY="value" formats
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        // Only set if not already in process.env (env vars take precedence)
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    });
    console.log('✅ Loaded environment variables from .env file');
  } catch (error) {
    console.warn('⚠️  Warning: Could not read .env file:', error);
  }
} else {
  console.warn('⚠️  Warning: .env file not found. Make sure DATABASE_URL is set as an environment variable.');
}

// Import Prisma directly to avoid env validation
import { PrismaClient } from '@prisma/client';

if (!process.env.DATABASE_URL) {
  console.error('\n❌ Error: DATABASE_URL environment variable is required');
  console.error('   Please set it in your .env file or as an environment variable\n');
  process.exit(1);
}

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

async function cleanupDuplicates() {
  console.log('✅ DATABASE_URL is set, proceeding with cleanup...\n');
  console.log('Starting cleanup of duplicate insights and recommendations...\n');

  // Clean up duplicate insights
  console.log('Cleaning duplicate insights...');
  const allInsights = await prisma.aIInsight.findMany({
    orderBy: { generatedAt: 'desc' },
  });

  const insightGroups = new Map<string, typeof allInsights>();
  
  for (const insight of allInsights) {
    const key = `${insight.organizationId}:${insight.title}:${insight.category}`;
    if (!insightGroups.has(key)) {
      insightGroups.set(key, []);
    }
    insightGroups.get(key)!.push(insight);
  }

  let insightsDeleted = 0;
  for (const [key, group] of insightGroups.entries()) {
    if (group.length > 1) {
      // Keep the most recent active one, or most recent if none are active
      const active = group.filter(i => i.isActive && !i.dismissedAt);
      const toKeep = active.length > 0 
        ? active.sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime())[0]
        : group.sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime())[0];
      
      const toDelete = group.filter(i => i.id !== toKeep.id);
      
      for (const insight of toDelete) {
        await prisma.aIInsight.delete({ where: { id: insight.id } });
        insightsDeleted++;
      }
      
      console.log(`  - ${key}: Kept 1, deleted ${toDelete.length} duplicates`);
    }
  }

  console.log(`Deleted ${insightsDeleted} duplicate insights\n`);

  // Clean up duplicate recommendations
  console.log('Cleaning duplicate recommendations...');
  const allRecommendations = await prisma.aIRecommendation.findMany({
    orderBy: { generatedAt: 'desc' },
  });

  const recGroups = new Map<string, typeof allRecommendations>();
  
  for (const rec of allRecommendations) {
    const key = `${rec.organizationId}:${rec.title}${rec.insightId ? `:${rec.insightId}` : ''}`;
    if (!recGroups.has(key)) {
      recGroups.set(key, []);
    }
    recGroups.get(key)!.push(rec);
  }

  let recsDeleted = 0;
  for (const [key, group] of recGroups.entries()) {
    if (group.length > 1) {
      // Keep the most recent pending/implemented one, or most recent if all dismissed
      const active = group.filter(r => r.status === 'PENDING' || r.status === 'IMPLEMENTED');
      const toKeep = active.length > 0
        ? active.sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime())[0]
        : group.sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime())[0];
      
      const toDelete = group.filter(r => r.id !== toKeep.id);
      
      for (const rec of toDelete) {
        await prisma.aIRecommendation.delete({ where: { id: rec.id } });
        recsDeleted++;
      }
      
      console.log(`  - ${key}: Kept 1, deleted ${toDelete.length} duplicates`);
    }
  }

  console.log(`Deleted ${recsDeleted} duplicate recommendations\n`);

  console.log('Cleanup complete!');
  console.log(`Total deleted: ${insightsDeleted} insights, ${recsDeleted} recommendations`);
}

cleanupDuplicates()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
