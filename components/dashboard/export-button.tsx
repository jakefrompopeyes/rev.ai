'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Copy, Download, FileSpreadsheet, FileText, Loader2, Lock, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExportButtonProps {
  data: any;
  filename?: string;
  className?: string;
}

type ExportFormat = 'csv' | 'json';

type OrgEntitlement = {
  entitled: boolean;
  source: 'billing' | 'comped' | 'none';
  tier: 'starter' | 'growth' | 'scale' | 'enterprise';
  expiresAt?: string;
  reason?: string;
};

function convertToCSV(data: any): string {
  if (!data) return '';
  
  // Handle array of objects
  if (Array.isArray(data) && data.length > 0) {
    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          // Handle strings with commas
          if (typeof value === 'string' && value.includes(',')) {
            return `"${value}"`;
          }
          return value ?? '';
        }).join(',')
      )
    ];
    return csvRows.join('\n');
  }
  
  // Handle object with nested data
  if (typeof data === 'object') {
    const rows: string[] = [];
    
    const flattenObject = (obj: any, prefix = ''): void => {
      Object.entries(obj).forEach(([key, value]) => {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          flattenObject(value, fullKey);
        } else {
          rows.push(`${fullKey},${Array.isArray(value) ? JSON.stringify(value) : value}`);
        }
      });
    };
    
    flattenObject(data);
    return 'Key,Value\n' + rows.join('\n');
  }
  
  return String(data);
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function formatSummaryLine(label: string, value: string) {
  return `${label}: ${value}`;
}

function generateShareSummary(data: any): string {
  const mrr = data?.metrics?.mrr;
  const arr = data?.metrics?.arr;
  const churn = data?.metrics?.grossChurnRate;
  const insights = Array.isArray(data?.insights) ? data.insights : [];
  const recommendations = Array.isArray(data?.recommendations) ? data.recommendations : [];

  const lines: string[] = [];
  lines.push('discovred — Stripe Revenue & Pricing Summary');
  lines.push('');

  if (typeof mrr === 'number') lines.push(formatSummaryLine('MRR', `$${Math.round(mrr).toLocaleString()}`));
  if (typeof arr === 'number') lines.push(formatSummaryLine('ARR', `$${Math.round(arr).toLocaleString()}`));
  if (typeof churn === 'number') lines.push(formatSummaryLine('Gross churn', `${(churn * 100).toFixed(2)}%`));

  lines.push(formatSummaryLine('Active insights', `${insights.length}`));
  lines.push(formatSummaryLine('Recommendations', `${recommendations.length}`));

  const topInsight = insights?.[0]?.title;
  if (typeof topInsight === 'string' && topInsight.trim()) {
    lines.push('');
    lines.push('Top insight:');
    lines.push(`- ${topInsight.trim()}`);
  }

  lines.push('');
  lines.push(`Exported from discovred at ${new Date().toISOString()}`);
  return lines.join('\n');
}

