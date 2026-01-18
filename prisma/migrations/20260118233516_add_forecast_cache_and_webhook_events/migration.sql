-- CreateTable
CREATE TABLE "forecast_cache" (
    "id" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "daysAhead" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "forecast_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stripe_webhook_events" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "stripeAccountId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "organizationId" TEXT,

    CONSTRAINT "stripe_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "forecast_cache_organizationId_expiresAt_idx" ON "forecast_cache"("organizationId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "forecast_cache_organizationId_cacheKey_key" ON "forecast_cache"("organizationId", "cacheKey");

-- CreateIndex
CREATE UNIQUE INDEX "stripe_webhook_events_eventId_key" ON "stripe_webhook_events"("eventId");

-- CreateIndex
CREATE INDEX "stripe_webhook_events_organizationId_receivedAt_idx" ON "stripe_webhook_events"("organizationId", "receivedAt");

-- AddForeignKey
ALTER TABLE "forecast_cache" ADD CONSTRAINT "forecast_cache_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stripe_webhook_events" ADD CONSTRAINT "stripe_webhook_events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
