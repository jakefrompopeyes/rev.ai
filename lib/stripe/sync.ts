import Stripe from 'stripe';
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { createConnectedStripeClient } from './client';

interface SyncResult {
  customers: number;
  subscriptions: number;
  invoices: number;
  payments: number;
  errors: string[];
}

/**
 * Sync all Stripe data for an organization
 */
export async function syncStripeData(organizationId: string): Promise<SyncResult> {
  const result: SyncResult = {
    customers: 0,
    subscriptions: 0,
    invoices: 0,
    payments: 0,
    errors: [],
  };

  // Get the Stripe connection
  const connection = await prisma.stripeConnection.findUnique({
    where: { organizationId },
  });

  if (!connection) {
    throw new Error('No Stripe connection found for this organization');
  }

  // Create a log entry
  const syncLog = await prisma.syncLog.create({
    data: {
      organizationId,
      type: 'full',
      status: 'started',
    },
  });

  try {
    // Update connection status
    await prisma.stripeConnection.update({
      where: { id: connection.id },
      data: { lastSyncStatus: 'in_progress' },
    });

    // Create Stripe client with connected account's access token
    const stripe = createConnectedStripeClient(connection.accessToken);

    // Sync in order of dependencies
    result.customers = await syncCustomers(stripe, organizationId);
    result.subscriptions = await syncSubscriptions(stripe, organizationId);
    result.invoices = await syncInvoices(stripe, organizationId);
    result.payments = await syncPayments(stripe, organizationId);

    // Update connection and log
    await prisma.stripeConnection.update({
      where: { id: connection.id },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: 'success',
        lastSyncError: null,
      },
    });

    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        customersSync: result.customers,
        subscriptionsSync: result.subscriptions,
        invoicesSync: result.invoices,
        paymentsSync: result.payments,
      },
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(errorMessage);

    await prisma.stripeConnection.update({
      where: { id: connection.id },
      data: {
        lastSyncStatus: 'failed',
        lastSyncError: errorMessage,
      },
    });

    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'failed',
        completedAt: new Date(),
        errorMessage,
      },
    });

    throw error;
  }
}

/**
 * Sync Stripe customers
 */
async function syncCustomers(stripe: Stripe, organizationId: string): Promise<number> {
  let count = 0;
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const customers = await stripe.customers.list({
      limit: 100,
      starting_after: startingAfter,
      expand: ['data.subscriptions'],
    });

    for (const customer of customers.data) {
      await prisma.stripeCustomer.upsert({
        where: {
          organizationId_stripeId: {
            organizationId,
            stripeId: customer.id,
          },
        },
        create: {
          organizationId,
          stripeId: customer.id,
          email: customer.email ? hashEmail(customer.email) : null,
          stripeCreatedAt: new Date(customer.created * 1000),
          currency: customer.currency,
          delinquent: customer.delinquent ?? false,
          metadata: customer.metadata as object,
        },
        update: {
          email: customer.email ? hashEmail(customer.email) : null,
          currency: customer.currency,
          delinquent: customer.delinquent ?? false,
          metadata: customer.metadata as object,
        },
      });
      count++;
    }

    hasMore = customers.has_more;
    if (customers.data.length > 0) {
      startingAfter = customers.data[customers.data.length - 1].id;
    }
  }

  return count;
}

/**
 * Sync Stripe subscriptions and track plan changes
 */
