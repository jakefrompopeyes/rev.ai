import { prisma } from '@/lib/db';

export type EntitlementSource = 'billing' | 'comped' | 'none';

export type EntitlementTierKey = 'starter' | 'growth' | 'scale' | 'enterprise';

export interface OrgEntitlement {
  entitled: boolean;
  source: EntitlementSource;
  tier: EntitlementTierKey;
  expiresAt?: Date;
  reason?: string;
}

function normalizeTierKey(input: string | null | undefined): EntitlementTierKey {
  const v = (input || '').toLowerCase();
  if (v === 'enterprise') return 'enterprise';
  if (v === 'scale') return 'scale';
  if (v === 'growth') return 'growth';
  return 'starter';
}

function compedTierToTierKey(compedTier: string | null | undefined): EntitlementTierKey {
  // Prisma enum values come through as strings: "STARTER" | "GROWTH" | ...
  const v = (compedTier || '').toUpperCase();
  if (v === 'ENTERPRISE') return 'enterprise';
  if (v === 'SCALE') return 'scale';
  if (v === 'GROWTH') return 'growth';
  return 'starter';
}

function isBillingActive(status: string | null | undefined): boolean {
  const s = (status || '').toLowerCase();
  return s === 'active' || s === 'trialing';
}

export async function getOrgEntitlement(organizationId: string): Promise<OrgEntitlement> {
  const [org, billing] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        isComped: true,
        compedTier: true,
        compedUntil: true,
        compedReason: true,
      },
    }),
    prisma.billingSubscription.findUnique({
      where: { organizationId },
      select: {
        status: true,
        currentPeriodEnd: true,
        trialEnd: true,
        tierKey: true,
      },
    }),
  ]);

  const now = new Date();

  if (org?.isComped) {
    const expiresAt = org.compedUntil ?? undefined;
    const isExpired = expiresAt ? expiresAt.getTime() <= now.getTime() : false;
    if (!isExpired) {
      return {
        entitled: true,
        source: 'comped',
        tier: compedTierToTierKey(org.compedTier),
        expiresAt,
        reason: org.compedReason ?? undefined,
      };
    }
  }

  if (billing && isBillingActive(billing.status)) {
    const periodEnd = billing.currentPeriodEnd ?? billing.trialEnd ?? null;
    const isExpired = periodEnd ? periodEnd.getTime() <= now.getTime() : false;
    if (!isExpired) {
      return {
        entitled: true,
        source: 'billing',
        tier: normalizeTierKey(billing.tierKey),
        expiresAt: periodEnd ?? undefined,
      };
    }
  }

  return {
    entitled: false,
    source: 'none',
    tier: 'starter',
  };
}

export async function requireEntitledOrg(organizationId: string): Promise<OrgEntitlement> {
  const entitlement = await getOrgEntitlement(organizationId);
  if (!entitlement.entitled) {
    const err = new Error('EntitlementRequired');
    // @ts-expect-error attach meta for API handlers
    err.code = 'EntitlementRequired';
    throw err;
  }
  return entitlement;
}


