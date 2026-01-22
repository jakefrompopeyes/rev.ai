# Analysis: Recommendations & AI Insights Sections

## Overview

This document provides a comprehensive analysis of the **AI Insights** and **Recommendations** systems in the REV.AI application. These two systems work together to provide actionable intelligence for SaaS revenue optimization.

---

## Architecture Overview

### Data Flow

```
Stripe Data → Metrics → AI Insights → Recommendations → UI Components
```

1. **Stripe Data**: Subscription, customer, and invoice data synced from Stripe
2. **Metrics**: Daily aggregated metrics (MRR, churn, discounts, etc.)
3. **AI Insights**: Pattern detection and anomaly identification
4. **Recommendations**: Actionable suggestions derived from insights
5. **UI Components**: User-facing displays in the dashboard

---

## AI Insights System

### Purpose
The AI Insights system identifies patterns, anomalies, and opportunities in subscription data using both heuristic analysis and LLM-powered analysis.

### Key Files
- **Backend Logic**: `lib/ai/insights.ts`
- **API Route**: `app/api/insights/route.ts`
- **UI Component**: `components/dashboard/insights-feed.tsx`
- **Database Model**: `AIInsight` in Prisma schema

### How It Works

#### 1. **Data Collection**
- Analyzes 90 days of historical metrics (`DailyMetrics`)
- Reviews subscription data (plans, status, churn patterns)
- Examines discount patterns and payment failures

#### 2. **Heuristic Analysis** (`runHeuristicAnalysis`)
The system runs 8 predefined checks:

**a. Churn Rate Analysis**
- Detects if monthly churn > 5% (HIGH) or > 10% (CRITICAL)
- Calculates monthly MRR loss
- Example: "Elevated customer churn detected - 7.2% churn rate costing $2,400/month"

**b. Plan-Based Churn**
- Compares churn rates across different plans
- Identifies plans with 1.5x+ higher churn than others
- Example: "Pro plan has elevated churn - 3x faster than Basic"

**c. Discount Leakage**
- Detects when discount leakage > 10% of MRR
- Calculates percentage of potential revenue lost
- Example: "Significant discount leakage - 18% of revenue lost to discounts"

**d. Discount-Churn Correlation**
- Analyzes if heavy discounts (>20%) correlate with higher churn
- Compares churn rates: discounted vs. regular customers
- Example: "Heavy discounts correlate with 2.3x higher churn"

**e. Annual vs Monthly Plans**
- Identifies low annual plan adoption (<30%)
- Highlights opportunity for annual upgrades
- Example: "Only 15% on annual plans - opportunity for better retention"

**f. Failed Payment Rate**
- Flags failed payment rates > 3% (MEDIUM) or > 8% (HIGH)
- Estimates lost revenue from payment failures
- Example: "Failed payment rate is 5.2% - industry benchmark is 3%"

**g. MRR Trend Analysis**
- Detects declining MRR (>5% drop = HIGH, >10% = CRITICAL)
- Also identifies strong growth (>10% = positive insight)
- Example: "MRR is declining - down 8.3% over past 30 days"

**h. Net Revenue Retention (NRR)**
- Flags NRR < 100% (losing more to churn than gaining from expansion)
- Compares to best-in-class benchmark (120%+)
- Example: "NRR is 85% - below 100% threshold"

#### 3. **LLM Analysis** (`runLLMAnalysis`)
- Uses OpenAI GPT-4o to generate nuanced insights
- Analyzes plan distribution, usage patterns, and trends
- Provides 2-3 additional insights beyond heuristics
- Temperature: 0.3 (conservative, focused responses)
- Returns structured JSON with category, severity, title, description

#### 4. **Insight Categories**
- **CHURN**: Customer retention issues
- **PRICING**: Discount, pricing strategy problems
- **REVENUE**: MRR, NRR, revenue trends
- **GROWTH**: Positive growth indicators
- **EFFICIENCY**: Operational issues (payment failures, etc.)
- **ANOMALY**: Unusual patterns

#### 5. **Severity Levels**
- **CRITICAL**: Immediate action required (e.g., >10% churn, >10% MRR decline)
- **HIGH**: Significant issue (e.g., 5-10% churn, high discount leakage)
- **MEDIUM**: Moderate concern (e.g., plan-specific churn, discount correlation)
- **LOW**: Opportunity or positive insight (e.g., growth, low annual adoption)

