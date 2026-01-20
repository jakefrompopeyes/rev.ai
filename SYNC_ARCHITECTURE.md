# Data Sync Architecture

This document explains how data synchronization works in the application.

## Two Sync Mechanisms

The application uses **two complementary sync mechanisms**:

1. **Webhooks** (Real-time, event-driven)
2. **Manual Sync** (Full sync via API)

## How Webhooks Work

### What are Webhooks?

Webhooks are HTTP callbacks - Stripe sends a POST request to your application whenever something happens in your Stripe account (customer created, subscription updated, payment made, etc.).

### The Flow

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Stripe    │         │   Your App   │         │  Database   │
│  Account    │         │  (Webhook    │         │             │
│             │         │   Endpoint)  │         │             │
└──────┬──────┘         └──────┬───────┘         └──────┬──────┘
       │                       │                         │
       │ 1. Customer created   │                         │
       │───────────────────────>│                         │
       │                       │                         │
       │                       │ 2. Verify signature     │
       │                       │    & process event      │
       │                       │                         │
       │                       │ 3. Update database      │
       │                       │────────────────────────>│
       │                       │                         │
       │ 4. Return 200 OK      │                         │
       │<──────────────────────│                         │
```

### Step-by-Step Process

1. **Event Occurs in Stripe**
   - Example: A customer subscribes to a plan
   - Stripe generates a `customer.subscription.created` event

2. **Stripe Sends Webhook**
   - Stripe makes an HTTP POST request to: `https://your-app.com/api/stripe/webhook`
   - Includes:
     - Event data (JSON body)
     - Signature header (for verification)
     - Event type and ID

3. **Your App Receives & Verifies**
   - Extracts the raw body and signature
   - Verifies the signature using `STRIPE_WEBHOOK_SECRET`
   - Ensures the event actually came from Stripe (security)

4. **Process the Event**
   - Identifies which organization the event belongs to
   - Updates the database:
     - Creates/updates customer record
     - Creates/updates subscription record
     - Calculates MRR/ARR
     - Records subscription events (upgrade/downgrade)
   - Triggers metrics recalculation

5. **Respond to Stripe**
   - Returns `200 OK` to acknowledge receipt
   - If processing fails, returns error (Stripe will retry)

### Events Handled by Webhooks

- **Customers**: `customer.created`, `customer.updated`, `customer.deleted`
- **Subscriptions**: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
- **Invoices**: `invoice.created`, `invoice.updated`, `invoice.paid`, `invoice.payment_failed`
- **Payments**: `charge.succeeded`, `charge.failed`, `charge.refunded`

### Advantages of Webhooks

✅ **Real-time updates** - Data syncs immediately when events happen  
✅ **Efficient** - Only syncs what changed  
✅ **Automatic** - No manual intervention needed  
✅ **Event history** - Tracks all changes as they happen

### Limitations of Webhooks

⚠️ **Requires webhook setup** - Must configure endpoint in Stripe  
⚠️ **Can miss events** - If your server is down, events might be missed  
⚠️ **No historical data** - Only syncs events going forward

## Manual Sync

### What is Manual Sync?

Manual sync is a full data synchronization that fetches ALL data from Stripe via API calls.

### When to Use Manual Sync

1. **Initial Connection**
   - When you first connect your Stripe account
   - Fetches all existing customers, subscriptions, invoices, payments

2. **Catching Up**
   - If webhooks were down or missed
   - After reconnecting a disconnected account

3. **Periodic Full Sync**
   - Daily/weekly syncs to ensure data consistency
   - Catches any edge cases webhooks might miss

4. **Manual Refresh**
   - User clicks "Sync Now" button in dashboard
   - Ensures data is up-to-date before generating reports

### How Manual Sync Works

```
User clicks "Sync Now"
    ↓
POST /api/stripe/sync
    ↓
1. Fetch ALL customers from Stripe API
2. Fetch ALL subscriptions from Stripe API
3. Fetch ALL invoices from Stripe API
4. Fetch ALL payments from Stripe API
    ↓
Update database with all records
    ↓
Recalculate metrics
    ↓
Generate insights & recommendations
```

### Manual Sync Endpoints

- **API Endpoint**: `POST /api/stripe/sync`
- **Script**: `npm run sync:stripe` (for cron jobs)

## Which One Should You Use?

### Recommended Setup: Both!

**Primary**: Webhooks for real-time updates  
**Backup**: Manual sync for initial load and periodic consistency checks

### Typical Workflow

1. **First Time Setup**
   - Connect Stripe account
   - Run manual sync to load all historical data
   - Set up webhooks for ongoing updates

2. **Ongoing Operation**
   - Webhooks handle real-time updates automatically
   - Optional: Run daily manual sync as backup

3. **If Webhooks Fail**
   - Check webhook status in Stripe Dashboard
   - Run manual sync to catch up on missed events

## Data Consistency

### Webhook Event Tracking

All webhook events are stored in the `stripe_webhook_events` table:
- Event ID (for duplicate detection)
- Event type
- Status (processing, processed, failed, ignored)
- Timestamp
- Error messages (if any)

### Duplicate Prevention

- Webhooks use event IDs to prevent processing the same event twice
- Manual sync uses upsert operations (create or update)

### Conflict Resolution

- Webhooks take precedence for real-time updates
- Manual sync overwrites with latest data from Stripe
- Last write wins (both mechanisms update the same records)

## Monitoring

### Check Webhook Status

1. **In Stripe Dashboard**:
   - Go to Webhooks → Your endpoint
   - View recent events and delivery status

2. **In Your Database**:
   ```sql
   SELECT * FROM stripe_webhook_events 
   ORDER BY received_at DESC 
   LIMIT 100;
   ```

3. **In Application Logs**:
   - Look for: `📨 Received Stripe webhook: [event_type]`
   - Look for: `✅ [resource] synced`

### Check Manual Sync Status

1. **In Database**:
   ```sql
   SELECT * FROM sync_logs 
   ORDER BY started_at DESC 
   LIMIT 10;
   ```

2. **In Dashboard**:
   - View "Last synced" timestamp
   - Check sync status (success/failed)

## Best Practices

1. **Always set up webhooks** for production
2. **Run initial manual sync** when connecting
3. **Set up daily cron job** for manual sync (backup)
4. **Monitor webhook delivery** in Stripe Dashboard
5. **Check sync logs** regularly for errors
6. **Use manual sync** if you suspect data is out of sync

## Troubleshooting

### Webhooks not working?

- Check `STRIPE_WEBHOOK_SECRET` is set correctly
- Verify webhook endpoint is accessible
- Check Stripe Dashboard for delivery failures
- Review application logs for errors

### Data out of sync?

- Run manual sync to catch up
- Check webhook event logs for missed events
- Verify Stripe connection is active
- Check for processing errors in webhook events table

### Missing historical data?

- Webhooks only sync events going forward
- Run manual sync to load historical data
- Historical data is fetched on first connection
