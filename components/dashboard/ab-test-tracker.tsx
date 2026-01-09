'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import {
  FlaskConical,
  Play,
  Pause,
  Square,
  Trash2,
  Plus,
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  CheckCircle,
  AlertTriangle,
  Clock,
  Target,
  BarChart3,
  X,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Trophy,
  Percent,
} from 'lucide-react';

// Types
interface ExperimentVariant {
  id: string;
  name: string;
  isControl: boolean;
  priceCents: number;
  visitors: number;
  conversions: number;
  churned: number;
  totalRevenue: number;
}

interface Experiment {
  id: string;
  name: string;
  hypothesis: string;
  description?: string;
  targetPlanId: string;
  targetPlanName: string;
  status: 'DRAFT' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  startedAt?: string;
  endedAt?: string;
  plannedDuration: number;
  trafficAllocation: number;
  minimumSampleSize: number;
  confidenceLevel: number;
  aiGenerated: boolean;
  expectedLift?: number;
  priority?: number;
  risks?: string[];
  variants: ExperimentVariant[];
  _count?: { assignments: number };
}

interface ExperimentResult {
  experimentId: string;
  status: string;
  duration: number;
  variants: Array<{
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
  }>;
  winner: string | null;
  isSignificant: boolean;
  confidence: number;
  relativeLift: number | null;
  recommendation: string;
  canEndEarly: boolean;
}

// Helpers
const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
};