async function syncSubscriptions(stripe: Stripe, organizationId: string): Promise<number> {
  let count = 0;
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const subscriptions = await stripe.subscriptions.list({
      limit: 100,
      starting_after: startingAfter,
      status: 'all',
      expand: ['data.discount'],
    });

    for (const sub of subscriptions.data) {
      // Get the customer record
      const customer = await prisma.stripeCustomer.findFirst({
        where: {
          organizationId,
          stripeId: sub.customer as string,
        },
      });

      if (!customer) continue;

      // Get primary plan info
      const item = sub.items.data[0];
      const price = item?.price;
      const planAmount = price?.unit_amount ?? 0;
      const planInterval = price?.recurring?.interval ?? 'month';
      const planIntervalCount = price?.recurring?.interval_count ?? 1;
      const quantity = item?.quantity ?? 1;

      // Calculate MRR
      const { mrr, arr } = calculateMrrArr(planAmount, planInterval, planIntervalCount, quantity);

      // Get discount info
      const discount = sub.discount;
      const discountPercent = discount?.coupon?.percent_off ?? null;
      const discountAmountOff = discount?.coupon?.amount_off ?? null;

      // Check if this subscription exists and track changes
      const existingSubscription = await prisma.stripeSubscription.findUnique({
        where: {
          organizationId_stripeId: {
            organizationId,
            stripeId: sub.id,
          },
        },
      });

      // Upsert the subscription
      const upsertedSubscription = await prisma.stripeSubscription.upsert({
        where: {
          organizationId_stripeId: {
            organizationId,
            stripeId: sub.id,
          },
        },
        create: {
          organizationId,
          customerId: customer.id,
          stripeId: sub.id,
          status: sub.status,
          currentPeriodStart: new Date(sub.current_period_start * 1000),
          currentPeriodEnd: new Date(sub.current_period_end * 1000),
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
          endedAt: sub.ended_at ? new Date(sub.ended_at * 1000) : null,
          trialStart: sub.trial_start ? new Date(sub.trial_start * 1000) : null,
          trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
          startDate: new Date(sub.start_date * 1000),
          billingCycleAnchor: new Date(sub.billing_cycle_anchor * 1000),
          planId: price?.id,
          planNickname: price?.nickname,
          planAmount,
          planCurrency: price?.currency ?? 'usd',
          planInterval,
          planIntervalCount,
          discountId: discount?.id,
          discountPercent,
          discountAmountOff,
          quantity,
          mrr,
          arr,
          stripeCreatedAt: new Date(sub.created * 1000),
          metadata: sub.metadata as object,
        },
        update: {
          status: sub.status,
          currentPeriodStart: new Date(sub.current_period_start * 1000),
          currentPeriodEnd: new Date(sub.current_period_end * 1000),
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
          endedAt: sub.ended_at ? new Date(sub.ended_at * 1000) : null,
          trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
          planId: price?.id,
          planNickname: price?.nickname,
          planAmount,
          planInterval,
          planIntervalCount,
          discountId: discount?.id,
          discountPercent,
          discountAmountOff,
          quantity,
          mrr,
          arr,
          metadata: sub.metadata as object,
        },
      });

      // Track subscription events (plan changes, cancellations, reactivations)
      await trackSubscriptionEvent(
        organizationId,
        upsertedSubscription.id,
        existingSubscription,
        {
          mrr,
          planId: price?.id ?? null,
          planNickname: price?.nickname ?? null,
          quantity,
          status: sub.status,
          canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
        }
      );

      count++;
    }

    hasMore = subscriptions.has_more;
    if (subscriptions.data.length > 0) {
      startingAfter = subscriptions.data[subscriptions.data.length - 1].id;
    }
  }

  return count;
}

/**
 * Track subscription changes and create events for upgrades, downgrades, etc.
 */
