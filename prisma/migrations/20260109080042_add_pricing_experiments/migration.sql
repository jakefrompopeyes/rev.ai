-- CreateEnum
CREATE TYPE "InsightCategory" AS ENUM ('CHURN', 'PRICING', 'REVENUE', 'GROWTH', 'EFFICIENCY', 'ANOMALY');

-- CreateEnum
CREATE TYPE "InsightSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('PENDING', 'IMPLEMENTED', 'DISMISSED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SubscriptionEventType" AS ENUM ('UPGRADE', 'DOWNGRADE', 'NEW', 'CANCELED', 'REACTIVATED');

-- CreateEnum
CREATE TYPE "ExperimentStatus" AS ENUM ('DRAFT', 'RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "hashedPassword" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "stripe_connections" (
    "id" TEXT NOT NULL,
    "stripeAccountId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "tokenType" TEXT NOT NULL DEFAULT 'bearer',
    "scope" TEXT,
    "livemode" BOOLEAN NOT NULL DEFAULT false,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disconnectedAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncStatus" TEXT,
    "lastSyncError" TEXT,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "stripe_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stripe_customers" (
    "id" TEXT NOT NULL,
    "stripeId" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stripeCreatedAt" TIMESTAMP(3) NOT NULL,
    "currency" TEXT,
    "delinquent" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "stripe_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stripe_subscriptions" (
    "id" TEXT NOT NULL,
    "stripeId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "canceledAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "trialStart" TIMESTAMP(3),
    "trialEnd" TIMESTAMP(3),
    "startDate" TIMESTAMP(3) NOT NULL,
    "billingCycleAnchor" TIMESTAMP(3) NOT NULL,
    "planId" TEXT,
    "planNickname" TEXT,
    "planAmount" INTEGER NOT NULL,
    "planCurrency" TEXT NOT NULL DEFAULT 'usd',
    "planInterval" TEXT NOT NULL,
    "planIntervalCount" INTEGER NOT NULL DEFAULT 1,
    "discountId" TEXT,
    "discountPercent" DOUBLE PRECISION,
    "discountAmountOff" INTEGER,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "mrr" INTEGER NOT NULL,
    "arr" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "stripeCreatedAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,

    CONSTRAINT "stripe_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stripe_invoices" (
    "id" TEXT NOT NULL,
    "stripeId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "amountDue" INTEGER NOT NULL,
    "amountPaid" INTEGER NOT NULL,
    "amountRemaining" INTEGER NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "tax" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "discountAmount" INTEGER NOT NULL DEFAULT 0,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "billingReason" TEXT,
    "subscriptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stripeCreatedAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,

    CONSTRAINT "stripe_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stripe_payments" (
    "id" TEXT NOT NULL,
    "stripeId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "amountRefunded" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "fee" INTEGER NOT NULL DEFAULT 0,
    "net" INTEGER NOT NULL,
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "paymentMethodType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stripeCreatedAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT,

    CONSTRAINT "stripe_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_metrics" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "mrr" INTEGER NOT NULL,
    "arr" INTEGER NOT NULL,
    "arpu" INTEGER NOT NULL,
    "activeSubscriptions" INTEGER NOT NULL,
    "newSubscriptions" INTEGER NOT NULL,
    "canceledSubscriptions" INTEGER NOT NULL,
    "upgrades" INTEGER NOT NULL,
    "downgrades" INTEGER NOT NULL,
    "grossChurnRate" DOUBLE PRECISION NOT NULL,
    "revenueChurnRate" DOUBLE PRECISION NOT NULL,
    "netRevenueRetention" DOUBLE PRECISION NOT NULL,
    "failedPayments" INTEGER NOT NULL,
    "successfulPayments" INTEGER NOT NULL,
    "failedPaymentRate" DOUBLE PRECISION NOT NULL,
    "totalPaymentVolume" INTEGER NOT NULL,
    "averageDiscount" DOUBLE PRECISION NOT NULL,
    "effectivePrice" INTEGER NOT NULL,
    "discountLeakage" INTEGER NOT NULL,
    "planDistribution" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "daily_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_insights" (
    "id" TEXT NOT NULL,
    "category" "InsightCategory" NOT NULL,
    "severity" "InsightSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "dataPoints" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "dismissedAt" TIMESTAMP(3),
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "ai_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_recommendations" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "estimatedImpact" INTEGER NOT NULL,
    "impactTimeframe" TEXT NOT NULL,
    "impactConfidence" DOUBLE PRECISION NOT NULL,
    "priorityScore" INTEGER NOT NULL,
    "status" "RecommendationStatus" NOT NULL DEFAULT 'PENDING',
    "implementedAt" TIMESTAMP(3),
    "baselineMetrics" JSONB,
    "resultMetrics" JSONB,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationId" TEXT NOT NULL,
    "insightId" TEXT,

    CONSTRAINT "ai_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_events" (
    "id" TEXT NOT NULL,
    "type" "SubscriptionEventType" NOT NULL,
    "previousMrr" INTEGER NOT NULL,
    "newMrr" INTEGER NOT NULL,
    "mrrDelta" INTEGER NOT NULL,
    "previousPlanId" TEXT,
    "previousPlanNickname" TEXT,
    "newPlanId" TEXT,
    "newPlanNickname" TEXT,
    "previousQuantity" INTEGER,
    "newQuantity" INTEGER,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,

    CONSTRAINT "subscription_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_experiments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hypothesis" TEXT NOT NULL,
    "description" TEXT,
    "targetPlanId" TEXT NOT NULL,
    "targetPlanName" TEXT NOT NULL,
    "status" "ExperimentStatus" NOT NULL DEFAULT 'DRAFT',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "plannedDuration" INTEGER NOT NULL,
    "trafficAllocation" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "minimumSampleSize" INTEGER NOT NULL,
    "confidenceLevel" DOUBLE PRECISION NOT NULL DEFAULT 0.95,
    "minimumDetectableEffect" DOUBLE PRECISION NOT NULL DEFAULT 0.05,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "expectedLift" DOUBLE PRECISION,
    "priority" INTEGER,
    "risks" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "pricing_experiments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experiment_variants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isControl" BOOLEAN NOT NULL DEFAULT false,
    "priceCents" INTEGER NOT NULL,
    "originalPriceCents" INTEGER,
    "visitors" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "churned" INTEGER NOT NULL DEFAULT 0,
    "totalRevenue" INTEGER NOT NULL DEFAULT 0,
    "conversionRate" DOUBLE PRECISION,
    "averageRevenue" DOUBLE PRECISION,
    "churnRate" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "experimentId" TEXT NOT NULL,

    CONSTRAINT "experiment_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experiment_assignments" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "customerId" TEXT,
    "subscriptionId" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "converted" BOOLEAN NOT NULL DEFAULT false,
    "convertedAt" TIMESTAMP(3),
    "conversionRevenue" INTEGER,
    "churned" BOOLEAN NOT NULL DEFAULT false,
    "churnedAt" TIMESTAMP(3),
    "lifetimeRevenue" INTEGER,
    "experimentId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,

    CONSTRAINT "experiment_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_logs" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "customersSync" INTEGER NOT NULL DEFAULT 0,
    "subscriptionsSync" INTEGER NOT NULL DEFAULT 0,
    "invoicesSync" INTEGER NOT NULL DEFAULT 0,
    "paymentsSync" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "errorDetails" JSONB,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "stripe_connections_stripeAccountId_key" ON "stripe_connections"("stripeAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "stripe_connections_organizationId_key" ON "stripe_connections"("organizationId");

-- CreateIndex
CREATE INDEX "stripe_customers_organizationId_idx" ON "stripe_customers"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "stripe_customers_organizationId_stripeId_key" ON "stripe_customers"("organizationId", "stripeId");

-- CreateIndex
CREATE INDEX "stripe_subscriptions_organizationId_status_idx" ON "stripe_subscriptions"("organizationId", "status");

-- CreateIndex
CREATE INDEX "stripe_subscriptions_organizationId_planId_idx" ON "stripe_subscriptions"("organizationId", "planId");

-- CreateIndex
CREATE UNIQUE INDEX "stripe_subscriptions_organizationId_stripeId_key" ON "stripe_subscriptions"("organizationId", "stripeId");

-- CreateIndex
CREATE INDEX "stripe_invoices_organizationId_status_idx" ON "stripe_invoices"("organizationId", "status");

-- CreateIndex
CREATE INDEX "stripe_invoices_organizationId_stripeCreatedAt_idx" ON "stripe_invoices"("organizationId", "stripeCreatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "stripe_invoices_organizationId_stripeId_key" ON "stripe_invoices"("organizationId", "stripeId");

-- CreateIndex
CREATE INDEX "stripe_payments_organizationId_status_idx" ON "stripe_payments"("organizationId", "status");

-- CreateIndex
CREATE INDEX "stripe_payments_organizationId_stripeCreatedAt_idx" ON "stripe_payments"("organizationId", "stripeCreatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "stripe_payments_organizationId_stripeId_key" ON "stripe_payments"("organizationId", "stripeId");

-- CreateIndex
CREATE INDEX "daily_metrics_organizationId_date_idx" ON "daily_metrics"("organizationId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_metrics_organizationId_date_key" ON "daily_metrics"("organizationId", "date");

-- CreateIndex
CREATE INDEX "ai_insights_organizationId_isActive_idx" ON "ai_insights"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "ai_insights_organizationId_category_idx" ON "ai_insights"("organizationId", "category");

-- CreateIndex
CREATE INDEX "ai_recommendations_organizationId_status_idx" ON "ai_recommendations"("organizationId", "status");

-- CreateIndex
CREATE INDEX "ai_recommendations_organizationId_priorityScore_idx" ON "ai_recommendations"("organizationId", "priorityScore");

-- CreateIndex
CREATE INDEX "subscription_events_organizationId_occurredAt_idx" ON "subscription_events"("organizationId", "occurredAt");

-- CreateIndex
CREATE INDEX "subscription_events_organizationId_type_idx" ON "subscription_events"("organizationId", "type");

-- CreateIndex
CREATE INDEX "pricing_experiments_organizationId_status_idx" ON "pricing_experiments"("organizationId", "status");

-- CreateIndex
CREATE INDEX "experiment_variants_experimentId_idx" ON "experiment_variants"("experimentId");

-- CreateIndex
CREATE INDEX "experiment_assignments_experimentId_variantId_idx" ON "experiment_assignments"("experimentId", "variantId");

-- CreateIndex
CREATE INDEX "experiment_assignments_customerId_idx" ON "experiment_assignments"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "experiment_assignments_experimentId_visitorId_key" ON "experiment_assignments"("experimentId", "visitorId");

-- CreateIndex
CREATE INDEX "sync_logs_organizationId_startedAt_idx" ON "sync_logs"("organizationId", "startedAt");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stripe_connections" ADD CONSTRAINT "stripe_connections_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stripe_customers" ADD CONSTRAINT "stripe_customers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stripe_subscriptions" ADD CONSTRAINT "stripe_subscriptions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stripe_subscriptions" ADD CONSTRAINT "stripe_subscriptions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "stripe_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stripe_invoices" ADD CONSTRAINT "stripe_invoices_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stripe_invoices" ADD CONSTRAINT "stripe_invoices_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "stripe_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stripe_payments" ADD CONSTRAINT "stripe_payments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stripe_payments" ADD CONSTRAINT "stripe_payments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "stripe_customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_metrics" ADD CONSTRAINT "daily_metrics_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_insights" ADD CONSTRAINT "ai_insights_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_insightId_fkey" FOREIGN KEY ("insightId") REFERENCES "ai_insights"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "stripe_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_experiments" ADD CONSTRAINT "pricing_experiments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiment_variants" ADD CONSTRAINT "experiment_variants_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "pricing_experiments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiment_assignments" ADD CONSTRAINT "experiment_assignments_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "pricing_experiments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiment_assignments" ADD CONSTRAINT "experiment_assignments_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "experiment_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
