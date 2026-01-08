'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, FileSpreadsheet, FileText, Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExportButtonProps {
  data: any;
  filename?: string;
  className?: string;
}

type ExportFormat = 'csv' | 'json';

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

export function ExportButton({ data, filename = 'dashboard-export', className }: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  const handleExport = async (format: ExportFormat) => {
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
      
      setExportSuccess(true);
      setTimeout(() => {
        setExportSuccess(false);
        setIsOpen(false);
      }, 1500);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
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
              {exportSuccess ? (
                <div className="p-4 text-center">
                  <div className="rounded-full bg-emerald-500/10 p-2 w-fit mx-auto mb-2">
                    <Check className="h-5 w-5 text-emerald-500" />
                  </div>
                  <p className="text-sm font-medium">Exported!</p>
                </div>
              ) : (
                <div className="py-1">
                  <button
                    onClick={() => handleExport('csv')}
                    disabled={isExporting}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 text-sm',
                      'hover:bg-muted/50 transition-colors disabled:opacity-50'
                    )}
                  >
                    {isExporting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                    )}
                    <div className="text-left">
                      <p className="font-medium">Export CSV</p>
                      <p className="text-xs text-muted-foreground">Spreadsheet format</p>
                    </div>
                  </button>
                  <button
                    onClick={() => handleExport('json')}
                    disabled={isExporting}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 text-sm',
                      'hover:bg-muted/50 transition-colors disabled:opacity-50'
                    )}
                  >
                    {isExporting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileText className="h-4 w-4 text-blue-500" />
                    )}
                    <div className="text-left">
                      <p className="font-medium">Export JSON</p>
                      <p className="text-xs text-muted-foreground">Raw data format</p>
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

