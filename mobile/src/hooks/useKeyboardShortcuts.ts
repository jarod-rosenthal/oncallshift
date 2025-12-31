import { useEffect, useCallback, useState, useRef } from 'react';
import { Platform, Keyboard, NativeEventEmitter, NativeModules } from 'react-native';

export interface KeyboardShortcut {
  key: string;
  modifiers?: ('ctrl' | 'cmd' | 'alt' | 'shift')[];
  description: string;
  action: () => void;
  category?: 'navigation' | 'actions' | 'general';
}

interface KeyboardEvent {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  preventDefault?: () => void;
}

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  shortcuts: KeyboardShortcut[];
}

// Default shortcuts for the incident management app
export const DEFAULT_SHORTCUTS: Omit<KeyboardShortcut, 'action'>[] = [
  // Navigation
  { key: 'j', description: 'Next item in list', category: 'navigation' },
  { key: 'k', description: 'Previous item in list', category: 'navigation' },
  { key: '/', description: 'Focus search', category: 'navigation' },
  { key: 'Escape', description: 'Close modal/Go back', category: 'navigation' },
  { key: 'Enter', description: 'Open selected item', category: 'navigation' },

  // Actions
  { key: 'a', description: 'Acknowledge incident', category: 'actions' },
  { key: 'r', description: 'Resolve incident', category: 'actions' },
  { key: 'e', description: 'Escalate incident', category: 'actions' },
  { key: 'n', description: 'Add note to incident', category: 'actions' },
  { key: 's', description: 'Select/deselect item', category: 'actions' },

  // General
  { key: '?', description: 'Show keyboard shortcuts', category: 'general' },
  { key: 'g', modifiers: ['shift'], description: 'Go to Dashboard', category: 'general' },
  { key: 'i', modifiers: ['shift'], description: 'Go to Incidents', category: 'general' },
  { key: 'o', modifiers: ['shift'], description: 'Go to On-Call', category: 'general' },
];

export function useKeyboardShortcuts({
  enabled = true,
  shortcuts,
}: UseKeyboardShortcutsOptions) {
  const [isListening, setIsListening] = useState(false);
  const shortcutsRef = useRef(shortcuts);

  // Keep shortcuts ref updated
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    const { key, ctrlKey, metaKey, altKey, shiftKey } = event;
    const normalizedKey = key.toLowerCase();

    // Find matching shortcut
    const matchingShortcut = shortcutsRef.current.find(shortcut => {
      const shortcutKey = shortcut.key.toLowerCase();
      if (shortcutKey !== normalizedKey) return false;

      // Check modifiers
      const modifiers = shortcut.modifiers || [];
      const needsCtrl = modifiers.includes('ctrl');
      const needsCmd = modifiers.includes('cmd');
      const needsAlt = modifiers.includes('alt');
      const needsShift = modifiers.includes('shift');

      // On Mac, cmd key is metaKey; on Windows/Linux, ctrl is ctrlKey
      const hasCtrlOrCmd = ctrlKey || metaKey;

      if (needsCtrl && !ctrlKey) return false;
      if (needsCmd && !metaKey) return false;
      if (needsAlt && !altKey) return false;
      if (needsShift && !shiftKey) return false;

      // If no modifiers required, make sure none are pressed (except for special cases)
      if (modifiers.length === 0) {
        // Allow shift for certain keys like ?
        if (key === '?' && shiftKey) return true;
        if (hasCtrlOrCmd || altKey) return false;
        // Don't require exact shift match for letters
        if (shortcutKey.match(/[a-z]/) && shiftKey) return false;
      }

      return true;
    });

    if (matchingShortcut) {
      // Prevent default browser behavior
      event.preventDefault?.();
      matchingShortcut.action();
    }
  }, [enabled]);

  useEffect(() => {
    // Only set up listeners on web or tablet with connected keyboard
    // React Native doesn't have native keyboard shortcut support,
    // but we can listen for hardware keyboard events on web
    if (Platform.OS === 'web') {
      const listener = (e: globalThis.KeyboardEvent) => {
        handleKeyPress({
          key: e.key,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey,
          altKey: e.altKey,
          shiftKey: e.shiftKey,
        });
      };

      window.addEventListener('keydown', listener);
      setIsListening(true);

      return () => {
        window.removeEventListener('keydown', listener);
        setIsListening(false);
      };
    }

    // For native platforms with external keyboards
    // This is a simplified version - full implementation would require
    // native modules for complete hardware keyboard support
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      // iOS and Android tablets with connected keyboards can receive
      // some key events through the Keyboard API
      const keyboardListener = Keyboard.addListener('keyboardDidShow', () => {
        // Hardware keyboard detected
        setIsListening(true);
      });

      return () => {
        keyboardListener.remove();
        setIsListening(false);
      };
    }

    return undefined;
  }, [handleKeyPress]);

  return {
    isListening,
    shortcuts: shortcutsRef.current,
  };
}

// Hook to detect if a hardware keyboard is connected
export function useHardwareKeyboard() {
  const [hasHardwareKeyboard, setHasHardwareKeyboard] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') {
      // Web always has keyboard
      setHasHardwareKeyboard(true);
      return;
    }

    // On native platforms, check for keyboard
    // This is a heuristic - tablets with keyboard cases would be detected
    const checkKeyboard = () => {
      // Check if keyboard height is 0 when shown (hardware keyboard indicator)
      const subscription = Keyboard.addListener('keyboardDidShow', (event) => {
        // Hardware keyboards typically don't change screen height much
        if (event.endCoordinates.height < 100) {
          setHasHardwareKeyboard(true);
        }
      });

      return () => {
        subscription.remove();
      };
    };

    return checkKeyboard();
  }, []);

  return hasHardwareKeyboard;
}

// Group shortcuts by category for display
export function groupShortcutsByCategory(
  shortcuts: Omit<KeyboardShortcut, 'action'>[]
): Record<string, Omit<KeyboardShortcut, 'action'>[]> {
  return shortcuts.reduce((acc, shortcut) => {
    const category = shortcut.category || 'general';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(shortcut);
    return acc;
  }, {} as Record<string, Omit<KeyboardShortcut, 'action'>[]>);
}

// Format keyboard shortcut for display
export function formatShortcut(shortcut: Omit<KeyboardShortcut, 'action'>): string {
  const parts: string[] = [];
  const modifiers = shortcut.modifiers || [];

  if (modifiers.includes('cmd')) {
    parts.push(Platform.OS === 'ios' || Platform.OS === 'web' ? '⌘' : 'Ctrl');
  }
  if (modifiers.includes('ctrl')) {
    parts.push('Ctrl');
  }
  if (modifiers.includes('alt')) {
    parts.push(Platform.OS === 'ios' ? '⌥' : 'Alt');
  }
  if (modifiers.includes('shift')) {
    parts.push('⇧');
  }

  // Format special keys
  const keyMap: Record<string, string> = {
    'Escape': 'Esc',
    'Enter': '↵',
    'ArrowUp': '↑',
    'ArrowDown': '↓',
    'ArrowLeft': '←',
    'ArrowRight': '→',
    ' ': 'Space',
  };

  const displayKey = keyMap[shortcut.key] || shortcut.key.toUpperCase();
  parts.push(displayKey);

  return parts.join(' + ');
}
