import { prisma } from '@/lib/db';
import { ExperimentStatus } from '@prisma/client';

// ============================================================================
// TYPES
// ============================================================================

export interface ExperimentCreate {
  name: string;
  hypothesis: string;
  description?: string;
  targetPlanId: string;
  targetPlanName: string;
  plannedDuration: number; // days
  trafficAllocation?: number; // 0-100
  minimumSampleSize?: number;
  confidenceLevel?: number; // 0.9, 0.95, 0.99
  variants: Array<{
    name: string;
    priceCents: number;
    isControl?: boolean;
  }>;
  aiGenerated?: boolean;
  expectedLift?: number;
  priority?: number;
  risks?: string[];
}

export interface ExperimentResult {
  experimentId: string;
  status: ExperimentStatus;
  duration: number; // days running
  variants: VariantResult[];
  winner: string | null;
  isSignificant: boolean;
  confidence: number;
  relativeLift: number | null; // % improvement of best variant over control
  recommendation: string;
  canEndEarly: boolean;
}

export interface VariantResult {
  id: string;
  name: string;
  isControl: boolean;
  priceCents: number;
  visitors: number;
  conversions: number;
  churned: number;
  totalRevenue: number;
  conversionRate: number;
  averageRevenue: number;
  churnRate: number;
  revenuePerVisitor: number;
  zScore: number | null;
  pValue: number | null;
  isWinning: boolean;
}

export interface StatisticalTest {
  zScore: number;
  pValue: number;
  isSignificant: boolean;
  confidenceInterval: { lower: number; upper: number };
  relativeLift: number;
  sampleSizeReached: boolean;
  powerAnalysis: {
    currentPower: number;
    recommendedSampleSize: number;
  };
}

// ============================================================================
// EXPERIMENT MANAGEMENT
// ============================================================================

/**
 * Create a new pricing experiment
 */
export async function createExperiment(
  organizationId: string,
  data: ExperimentCreate
) {
  // Validate at least 2 variants
  if (data.variants.length < 2) {
    throw new Error('Experiment must have at least 2 variants');
  }

  // Ensure exactly one control
  const controlCount = data.variants.filter(v => v.isControl).length;
  if (controlCount === 0) {
    data.variants[0].isControl = true; // Make first variant control
  } else if (controlCount > 1) {
    throw new Error('Experiment can only have one control variant');
  }

  // Calculate minimum sample size if not provided
  const minimumSampleSize = data.minimumSampleSize || 
    calculateRequiredSampleSize(0.05, data.confidenceLevel || 0.95);

  const experiment = await prisma.pricingExperiment.create({
    data: {
      organizationId,
      name: data.name,
      hypothesis: data.hypothesis,
      description: data.description,
      targetPlanId: data.targetPlanId,
      targetPlanName: data.targetPlanName,
      plannedDuration: data.plannedDuration,
      trafficAllocation: data.trafficAllocation || 50,
      minimumSampleSize,
      confidenceLevel: data.confidenceLevel || 0.95,
      aiGenerated: data.aiGenerated || false,
      expectedLift: data.expectedLift,
      priority: data.priority,
      risks: data.risks,
      variants: {
        create: data.variants.map((v, index) => ({
          name: v.name,
          priceCents: v.priceCents,
          isControl: v.isControl || index === 0,
          originalPriceCents: v.priceCents,
        })),
      },
    },
    include: {
      variants: true,
    },
  });

  return experiment;
}

/**
 * Start an experiment
 */
export async function startExperiment(experimentId: string, organizationId: string) {
  const experiment = await prisma.pricingExperiment.findFirst({
    where: { id: experimentId, organizationId },
  });

  if (!experiment) {
    throw new Error('Experiment not found');
  }

  if (experiment.status !== 'DRAFT') {
    throw new Error('Only draft experiments can be started');
  }

  return prisma.pricingExperiment.update({
    where: { id: experimentId },
    data: {
      status: 'RUNNING',
      startedAt: new Date(),
    },
    include: { variants: true },
  });
}

