import { NextResponse } from 'next/server';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const { requireAuthWithOrg } = await import('@/lib/supabase/auth-helpers');
    const { getStripeOAuthUrl } = await import('@/lib/stripe/client');
    
    const { organizationId } = await requireAuthWithOrg();

    // Generate a secure state token
    const state = crypto.randomBytes(32).toString('hex');
    
    // Store state in a temporary way (in production, use Redis or similar)
    // For MVP, we'll encode org ID in state
    const stateData = Buffer.from(JSON.stringify({
      organizationId,
      nonce: state,
    })).toString('base64');

    const authUrl = getStripeOAuthUrl(stateData);

    return NextResponse.json({ url: authUrl });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Stripe connect error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Stripe connection' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const { requireAuthWithOrg } = await import('@/lib/supabase/auth-helpers');
    const { prisma } = await import('@/lib/db');
    
    const { organizationId } = await requireAuthWithOrg();

    const connection = await prisma.stripeConnection.findUnique({
      where: { organizationId },
    });

    if (!connection) {
      return NextResponse.json({ error: 'No connection found' }, { status: 404 });
    }

    // Deauthorize from Stripe
    const { deauthorizeStripeAccount } = await import('@/lib/stripe/client');
    await deauthorizeStripeAccount(connection.stripeAccountId);

    // Update our record
    await prisma.stripeConnection.update({
      where: { id: connection.id },
      data: { disconnectedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Stripe disconnect error:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Stripe' },
      { status: 500 }
    );
  }
}

