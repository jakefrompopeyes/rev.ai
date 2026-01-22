# Stripe Webhook Setup Guide

This guide will help you set up Stripe webhooks for real-time data synchronization.

## Overview

Webhooks allow Stripe to send real-time events to your application when things happen in your connected Stripe accounts (customers created, subscriptions updated, payments made, etc.).

## Events Handled

The webhook endpoint handles the following events:
- **Customer events**: `customer.created`, `customer.updated`, `customer.deleted`
- **Subscription events**: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
- **Invoice events**: `invoice.created`, `invoice.updated`, `invoice.paid`, `invoice.payment_failed`
- **Payment events**: `charge.succeeded`, `charge.failed`, `charge.refunded`

## Setup for Local Development

### Option 1: Using Stripe CLI (Recommended)

1. **Install Stripe CLI**:
   ```bash
   # macOS
   brew install stripe/stripe-cli/stripe
   
   # Or download from: https://stripe.com/docs/stripe-cli
   ```

2. **Login to Stripe**:
   ```bash
   stripe login
   ```

3. **Forward webhooks to your local server**:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

4. **Copy the webhook signing secret**:
   The CLI will output something like:
   ```
   > Ready! Your webhook signing secret is whsec_xxxxx
   ```

5. **Add to your `.env.local`**:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_xxxxx
   ```

6. **Trigger test events** (optional):
   ```bash
   stripe trigger customer.created
   stripe trigger customer.subscription.created
   ```

### Option 2: Using ngrok (Alternative)

1. **Install ngrok**: https://ngrok.com/download

2. **Start your Next.js server**:
   ```bash
   npm run dev
   ```

3. **Expose your local server**:
   ```bash
   ngrok http 3000
   ```

4. **Copy the ngrok URL** (e.g., `https://abc123.ngrok.io`)

5. **Set up webhook in Stripe Dashboard**:
   - For test mode: Go to https://dashboard.stripe.com/test/webhooks
   - For live mode: Go to https://dashboard.stripe.com/webhooks
   - Click "Add endpoint"
   - Enter: `https://abc123.ngrok.io/api/stripe/webhook`
   - Select the events listed above
   - Copy the signing secret

6. **Add to your `.env.local`**:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_xxxxx
   ```

## Setup for Production

1. **Deploy your application** to your hosting provider (Vercel, Railway, etc.)

2. **Get your production URL**:
   - Example: `https://your-app.vercel.app`

3. **Set up webhook in Stripe Dashboard**:
   - **Live mode** (production): https://dashboard.stripe.com/webhooks
   - **Test mode** (development): https://dashboard.stripe.com/test/webhooks
   - Click "Add endpoint"
   - Enter: `https://your-app.vercel.app/api/stripe/webhook`
   - Select events:
     - `customer.created`
     - `customer.updated`
     - `customer.deleted`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.created`
     - `invoice.updated`
     - `invoice.paid`
     - `invoice.payment_failed`
     - `charge.succeeded`
     - `charge.failed`
     - `charge.refunded`
   - Click "Add endpoint"

4. **Copy the signing secret**:
   - Click on the webhook endpoint you just created
   - Click "Reveal" next to "Signing secret"
   - Copy the secret (starts with `whsec_`)

5. **Add to your production environment variables**:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_xxxxx
   ```

## Verifying Webhooks Work

1. **Check your application logs** when a webhook is received:
   ```
   📨 Received Stripe webhook: customer.subscription.created
   ✅ Subscription sub_xxxxx synced (MRR: $99.00)
   ```

2. **Check the database**:
   - Webhook events are stored in `stripe_webhook_events` table
   - Check status: `processing`, `processed`, `failed`, or `ignored`

3. **Test with Stripe CLI** (local only):
   ```bash
   stripe trigger customer.subscription.created
   ```

## Troubleshooting

### "Webhook not configured" error
- Make sure `STRIPE_WEBHOOK_SECRET` is set in your environment variables
- Restart your server after adding the secret

### "Invalid signature" error
- Make sure you're using the correct webhook secret
- For local development with Stripe CLI, use the secret from `stripe listen`
- For production, use the secret from your Stripe Dashboard webhook endpoint

### Webhooks not being received
- Check that your webhook endpoint URL is correct and accessible
- For local development, make sure Stripe CLI is running (`stripe listen`)
- For production, verify the URL is publicly accessible
- Check Stripe Dashboard → Webhooks → Your endpoint → Recent events

### Webhooks received but not processed
- Check your application logs for errors
- Verify your Stripe account is connected (`/api/stripe/status`)
- Check that the webhook event has a matching `stripeAccountId` in your database

## Webhook Endpoint Details

- **URL**: `/api/stripe/webhook`
- **Method**: `POST`
- **Content-Type**: `application/json`
- **Authentication**: Signature verification using `STRIPE_WEBHOOK_SECRET`

## Security Notes

- Webhook signatures are verified to ensure events come from Stripe
- Duplicate events are automatically ignored (idempotency)
- Failed webhook processing is logged in the database
- Webhook events are stored for audit purposes
