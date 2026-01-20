'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  X,
  Save,
  Filter,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  Percent,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { formatCurrency, formatPercentAbs } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';

interface Segment {
  id: string;
  name: string;
  description?: string;
  color?: string;
  rules: SegmentRules;
  isSystem: boolean;
  customerCount: number;
  createdAt: string;
  updatedAt: string;
}

interface SegmentRules {
  mrr?: { min?: number; max?: number };
  planId?: string;
  planNickname?: string;
  planInterval?: 'month' | 'year';
  tenureDays?: { min?: number; max?: number };
  status?: 'active' | 'canceled' | 'past_due' | 'trialing';
  hasDiscount?: boolean;
  discountPercent?: { min?: number; max?: number };
  isChurning?: boolean;
  isDelinquent?: boolean;
}

interface SegmentPerformance {
  segment: { id: string; name: string; description?: string; color?: string };
  metrics: {
    totalCustomers: number;
    totalMrr: number;
    totalArr: number;
    avgMrr: number;
    avgArr: number;
    churnRate: number;
    churnRiskRate: number;
    delinquentRate: number;
    newCustomersLast30Days: number;
    planDistribution: Record<string, number>;
  };
}

export function CustomerSegmentation() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
  const [performance, setPerformance] = useState<SegmentPerformance | null>(null);
  const [isLoadingPerformance, setIsLoadingPerformance] = useState(false);

  useEffect(() => {
    fetchSegments();
  }, []);

  useEffect(() => {
    if (selectedSegment) {
      fetchPerformance(selectedSegment);
    }
  }, [selectedSegment]);

  const fetchSegments = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/segments');
      if (!res.ok) throw new Error('Failed to fetch segments');
      const data = await res.json();
      setSegments(data.segments || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load segments');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPerformance = async (segmentId: string) => {
    try {
      setIsLoadingPerformance(true);
      const res = await fetch(`/api/segments/${segmentId}/performance`);
      if (!res.ok) throw new Error('Failed to fetch performance');
      const data = await res.json();
      setPerformance(data);
    } catch (err) {
      console.error('Failed to fetch performance:', err);
    } finally {
      setIsLoadingPerformance(false);
    }
  };

  const handleDelete = async (segmentId: string) => {
    if (!confirm('Are you sure you want to delete this segment?')) return;
    
    try {
      const res = await fetch(`/api/segments?segmentId=${segmentId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete segment');
      await fetchSegments();
      if (selectedSegment === segmentId) {
        setSelectedSegment(null);
        setPerformance(null);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete segment');
    }
  };

  if (isLoading) {
    return (
      <Card>
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
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30">
              <Users className="w-6 h-6 text-purple-400" />
            </div>
            Customer Segmentation
          </h2>
          <p className="text-muted-foreground mt-1">
            Create and manage customer segments for targeted analysis
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          New Segment
        </Button>
      </div>

      {/* Segments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {segments.map((segment) => (
          <motion.div
            key={segment.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-lg border p-4 cursor-pointer transition-all ${
              selectedSegment === segment.id
                ? 'border-primary bg-primary/5'
                : 'border-border bg-card hover:bg-muted/50'
            }`}
            onClick={() => setSelectedSegment(segment.id)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: segment.color || '#8b5cf6' }}
                />
                <h3 className="font-semibold">{segment.name}</h3>
                {segment.isSystem && (
                  <Badge variant="outline" className="text-xs">
                    System
                  </Badge>
                )}
              </div>
              <div className="flex gap-1">
                {!segment.isSystem && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingSegment(segment);
                        setShowCreateModal(true);
                      }}
                      className="p-1 rounded hover:bg-muted"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(segment.id);
                      }}
                      className="p-1 rounded hover:bg-muted text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {segment.description && (
              <p className="text-sm text-muted-foreground mb-3">{segment.description}</p>
            )}

            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="font-semibold">{segment.customerCount}</span>
                <span className="text-muted-foreground">customers</span>
              </div>
            </div>
          </motion.div>
        ))}

        {segments.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No segments yet. Create your first segment to get started.</p>
          </div>
        )}
      </div>

      {/* Performance Panel */}
      <AnimatePresence>
        {selectedSegment && performance && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: performance.segment.color || '#8b5cf6' }}
                    />
                    <CardTitle>{performance.segment.name} Performance</CardTitle>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedSegment(null);
                      setPerformance(null);
                    }}
                    className="p-1 rounded hover:bg-muted"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingPerformance ? (
                  <div className="flex items-center justify-center py-12">
                    <Spinner className="w-6 h-6" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-lg bg-muted/50">
                      <div className="text-sm text-muted-foreground mb-1">Total Customers</div>
                      <div className="text-2xl font-bold">{performance.metrics.totalCustomers}</div>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50">
                      <div className="text-sm text-muted-foreground mb-1">Total MRR</div>
                      <div className="text-2xl font-bold">
                        {formatCurrency(performance.metrics.totalMrr)}
                      </div>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50">
                      <div className="text-sm text-muted-foreground mb-1">Avg MRR</div>
                      <div className="text-2xl font-bold">
                        {formatCurrency(performance.metrics.avgMrr)}
                      </div>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50">
                      <div className="text-sm text-muted-foreground mb-1">Churn Rate</div>
                      <div className="text-2xl font-bold text-red-600">
                        {formatPercentAbs(performance.metrics.churnRate)}
                      </div>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50">
                      <div className="text-sm text-muted-foreground mb-1">Churn Risk</div>
                      <div className="text-2xl font-bold text-amber-600">
                        {formatPercentAbs(performance.metrics.churnRiskRate)}
                      </div>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50">
                      <div className="text-sm text-muted-foreground mb-1">Delinquent</div>
                      <div className="text-2xl font-bold text-red-600">
                        {formatPercentAbs(performance.metrics.delinquentRate)}
                      </div>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50">
                      <div className="text-sm text-muted-foreground mb-1">New (30d)</div>
                      <div className="text-2xl font-bold text-emerald-600">
                        {performance.metrics.newCustomersLast30Days}
                      </div>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50">
                      <div className="text-sm text-muted-foreground mb-1">Total ARR</div>
                      <div className="text-2xl font-bold">
                        {formatCurrency(performance.metrics.totalArr)}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <SegmentBuilderModal
            segment={editingSegment}
            onClose={() => {
              setShowCreateModal(false);
              setEditingSegment(null);
            }}
            onSave={async () => {
              await fetchSegments();
              setShowCreateModal(false);
              setEditingSegment(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Segment Builder Modal Component
function SegmentBuilderModal({
  segment,
  onClose,
  onSave,
}: {
  segment: Segment | null;
  onClose: () => void;
  onSave: () => Promise<void>;
}) {
  const [name, setName] = useState(segment?.name || '');
  const [description, setDescription] = useState(segment?.description || '');
  const [color, setColor] = useState(segment?.color || '#8b5cf6');
  const [rules, setRules] = useState<SegmentRules>(segment?.rules || {});
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Segment name is required');
      return;
    }

    try {
      setIsSaving(true);
      const url = segment ? '/api/segments' : '/api/segments';
      const method = segment ? 'PATCH' : 'POST';
      const body = segment
        ? { segmentId: segment.id, name, description, color, rules }
        : { name, description, color, rules };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to save segment');
      }

      await onSave();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save segment');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border border-border rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Filter className="w-5 h-5" />
              {segment ? 'Edit Segment' : 'Create Segment'}
            </h2>
            <button onClick={onClose} className="p-1 rounded hover:bg-muted">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Segment Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., High-Value Customers"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Description (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe this segment..."
                className="w-full px-3 py-2 rounded-lg border border-border bg-background resize-none"
                rows={2}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Color</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-16 h-10 rounded border border-border"
                />
                <Input
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="#8b5cf6"
                  className="flex-1"
                />
              </div>
            </div>
          </div>

          {/* Rules Builder */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Segment Rules
            </h3>

            {/* MRR Filter */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Min MRR ($)</label>
                <Input
                  type="number"
                  value={rules.mrr?.min || ''}
                  onChange={(e) =>
                    setRules({
                      ...rules,
                      mrr: { ...rules.mrr, min: e.target.value ? Number(e.target.value) * 100 : undefined },
                    })
                  }
                  placeholder="0"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Max MRR ($)</label>
                <Input
                  type="number"
                  value={rules.mrr?.max ? rules.mrr.max / 100 : ''}
                  onChange={(e) =>
                    setRules({
                      ...rules,
                      mrr: { ...rules.mrr, max: e.target.value ? Number(e.target.value) * 100 : undefined },
                    })
                  }
                  placeholder="Unlimited"
                />
              </div>
            </div>

            {/* Plan Filters */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Plan Name</label>
                <Input
                  value={rules.planNickname || ''}
                  onChange={(e) =>
                    setRules({ ...rules, planNickname: e.target.value || undefined })
                  }
                  placeholder="e.g., Pro Plan"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Billing Interval</label>
                <select
                  value={rules.planInterval || ''}
                  onChange={(e) =>
                    setRules({
                      ...rules,
                      planInterval: e.target.value as 'month' | 'year' | undefined,
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background"
                >
                  <option value="">Any</option>
                  <option value="month">Monthly</option>
                  <option value="year">Annual</option>
                </select>
              </div>
            </div>

            {/* Tenure Filter */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Min Tenure (days)</label>
                <Input
                  type="number"
                  value={rules.tenureDays?.min || ''}
                  onChange={(e) =>
                    setRules({
                      ...rules,
                      tenureDays: {
                        ...rules.tenureDays,
                        min: e.target.value ? Number(e.target.value) : undefined,
                      },
                    })
                  }
                  placeholder="0"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Max Tenure (days)</label>
                <Input
                  type="number"
                  value={rules.tenureDays?.max || ''}
                  onChange={(e) =>
                    setRules({
                      ...rules,
                      tenureDays: {
                        ...rules.tenureDays,
                        max: e.target.value ? Number(e.target.value) : undefined,
                      },
                    })
                  }
                  placeholder="Unlimited"
                />
              </div>
            </div>

            {/* Status & Flags */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Status</label>
                <select
                  value={rules.status || ''}
                  onChange={(e) =>
                    setRules({
                      ...rules,
                      status: e.target.value as SegmentRules['status'] | undefined,
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background"
                >
                  <option value="">Any</option>
                  <option value="active">Active</option>
                  <option value="trialing">Trialing</option>
                  <option value="past_due">Past Due</option>
                  <option value="canceled">Canceled</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium block">Flags</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={rules.hasDiscount === true}
                      onChange={(e) =>
                        setRules({ ...rules, hasDiscount: e.target.checked ? true : undefined })
                      }
                    />
                    <span className="text-sm">Has Discount</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={rules.isChurning === true}
                      onChange={(e) =>
                        setRules({ ...rules, isChurning: e.target.checked ? true : undefined })
                      }
                    />
                    <span className="text-sm">Is Churning</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={rules.isDelinquent === true}
                      onChange={(e) =>
                        setRules({ ...rules, isDelinquent: e.target.checked ? true : undefined })
                      }
                    />
                    <span className="text-sm">Is Delinquent</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-border">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="flex-1 gap-2">
              {isSaving ? (
                <>
                  <Spinner className="w-4 h-4" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Segment
                </>
              )}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
