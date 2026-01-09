import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const { requireAuthWithOrg } = await import('@/lib/supabase/auth-helpers');
    const { prisma } = await import('@/lib/db');
    const { isTestMode } = await import('@/lib/stripe/client');
    
    const { organizationId } = await requireAuthWithOrg();

    const connection = await prisma.stripeConnection.findUnique({
      where: { organizationId },
      select: {
        id: true,
        stripeAccountId: true,
        livemode: true,
        connectedAt: true,
        disconnectedAt: true,
        lastSyncAt: true,
        lastSyncStatus: true,
        lastSyncError: true,
        scope: true,
      },
    });

    // Check if direct API key connection is supported (test mode only)
    const supportsDirectConnect = isTestMode();

    if (!connection || connection.disconnectedAt) {
      return NextResponse.json({
        connected: false,
        connection: null,
        supportsDirectConnect,
      });
    }

    return NextResponse.json({
      connected: true,
      supportsDirectConnect,
      connection: {
        accountId: connection.stripeAccountId,
        livemode: connection.livemode,
        connectedAt: connection.connectedAt,
        lastSyncAt: connection.lastSyncAt,
        lastSyncStatus: connection.lastSyncStatus,
        lastSyncError: connection.lastSyncError,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Status error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch status' },
      { status: 500 }
    );
  }
}

