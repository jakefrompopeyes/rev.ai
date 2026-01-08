'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Keyboard, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Shortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  description: string;
}

interface KeyboardShortcutsHelpProps {
  shortcuts: Shortcut[];
}

export function KeyboardShortcutsHelp({ shortcuts }: KeyboardShortcutsHelpProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg border border-border',
          'bg-card hover:bg-muted/50 transition-colors text-sm text-muted-foreground'
        )}
        title="Keyboard shortcuts"
      >
        <Keyboard className="h-4 w-4" />
        <span className="hidden sm:inline">Shortcuts</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50"
              onClick={() => setIsOpen(false)}
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md"
            >
              <div className="rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Keyboard className="h-5 w-5" />
                    Keyboard Shortcuts
                  </h2>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1 rounded hover:bg-muted transition-colors"
                  >
                    <X className="h-5 w-5 text-muted-foreground" />
                  </button>
                </div>

                {/* Shortcuts list */}
                <div className="px-6 py-4 space-y-3">
                  {shortcuts.map((shortcut, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between py-2"
                    >
                      <span className="text-sm text-muted-foreground">
                        {shortcut.description}
                      </span>
                      <div className="flex items-center gap-1">
                        {shortcut.ctrl && (
                          <>
                            <kbd className="px-2 py-1 text-xs font-mono bg-muted rounded border border-border">
                              ⌘
                            </kbd>
                            <span className="text-muted-foreground">+</span>
                          </>
                        )}
                        {shortcut.shift && (
                          <>
                            <kbd className="px-2 py-1 text-xs font-mono bg-muted rounded border border-border">
                              ⇧
                            </kbd>
                            <span className="text-muted-foreground">+</span>
                          </>
                        )}
                        <kbd className="px-2 py-1 text-xs font-mono bg-muted rounded border border-border uppercase">
                          {shortcut.key}
                        </kbd>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 bg-muted/30 border-t border-border">
                  <p className="text-xs text-muted-foreground text-center">
                    Press <kbd className="px-1 py-0.5 text-xs font-mono bg-muted rounded">?</kbd> to toggle this help
                  </p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

