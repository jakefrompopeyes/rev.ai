import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/db';
import { getSecretKey } from '@/lib/stripe/client';

const stripe = new Stripe(getSecretKey(), { apiVersion: '2023-10-16' });

// Disable body parsing - Stripe needs raw body for signature verification
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  console.log(`📨 Received Stripe webhook: ${event.type}`);

  try {
    // Find the organization by the connected account
    const stripeAccountId = event.account;
    
    let connection;
    if (stripeAccountId) {
      // Event from a connected account
      connection = await prisma.stripeConnection.findFirst({
        where: { stripeAccountId, disconnectedAt: null },
      });
    } else {
      // Direct account event - find the first active connection
      connection = await prisma.stripeConnection.findFirst({
        where: { disconnectedAt: null },
      });
    }

    if (!connection) {
      console.warn('No active Stripe connection found for webhook');
      return NextResponse.json({ received: true });
    }

    const organizationId = connection.organizationId;

    switch (event.type) {
      // Customer events
      case 'customer.created':
      case 'customer.updated':
        await handleCustomerUpdate(event.data.object as Stripe.Customer, organizationId);
        break;
      case 'customer.deleted':
        await handleCustomerDeleted(event.data.object as Stripe.Customer, organizationId);
        break;

      // Subscription events
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object as Stripe.Subscription, organizationId);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, organizationId);
        break;

      // Invoice events
      case 'invoice.created':
      case 'invoice.updated':
      case 'invoice.paid':
      case 'invoice.payment_failed':
        await handleInvoiceUpdate(event.data.object as Stripe.Invoice, organizationId);
        break;

      // Payment events
      case 'charge.succeeded':
      case 'charge.failed':
      case 'charge.refunded':
        await handleChargeUpdate(event.data.object as Stripe.Charge, organizationId);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Update last sync time
    await prisma.stripeConnection.update({
      where: { id: connection.id },
      data: { lastSyncAt: new Date(), lastSyncStatus: 'success' },
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}

async function handleCustomerUpdate(customer: Stripe.Customer, organizationId: string) {
  await prisma.stripeCustomer.upsert({
    where: {
      organizationId_stripeId: { organizationId, stripeId: customer.id },
    },
    create: {
      stripeId: customer.id,
      email: customer.email,
      currency: customer.currency,
      delinquent: customer.delinquent || false,
      organizationId,
      stripeCreatedAt: new Date(customer.created * 1000),
      metadata: customer.metadata || {},
    },
    update: {
      email: customer.email,
      currency: customer.currency,
      delinquent: customer.delinquent || false,
      metadata: customer.metadata || {},
    },
  });
  console.log(`✅ Customer ${customer.id} synced`);
}

async function handleCustomerDeleted(customer: Stripe.Customer, organizationId: string) {
  await prisma.stripeCustomer.deleteMany({
    where: { organizationId, stripeId: customer.id },
  });
  console.log(`🗑️ Customer ${customer.id} deleted`);
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription, organizationId: string) {
  const item = subscription.items.data[0];
  const price = item?.price;
  const planAmount = price?.unit_amount || 0;
  const interval = price?.recurring?.interval || 'month';

  // Calculate MRR
  let mrr = planAmount;
  if (interval === 'year') {
    mrr = Math.round(planAmount / 12);
  } else if (interval === 'week') {
    mrr = Math.round(planAmount * 4.33);
  }

  // Get db customer id
  const stripeCustomerId = typeof subscription.customer === 'string' 
    ? subscription.customer 
    : subscription.customer.id;
  
  const dbCustomer = await prisma.stripeCustomer.findFirst({
    where: { organizationId, stripeId: stripeCustomerId },
  });

  if (!dbCustomer) {
    console.warn(`Customer ${stripeCustomerId} not found, skipping subscription`);
    return;
  }

  await prisma.stripeSubscription.upsert({
    where: {
      organizationId_stripeId: { organizationId, stripeId: subscription.id },
    },
    create: {
      stripeId: subscription.id,
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
      endedAt: subscription.ended_at ? new Date(subscription.ended_at * 1000) : null,
      trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
      trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
      startDate: new Date(subscription.start_date * 1000),
      billingCycleAnchor: new Date(subscription.billing_cycle_anchor * 1000),
      planId: price?.id || 'unknown',
      planNickname: price?.nickname || 'Plan',
      planAmount,
      planCurrency: price?.currency || 'usd',
      planInterval: interval,
      planIntervalCount: price?.recurring?.interval_count || 1,
      quantity: item?.quantity || 1,
      mrr,
      arr: mrr * 12,
      organizationId,
      customerId: dbCustomer.id,
      stripeCreatedAt: new Date(subscription.created * 1000),
      metadata: subscription.metadata || {},
    },
    update: {
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
      endedAt: subscription.ended_at ? new Date(subscription.ended_at * 1000) : null,
      trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
      trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
      mrr,
      arr: mrr * 12,
    },
  });

  // Record subscription event
  const eventType = subscription.status === 'canceled' ? 'CANCELED' 
    : subscription.status === 'active' && !subscription.trial_end ? 'CONVERTED'
    : 'UPGRADED';

  await prisma.subscriptionEvent.create({
    data: {
      organizationId,
      subscriptionId: subscription.id,
      eventType,
      previousMrr: 0,
      newMrr: mrr,
      mrrDelta: mrr,
    },
  });

  console.log(`✅ Subscription ${subscription.id} synced (MRR: $${(mrr / 100).toFixed(2)})`);

  // Update daily metrics
  await updateDailyMetrics(organizationId);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription, organizationId: string) {
  await prisma.stripeSubscription.updateMany({
    where: { organizationId, stripeId: subscription.id },
    data: { 
      status: 'canceled',
      endedAt: new Date(),
    },
  });
  console.log(`🗑️ Subscription ${subscription.id} marked as canceled`);
  
  await updateDailyMetrics(organizationId);
}

async function handleInvoiceUpdate(invoice: Stripe.Invoice, organizationId: string) {
  const stripeCustomerId = typeof invoice.customer === 'string' 
    ? invoice.customer 
    : invoice.customer?.id;

  const dbCustomer = await prisma.stripeCustomer.findFirst({
    where: { organizationId, stripeId: stripeCustomerId },
  });

  if (!dbCustomer) {
    console.warn(`Customer ${stripeCustomerId} not found, skipping invoice`);
    return;
  }

  const stripeSubId = typeof invoice.subscription === 'string' 
    ? invoice.subscription 
    : invoice.subscription?.id;

  await prisma.stripeInvoice.upsert({
    where: {
      organizationId_stripeId: { organizationId, stripeId: invoice.id },
    },
    create: {
      stripeId: invoice.id,
      organizationId,
      customerId: dbCustomer.id,
      subscriptionId: stripeSubId || null,
      status: invoice.status || 'draft',
      amountDue: invoice.amount_due || 0,
      amountPaid: invoice.amount_paid || 0,
      amountRemaining: invoice.amount_remaining || 0,
      subtotal: invoice.subtotal || 0,
      total: invoice.total || 0,
      tax: invoice.tax || null,
      currency: invoice.currency || 'usd',
      discountAmount: 0,
      billingReason: invoice.billing_reason,
      stripeCreatedAt: new Date(invoice.created * 1000),
      periodStart: invoice.period_start ? new Date(invoice.period_start * 1000) : new Date(),
      periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : new Date(),
      dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
      paidAt: invoice.status === 'paid' && invoice.status_transitions?.paid_at
        ? new Date(invoice.status_transitions.paid_at * 1000)
        : null,
      metadata: invoice.metadata || {},
    },
    update: {
      status: invoice.status || 'draft',
      amountPaid: invoice.amount_paid || 0,
      amountRemaining: invoice.amount_remaining || 0,
      paidAt: invoice.status === 'paid' && invoice.status_transitions?.paid_at
        ? new Date(invoice.status_transitions.paid_at * 1000)
        : null,
    },
  });
  console.log(`✅ Invoice ${invoice.id} synced`);
}

async function handleChargeUpdate(charge: Stripe.Charge, organizationId: string) {
  const stripeCustomerId = typeof charge.customer === 'string' 
    ? charge.customer 
    : charge.customer?.id;

  if (!stripeCustomerId) return;

  const dbCustomer = await prisma.stripeCustomer.findFirst({
    where: { organizationId, stripeId: stripeCustomerId },
  });

  if (!dbCustomer) {
    console.warn(`Customer ${stripeCustomerId} not found, skipping charge`);
    return;
  }

  await prisma.stripePayment.upsert({
    where: {
      organizationId_stripeId: { organizationId, stripeId: charge.id },
    },
    create: {
      stripeId: charge.id,
      organizationId,
      customerId: dbCustomer.id,
      amount: charge.amount,
      amountRefunded: charge.amount_refunded,
      currency: charge.currency,
      status: charge.status,
      fee: 0,
      net: charge.amount,
      paymentMethodType: charge.payment_method_details?.type,
      failureCode: charge.failure_code,
      failureMessage: charge.failure_message,
      stripeCreatedAt: new Date(charge.created * 1000),
      metadata: charge.metadata || {},
    },
    update: {
      status: charge.status,
      amountRefunded: charge.amount_refunded,
      failureCode: charge.failure_code,
      failureMessage: charge.failure_message,
    },
  });
  console.log(`✅ Payment ${charge.id} synced (${charge.status})`);
}

async function updateDailyMetrics(organizationId: string) {
  const activeSubscriptions = await prisma.stripeSubscription.findMany({
    where: {
      organizationId,
      status: { in: ['active', 'trialing'] },
    },
  });

  const totalMrr = activeSubscriptions.reduce((sum, sub) => sum + sub.mrr, 0);
  const avgArpu = activeSubscriptions.length > 0 ? totalMrr / activeSubscriptions.length : 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.dailyMetrics.upsert({
    where: {
      organizationId_date: { organizationId, date: today },
    },
    create: {
      organizationId,
      date: today,
      mrr: totalMrr,
      arr: totalMrr * 12,
      arpu: Math.round(avgArpu),
      activeSubscriptions: activeSubscriptions.length,
      newSubscriptions: 0,
      canceledSubscriptions: 0,
      upgrades: 0,
      downgrades: 0,
      grossChurnRate: 0,
      revenueChurnRate: 0,
      netRevenueRetention: 100,
      failedPayments: 0,
      successfulPayments: 0,
      failedPaymentRate: 0,
      totalPaymentVolume: 0,
      averageDiscount: 0,
      effectivePrice: Math.round(avgArpu),
      discountLeakage: 0,
      planDistribution: {},
    },
    update: {
      mrr: totalMrr,
      arr: totalMrr * 12,
      arpu: Math.round(avgArpu),
      activeSubscriptions: activeSubscriptions.length,
    },
  });

  console.log(`📊 Daily metrics updated (MRR: $${(totalMrr / 100).toFixed(2)})`);
}

