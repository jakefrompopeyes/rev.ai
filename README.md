# discovred - AI-Powered Revenue Intelligence Platform

> Transform your Stripe data into actionable revenue insights. Built for subscription businesses.

![discovred Dashboard](https://via.placeholder.com/800x400?text=discovred+Dashboard)

## 🎯 Target Customer (ICP)

discovred is designed first for:

- **Company type**: B2B SaaS
- **Billing stack**: Stripe Billing (subscriptions)
- **Size**: ~**$1M–$15M ARR**
- **Primary jobs-to-be-done**: make better pricing + retention decisions (discounts, plan complexity, churn risk)

## 🎯 Overview

discovred connects to your Stripe account via secure OAuth (read-only) and provides:

- **Live Revenue Metrics** - MRR, ARR, ARPU, churn, and more
- **AI-Generated Insights** - Plain English explanations of trends and anomalies
- **Actionable Recommendations** - Prioritized actions with estimated revenue impact
- **Change Tracking** - Monitor the impact of your pricing and retention changes

## ✨ Features

### Core Metrics
- Monthly/Annual Recurring Revenue (MRR/ARR)
- Average Revenue Per User (ARPU)
- Gross and Revenue Churn Rates
- Net Revenue Retention
- Failed Payment Rate
- Discount Leakage Analysis

### AI Insights
- Churn pattern detection
- Pricing inefficiency identification
- Plan performance comparison
- Anomaly detection
- Trend analysis

### Recommendations
- Risk-assessed action items
- Revenue impact estimation
- Implementation tracking
- Before/after comparison

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Stripe account with OAuth enabled
- OpenAI API key (for AI features)
 - Supabase project (for auth)

### Installation

1. **Clone and install dependencies**
   ```bash
   cd discovred
   npm install
   ```

2. **Configure environment**
   ```bash
   cp env.template .env.local
   ```
   
   Edit `.env.local` with your credentials:
   ```env
   DATABASE_URL="postgresql://..."
    NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
    NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
    SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
    STRIPE_MODE="test"
    STRIPE_CLIENT_ID_TEST="ca_xxx"
    STRIPE_SECRET_KEY_TEST="sk_test_xxx"
    STRIPE_PUBLISHABLE_KEY_TEST="pk_test_xxx"
    STRIPE_WEBHOOK_SECRET="whsec_xxx"
   OPENAI_API_KEY="sk-xxx"
    PII_HASH_SECRET="replace-with-random-32-bytes"
   APP_URL="http://localhost:3000"
   ```
   For the full list (including Stripe price IDs), see `env.template`.

3. **Set up database**
   ```bash
   npm run db:generate
   npm run db:push
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Open http://localhost:3000**

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                        │
│  ┌──────────────┬───────────────┬─────────────┬───────────────┐ │
│  │ Revenue      │ AI Insights   │ AI Recom-   │ Change        │ │
│  │ Snapshot     │ Feed          │ mendations  │ Tracking      │ │
│  └──────────────┴───────────────┴─────────────┴───────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                        API Layer (Next.js)                       │
│  ┌─────────────┬──────────────┬─────────────┬─────────────────┐ │
│  │ Auth Routes │ Stripe OAuth │ Metrics API │ Insights API    │ │
│  └─────────────┴──────────────┴─────────────┴─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                      Service Layer                               │
│  ┌─────────────┬──────────────┬─────────────┬─────────────────┐ │
│  │ Stripe Sync │ Metrics      │ AI Insights │ Recommendations │ │
│  │ Service     │ Engine       │ Engine      │ Engine          │ │
│  └─────────────┴──────────────┴─────────────┴─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    Database (PostgreSQL + Prisma)                │
│  Organizations │ Stripe Data │ Metrics │ Insights │ Recommendations │
└─────────────────────────────────────────────────────────────────┘
```

## 📁 Project Structure

```
discovred/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── stripe/        # Stripe OAuth & sync
│   │   ├── metrics/       # Metrics API
│   │   ├── insights/      # Insights API
│   │   └── recommendations/ # Recommendations API
│   ├── dashboard/         # Main dashboard page
│   ├── login/             # Authentication page
│   ├── auth/              # Supabase OAuth callback
│   └── page.tsx           # Landing page
├── components/            # React components
│   ├── ui/               # Reusable UI components
│   └── dashboard/        # Dashboard-specific components
├── lib/                   # Core libraries
│   ├── stripe/           # Stripe client & sync
│   ├── metrics/          # Metrics computation
│   ├── ai/               # AI insights & recommendations
│   ├── supabase/         # Supabase auth helpers
│   └── db.ts             # Prisma client
├── prisma/               # Database
│   └── schema.prisma     # Database schema
└── scripts/              # Cron jobs
    └── sync-stripe.ts    # Daily sync script
```

## 🔧 Configuration

### Stripe OAuth Setup

1. Go to [Stripe Dashboard → Connect Settings](https://dashboard.stripe.com/settings/connect)
2. Enable "OAuth for Standard accounts"
3. Add your redirect URI: `https://yourapp.com/api/stripe/callback`
4. Copy your Client ID to `STRIPE_CLIENT_ID`

### Database Schema

Key models:
- `Organization` - Multi-tenant support
- `StripeConnection` - OAuth tokens
- `StripeCustomer/Subscription/Invoice/Payment` - Normalized Stripe data
- `DailyMetrics` - Computed metrics
- `AIInsight/AIRecommendation` - AI-generated content

## 📊 Data Sync

### Manual Sync
Trigger from the dashboard or via API:
```bash
curl -X POST http://localhost:3000/api/stripe/sync
```

### Automated Sync (Cron)
Set up a daily cron job:
```bash
# Run at 2 AM daily
0 2 * * * cd /path/to/discovred && npm run sync:stripe
```

## 🤖 AI Insights

The AI engine uses two approaches:

1. **Heuristic Analysis** - Rule-based detection of common patterns:
   - Elevated churn rates
   - Discount leakage
   - Plan performance gaps
   - Payment failure patterns

2. **LLM Analysis** - GPT-4 powered deeper insights:
   - Nuanced trend interpretation
   - Custom recommendations
   - Impact estimation

## 🛡 Security

- **OAuth Only** - No direct API key storage for connected accounts
- **Read-Only Access** - Only reads Stripe data, never modifies
- **Token Encryption** - Access tokens stored securely
- **Multi-Tenant** - Strict data isolation between organizations

## 📈 Metrics Computed

| Metric | Description |
|--------|-------------|
| MRR | Monthly Recurring Revenue |
| ARR | Annual Recurring Revenue |
| ARPU | Average Revenue Per User |
| Gross Churn | Customer loss rate |
| Revenue Churn | MRR loss rate |
| NRR | Net Revenue Retention |
| Failed Payment Rate | Payment failure percentage |
| Discount Leakage | Revenue lost to discounts |

## 🔮 Roadmap

- [ ] Webhook support for real-time sync
- [ ] Custom alert thresholds
- [ ] Cohort analysis
- [ ] Exportable reports
- [ ] Slack/email notifications
- [ ] Multiple Stripe account support

## 📝 License

MIT

---

Built with ❤️ for subscription businesses


