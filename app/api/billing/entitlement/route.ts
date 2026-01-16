import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const { requireAuthWithOrg } = await import('@/lib/supabase/auth-helpers');
    const { getOrgEntitlement } = await import('@/lib/billing/entitlements');

    const { organizationId } = await requireAuthWithOrg();
    const entitlement = await getOrgEntitlement(organizationId);

    return NextResponse.json({ entitlement });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Entitlement status error:', error);
    return NextResponse.json({ error: 'Failed to fetch entitlement' }, { status: 500 });
  }
}