const statusConfig = {
  DRAFT: { label: 'Draft', color: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/30', icon: Clock },
  RUNNING: { label: 'Running', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30', icon: Play },
  PAUSED: { label: 'Paused', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30', icon: Pause },
  COMPLETED: { label: 'Completed', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30', icon: CheckCircle },
  CANCELLED: { label: 'Cancelled', color: 'text-red-400 bg-red-500/10 border-red-500/30', icon: X },
};

// Create Experiment Modal
function CreateExperimentModal({
  isOpen,
  onClose,
  onCreate,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: any) => Promise<void>;
}) {
  const [formData, setFormData] = useState({
    name: '',
    hypothesis: '',
    targetPlanId: '',
    targetPlanName: '',
    plannedDuration: 14,
    trafficAllocation: 50,
    controlPrice: '',
    variantPrice: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onCreate({
        name: formData.name,
        hypothesis: formData.hypothesis,
        targetPlanId: formData.targetPlanId || 'plan_default',
        targetPlanName: formData.targetPlanName || 'Default Plan',
        plannedDuration: formData.plannedDuration,
        trafficAllocation: formData.trafficAllocation,
        variants: [
          { name: 'Control', priceCents: parseInt(formData.controlPrice) * 100, isControl: true },
          { name: 'Variant A', priceCents: parseInt(formData.variantPrice) * 100 },
        ],
      });
      onClose();
      setFormData({
        name: '',
        hypothesis: '',
        targetPlanId: '',
        targetPlanName: '',
        plannedDuration: 14,
        trafficAllocation: 50,
        controlPrice: '',
        variantPrice: '',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg bg-zinc-900 border-zinc-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-purple-400" />
              Create Pricing Experiment
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-zinc-400 block mb-1">Experiment Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Pro Plan +15% Price Test"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                required
              />
            </div>

            <div>
              <label className="text-sm text-zinc-400 block mb-1">Hypothesis</label>
              <textarea
                value={formData.hypothesis}
                onChange={(e) => setFormData({ ...formData, hypothesis: e.target.value })}
                placeholder="e.g., Increasing Pro plan price by 15% will not significantly impact conversion rate while increasing revenue"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 h-20 resize-none"
                required
              />
            </div>

            <div>
              <label className="text-sm text-zinc-400 block mb-1">Target Plan Name</label>
              <input
                type="text"
                value={formData.targetPlanName}
                onChange={(e) => setFormData({ ...formData, targetPlanName: e.target.value })}
                placeholder="e.g., Pro Plan"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-zinc-400 block mb-1">Control Price ($)</label>
                <input
                  type="number"
                  value={formData.controlPrice}
                  onChange={(e) => setFormData({ ...formData, controlPrice: e.target.value })}
                  placeholder="49"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  required
                />
              </div>
              <div>
                <label className="text-sm text-zinc-400 block mb-1">Variant Price ($)</label>
                <input
                  type="number"
                  value={formData.variantPrice}
                  onChange={(e) => setFormData({ ...formData, variantPrice: e.target.value })}
                  placeholder="59"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-zinc-400 block mb-1">Duration (days)</label>
                <input
                  type="number"
                  value={formData.plannedDuration}
                  onChange={(e) => setFormData({ ...formData, plannedDuration: parseInt(e.target.value) })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
              </div>
              <div>
                <label className="text-sm text-zinc-400 block mb-1">Traffic %</label>
                <input
                  type="number"
                  value={formData.trafficAllocation}
                  onChange={(e) => setFormData({ ...formData, trafficAllocation: parseInt(e.target.value) })}
                  min="10"
                  max="100"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1 border-zinc-700" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-purple-600 hover:bg-purple-700"
              >
                {isSubmitting ? <Spinner className="w-4 h-4" /> : 'Create Experiment'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// Experiment Card
function ExperimentCard({
  experiment,
  onAction,
  onViewResults,
}: {
  experiment: Experiment;
  onAction: (id: string, action: string) => Promise<void>;
  onViewResults: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const config = statusConfig[experiment.status];
  const StatusIcon = config.icon;

  const handleAction = async (action: string) => {
    setActionLoading(action);
    try {
      await onAction(experiment.id, action);
    } finally {
      setActionLoading(null);
    }
  };

  const totalVisitors = experiment.variants.reduce((sum, v) => sum + v.visitors, 0);
  const totalConversions = experiment.variants.reduce((sum, v) => sum + v.conversions, 0);
  const overallConversionRate = totalVisitors > 0 ? (totalConversions / totalVisitors) * 100 : 0;

  return (
    <Card className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-all">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className={config.color}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {config.label}
              </Badge>
              {experiment.aiGenerated && (
                <Badge variant="outline" className="border-purple-500/30 text-purple-400 bg-purple-500/10">
                  <Sparkles className="w-3 h-3 mr-1" />
                  AI
                </Badge>
              )}
              <span className="text-sm text-zinc-500">{experiment.targetPlanName}</span>
            </div>
            <h3 className="font-semibold text-white text-lg">{experiment.name}</h3>
            <p className="text-sm text-zinc-400 mt-1 line-clamp-2">{experiment.hypothesis}</p>
          </div>

          <div className="flex gap-2">
            {experiment.status === 'DRAFT' && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                  onClick={() => handleAction('start')}
                  disabled={actionLoading === 'start'}
                >
                  {actionLoading === 'start' ? <Spinner className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                  onClick={() => handleAction('delete')}
                  disabled={actionLoading === 'delete'}
                >
                  {actionLoading === 'delete' ? <Spinner className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                </Button>
              </>
            )}
            {experiment.status === 'RUNNING' && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                  onClick={() => handleAction('pause')}
                  disabled={actionLoading === 'pause'}
                >
                  {actionLoading === 'pause' ? <Spinner className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                  onClick={() => handleAction('end')}
                  disabled={actionLoading === 'end'}
                >
                  {actionLoading === 'end' ? <Spinner className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                </Button>
              </>
            )}
            {experiment.status === 'PAUSED' && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                  onClick={() => handleAction('resume')}
                  disabled={actionLoading === 'resume'}
                >
                  {actionLoading === 'resume' ? <Spinner className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                  onClick={() => handleAction('cancel')}
                  disabled={actionLoading === 'cancel'}
                >
                  {actionLoading === 'cancel' ? <Spinner className="w-4 h-4" /> : <X className="w-4 h-4" />}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Metrics Overview */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="p-3 rounded-lg bg-zinc-800/50">
            <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
              <Users className="w-3 h-3" />
              Visitors
            </div>
            <div className="text-xl font-bold text-white">{totalVisitors.toLocaleString()}</div>
          </div>
          <div className="p-3 rounded-lg bg-zinc-800/50">
            <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
              <Target className="w-3 h-3" />
              Conversions
            </div>
            <div className="text-xl font-bold text-white">{totalConversions.toLocaleString()}</div>
          </div>
          <div className="p-3 rounded-lg bg-zinc-800/50">
            <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
              <Percent className="w-3 h-3" />
              Conv. Rate
            </div>
            <div className="text-xl font-bold text-white">{overallConversionRate.toFixed(1)}%</div>
          </div>
          <div className="p-3 rounded-lg bg-zinc-800/50">
            <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
              <Clock className="w-3 h-3" />
              Duration
            </div>
            <div className="text-xl font-bold text-white">{experiment.plannedDuration}d</div>
          </div>
        </div>

        {/* Variants Preview */}
        <div className="flex gap-2 mb-4">
          {experiment.variants.map((variant) => (
            <div
              key={variant.id}
              className={`flex-1 p-3 rounded-lg ${
                variant.isControl
                  ? 'bg-zinc-800/50 border border-zinc-700'
                  : 'bg-purple-500/10 border border-purple-500/30'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-sm font-medium ${variant.isControl ? 'text-zinc-300' : 'text-purple-300'}`}>
                  {variant.name}
                </span>
                {variant.isControl && (
                  <Badge variant="outline" className="text-xs border-zinc-600 text-zinc-400">
                    Control
                  </Badge>
                )}
              </div>
              <div className="text-lg font-bold text-white">{formatCurrency(variant.priceCents)}</div>
              <div className="text-xs text-zinc-500 mt-1">
                {variant.visitors} visitors · {variant.conversions} conv.
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="text-sm text-zinc-400 hover:text-white flex items-center gap-1"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          {expanded ? 'Hide details' : 'View details'}
        </button>

        {expanded && (
          <div className="mt-4 pt-4 border-t border-zinc-800 space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-zinc-500">Traffic Allocation:</span>
                <span className="text-white ml-2">{experiment.trafficAllocation}%</span>
              </div>
              <div>
                <span className="text-zinc-500">Min. Sample Size:</span>
                <span className="text-white ml-2">{experiment.minimumSampleSize.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-zinc-500">Confidence Level:</span>
                <span className="text-white ml-2">{(experiment.confidenceLevel * 100).toFixed(0)}%</span>
              </div>
              {experiment.expectedLift && (
                <div>
                  <span className="text-zinc-500">Expected Lift:</span>
                  <span className="text-emerald-400 ml-2">+{experiment.expectedLift}%</span>
                </div>
              )}
            </div>

            {experiment.risks && experiment.risks.length > 0 && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <div className="text-xs text-amber-400 font-medium mb-1">Risks</div>
                <ul className="text-sm text-zinc-300 space-y-1">
                  {(experiment.risks as string[]).map((risk, i) => (
                    <li key={i}>• {risk}</li>
                  ))}
                </ul>
              </div>
            )}

            <Button
              variant="outline"
              className="w-full border-zinc-700"
              onClick={() => onViewResults(experiment.id)}
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              View Full Results
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Results Modal
function ResultsModal({
  isOpen,
  onClose,
  results,
}: {
  isOpen: boolean;
  onClose: () => void;
  results: ExperimentResult | null;
}) {
  if (!isOpen || !results) return null;

  const control = results.variants.find(v => v.isControl);
  const treatments = results.variants.filter(v => !v.isControl);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <Card className="w-full max-w-3xl bg-zinc-900 border-zinc-700 my-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-400" />
              Experiment Results
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          <CardDescription>{results.recommendation}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Winner Banner */}
          {results.winner && (
            <div className={`p-4 rounded-lg ${
              results.isSignificant
                ? 'bg-emerald-500/20 border border-emerald-500/30'
                : 'bg-amber-500/20 border border-amber-500/30'
            }`}>
              <div className="flex items-center gap-3">
                <Trophy className={`w-6 h-6 ${results.isSignificant ? 'text-emerald-400' : 'text-amber-400'}`} />
                <div>
                  <div className={`font-semibold ${results.isSignificant ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {results.winner} is winning!
                  </div>
                  <div className="text-sm text-zinc-300">
                    {results.relativeLift !== null && (
                      <>
                        {results.relativeLift > 0 ? '+' : ''}{results.relativeLift.toFixed(1)}% lift
                      </>
                    )}
                    {' · '}
                    {results.confidence.toFixed(0)}% confidence
                    {!results.isSignificant && ' (not yet significant)'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="p-3 rounded-lg bg-zinc-800/50 text-center">
              <div className="text-zinc-500 text-xs mb-1">Duration</div>
              <div className="text-xl font-bold text-white">{results.duration}d</div>
            </div>
            <div className="p-3 rounded-lg bg-zinc-800/50 text-center">
              <div className="text-zinc-500 text-xs mb-1">Total Visitors</div>
              <div className="text-xl font-bold text-white">
                {results.variants.reduce((sum, v) => sum + v.visitors, 0).toLocaleString()}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-zinc-800/50 text-center">
              <div className="text-zinc-500 text-xs mb-1">Significance</div>
              <div className={`text-xl font-bold ${results.isSignificant ? 'text-emerald-400' : 'text-amber-400'}`}>
                {results.isSignificant ? 'Yes' : 'No'}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-zinc-800/50 text-center">
              <div className="text-zinc-500 text-xs mb-1">Confidence</div>
              <div className="text-xl font-bold text-white">{results.confidence.toFixed(0)}%</div>
            </div>
          </div>

          {/* Variant Comparison Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left py-3 px-4 text-zinc-500 font-medium">Variant</th>
                  <th className="text-right py-3 px-4 text-zinc-500 font-medium">Price</th>
                  <th className="text-right py-3 px-4 text-zinc-500 font-medium">Visitors</th>
                  <th className="text-right py-3 px-4 text-zinc-500 font-medium">Conv.</th>
                  <th className="text-right py-3 px-4 text-zinc-500 font-medium">Conv. Rate</th>
                  <th className="text-right py-3 px-4 text-zinc-500 font-medium">Revenue</th>
                  <th className="text-right py-3 px-4 text-zinc-500 font-medium">Rev/Visitor</th>
                  <th className="text-right py-3 px-4 text-zinc-500 font-medium">p-value</th>
                </tr>
              </thead>
              <tbody>
                {results.variants.map((variant) => (
                  <tr
                    key={variant.id}
                    className={`border-b border-zinc-800/50 ${variant.isWinning ? 'bg-emerald-500/5' : ''}`}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {variant.isWinning && <Trophy className="w-4 h-4 text-emerald-400" />}
                        <span className="text-white font-medium">{variant.name}</span>
                        {variant.isControl && (
                          <Badge variant="outline" className="text-xs border-zinc-600 text-zinc-400">
                            Control
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="text-right py-3 px-4 text-white">{formatCurrency(variant.priceCents)}</td>
                    <td className="text-right py-3 px-4 text-zinc-300">{variant.visitors.toLocaleString()}</td>
                    <td className="text-right py-3 px-4 text-zinc-300">{variant.conversions}</td>
                    <td className="text-right py-3 px-4">
                      <span className={variant.isWinning ? 'text-emerald-400 font-medium' : 'text-zinc-300'}>
                        {variant.conversionRate.toFixed(2)}%
                      </span>
                    </td>
                    <td className="text-right py-3 px-4 text-zinc-300">{formatCurrency(variant.totalRevenue)}</td>
                    <td className="text-right py-3 px-4">
                      <span className={variant.isWinning ? 'text-emerald-400 font-medium' : 'text-zinc-300'}>
                        {formatCurrency(variant.revenuePerVisitor)}
                      </span>
                    </td>
                    <td className="text-right py-3 px-4 text-zinc-400">
                      {variant.pValue !== null ? variant.pValue.toFixed(4) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Actions */}
          {results.canEndEarly && results.status === 'RUNNING' && (
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-emerald-400">Ready to conclude</div>
                  <div className="text-sm text-zinc-400">
                    Statistical significance reached. You can end the experiment early.
                  </div>
                </div>
                <Button className="bg-emerald-600 hover:bg-emerald-700">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  End & Apply Winner
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Main Component
export function ABTestTracker() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedResults, setSelectedResults] = useState<ExperimentResult | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);

  useEffect(() => {
    fetchExperiments();
  }, []);

  const fetchExperiments = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/experiments');
      if (!response.ok) throw new Error('Failed to fetch experiments');
      const data = await response.json();
      setExperiments(data.experiments || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (data: any) => {
    const response = await fetch('/api/experiments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create experiment');
    await fetchExperiments();
  };

  const handleAction = async (experimentId: string, action: string) => {
    if (action === 'delete') {
      const response = await fetch(`/api/experiments?id=${experimentId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete experiment');
    } else {
      const response = await fetch('/api/experiments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ experimentId, action }),
      });
      if (!response.ok) throw new Error(`Failed to ${action} experiment`);
    }
    await fetchExperiments();
  };

  const handleViewResults = async (experimentId: string) => {
    setResultsLoading(true);
    try {
      const response = await fetch(`/api/experiments?id=${experimentId}`);
      if (!response.ok) throw new Error('Failed to fetch results');
      const data = await response.json();
      setSelectedResults(data);
    } catch (err) {
      console.error('Failed to fetch results:', err);
    } finally {
      setResultsLoading(false);
    }
  };

  const runningExperiments = experiments.filter(e => e.status === 'RUNNING');
  const otherExperiments = experiments.filter(e => e.status !== 'RUNNING');

  if (loading) {
    return (
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardContent className="flex items-center justify-center py-20">
          <Spinner className="w-8 h-8" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30">
              <FlaskConical className="w-6 h-6 text-amber-400" />
            </div>
            A/B Test Tracker
          </h2>
          <p className="text-zinc-400 mt-1">Run pricing experiments with statistical significance</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-purple-600 hover:bg-purple-700">
          <Plus className="w-4 h-4 mr-2" />
          New Experiment
        </Button>
      </div>

      {/* Running Experiments */}
      {runningExperiments.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Running Experiments
          </h3>
          <div className="space-y-4">
            {runningExperiments.map((exp) => (
              <ExperimentCard
                key={exp.id}
                experiment={exp}
                onAction={handleAction}
                onViewResults={handleViewResults}
              />
            ))}
          </div>
        </div>
      )}

      {/* Other Experiments */}
      {otherExperiments.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">
            {runningExperiments.length > 0 ? 'Other Experiments' : 'All Experiments'}
          </h3>
          <div className="space-y-4">
            {otherExperiments.map((exp) => (
              <ExperimentCard
                key={exp.id}
                experiment={exp}
                onAction={handleAction}
                onViewResults={handleViewResults}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {experiments.length === 0 && (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="py-16 text-center">
            <FlaskConical className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No experiments yet</h3>
            <p className="text-zinc-400 mb-6">
              Create your first pricing experiment to start optimizing revenue
            </p>
            <Button onClick={() => setShowCreate(true)} className="bg-purple-600 hover:bg-purple-700">
              <Plus className="w-4 h-4 mr-2" />
              Create First Experiment
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create Modal */}
      <CreateExperimentModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={handleCreate}
      />

      {/* Results Modal */}
      <ResultsModal
        isOpen={!!selectedResults}
        onClose={() => setSelectedResults(null)}
        results={selectedResults}
      />
    </div>
  );
}

