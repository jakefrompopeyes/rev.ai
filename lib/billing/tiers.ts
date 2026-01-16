export type BillingInterval = 'monthly' | 'annually';

export type TierKey = 'starter' | 'growth' | 'scale' | 'enterprise';

export interface BillingTier {
  key: TierKey;
  name: string;
  description: string;
  highlight?: boolean;
  badge?: string;
  monthlyPriceUsd: number; // display only (USD)
  annualPriceUsd: number; // display only (USD, per-month equivalent)
  features: string[];
  cta: string;
  stripePriceId?: {
    monthly: string;
    annually: string;
  };
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export function getBillingTiers(): BillingTier[] {
  return [
    {
      key: 'starter',
      name: 'Starter',
      description: 'For evaluating discovred on a smaller Stripe account',
      monthlyPriceUsd: 0,
      annualPriceUsd: 0,
      features: [
        'Up to $10K MRR tracked',
        'Basic revenue metrics',
        'Manual data sync',
        '7-day data history',
        'Email support',
      ],
      cta: 'Start Free',
    },
    {
      key: 'growth',
      name: 'Growth',
      description: 'Best for B2B SaaS teams making pricing and retention decisions',
      monthlyPriceUsd: 49,
      annualPriceUsd: 39,
      highlight: true,
      badge: 'Most Popular',
      features: [
        'Up to $100K MRR tracked',
        'All revenue metrics & KPIs',
        'AI-powered insights',
        'Automated daily sync',
        '90-day data history',
        'Custom dashboards',
        'Slack notifications',
        'Priority email support',
      ],
      cta: 'Start Free Trial',
      stripePriceId: {
        monthly: process.env.STRIPE_PRICE_GROWTH_MONTHLY || 'price_growth_monthly',
        annually: process.env.STRIPE_PRICE_GROWTH_ANNUALLY || 'price_growth_annually',
      },
    },
    {
      key: 'scale',
      name: 'Scale',
      description: 'For scaling B2B SaaS with active discounting and plan complexity',
      monthlyPriceUsd: 149,
      annualPriceUsd: 119,
      features: [
        'Up to $1M MRR tracked',
        'Everything in Growth, plus:',
        'Cohort analysis & heatmaps',
        'Revenue forecasting',
        'Pricing experiments (A/B)',
        'Discount leakage detection',
        '1-year data history',
        'API access',
        'Team members (up to 5)',
        'Dedicated support',
      ],
      cta: 'Start Free Trial',
      stripePriceId: {
        monthly: process.env.STRIPE_PRICE_SCALE_MONTHLY || 'price_scale_monthly',
        annually: process.env.STRIPE_PRICE_SCALE_ANNUALLY || 'price_scale_annually',
      },
    },
    {
      key: 'enterprise',
      name: 'Enterprise',
      description: 'Custom solutions for high-volume businesses',
      monthlyPriceUsd: -1,
      annualPriceUsd: -1,
      features: [
        'Unlimited MRR tracked',
        'Everything in Scale, plus:',
        'Unlimited data history',
        'Custom integrations',
        'SSO / SAML',
        'Dedicated success manager',
        'Custom SLAs',
        'On-premise deployment',
        'Unlimited team members',
      ],
      cta: 'Contact Sales',
    },
  ];
}

export function getTierByKey(key: string): BillingTier | null {
  return getBillingTiers().find((t) => t.key === key) ?? null;
}

export function getStripePriceIdForTier(tier: BillingTier, interval: BillingInterval): string {
  if (!tier.stripePriceId) {
    throw new Error(`Tier ${tier.key} does not have Stripe price IDs`);
  }

  const priceId = tier.stripePriceId[interval];
  // If the env var isn't set, we still return the placeholder string, but allow
  // stricter runtime validation in production by requiring STRIPE_PRICE_*.
  if (process.env.NODE_ENV === 'production') {
    // In prod we want real Stripe price IDs (price_...)
    if (!priceId.startsWith('price_')) {
      // Force a clear error early.
      if (tier.key === 'growth') {
        requireEnv(interval === 'monthly' ? 'STRIPE_PRICE_GROWTH_MONTHLY' : 'STRIPE_PRICE_GROWTH_ANNUALLY');
      }
      if (tier.key === 'scale') {
        requireEnv(interval === 'monthly' ? 'STRIPE_PRICE_SCALE_MONTHLY' : 'STRIPE_PRICE_SCALE_ANNUALLY');
      }
    }
  }

  return priceId;
}


