# Confidence Percentage Explanation

## What It Means

The **confidence percentage** represents how certain the system is that:
1. The insight is **accurate** (the pattern detected is real, not noise)
2. The **data supports** the conclusion
3. The insight is **actionable** (not a false positive)

It's stored as a decimal (0-1) in the database but displayed as a percentage (0-100%) in the UI.

---

## How Confidence is Assigned

### Heuristic Insights (Rule-Based)

Confidence is **manually assigned** based on the reliability of the metric and clarity of the pattern:

| Insight Type | Confidence | Reasoning |
|-------------|------------|-----------|
| **Churn Rate Analysis** | 95% (0.95) | Direct calculation from subscription data - very reliable |
| **MRR Trend Analysis** | 95% (0.95) | Simple percentage calculation - highly accurate |
| **Discount Leakage** | 90% (0.9) | Direct calculation from discount data - reliable |
| **Failed Payment Rate** | 90% (0.9) | Direct metric calculation - reliable |
| **Net Revenue Retention** | 90% (0.9) | Standard SaaS metric - well-established calculation |
| **Annual Plan Adoption** | 85% (0.85) | Based on subscription counts - reliable but opportunity-based |
| **Plan-Based Churn** | 80% (0.8) | Requires sufficient sample size (≥10 per plan) - good but less certain |
| **Discount-Churn Correlation** | 75% (0.75) | Correlation analysis - requires ≥10 samples per group, correlation ≠ causation |

### LLM Insights (AI-Generated)

- **Range**: 60-90% (0.6-0.9)
- **Default**: 70% (0.7) if not specified
- **Assigned by**: GPT-4o model based on data quality and pattern clarity
- **Lower confidence** because:
  - More nuanced patterns
  - May involve interpretation
  - Less direct calculation

---

## Confidence Levels Explained

### High Confidence (85-95%)
**What it means**: Very reliable, direct calculation from clear data

**Examples**:
- Churn rate: Direct count of canceled vs. active subscriptions
- MRR trend: Simple percentage change calculation
- Discount leakage: Sum of all discounts applied

**Why high**: These are **direct metrics** with minimal interpretation needed.

### Medium Confidence (70-85%)
**What it means**: Reliable pattern, but requires some interpretation or has sample size requirements

**Examples**:
- Annual plan adoption: Reliable count, but "low adoption" is opportunity-based
- Plan-based churn: Requires sufficient samples (≥10 per plan) to be meaningful

**Why medium**: Pattern is clear, but conclusions may vary based on context.

### Lower Confidence (60-75%)
**What it means**: Pattern detected, but correlation doesn't guarantee causation

**Examples**:
- Discount-churn correlation: Shows correlation, but other factors may be involved
- LLM-generated insights: More nuanced patterns that require interpretation

**Why lower**: These insights identify **patterns** but may have multiple contributing factors.

---

## Code Reference

### Storage
```typescript
// Database: stored as Float (0-1)
confidence: 0.95  // 95% confidence
```

### Display
```typescript
// UI: multiplied by 100 for percentage display
{Math.round(insight.confidence * 100)}% confidence
// Displays: "95% confidence"
```

### Assignment Examples

**High Confidence (0.95)**:
```typescript
// Churn Rate - direct calculation
if (latest.grossChurnRate > 5) {
  insights.push({
    confidence: 0.95,  // Very reliable metric
    // ...
  });
}
```

**Medium Confidence (0.8)**:
```typescript
// Plan-based churn - requires sample size
if (highest[1].churnRate > lowest[1].churnRate * 1.5 && highest[1].total >= 10) {
  insights.push({
    confidence: 0.8,  // Good but needs sufficient samples
    // ...
  });
}
```

**Lower Confidence (0.75)**:
```typescript
// Correlation analysis
if (discountedChurnRate > regularChurnRate * 1.3) {
  insights.push({
    confidence: 0.75,  // Correlation, not causation
    // ...
  });
}
```

---

## What Confidence Does NOT Mean

❌ **NOT** a measure of:
- How important the insight is (that's **severity**)
- How urgent it is (that's **priority score** for recommendations)
- How much revenue is at stake (that's in the **description/dataPoints**)

✅ **IS** a measure of:
- How reliable the data/metric is
- How certain the pattern detection is
- How actionable the insight is (higher = more trustworthy)

---

## Practical Usage

### High Confidence (90%+)
- **Trust**: Very high - these are direct calculations
- **Action**: Can act on these with high certainty
- **Example**: "7.2% churn rate" - this is a fact, not an interpretation

### Medium Confidence (75-89%)
- **Trust**: Good - patterns are clear but may have context
- **Action**: Worth investigating, but consider other factors
- **Example**: "Pro plan has higher churn" - pattern is real, but why?

### Lower Confidence (60-74%)
- **Trust**: Moderate - correlation detected, but investigate further
- **Action**: Use as a hypothesis to test, not a conclusion
- **Example**: "Discounts correlate with churn" - true, but other factors may be involved

---

## Why Different Confidences?

The system uses different confidence levels to help you:

1. **Prioritize investigation**: Higher confidence = more reliable = worth investigating first
2. **Understand certainty**: Know how much to trust each insight
3. **Avoid false positives**: Lower confidence insights may need validation

---

## Summary

**Confidence = How certain the system is that the insight is accurate**

- **95%**: Direct metric calculation (churn rate, MRR trend)
- **90%**: Reliable metric with clear pattern (discount leakage, NRR)
- **85%**: Good pattern, opportunity-based (annual adoption)
- **80%**: Clear pattern, needs sufficient samples (plan churn)
- **75%**: Correlation detected, may have other factors (discount-churn)
- **60-70%**: LLM-generated, nuanced patterns

The confidence helps you understand **how much to trust** each insight when making decisions.