/**
 * Pause an experiment
 */
export async function pauseExperiment(experimentId: string, organizationId: string) {
  return prisma.pricingExperiment.update({
    where: { id: experimentId, organizationId },
    data: { status: 'PAUSED' },
  });
}

/**
 * Resume an experiment
 */
export async function resumeExperiment(experimentId: string, organizationId: string) {
  return prisma.pricingExperiment.update({
    where: { id: experimentId, organizationId },
    data: { status: 'RUNNING' },
  });
}

/**
 * End an experiment
 */
export async function endExperiment(experimentId: string, organizationId: string) {
  return prisma.pricingExperiment.update({
    where: { id: experimentId, organizationId },
    data: {
      status: 'COMPLETED',
      endedAt: new Date(),
    },
    include: { variants: true },
  });
}

/**
 * Cancel an experiment
 */
export async function cancelExperiment(experimentId: string, organizationId: string) {
  return prisma.pricingExperiment.update({
    where: { id: experimentId, organizationId },
    data: {
      status: 'CANCELLED',
      endedAt: new Date(),
    },
  });
}

/**
 * Delete an experiment (only drafts)
 */
export async function deleteExperiment(experimentId: string, organizationId: string) {
  const experiment = await prisma.pricingExperiment.findFirst({
    where: { id: experimentId, organizationId },
  });

  if (!experiment) {
    throw new Error('Experiment not found');
  }

  if (experiment.status !== 'DRAFT') {
    throw new Error('Only draft experiments can be deleted');
  }

  await prisma.pricingExperiment.delete({
    where: { id: experimentId },
  });
}

// ============================================================================
// EXPERIMENT ASSIGNMENT
// ============================================================================

/**
 * Assign a visitor to an experiment variant
 */
export async function assignVisitor(
  experimentId: string,
  visitorId: string
): Promise<{ variantId: string; priceCents: number } | null> {
  // Get experiment with variants
  const experiment = await prisma.pricingExperiment.findFirst({
    where: {
      id: experimentId,
      status: 'RUNNING',
    },
    include: { variants: true },
  });

  if (!experiment || experiment.variants.length === 0) {
    return null;
  }

  // Check if already assigned
  const existing = await prisma.experimentAssignment.findUnique({
    where: {
      experimentId_visitorId: {
        experimentId,
        visitorId,
      },
    },
    include: { variant: true },
  });

  if (existing) {
    return {
      variantId: existing.variantId,
      priceCents: existing.variant.priceCents,
    };
  }

  // Check traffic allocation
  if (Math.random() * 100 > experiment.trafficAllocation) {
    return null; // Not in experiment
  }

  // Random assignment to variant
  const randomIndex = Math.floor(Math.random() * experiment.variants.length);
  const selectedVariant = experiment.variants[randomIndex];

  // Create assignment
  await prisma.experimentAssignment.create({
    data: {
      experimentId,
      visitorId,
      variantId: selectedVariant.id,
    },
  });

  // Increment visitor count
  await prisma.experimentVariant.update({
    where: { id: selectedVariant.id },
    data: { visitors: { increment: 1 } },
  });

  return {
    variantId: selectedVariant.id,
    priceCents: selectedVariant.priceCents,
  };
}

/**
 * Record a conversion
 */
export async function recordConversion(
  experimentId: string,
  visitorId: string,
  customerId: string,
  subscriptionId: string,
  revenueCents: number
) {
  const assignment = await prisma.experimentAssignment.findUnique({
    where: {
      experimentId_visitorId: {
        experimentId,
        visitorId,
      },
    },
  });

  if (!assignment || assignment.converted) {
    return null;
  }

  // Update assignment
  await prisma.experimentAssignment.update({
    where: { id: assignment.id },
    data: {
      converted: true,
      convertedAt: new Date(),
      customerId,
      subscriptionId,
      conversionRevenue: revenueCents,
    },
  });

  // Update variant stats
  await prisma.experimentVariant.update({
    where: { id: assignment.variantId },
    data: {
      conversions: { increment: 1 },
      totalRevenue: { increment: revenueCents },
    },
  });

  return assignment;
}

