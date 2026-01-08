'use client';

import { useEffect, useCallback } from 'react';

interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description: string;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      for (const shortcut of shortcuts) {
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = shortcut.ctrl ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey;
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const altMatch = shortcut.alt ? event.altKey : !event.altKey;

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          event.preventDefault();
          shortcut.action();
          break;
        }
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

// Default dashboard shortcuts
export const defaultDashboardShortcuts = (actions: {
  refresh: () => void;
  toggleTheme: () => void;
  toggleComparison: () => void;
  exportData: () => void;
}) => [
  {
    key: 'r',
    action: actions.refresh,
    description: 'Refresh data',
  },
  {
    key: 't',
    action: actions.toggleTheme,
    description: 'Toggle theme',
  },
  {
    key: 'c',
    action: actions.toggleComparison,
    description: 'Toggle comparison mode',
  },
  {
    key: 'e',
    ctrl: true,
    action: actions.exportData,
    description: 'Export data',
  },
];

