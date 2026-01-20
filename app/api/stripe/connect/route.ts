import { NextResponse } from 'next/server';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const { requireAuthWithOrg } = await import('@/lib/supabase/auth-helpers');
    const { getStripeOAuthUrl, isTestMode, STRIPE_OAUTH_CONFIG } = await import('@/lib/stripe/client');
    
    const { organizationId } = await requireAuthWithOrg();

    // Check if Stripe Client ID is configured
    const clientId = STRIPE_OAUTH_CONFIG.clientId;
    const testMode = isTestMode();
    
    if (!clientId) {
      const mode = testMode ? 'test' : 'live';
      const dashboardUrl = testMode 
        ? 'https://dashboard.stripe.com/test/settings/connect'
        : 'https://dashboard.stripe.com/settings/connect';
      return NextResponse.json(
        { 
          error: `Stripe Client ID is not configured. Please set STRIPE_CLIENT_ID_${mode.toUpperCase()} or STRIPE_CLIENT_ID in your environment variables. You can get your Client ID from ${dashboardUrl}` 
        },
        { status: 500 }
      );
    }
    
    // Validate client ID matches the mode
    if (testMode && !clientId.startsWith('ca_test_')) {
      console.warn(`[Stripe Connect] Test mode is enabled but client ID "${clientId.substring(0, 15)}..." does not appear to be a test client ID (should start with "ca_test_"). This may cause OAuth to show live accounts instead of test accounts.`);
    }
    
    if (!testMode && clientId.startsWith('ca_test_')) {
      console.warn(`[Stripe Connect] Live mode is enabled but client ID appears to be a test client ID. This may cause OAuth to show test accounts instead of live accounts.`);
    }

    // Generate a secure state token
    const state = crypto.randomBytes(32).toString('hex');
    
    // Store state in a temporary way (in production, use Redis or similar)
    // For MVP, we'll encode org ID in state
    const stateData = Buffer.from(JSON.stringify({
      organizationId,
      nonce: state,
    })).toString('base64');

    const authUrl = getStripeOAuthUrl(stateData);

    // Validate that the URL was generated correctly
    if (!authUrl || !authUrl.includes('client_id=')) {
      return NextResponse.json(
        { 
          error: 'Failed to generate OAuth URL. Please check your Stripe Client ID configuration.' 
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      url: authUrl,
      testMode,
      supportsDirectConnect: testMode, // Can use direct API key connection in test mode
      clientIdPrefix: clientId.substring(0, 10), // First 10 chars for debugging (safe to expose)
      mode: testMode ? 'test' : 'live',
      note: testMode 
        ? 'Using test mode - you should see test/sandbox Stripe accounts in the OAuth flow. If you see live accounts, ensure STRIPE_CLIENT_ID_TEST is set correctly.'
        : 'Using live mode - you will see live Stripe accounts in the OAuth flow.',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Stripe connect error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to initiate Stripe connection' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/stripe/connect
 * 
 * Direct connection using API key (test mode only, bypasses OAuth)
 * This is useful for development when OAuth eligibility is an issue.
 * 
 * Body: { apiKey: "sk_test_..." }
 */
export async function POST(request: Request) {
  try {
    const { requireAuthWithOrg } = await import('@/lib/supabase/auth-helpers');
    const { isTestMode } = await import('@/lib/stripe/client');
    const { prisma } = await import('@/lib/db');
    const Stripe = (await import('stripe')).default;
    
    // Only allow in test mode for security
    if (!isTestMode()) {
      return NextResponse.json(
        { error: 'Direct API key connection is only available in test mode' },
        { status: 403 }
      );
    }
    
    const { organizationId } = await requireAuthWithOrg();
    const body = await request.json();
    const { apiKey } = body;
    
    if (!apiKey || typeof apiKey !== 'string') {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      );
    }
    
    // Validate it's a test key
    if (!apiKey.startsWith('sk_test_') && !apiKey.startsWith('rk_test_')) {
      return NextResponse.json(
        { error: 'Only test mode API keys are allowed for direct connection' },
        { status: 400 }
      );
    }
    
    // Verify the API key works by fetching account info
    const testStripe = new Stripe(apiKey, { apiVersion: '2023-10-16' });
    let account;
    try {
      account = await testStripe.accounts.retrieve();
    } catch {
      return NextResponse.json(
        { error: 'Invalid API key or unable to connect to Stripe' },
        { status: 400 }
      );
    }
    
    // Check for existing connection
    const existingConnection = await prisma.stripeConnection.findUnique({
      where: { organizationId },
    });
    
    if (existingConnection && !existingConnection.disconnectedAt) {
      // Update existing connection
      await prisma.stripeConnection.update({
        where: { id: existingConnection.id },
        data: {
          stripeAccountId: account.id,
          accessToken: apiKey, // In test mode, we store the API key directly
          livemode: false,
          scope: 'read_write',
          disconnectedAt: null,
        },
      });
    } else {
      // Create new connection
      await prisma.stripeConnection.create({
        data: {
          organizationId,
          stripeAccountId: account.id,
          accessToken: apiKey,
          livemode: false,
          scope: 'read_write',
        },
      });
    }
    
    return NextResponse.json({
      success: true,
      accountId: account.id,
      livemode: false,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Stripe direct connect error:', error);
    return NextResponse.json(
      { error: 'Failed to connect Stripe account' },
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