/**
 * Record a churn
 */
export async function recordChurn(
  experimentId: string,
  customerId: string,
  lifetimeRevenue: number
) {
  const assignment = await prisma.experimentAssignment.findFirst({
    where: {
      experimentId,
      customerId,
      converted: true,
      churned: false,
    },
  });

  if (!assignment) {
    return null;
  }

  // Update assignment
  await prisma.experimentAssignment.update({
    where: { id: assignment.id },
    data: {
      churned: true,
      churnedAt: new Date(),
      lifetimeRevenue,
    },
  });

  // Update variant stats
  await prisma.experimentVariant.update({
    where: { id: assignment.variantId },
    data: {
      churned: { increment: 1 },
    },
  });

  return assignment;
}

// ============================================================================
// STATISTICAL ANALYSIS
// ============================================================================

/**
 * Calculate Z-score for proportion comparison
 */
function calculateZScore(
  p1: number, // Control conversion rate
  n1: number, // Control sample size
  p2: number, // Treatment conversion rate
  n2: number  // Treatment sample size
): number {
  if (n1 === 0 || n2 === 0) return 0;
  
  const pPooled = (p1 * n1 + p2 * n2) / (n1 + n2);
  const se = Math.sqrt(pPooled * (1 - pPooled) * (1/n1 + 1/n2));
  
  if (se === 0) return 0;
  
  return (p2 - p1) / se;
}

/**
 * Calculate p-value from z-score (two-tailed)
 */
