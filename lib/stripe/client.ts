import Stripe from 'stripe';

// =============================================================================
// MODE DETECTION & KEY SELECTION
// =============================================================================

// Get the appropriate secret key based on mode
// Supports: STRIPE_SECRET_KEY_TEST, STRIPE_SECRET_KEY_LIVE, or single STRIPE_SECRET_KEY
export function getSecretKey(): string {
  const mode = process.env.STRIPE_MODE?.toLowerCase();
  
  // If explicit mode is set, use the corresponding key
  if (mode === 'test' || mode === 'development' || mode === 'dev') {
    return process.env.STRIPE_SECRET_KEY_TEST || process.env.STRIPE_SECRET_KEY || '';
  }
  if (mode === 'live' || mode === 'production' || mode === 'prod') {
    return process.env.STRIPE_SECRET_KEY_LIVE || process.env.STRIPE_SECRET_KEY || '';
  }
  
  // Default: use STRIPE_SECRET_KEY
  return process.env.STRIPE_SECRET_KEY || '';
}

// Check if we're in test/development mode
// Priority: STRIPE_MODE env var > secret key prefix detection
export function isTestMode(): boolean {
  // Explicit mode override
  const mode = process.env.STRIPE_MODE?.toLowerCase();
  if (mode === 'test' || mode === 'development' || mode === 'dev') {
    return true;
  }
  if (mode === 'live' || mode === 'production' || mode === 'prod') {
    return false;
  }
  
  // Fall back to detecting from secret key prefix
  const secretKey = getSecretKey();
  return secretKey.startsWith('sk_test_') || secretKey.startsWith('rk_test_');
}

// Get the appropriate Client ID based on mode
function getClientId(): string {
  if (isTestMode()) {
    return process.env.STRIPE_CLIENT_ID_TEST || process.env.STRIPE_CLIENT_ID || '';
  }
  return process.env.STRIPE_CLIENT_ID_LIVE || process.env.STRIPE_CLIENT_ID || '';
}

// Get the appropriate publishable key based on mode
export function getPublishableKey(): string {
  if (isTestMode()) {
    return process.env.STRIPE_PUBLISHABLE_KEY_TEST || process.env.STRIPE_PUBLISHABLE_KEY || '';
  }
  return process.env.STRIPE_PUBLISHABLE_KEY_LIVE || process.env.STRIPE_PUBLISHABLE_KEY || '';
}

// =============================================================================
// STRIPE CLIENT
// =============================================================================

// Lazy-initialized Stripe client to ensure env vars are loaded
let _stripe: Stripe | null = null;

// Main Stripe client for platform operations
export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(getSecretKey(), {
      apiVersion: '2023-10-16',
      typescript: true,
    });
  }
  return _stripe;
}

// For backwards compatibility - uses lazy getter via Proxy
export const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    return (getStripe() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

// Create a Stripe client for a connected account
export function createConnectedStripeClient(accessToken: string): Stripe {
  return new Stripe(accessToken, {
    apiVersion: '2023-10-16',
    typescript: true,
  });
}

// =============================================================================
// OAUTH CONFIGURATION
// =============================================================================

export const STRIPE_OAUTH_CONFIG = {
  get clientId() {
    return getClientId();
  },
  authorizeUrl: 'https://connect.stripe.com/oauth/authorize',
  tokenUrl: 'https://connect.stripe.com/oauth/token',
  deauthorizeUrl: 'https://connect.stripe.com/oauth/deauthorize',
  scope: 'read_write',
};

// Get the app URL (works on Vercel and locally)
function getAppUrl(): string {
  const raw =
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

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
      client_secret: getSecretKey(),
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
      client_secret: getSecretKey(),
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
      client_secret: getSecretKey(),
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