async function trackSubscriptionEvent(
  organizationId: string,
  subscriptionId: string,
  existing: {
    id: string;
    mrr: number;
    planId: string | null;
    planNickname: string | null;
    quantity: number;
    status: string;
    canceledAt: Date | null;
  } | null,
  current: {
    mrr: number;
    planId: string | null;
    planNickname: string | null;
    quantity: number;
    status: string;
    canceledAt: Date | null;
  }
): Promise<void> {
  // New subscription
  if (!existing) {
    await prisma.subscriptionEvent.create({
      data: {
        organizationId,
        subscriptionId,
        type: 'NEW',
        previousMrr: 0,
        newMrr: current.mrr,
        mrrDelta: current.mrr,
        previousPlanId: null,
        previousPlanNickname: null,
        newPlanId: current.planId,
        newPlanNickname: current.planNickname,
        previousQuantity: null,
        newQuantity: current.quantity,
      },
    });
    return;
  }

  // Cancellation
  if (!existing.canceledAt && current.canceledAt) {
    await prisma.subscriptionEvent.create({
      data: {
        organizationId,
        subscriptionId,
        type: 'CANCELED',
        previousMrr: existing.mrr,
        newMrr: 0,
        mrrDelta: -existing.mrr,
        previousPlanId: existing.planId,
        previousPlanNickname: existing.planNickname,
        newPlanId: current.planId,
        newPlanNickname: current.planNickname,
        previousQuantity: existing.quantity,
        newQuantity: current.quantity,
      },
    });
    return;
  }

  // Reactivation (was canceled, now active again)
  if (existing.canceledAt && !current.canceledAt && current.status === 'active') {
    await prisma.subscriptionEvent.create({
      data: {
        organizationId,
        subscriptionId,
        type: 'REACTIVATED',
        previousMrr: 0,
        newMrr: current.mrr,
        mrrDelta: current.mrr,
        previousPlanId: existing.planId,
        previousPlanNickname: existing.planNickname,
        newPlanId: current.planId,
        newPlanNickname: current.planNickname,
        previousQuantity: existing.quantity,
        newQuantity: current.quantity,
      },
    });
    return;
  }

  // MRR change detection (upgrade or downgrade)
  const mrrDelta = current.mrr - existing.mrr;
  
  // Only track if there's a meaningful change (> $1 to avoid rounding issues)
  if (Math.abs(mrrDelta) > 100) {
    const eventType = mrrDelta > 0 ? 'UPGRADE' : 'DOWNGRADE';
    
    await prisma.subscriptionEvent.create({
      data: {
        organizationId,
        subscriptionId,
        type: eventType,
        previousMrr: existing.mrr,
        newMrr: current.mrr,
        mrrDelta,
        previousPlanId: existing.planId,
        previousPlanNickname: existing.planNickname,
        newPlanId: current.planId,
        newPlanNickname: current.planNickname,
        previousQuantity: existing.quantity,
        newQuantity: current.quantity,
      },
    });
  }
}

/**
 * Sync Stripe invoices
 */
async function syncInvoices(stripe: Stripe, organizationId: string): Promise<number> {
  let count = 0;
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const invoices = await stripe.invoices.list({
      limit: 100,
      starting_after: startingAfter,
    });

    for (const invoice of invoices.data) {
      if (!invoice.customer) continue;

      const customer = await prisma.stripeCustomer.findFirst({
        where: {
          organizationId,
          stripeId: invoice.customer as string,
        },
      });

      if (!customer) continue;

      // Calculate discount amount
      const discountAmount = (invoice.subtotal ?? 0) - (invoice.total ?? 0) + (invoice.tax ?? 0);

      await prisma.stripeInvoice.upsert({
        where: {
          organizationId_stripeId: {
            organizationId,
            stripeId: invoice.id,
          },
        },
        create: {
          organizationId,
          customerId: customer.id,
          stripeId: invoice.id,
          status: invoice.status ?? 'draft',
          amountDue: invoice.amount_due ?? 0,
          amountPaid: invoice.amount_paid ?? 0,
          amountRemaining: invoice.amount_remaining ?? 0,
          subtotal: invoice.subtotal ?? 0,
          total: invoice.total ?? 0,
          tax: invoice.tax,
          currency: invoice.currency ?? 'usd',
          discountAmount: Math.max(0, discountAmount),
          periodStart: new Date((invoice.period_start ?? invoice.created) * 1000),
          periodEnd: new Date((invoice.period_end ?? invoice.created) * 1000),
          dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
          paidAt: invoice.status_transitions?.paid_at 
            ? new Date(invoice.status_transitions.paid_at * 1000) 
            : null,
          billingReason: invoice.billing_reason,
          subscriptionId: invoice.subscription as string | null,
          stripeCreatedAt: new Date(invoice.created * 1000),
          metadata: invoice.metadata as object,
        },
        update: {
          status: invoice.status ?? 'draft',
          amountDue: invoice.amount_due ?? 0,
          amountPaid: invoice.amount_paid ?? 0,
          amountRemaining: invoice.amount_remaining ?? 0,
          subtotal: invoice.subtotal ?? 0,
          total: invoice.total ?? 0,
          tax: invoice.tax,
          discountAmount: Math.max(0, discountAmount),
          paidAt: invoice.status_transitions?.paid_at 
            ? new Date(invoice.status_transitions.paid_at * 1000) 
            : null,
          metadata: invoice.metadata as object,
        },
      });
      count++;
    }

    hasMore = invoices.has_more;
    if (invoices.data.length > 0) {
      startingAfter = invoices.data[invoices.data.length - 1].id;
    }
  }

  return count;
}

