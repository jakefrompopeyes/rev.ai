import { NextResponse } from 'next/server';
import { seedDemoDataForOrg } from '@/lib/demo/seed';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST() {
  try {
    const { requireAuthWithOrg } = await import('@/lib/supabase/auth-helpers');
    const { organizationId } = await requireAuthWithOrg();

    await seedDemoDataForOrg(organizationId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Demo seed error:', error);
    return NextResponse.json({ error: 'Failed to seed demo data' }, { status: 500 });
  }
}

