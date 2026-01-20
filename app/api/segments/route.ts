import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const segmentRulesSchema = z.object({
  // MRR filters
  mrr: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
  }).optional(),
  
  // Plan filters
  planId: z.string().optional(),
  planNickname: z.string().optional(),
  planInterval: z.enum(['month', 'year']).optional(),
  
  // Tenure filters (days since first subscription)
  tenureDays: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
  }).optional(),
  
  // Status filters
  status: z.enum(['active', 'canceled', 'past_due', 'trialing']).optional(),
  
  // Discount filters
  hasDiscount: z.boolean().optional(),
  discountPercent: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
  }).optional(),
  
  // Churn risk
  isChurning: z.boolean().optional(), // cancelAtPeriodEnd = true
  isDelinquent: z.boolean().optional(),
  
  // Custom metadata (if you store custom fields)
  metadata: z.record(z.any()).optional(),
});

const createSegmentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  rules: segmentRulesSchema,
});

const updateSegmentSchema = createSegmentSchema.partial();

/**
 * GET /api/segments
 * List all customer segments for the organization
 */
export async function GET(request: NextRequest) {
  try {
    const { requireAuthWithOrg } = await import('@/lib/supabase/auth-helpers');
    const { organizationId } = await requireAuthWithOrg();

    const segments = await prisma.customerSegment.findMany({
      where: { organizationId },
      include: {
        _count: {
          select: { customers: true },
        },
      },
      orderBy: [
        { isSystem: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return NextResponse.json({
      segments: segments.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        color: s.color,
        rules: s.rules,
        isSystem: s.isSystem,
        customerCount: s._count.customers,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Segments fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch segments' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/segments
 * Create a new customer segment
 */
export async function POST(request: NextRequest) {
  try {
    const { requireAuthWithOrg } = await import('@/lib/supabase/auth-helpers');
    const { organizationId } = await requireAuthWithOrg();

    const body = await request.json();
    const data = createSegmentSchema.parse(body);

    const segment = await prisma.customerSegment.create({
      data: {
        organizationId,
        name: data.name,
        description: data.description,
        color: data.color || `#${Math.floor(Math.random() * 16777215).toString(16)}`,
        rules: data.rules as any,
      },
    });

    // Auto-apply segment to matching customers
    await applySegmentToCustomers(organizationId, segment.id, data.rules);

    return NextResponse.json({ segment });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid segment data', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Segment creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create segment' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/segments
 * Update an existing segment
 */
export async function PATCH(request: NextRequest) {
  try {
    const { requireAuthWithOrg } = await import('@/lib/supabase/auth-helpers');
    const { organizationId } = await requireAuthWithOrg();

    const body = await request.json();
    const { segmentId, ...updateData } = body;

    if (!segmentId) {
      return NextResponse.json({ error: 'segmentId is required' }, { status: 400 });
    }

    // Check if segment exists and belongs to organization
    const existing = await prisma.customerSegment.findFirst({
      where: { id: segmentId, organizationId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Segment not found' }, { status: 404 });
    }

    if (existing.isSystem) {
      return NextResponse.json({ error: 'Cannot modify system segments' }, { status: 403 });
    }

    const validated = updateSegmentSchema.parse(updateData);

    const segment = await prisma.customerSegment.update({
      where: { id: segmentId },
      data: {
        ...(validated.name && { name: validated.name }),
        ...(validated.description !== undefined && { description: validated.description }),
        ...(validated.color && { color: validated.color }),
        ...(validated.rules && { rules: validated.rules as any }),
      },
    });

    // Re-apply segment if rules changed
    if (validated.rules) {
      // Remove all existing assignments
      await prisma.segmentCustomerAssignment.deleteMany({
        where: { segmentId, organizationId },
      });
      
      // Re-apply with new rules
      await applySegmentToCustomers(organizationId, segmentId, validated.rules);
    }

    return NextResponse.json({ segment });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid segment data', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Segment update error:', error);
    return NextResponse.json(
      { error: 'Failed to update segment' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/segments?segmentId=xxx
 * Delete a segment
 */
export async function DELETE(request: NextRequest) {
  try {
    const { requireAuthWithOrg } = await import('@/lib/supabase/auth-helpers');
    const { organizationId } = await requireAuthWithOrg();

    const { searchParams } = new URL(request.url);
    const segmentId = searchParams.get('segmentId');

    if (!segmentId) {
      return NextResponse.json({ error: 'segmentId is required' }, { status: 400 });
    }

    const segment = await prisma.customerSegment.findFirst({
      where: { id: segmentId, organizationId },
    });

    if (!segment) {
      return NextResponse.json({ error: 'Segment not found' }, { status: 404 });
    }

    if (segment.isSystem) {
      return NextResponse.json({ error: 'Cannot delete system segments' }, { status: 403 });
    }

    await prisma.customerSegment.delete({
      where: { id: segmentId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Segment deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete segment' },
      { status: 500 }
    );
  }
}

/**
 * Apply segment rules to customers and create assignments
 */
async function applySegmentToCustomers(
  organizationId: string,
  segmentId: string,
  rules: z.infer<typeof segmentRulesSchema>
) {
  // Build Prisma where clause from rules
  const where: any = { organizationId };

  // MRR filter (need to check subscriptions)
  if (rules.mrr) {
    // This will be handled in the query below
  }

  // Build subscription filters (combine them)
  const subscriptionFilters: any[] = [];
  
  if (rules.planId) {
    subscriptionFilters.push({ planId: rules.planId });
  }
  if (rules.planNickname) {
    subscriptionFilters.push({ planNickname: rules.planNickname });
  }
  if (rules.planInterval) {
    subscriptionFilters.push({ planInterval: rules.planInterval });
  }
  if (rules.status) {
    subscriptionFilters.push({ status: rules.status });
  } else {
    // Default to active/trialing if no status specified
    subscriptionFilters.push({ status: { in: ['active', 'trialing'] } });
  }
  
  if (rules.hasDiscount !== undefined) {
    if (rules.hasDiscount) {
      subscriptionFilters.push({
        OR: [
          { discountPercent: { not: null } },
          { discountAmountOff: { not: null } },
        ],
      });
    } else {
      subscriptionFilters.push({
        discountPercent: null,
        discountAmountOff: null,
      });
    }
  }

  if (subscriptionFilters.length > 0) {
    where.subscriptions = {
      some: subscriptionFilters.length === 1 ? subscriptionFilters[0] : { AND: subscriptionFilters },
    };
  }

  // Delinquent filter
  if (rules.isDelinquent !== undefined) {
    where.delinquent = rules.isDelinquent;
  }

  // Get matching customers
  let customers = await prisma.stripeCustomer.findMany({
    where,
    include: {
      subscriptions: {
        where: { status: { in: ['active', 'trialing'] } },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  // Apply additional filters that require computation
  if (rules.mrr) {
    customers = customers.filter(c => {
      const activeSub = c.subscriptions[0];
      if (!activeSub) return false;
      const mrr = activeSub.mrr;
      if (rules.mrr?.min && mrr < rules.mrr.min) return false;
      if (rules.mrr?.max && mrr > rules.mrr.max) return false;
      return true;
    });
  }

  if (rules.tenureDays) {
    customers = customers.filter(c => {
      const firstSub = c.subscriptions[0];
      if (!firstSub) return false;
      const tenureDays = Math.floor(
        (Date.now() - firstSub.stripeCreatedAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (rules.tenureDays?.min && tenureDays < rules.tenureDays.min) return false;
      if (rules.tenureDays?.max && tenureDays > rules.tenureDays.max) return false;
      return true;
    });
  }

  if (rules.isChurning !== undefined) {
    customers = customers.filter(c => {
      const activeSub = c.subscriptions[0];
      if (!activeSub) return false;
      return activeSub.cancelAtPeriodEnd === rules.isChurning;
    });
  }

  if (rules.discountPercent) {
    customers = customers.filter(c => {
      const activeSub = c.subscriptions[0];
      if (!activeSub || !activeSub.discountPercent) return false;
      if (rules.discountPercent?.min && activeSub.discountPercent < rules.discountPercent.min) return false;
      if (rules.discountPercent?.max && activeSub.discountPercent > rules.discountPercent.max) return false;
      return true;
    });
  }

  // Create assignments
  const assignments = customers.map(c => ({
    organizationId,
    segmentId,
    customerId: c.id,
  }));

  if (assignments.length > 0) {
    // Use createMany with skipDuplicates for idempotency
    await prisma.segmentCustomerAssignment.createMany({
      data: assignments,
      skipDuplicates: true,
    });
  }

  return customers.length;
}
