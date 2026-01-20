import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe, getPublishableKey } from '@/lib/stripe/client';
import { getStripePriceIdForTier, getTierByKey, type BillingInterval } from '@/lib/billing/tiers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tierKey, interval } = body as { tierKey?: string; interval?: BillingInterval };

    const tier = tierKey ? getTierByKey(tierKey) : null;
    if (!tier || (interval !== 'monthly' && interval !== 'annually')) {
      return NextResponse.json(
        { error: 'Invalid tier or billing interval' },
        { status: 400 }
      );
    }

    // Require auth + org so we can attach billing to an Organization
    const { requireAuthWithOrg } = await import('@/lib/supabase/auth-helpers');
    const { organizationId, email, userId } = await requireAuthWithOrg();

    // Check if free mode is enabled - if so, grant comped access instead of creating Stripe checkout
    const { isFreeMode } = await import('@/lib/env');
    if (isFreeMode()) {
      const { prisma } = await import('@/lib/db');
      const compedTier = tier.key.toUpperCase() as 'STARTER' | 'GROWTH' | 'SCALE' | 'ENTERPRISE';
      
      await prisma.organization.update({
        where: { id: organizationId },
        data: {
          isComped: true,
          compedTier,
          compedReason: 'Free mode enabled',
        },
      });

      // Return success response (similar to Stripe checkout success)
      const appUrl = process.env.APP_URL || 
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
      
      return NextResponse.json({ 
        url: `${appUrl}/dashboard?checkout=success&free_mode=true`,
        sessionId: 'free-mode',
        freeMode: true,
      });
    }

    if (!tier.stripePriceId) {
      return NextResponse.json(
        { error: 'Selected tier is not purchasable via checkout' },
        { status: 400 }
      );
    }

    const stripePriceId = getStripePriceIdForTier(tier, interval);

    // Get app URL for redirects
    const appUrl = process.env.APP_URL || 
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

    // Create Stripe checkout session
    const stripe = getStripe();
    
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/pricing?checkout=cancelled`,
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      customer_email: email,
      client_reference_id: organizationId,
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          billingType: 'revai',
          organizationId,
          tierKey: tier.key,
          interval,
          userId,
        },
      },
      metadata: {
        billingType: 'revai',
        organizationId,
        tierKey: tier.key,
        interval,
        userId,
      },
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    return NextResponse.json({ 
      url: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error('Checkout session creation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve publishable key for client-side Stripe.js
export async function GET() {
  return NextResponse.json({
    publishableKey: getPublishableKey(),
  });
}

