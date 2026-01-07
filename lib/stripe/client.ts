import Stripe from 'stripe';

// Main Stripe client for platform operations
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
  typescript: true,
});

// Create a Stripe client for a connected account
export function createConnectedStripeClient(accessToken: string): Stripe {
  return new Stripe(accessToken, {
    apiVersion: '2023-10-16',
    typescript: true,
  });
}

// OAuth Configuration
export const STRIPE_OAUTH_CONFIG = {
  clientId: process.env.STRIPE_CLIENT_ID!,
  authorizeUrl: 'https://connect.stripe.com/oauth/authorize',
  tokenUrl: 'https://connect.stripe.com/oauth/token',
  deauthorizeUrl: 'https://connect.stripe.com/oauth/deauthorize',
  // Read-only scopes for revenue data
  scope: 'read_only',
};

// Get the app URL (works on Vercel and locally)
function getAppUrl(): string {
  const raw =
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

  // Strip any trailing slashes to avoid `//api/stripe/callback`
  return raw.replace(/\/+$/, '');
}

// Generate OAuth authorization URL
export function getStripeOAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: STRIPE_OAUTH_CONFIG.clientId,
    scope: STRIPE_OAUTH_CONFIG.scope,
    state,
    redirect_uri: `${getAppUrl()}/api/stripe/callback`,
  });

  return `${STRIPE_OAUTH_CONFIG.authorizeUrl}?${params.toString()}`;
}

// Exchange authorization code for access token
export async function exchangeCodeForToken(code: string): Promise<{
  accessToken: string;
  refreshToken: string | null;
  stripeUserId: string;
  scope: string;
  livemode: boolean;
}> {
  const response = await fetch(STRIPE_OAUTH_CONFIG.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_secret: process.env.STRIPE_SECRET_KEY!,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error_description || 'Failed to exchange code for token');
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || null,
    stripeUserId: data.stripe_user_id,
    scope: data.scope,
    livemode: data.livemode,
  };
}

// Deauthorize (disconnect) a Stripe account
export async function deauthorizeStripeAccount(stripeUserId: string): Promise<void> {
  const response = await fetch(STRIPE_OAUTH_CONFIG.deauthorizeUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: STRIPE_OAUTH_CONFIG.clientId,
      stripe_user_id: stripeUserId,
      client_secret: process.env.STRIPE_SECRET_KEY!,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error_description || 'Failed to disconnect Stripe account');
  }
}

// Refresh access token
export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string | null;
}> {
  const response = await fetch(STRIPE_OAUTH_CONFIG.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_secret: process.env.STRIPE_SECRET_KEY!,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error_description || 'Failed to refresh token');
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || null,
  };
}


