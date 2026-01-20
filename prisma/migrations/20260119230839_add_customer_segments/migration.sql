-- CreateTable
CREATE TABLE "customer_segments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "rules" JSONB NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "customer_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "segment_customer_assignments" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "segmentId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "segment_customer_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_segments_organizationId_idx" ON "customer_segments"("organizationId");

-- CreateIndex
CREATE INDEX "segment_customer_assignments_organizationId_segmentId_idx" ON "segment_customer_assignments"("organizationId", "segmentId");

-- CreateIndex
CREATE INDEX "segment_customer_assignments_customerId_idx" ON "segment_customer_assignments"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "segment_customer_assignments_segmentId_customerId_key" ON "segment_customer_assignments"("segmentId", "customerId");

-- AddForeignKey
ALTER TABLE "customer_segments" ADD CONSTRAINT "customer_segments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "segment_customer_assignments" ADD CONSTRAINT "segment_customer_assignments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "segment_customer_assignments" ADD CONSTRAINT "segment_customer_assignments_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "customer_segments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "segment_customer_assignments" ADD CONSTRAINT "segment_customer_assignments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "stripe_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