/**
 * Sync Stripe payments (charges)
 */
async function syncPayments(stripe: Stripe, organizationId: string): Promise<number> {
  let count = 0;
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const charges = await stripe.charges.list({
      limit: 100,
      starting_after: startingAfter,
    });

    for (const charge of charges.data) {
      let customerId: string | null = null;

      if (charge.customer) {
        const customer = await prisma.stripeCustomer.findFirst({
          where: {
            organizationId,
            stripeId: charge.customer as string,
          },
        });
        customerId = customer?.id ?? null;
      }

      await prisma.stripePayment.upsert({
        where: {
          organizationId_stripeId: {
            organizationId,
            stripeId: charge.id,
          },
        },
        create: {
          organizationId,
          customerId,
          stripeId: charge.id,
          status: charge.status,
          amount: charge.amount,
          amountRefunded: charge.amount_refunded,
          currency: charge.currency,
          fee: charge.balance_transaction 
            ? (typeof charge.balance_transaction === 'object' ? charge.balance_transaction.fee : 0) 
            : 0,
          net: charge.balance_transaction 
            ? (typeof charge.balance_transaction === 'object' ? charge.balance_transaction.net : charge.amount) 
            : charge.amount,
          failureCode: charge.failure_code,
          failureMessage: charge.failure_message,
          paymentMethodType: charge.payment_method_details?.type,
          stripeCreatedAt: new Date(charge.created * 1000),
          metadata: charge.metadata as object,
        },
        update: {
          status: charge.status,
          amountRefunded: charge.amount_refunded,
          failureCode: charge.failure_code,
          failureMessage: charge.failure_message,
          metadata: charge.metadata as object,
        },
      });
      count++;
    }

    hasMore = charges.has_more;
    if (charges.data.length > 0) {
      startingAfter = charges.data[charges.data.length - 1].id;
    }
  }

  return count;
}

/**
 * Calculate MRR and ARR from plan details
 */
function calculateMrrArr(
  amount: number, 
  interval: string, 
  intervalCount: number,
  quantity: number
): { mrr: number; arr: number } {
  const totalAmount = amount * quantity;
  let mrr: number;

  switch (interval) {
    case 'day':
      mrr = Math.round((totalAmount * 30) / intervalCount);
      break;
    case 'week':
      mrr = Math.round((totalAmount * 4.33) / intervalCount);
      break;
    case 'month':
      mrr = Math.round(totalAmount / intervalCount);
      break;
    case 'year':
      mrr = Math.round(totalAmount / (12 * intervalCount));
      break;
    default:
      mrr = totalAmount;
  }

  return {
    mrr,
    arr: mrr * 12,
  };
}

/**
 * Hash email for privacy (simple hash, not cryptographically secure)
 */
function hashEmail(email: string): string {
  const secret = process.env.PII_HASH_SECRET;
  if (!secret) {
    console.warn('PII_HASH_SECRET not set; falling back to anonymized email hash');
  }

  const normalized = email.trim().toLowerCase();
  const hmac = crypto.createHmac('sha256', secret || 'discovred-fallback-secret');
  hmac.update(normalized);
  return hmac.digest('hex');
}

