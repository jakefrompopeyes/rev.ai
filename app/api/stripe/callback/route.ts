import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle errors from Stripe
    if (error) {
      console.error('Stripe OAuth error:', error, errorDescription);
      
      // Provide helpful error message for redirect URI issues
      let errorMessage = errorDescription || error;
      if (errorDescription?.includes('Invalid redirect URI') || errorDescription?.includes('redirect_uri')) {
        const { isTestMode, getAppUrl } = await import('@/lib/stripe/client');
        const appUrl = getAppUrl();
        const redirectUri = `${appUrl}/api/stripe/callback`;
        const testMode = isTestMode();
        const settingsUrl = `https://dashboard.stripe.com/${testMode ? 'test/' : ''}settings/applications`;
        
        errorMessage = `Redirect URI not registered in Stripe. Add this exact URI to your Connect app settings:\n\n${redirectUri}\n\nGo to: ${settingsUrl}`;
      }
      
      return NextResponse.redirect(
        new URL(`/dashboard?error=${encodeURIComponent(errorMessage)}`, process.env.APP_URL)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/dashboard?error=Missing authorization code', process.env.APP_URL)
      );
    }

    // Decode state to get organization ID
    let organizationId: string;
    try {
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
      organizationId = stateData.organizationId;
    } catch {
      return NextResponse.redirect(
        new URL('/dashboard?error=Invalid state parameter', process.env.APP_URL)
      );
    }

    // Dynamic imports to avoid build-time issues
    const { exchangeCodeForToken } = await import('@/lib/stripe/client');
    const { prisma } = await import('@/lib/db');

    // Exchange code for token
    const tokenData = await exchangeCodeForToken(code);

    // Check if this Stripe account is already connected to another org
    const existingConnection = await prisma.stripeConnection.findUnique({
      where: { stripeAccountId: tokenData.stripeUserId },
    });

    if (existingConnection && existingConnection.organizationId !== organizationId) {
      return NextResponse.redirect(
        new URL('/dashboard?error=This Stripe account is already connected to another organization', process.env.APP_URL)
      );
    }

    // Store or update the connection
    await prisma.stripeConnection.upsert({
      where: { organizationId },
      create: {
        organizationId,
        stripeAccountId: tokenData.stripeUserId,
        accessToken: tokenData.accessToken,
        refreshToken: tokenData.refreshToken,
        scope: tokenData.scope,
        livemode: tokenData.livemode,
      },
      update: {
        stripeAccountId: tokenData.stripeUserId,
        accessToken: tokenData.accessToken,
        refreshToken: tokenData.refreshToken,
        scope: tokenData.scope,
        livemode: tokenData.livemode,
        disconnectedAt: null,
      },
    });

    // Redirect to dashboard with success
    return NextResponse.redirect(
      new URL('/dashboard?connected=true', process.env.APP_URL)
    );
  } catch (error) {
    console.error('Stripe callback error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.redirect(
      new URL(`/dashboard?error=${encodeURIComponent(message)}`, process.env.APP_URL)
    );
  }
}