#### 6. **Storage & Retrieval**
- Stored in `ai_insights` table with:
  - Category, severity, title, description
  - Data points (JSON) for supporting evidence
  - Confidence score (0-1)
  - Active status and dismissal tracking
- Retrieved via `getActiveInsights()` - only active, non-dismissed insights

---

## Recommendations System

### Purpose
The Recommendations system generates actionable suggestions based on insights, with specific steps, impact estimates, and priority scoring.

### Key Files
- **Backend Logic**: `lib/ai/recommendations.ts`
- **API Route**: `app/api/recommendations/route.ts`
- **UI Component**: `components/dashboard/recommendations-panel.tsx`
- **Database Model**: `AIRecommendation` in Prisma schema

### How It Works

#### 1. **Generation Process** (`generateRecommendations`)
- Fetches active insights for the organization
- Gets latest metrics for context
- Generates recommendations for each insight
- Stores recommendations in database

#### 2. **Recommendation Types by Category**

**a. Churn Recommendations** (`generateChurnRecommendations`)

**High Churn Prevention Program**
- **Title**: "Implement proactive churn prevention program"
- **Description**: Automated health scoring + intervention workflows
- **Impact**: 30% churn reduction target over 6 months
- **Priority**: 95 (CRITICAL) or 80 (HIGH)
- **Risk**: LOW

**Cancellation Flow Survey**
- **Title**: "Add cancellation flow survey and save offers"
- **Description**: Survey + targeted retention deals (pause, downgrade, discount)
- **Impact**: 10-20% save rate on cancellations
- **Priority**: 75
- **Risk**: LOW

**Plan Value Proposition Review**
- **Title**: "Review [Plan] plan value proposition"
- **Description**: Analyze what makes low-churn plans successful
- **Impact**: Moderate (5% of MRR over 6 months)
- **Priority**: 65
- **Risk**: MEDIUM

**b. Pricing Recommendations** (`generatePricingRecommendations`)

**Discount Governance Policy**
- **Title**: "Implement discount governance policy"
- **Description**: Approval workflows, expiration dates, track usage
- **Impact**: 40% reduction in discount leakage over 6 months
- **Priority**: 70
- **Risk**: MEDIUM

**A/B Test Reduced Discounts**
- **Title**: "A/B test reduced discount levels"
- **Description**: Test 10% vs 20%+ discounts to measure ROI
- **Impact**: Moderate (3 months)
- **Priority**: 60
- **Risk**: LOW

**Qualify Discount Recipients**
- **Title**: "Qualify discount recipients more carefully"
- **Description**: Only offer large discounts to engaged customers
- **Impact**: Reduced churn from discount-hunters
- **Priority**: 55
- **Risk**: MEDIUM

**c. Revenue Recommendations** (`generateRevenueRecommendations`)

**Annual Plan Upgrade Campaign**
- **Title**: "Launch annual plan upgrade campaign"
- **Description**: Email campaign offering 2 months free for annual switch
- **Impact**: 20% conversion target, improved retention value
- **Priority**: 75
- **Risk**: LOW

**Audit Recent Churns**
- **Title**: "Audit recent churns and implement quick wins"
- **Description**: Interview last 10 churned customers, find patterns
- **Impact**: Address 2-3 fixable issues driving churn
- **Priority**: 90
- **Risk**: LOW

**Build Expansion Revenue Motion**
- **Title**: "Build expansion revenue motion"
- **Description**: Identify successful customers, create upsell triggers
- **Impact**: 15% of MRR over 6 months
- **Priority**: 70
- **Risk**: MEDIUM

**d. Efficiency Recommendations** (`generateEfficiencyRecommendations`)

**Smart Payment Retry with Dunning**
- **Title**: "Implement smart payment retry with dunning"
- **Description**: Automatic retries (days 1, 3, 5, 7) + personalized emails
- **Impact**: 30-70% recovery rate on failed payments
- **Priority**: 85
- **Risk**: LOW

**Backup Payment Method Collection**
- **Title**: "Add backup payment method collection"
- **Description**: Collect secondary payment method during onboarding
- **Impact**: Reduced involuntary churn
- **Priority**: 60
- **Risk**: LOW

#### 3. **LLM Fallback** (`generateLLMRecommendation`)
- If no heuristic recommendations match, uses GPT-4o
- Provides custom recommendation based on insight context
- Returns structured JSON with all required fields
- Conservative impact estimates (1-15% of MRR)

