import { z } from 'zod';

const serverEnvSchema = z
  .object({
    NODE_ENV: z.string().optional(),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    NEXT_PUBLIC_SUPABASE_URL: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_URL is required'),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
    APP_URL: z.string().min(1, 'APP_URL is required'),
    OPENAI_API_KEY: z.string().optional(),
    PII_HASH_SECRET: z.string().min(8, 'PII_HASH_SECRET should be at least 8 characters').optional(),
    ADMIN_API_KEY: z.string().optional(),
    FREE_MODE: z.string().optional(), // Set to "true" to disable billing and give free access
    FORECAST_CACHE_TTL_MS: z.string().optional(),
    STRIPE_MODE: z.string().optional(),
    STRIPE_CLIENT_ID: z.string().optional(),
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_PUBLISHABLE_KEY: z.string().optional(),
    STRIPE_CLIENT_ID_TEST: z.string().optional(),
    STRIPE_SECRET_KEY_TEST: z.string().optional(),
    STRIPE_PUBLISHABLE_KEY_TEST: z.string().optional(),
    STRIPE_CLIENT_ID_LIVE: z.string().optional(),
    STRIPE_SECRET_KEY_LIVE: z.string().optional(),
    STRIPE_PUBLISHABLE_KEY_LIVE: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // Skip production validation during build time
    // During build, Next.js may set NODE_ENV=production but we shouldn't enforce
    // production requirements until runtime. Check if we're in a build context.
    const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build' || 
                        process.env.NEXT_PHASE === 'phase-development-build' ||
                        process.env.NEXT_PHASE === 'phase-export';
    
    // Only enforce production requirements at runtime, not during build
    const isProd = (data.NODE_ENV ?? 'development') === 'production';
    if (!isProd || isBuildTime) return;

    // Note: STRIPE_WEBHOOK_SECRET is optional - only needed if using webhooks
    // It's not required for basic Stripe Connect functionality

    if (!data.STRIPE_SECRET_KEY_LIVE && !data.STRIPE_SECRET_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['STRIPE_SECRET_KEY_LIVE'],
        message: 'Stripe secret key is required in production',
      });
    }

    if (!data.STRIPE_CLIENT_ID_LIVE && !data.STRIPE_CLIENT_ID) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['STRIPE_CLIENT_ID_LIVE'],
        message: 'Stripe client ID is required in production',
      });
    }

    if (!data.STRIPE_PUBLISHABLE_KEY_LIVE && !data.STRIPE_PUBLISHABLE_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['STRIPE_PUBLISHABLE_KEY_LIVE'],
        message: 'Stripe publishable key is required in production',
      });
    }
  });

let cachedServerEnv: z.infer<typeof serverEnvSchema> | null = null;

export function getServerEnv() {
  if (cachedServerEnv) return cachedServerEnv;
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid server environment: ${details}`);
  }
  cachedServerEnv = parsed.data;
  return cachedServerEnv;
}

export function assertServerEnv() {
  getServerEnv();
}

/**
 * Check if free mode is enabled (disables billing and gives free access)
 */
export function isFreeMode(): boolean {
  return process.env.FREE_MODE === 'true' || process.env.FREE_MODE === '1';
}