function calculatePValue(zScore: number): number {
  // Approximation of normal CDF
  const absZ = Math.abs(zScore);
  const t = 1 / (1 + 0.2316419 * absZ);
  const d = 0.3989423 * Math.exp(-absZ * absZ / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  
  return 2 * (zScore > 0 ? p : 1 - p);
}

/**
 * Calculate required sample size for given effect and confidence
 */
function calculateRequiredSampleSize(
  minimumDetectableEffect: number, // e.g., 0.05 for 5%
  confidenceLevel: number = 0.95,
  power: number = 0.8,
  baselineConversionRate: number = 0.03 // 3% baseline
): number {
  // Z-scores for confidence and power
  const zAlpha = confidenceLevel === 0.99 ? 2.576 : confidenceLevel === 0.95 ? 1.96 : 1.645;
  const zBeta = power === 0.9 ? 1.282 : 0.842;
  
  const p1 = baselineConversionRate;
  const p2 = baselineConversionRate * (1 + minimumDetectableEffect);
  const delta = Math.abs(p2 - p1);
  
  if (delta === 0) return 1000;
  
  const pBar = (p1 + p2) / 2;
  const n = 2 * Math.pow(zAlpha + zBeta, 2) * pBar * (1 - pBar) / Math.pow(delta, 2);
  
  return Math.ceil(n);
}

/**
 * Calculate current statistical power
 */
function calculatePower(
  n1: number,
  n2: number,
  p1: number,
  p2: number,
  alpha: number = 0.05
): number {
  if (n1 === 0 || n2 === 0) return 0;
  
  const delta = Math.abs(p2 - p1);
  if (delta === 0) return 0;
  
  const pPooled = (p1 * n1 + p2 * n2) / (n1 + n2);
  const se = Math.sqrt(pPooled * (1 - pPooled) * (1/n1 + 1/n2));
  
  if (se === 0) return 0;
  
  const zAlpha = alpha === 0.01 ? 2.576 : alpha === 0.05 ? 1.96 : 1.645;
  const zBeta = (delta / se) - zAlpha;
  
  // Approximate power from z-beta
  const power = 1 / (1 + Math.exp(-0.07056 * Math.pow(zBeta, 3) - 1.5976 * zBeta));
  
  return Math.max(0, Math.min(1, power));
}

/**
 * Run statistical test between control and treatment
 */
function runStatisticalTest(
  control: { visitors: number; conversions: number },
  treatment: { visitors: number; conversions: number },
  confidenceLevel: number,
  minimumSampleSize: number
): StatisticalTest {
  const p1 = control.visitors > 0 ? control.conversions / control.visitors : 0;
  const p2 = treatment.visitors > 0 ? treatment.conversions / treatment.visitors : 0;
  
  const zScore = calculateZScore(p1, control.visitors, p2, treatment.visitors);
  const pValue = calculatePValue(zScore);
  const alpha = 1 - confidenceLevel;
  const isSignificant = pValue < alpha && control.visitors >= minimumSampleSize && treatment.visitors >= minimumSampleSize;
  
  // Confidence interval for the difference
  const se = Math.sqrt(
    (p1 * (1 - p1) / (control.visitors || 1)) + 
    (p2 * (1 - p2) / (treatment.visitors || 1))
  );
  const zCritical = confidenceLevel === 0.99 ? 2.576 : confidenceLevel === 0.95 ? 1.96 : 1.645;
  const margin = zCritical * se;
  
  const relativeLift = p1 > 0 ? ((p2 - p1) / p1) * 100 : 0;
  
  const sampleSizeReached = 
    control.visitors >= minimumSampleSize && 
    treatment.visitors >= minimumSampleSize;
  
  const currentPower = calculatePower(control.visitors, treatment.visitors, p1, p2, alpha);
  
  return {
    zScore,
    pValue,
    isSignificant,
    confidenceInterval: {
      lower: (p2 - p1 - margin) * 100,
      upper: (p2 - p1 + margin) * 100,
    },
    relativeLift,
    sampleSizeReached,
    powerAnalysis: {
      currentPower,
      recommendedSampleSize: minimumSampleSize,
    },
  };
}

// ============================================================================
// RESULTS ANALYSIS
// ============================================================================

/**
 * Get experiment results with statistical analysis
 */
export async function getExperimentResults(
  experimentId: string,
  organizationId: string
): Promise<ExperimentResult | null> {
  const experiment = await prisma.pricingExperiment.findFirst({
    where: { id: experimentId, organizationId },
    include: { variants: true },
  });

  if (!experiment) {
    return null;
  }

  // Find control variant
  const control = experiment.variants.find(v => v.isControl);
  if (!control) {
    throw new Error('No control variant found');
  }

  // Calculate duration
  const startDate = experiment.startedAt || experiment.createdAt;
  const endDate = experiment.endedAt || new Date();
  const duration = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  // Analyze each variant
  const variantResults: VariantResult[] = experiment.variants.map(variant => {
    const conversionRate = variant.visitors > 0 ? variant.conversions / variant.visitors : 0;
    const averageRevenue = variant.conversions > 0 ? variant.totalRevenue / variant.conversions : 0;
    const churnRate = variant.conversions > 0 ? variant.churned / variant.conversions : 0;
    const revenuePerVisitor = variant.visitors > 0 ? variant.totalRevenue / variant.visitors : 0;

    // Statistical test vs control (if not control)
    let zScore: number | null = null;
    let pValue: number | null = null;

    if (!variant.isControl && control) {
      const test = runStatisticalTest(
        { visitors: control.visitors, conversions: control.conversions },
        { visitors: variant.visitors, conversions: variant.conversions },
        experiment.confidenceLevel,
        experiment.minimumSampleSize
      );
      zScore = test.zScore;
      pValue = test.pValue;
    }

    return {
      id: variant.id,
      name: variant.name,
      isControl: variant.isControl,
      priceCents: variant.priceCents,
      visitors: variant.visitors,
      conversions: variant.conversions,
      churned: variant.churned,
      totalRevenue: variant.totalRevenue,
      conversionRate: conversionRate * 100,
      averageRevenue,
      churnRate: churnRate * 100,
      revenuePerVisitor,
      zScore,
      pValue,
      isWinning: false, // Will be set below
    };
  });

  // Determine winner based on revenue per visitor
  const sortedByRevenue = [...variantResults].sort((a, b) => b.revenuePerVisitor - a.revenuePerVisitor);
  const potentialWinner = sortedByRevenue[0];
  
  // Check if winner is statistically significant
  let winner: string | null = null;
  let isSignificant = false;
  let confidence = 0;
  let relativeLift: number | null = null;

  if (!potentialWinner.isControl) {
    const test = runStatisticalTest(
      { visitors: control.visitors, conversions: control.conversions },
      { visitors: potentialWinner.visitors, conversions: potentialWinner.conversions },
      experiment.confidenceLevel,
      experiment.minimumSampleSize
    );
    
    isSignificant = test.isSignificant;
    confidence = test.pValue ? (1 - test.pValue) * 100 : 0;
    relativeLift = test.relativeLift;
    
    if (isSignificant) {
      winner = potentialWinner.name;
      potentialWinner.isWinning = true;
    }
  } else if (potentialWinner.isControl) {
    // Control is winning - check if significantly better than best treatment
    const bestTreatment = variantResults.find(v => !v.isControl);
    if (bestTreatment) {
      const test = runStatisticalTest(
        { visitors: bestTreatment.visitors, conversions: bestTreatment.conversions },
        { visitors: control.visitors, conversions: control.conversions },
        experiment.confidenceLevel,
        experiment.minimumSampleSize
      );
      
      isSignificant = test.isSignificant;
      confidence = test.pValue ? (1 - test.pValue) * 100 : 0;
      relativeLift = -test.relativeLift; // Negative because control is winning
      
      if (isSignificant) {
        winner = 'Control';
        potentialWinner.isWinning = true;
      }
    }
  }

  // Check if we can end early (reached significance with enough sample)
  const totalVisitors = variantResults.reduce((sum, v) => sum + v.visitors, 0);
  const canEndEarly = isSignificant && totalVisitors >= experiment.minimumSampleSize * experiment.variants.length;

  // Generate recommendation
  let recommendation: string;
  if (experiment.status === 'DRAFT') {
    recommendation = 'Start the experiment to begin collecting data.';
  } else if (experiment.status === 'COMPLETED' || experiment.status === 'CANCELLED') {
    if (winner) {
      recommendation = `Experiment complete. ${winner} won with ${relativeLift?.toFixed(1)}% lift. Consider implementing this price.`;
    } else {
      recommendation = 'Experiment complete. No statistically significant winner found.';
    }
  } else if (isSignificant && canEndEarly) {
    recommendation = `${winner} is winning with ${confidence.toFixed(0)}% confidence. You can end the experiment early.`;
  } else if (totalVisitors < experiment.minimumSampleSize) {
    const remaining = experiment.minimumSampleSize * experiment.variants.length - totalVisitors;
    recommendation = `Need ${remaining} more visitors for statistical significance.`;
  } else {
    recommendation = 'Continue running to reach statistical significance.';
  }

  return {
    experimentId,
    status: experiment.status,
    duration,
    variants: variantResults,
    winner,
    isSignificant,
    confidence,
    relativeLift,
    recommendation,
    canEndEarly,
  };
}

/**
 * Get all experiments for an organization
 */
export async function getExperiments(organizationId: string) {
  return prisma.pricingExperiment.findMany({
    where: { organizationId },
    include: {
      variants: true,
      _count: {
        select: { assignments: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get running experiments
 */
export async function getRunningExperiments(organizationId: string) {
  return prisma.pricingExperiment.findMany({
    where: {
      organizationId,
      status: 'RUNNING',
    },
    include: { variants: true },
  });
}

/**
 * Check if a plan has a running experiment
 */
export async function getPlanExperiment(organizationId: string, planId: string) {
  return prisma.pricingExperiment.findFirst({
    where: {
      organizationId,
      targetPlanId: planId,
      status: 'RUNNING',
    },
    include: { variants: true },
  });
}