#### 4. **Recommendation Properties**

**Priority Score (1-100)**
- Higher = more urgent/impactful
- Based on severity of underlying insight
- Factors: churn rate, revenue impact, ease of implementation

**Risk Level**
- **LOW**: Safe to implement, minimal downside
- **MEDIUM**: Some risk, requires careful execution
- **HIGH**: Significant risk, needs validation

**Estimated Impact**
- Revenue impact in cents (stored as integer)
- Timeframe: "3 months", "6 months", "12 months"
- Confidence: 0-1 (how certain the estimate is)

**Status Tracking**
- **PENDING**: Awaiting implementation
- **IMPLEMENTED**: User marked as done
- **DISMISSED**: User dismissed
- **EXPIRED**: No longer relevant

**Baseline Metrics**
- Captured when recommendation is implemented
- Used to measure actual impact vs. estimated impact
- Includes: MRR, ARR, churn rate, active subscriptions

#### 5. **Storage & Retrieval**
- Stored in `ai_recommendations` table
- Linked to insights via `insightId` (optional)
- Retrieved via `getRecommendations()` - PENDING and IMPLEMENTED only
- Sorted by priority score (descending)

---

## UI Components

### InsightsFeed Component

**Location**: `components/dashboard/insights-feed.tsx`

**Features**:
- Displays insights in a feed format
- Category icons (CHURN, PRICING, REVENUE, GROWTH, EFFICIENCY, ANOMALY)
- Severity badges (CRITICAL, HIGH, MEDIUM, LOW)
- Confidence percentage display
- Relative time display ("2 hours ago")
- Dismiss functionality (X button on hover)
- Loading skeleton states
- Empty state when no insights

**Visual Design**:
- Card-based layout with hover effects
- Color-coded severity badges
- Icon-based category identification
- Smooth animations (Framer Motion)

### RecommendationsPanel Component

**Location**: `components/dashboard/recommendations-panel.tsx`

**Features**:
- Two sections: "Action Items" (PENDING) and "Implemented"
- Priority-based sorting
- Expandable reasoning section ("Show reasoning")
- Impact display (estimated revenue + timeframe)
- Risk level indicator
- Implement/Dismiss actions
- "TOP" badge for priority score ≥ 80
- Implemented date tracking
- Loading skeleton states
- Empty state when no recommendations

**Visual Design**:
- Card-based layout with priority indicators
- Green highlight for implemented items
- Expandable sections for detailed reasoning
- Action buttons (Mark Implemented, Dismiss)
- Smooth animations

---

## API Endpoints

### Insights API (`/api/insights`)

**GET** `/api/insights`
- Returns active insights for authenticated organization
- Requires authentication via `requireAuthWithOrg()`
- Returns: `{ insights: Insight[] }`

**PATCH** `/api/insights`
- Body: `{ insightId: string, action: 'dismiss' }`
- Dismisses an insight (sets `dismissedAt`, `isActive: false`)
- Returns: `{ success: true }`

### Recommendations API (`/api/recommendations`)

**GET** `/api/recommendations`
- Returns recommendations (PENDING and IMPLEMENTED) for authenticated organization
- Includes related insight data
- Sorted by priority score (descending)
- Returns: `{ recommendations: Recommendation[] }`

**PATCH** `/api/recommendations`
- Body: `{ recommendationId: string, action: 'implement' | 'dismiss' | 'update_results' }`
- **implement**: Marks as implemented, captures baseline metrics
- **dismiss**: Sets status to DISMISSED
- **update_results**: Updates result metrics for implemented recommendations
- Returns: `{ success: true }`

---

## Dashboard Integration

### Location in Dashboard
- **Overview Tab**: Shows 3 latest insights and 3 pending recommendations
- **AI Tab**: Full view of all insights and recommendations side-by-side

### Data Fetching
- Fetched on dashboard load
- Auto-refreshes every 30 seconds (if Stripe connected)
- Refreshes on page visibility change (user returns to tab)
- Manual refresh via sync button

### User Actions
1. **Dismiss Insight**: Removes from active list
2. **Implement Recommendation**: Marks as done, captures baseline
3. **Dismiss Recommendation**: Removes from list
4. **View Reasoning**: Expands to show detailed explanation

---

## Data Models

