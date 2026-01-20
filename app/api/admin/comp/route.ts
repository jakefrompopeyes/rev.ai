import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const { prisma } = await import('@/lib/db');
  const body = await request.json().catch(() => ({}));

  const {
    organizationId,
    email,
    domain,
    isComped = true,
    compedTier = 'SCALE',
    compedUntil,
    compedReason,
  } = body as {
    organizationId?: string;
    email?: string;
    domain?: string;
    isComped?: boolean;
    compedTier?: 'STARTER' | 'GROWTH' | 'SCALE' | 'ENTERPRISE';
    compedUntil?: string;
    compedReason?: string;
  };

  let orgId = organizationId;
  if (!orgId && email) {
    const u = await prisma.user.findUnique({
      where: { email },
      select: { organizationId: true },
    });
    orgId = u?.organizationId;
  }

  if (!orgId && domain) {
    const suffix = domain.startsWith('@') ? domain : `@${domain}`;
    const u = await prisma.user.findFirst({
      where: { email: { endsWith: suffix } },
      select: { organizationId: true },
      orderBy: { createdAt: 'asc' },
    });
    orgId = u?.organizationId;
  }

  if (!orgId) {
    return NextResponse.json(
      { error: 'organizationId, email, or domain is required' },
      { status: 400 }
    );
  }

  const parsedCompedUntil =
    typeof compedUntil === 'string' && compedUntil.length > 0
      ? new Date(compedUntil)
      : null;

  const updated = await prisma.organization.update({
    where: { id: orgId },
    data: isComped
      ? {
          isComped: true,
          compedTier,
          compedUntil: parsedCompedUntil,
          compedReason: compedReason ?? null,
        }
      : {
          isComped: false,
          compedTier: null,
          compedUntil: null,
          compedReason: null,
        },
    select: {
      id: true,
      name: true,
      isComped: true,
      compedTier: true,
      compedUntil: true,
      compedReason: true,
    },
  });

  return NextResponse.json({ organization: updated });
}


