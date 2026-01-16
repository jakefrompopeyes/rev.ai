-- CreateEnum
CREATE TYPE "EntitlementTier" AS ENUM ('STARTER', 'GROWTH', 'SCALE', 'ENTERPRISE');

-- AlterTable
ALTER TABLE "organizations"
ADD COLUMN     "isComped" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "compedTier" "EntitlementTier",
ADD COLUMN     "compedUntil" TIMESTAMP(3),
ADD COLUMN     "compedReason" TEXT;

-- CreateTable
CREATE TABLE "billing_subscriptions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT NOT NULL,
    "stripeCustomerId" TEXT,
    "status" TEXT NOT NULL,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "canceledAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "trialStart" TIMESTAMP(3),
    "trialEnd" TIMESTAMP(3),
    "tierKey" TEXT,
    "interval" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "billing_subscriptions_organizationId_key" ON "billing_subscriptions"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "billing_subscriptions_stripeSubscriptionId_key" ON "billing_subscriptions"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "billing_subscriptions_status_idx" ON "billing_subscriptions"("status");

-- AddForeignKey
ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;