### AIInsight (Database)
```typescript
{
  id: string
  category: InsightCategory // CHURN | PRICING | REVENUE | GROWTH | EFFICIENCY | ANOMALY
  severity: InsightSeverity // CRITICAL | HIGH | MEDIUM | LOW
  title: string
  description: string
  dataPoints: Json // Supporting data
  confidence: number // 0-1
  generatedAt: DateTime
  validUntil?: DateTime
  isActive: boolean
  dismissedAt?: DateTime
  organizationId: string
}
```

### AIRecommendation (Database)
```typescript
{
  id: string
  title: string
  description: string
  reasoning: string
  riskLevel: RiskLevel // LOW | MEDIUM | HIGH
  estimatedImpact: number // cents
  impactTimeframe: string // "3 months" | "6 months" | "12 months"
  impactConfidence: number // 0-1
  priorityScore: number // 1-100
  status: RecommendationStatus // PENDING | IMPLEMENTED | DISMISSED | EXPIRED
  implementedAt?: DateTime
  baselineMetrics?: Json // Metrics at implementation time
  resultMetrics?: Json // Metrics after implementation
  insightId?: string // Optional link to insight
  organizationId: string
}
```

---

## Key Algorithms & Logic

### Churn Rate Calculation
```typescript
// From subscriptions
churnRate = (canceledSubscriptions / totalSubscriptions) * 100
```

### Discount Leakage Calculation
```typescript
// From daily metrics
discountLeakage = sum of all discounts applied
leakagePercent = (discountLeakage / (MRR + discountLeakage)) * 100
```

### Impact Estimation
```typescript
// Example: Churn prevention
monthlyLoss = MRR * (churnRate / 100)
sixMonthImpact = monthlyLoss * 6 * 0.3 // 30% reduction target
```

### Priority Scoring
- Based on insight severity (CRITICAL = 95, HIGH = 80, etc.)
- Adjusted by estimated impact magnitude
- Higher for low-risk, high-impact recommendations

---

## Strengths

1. **Dual Analysis Approach**: Heuristic + LLM provides both reliable patterns and nuanced insights
2. **Actionable Recommendations**: Specific steps, not just observations
3. **Impact Quantification**: Revenue estimates help prioritize
4. **Status Tracking**: Can measure actual vs. estimated impact
5. **User Control**: Dismiss and implement actions
6. **Visual Hierarchy**: Priority scoring and severity levels guide attention
7. **Comprehensive Coverage**: 8 heuristic checks + LLM analysis

---

## Potential Improvements

1. **Insight Expiration**: `validUntil` field exists but not actively used
2. **Recommendation Results**: `updateRecommendationResults` exists but not called automatically
3. **Insight Regeneration**: No automatic re-generation when metrics change significantly
4. **Recommendation Deduplication**: Could prevent duplicate recommendations from same insight
5. **A/B Testing Integration**: Recommendations mention A/B tests but no integration with experiment system
6. **Confidence Calibration**: Confidence scores not validated against actual outcomes
7. **Custom Thresholds**: Hard-coded thresholds (5% churn, 3% failed payments) could be configurable

---

## Usage Flow Example

1. **User connects Stripe** → Data syncs
2. **Metrics calculated** → Daily metrics aggregated
3. **Insights generated** → Heuristic + LLM analysis runs
4. **Recommendations created** → Based on active insights
5. **User views dashboard** → Sees insights and recommendations
6. **User implements recommendation** → Status changes, baseline captured
7. **User checks results** → Can update result metrics (manual for now)

---

## Configuration

### Environment Variables
- `OPENAI_API_KEY`: Required for LLM analysis (optional - system works without it)

### Thresholds (Hard-coded)
- Churn: 5% (HIGH), 10% (CRITICAL)
- Failed Payments: 3% (MEDIUM), 8% (HIGH)
- Discount Leakage: 10% of MRR (MEDIUM), 20% (HIGH)
- MRR Decline: 5% (HIGH), 10% (CRITICAL)
- Annual Plan Adoption: <30% triggers insight

---

## Conclusion

The Recommendations and AI Insights systems provide a comprehensive revenue intelligence layer that:
- **Detects** problems and opportunities automatically
- **Explains** why they matter with data
- **Recommends** specific actions with impact estimates
- **Tracks** implementation and results

This creates a closed-loop system for continuous revenue optimization.