export function ExportButton({ data, filename = 'dashboard-export', className }: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [successMode, setSuccessMode] = useState<null | 'export' | 'copy'>(null);
  const [entitlement, setEntitlement] = useState<OrgEntitlement | null>(null);
  const [isLoadingEntitlement, setIsLoadingEntitlement] = useState(false);

  const canExport = useMemo(() => entitlement?.entitled === true, [entitlement?.entitled]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoadingEntitlement(true);
      try {
        const res = await fetch('/api/billing/entitlement');
        if (!res.ok) {
          if (!cancelled) {
            setEntitlement({ entitled: false, source: 'none', tier: 'starter' });
          }
          return;
        }
        const json = await res.json();
        const e = json?.entitlement as OrgEntitlement | undefined;
        if (!cancelled) {
          setEntitlement(e || { entitled: false, source: 'none', tier: 'starter' });
        }
      } catch {
        if (!cancelled) setEntitlement({ entitled: false, source: 'none', tier: 'starter' });
      } finally {
        if (!cancelled) setIsLoadingEntitlement(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleExport = async (format: ExportFormat) => {
    if (!canExport) {
      window.location.href = '/pricing';
      return;
    }
    setIsExporting(true);
    
    // Simulate small delay for UX
    await new Promise(resolve => setTimeout(resolve, 300));
    
    try {
      const timestamp = new Date().toISOString().split('T')[0];
      const fullFilename = `${filename}-${timestamp}`;
      
      if (format === 'csv') {
        const csv = convertToCSV(data);
        downloadFile(csv, `${fullFilename}.csv`, 'text/csv');
      } else {
        const json = JSON.stringify(data, null, 2);
        downloadFile(json, `${fullFilename}.json`, 'application/json');
      }
      
      setSuccessMode('export');
      setTimeout(() => {
        setSuccessMode(null);
        setIsOpen(false);
      }, 1500);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopySummary = async () => {
    try {
      const summary = generateShareSummary(data);
      await navigator.clipboard.writeText(summary);
      setSuccessMode('copy');
      setTimeout(() => {
        setSuccessMode(null);
        setIsOpen(false);
      }, 1500);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };

  return (
    <div className={cn('relative', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg border border-border',
          'bg-card hover:bg-muted/50 transition-colors text-sm font-medium',
          isOpen && 'ring-2 ring-ring ring-offset-2 ring-offset-background'
        )}
      >
        <Download className="h-4 w-4" />
        Export
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className={cn(
                'absolute right-0 top-full mt-2 z-50',
                'min-w-[180px] rounded-lg border border-border bg-card shadow-lg',
                'overflow-hidden'
              )}
            >
              {successMode ? (
                <div className="p-4 text-center">
                  <div className="rounded-full bg-emerald-500/10 p-2 w-fit mx-auto mb-2">
                    <Check className="h-5 w-5 text-emerald-500" />
                  </div>
                  <p className="text-sm font-medium">{successMode === 'export' ? 'Exported!' : 'Copied!'}</p>
                </div>
              ) : (
                <div className="py-1">
                  {!canExport && (
                    <div className="px-3 py-2 border-b border-border bg-muted/30">
                      <div className="flex items-start gap-2">
                        <div className="rounded-md bg-primary/10 p-1.5 mt-0.5">
                          <Sparkles className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div>
                          <p className="text-xs font-medium">Unlock exports</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Start a plan trial to export CSV/JSON.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => (window.location.href = '/pricing')}
                        className="mt-2 w-full rounded-md bg-primary text-primary-foreground text-xs font-medium px-2.5 py-2 hover:bg-primary/90 transition-colors"
                      >
                        View plans
                      </button>
                    </div>
                  )}

                  <button
                    onClick={handleCopySummary}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 text-sm',
                      'hover:bg-muted/50 transition-colors'
                    )}
                  >
                    <Copy className="h-4 w-4 text-violet-500" />
                    <div className="text-left">
                      <p className="font-medium">Copy summary</p>
                      <p className="text-xs text-muted-foreground">Share in Slack/email</p>
                    </div>
                  </button>

                  <button
                    onClick={() => handleExport('csv')}
                    disabled={isExporting || isLoadingEntitlement}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 text-sm',
                      'hover:bg-muted/50 transition-colors disabled:opacity-50'
                    )}
                  >
                    {isExporting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : !canExport ? (
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                    )}
                    <div className="text-left">
                      <p className="font-medium">Export CSV</p>
                      <p className="text-xs text-muted-foreground">{canExport ? 'Spreadsheet format' : 'Requires trial/plan'}</p>
                    </div>
                  </button>
                  <button
                    onClick={() => handleExport('json')}
                    disabled={isExporting || isLoadingEntitlement}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 text-sm',
                      'hover:bg-muted/50 transition-colors disabled:opacity-50'
                    )}
                  >
                    {isExporting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : !canExport ? (
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <FileText className="h-4 w-4 text-blue-500" />
                    )}
                    <div className="text-left">
                      <p className="font-medium">Export JSON</p>
                      <p className="text-xs text-muted-foreground">{canExport ? 'Raw data format' : 'Requires trial/plan'}</p>
                    </div>
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

