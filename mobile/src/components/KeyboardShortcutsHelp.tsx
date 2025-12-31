import React from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Text, Portal, Modal, Divider, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import { colors } from '../theme';
import {
  DEFAULT_SHORTCUTS,
  groupShortcutsByCategory,
  formatShortcut,
} from '../hooks/useKeyboardShortcuts';
import type { KeyboardShortcut } from '../hooks/useKeyboardShortcuts';

interface KeyboardShortcutsHelpProps {
  visible: boolean;
  onDismiss: () => void;
  customShortcuts?: Omit<KeyboardShortcut, 'action'>[];
}

const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
  navigation: { label: 'Navigation', icon: 'navigation' },
  actions: { label: 'Actions', icon: 'lightning-bolt' },
  general: { label: 'General', icon: 'keyboard' },
};

export function KeyboardShortcutsHelp({
  visible,
  onDismiss,
  customShortcuts,
}: KeyboardShortcutsHelpProps) {
  const { colors: themeColors } = useAppTheme();

  const shortcuts = customShortcuts || DEFAULT_SHORTCUTS;
  const groupedShortcuts = groupShortcutsByCategory(shortcuts);

  const renderShortcutRow = (shortcut: Omit<KeyboardShortcut, 'action'>, index: number) => (
    <View key={`${shortcut.key}-${index}`} style={styles.shortcutRow}>
      <Text style={styles.shortcutDescription}>{shortcut.description}</Text>
      <View style={styles.shortcutKeys}>
        {formatShortcut(shortcut).split(' + ').map((key, i) => (
          <React.Fragment key={i}>
            {i > 0 && <Text style={styles.keySeparator}>+</Text>}
            <View style={[styles.keyBadge, { backgroundColor: themeColors.surfaceVariant }]}>
              <Text style={styles.keyText}>{key}</Text>
            </View>
          </React.Fragment>
        ))}
      </View>
    </View>
  );

  const renderCategory = (categoryKey: string) => {
    const categoryShortcuts = groupedShortcuts[categoryKey];
    if (!categoryShortcuts || categoryShortcuts.length === 0) return null;

    const categoryInfo = CATEGORY_LABELS[categoryKey] || {
      label: categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1),
      icon: 'keyboard',
    };

    return (
      <View key={categoryKey} style={styles.category}>
        <View style={styles.categoryHeader}>
          <MaterialCommunityIcons
            name={categoryInfo.icon as any}
            size={18}
            color={colors.accent}
          />
          <Text style={styles.categoryTitle}>{categoryInfo.label}</Text>
        </View>
        {categoryShortcuts.map((shortcut, index) => renderShortcutRow(shortcut, index))}
      </View>
    );
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[styles.modal, { backgroundColor: themeColors.surface }]}
      >
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <MaterialCommunityIcons
              name="keyboard"
              size={24}
              color={colors.accent}
            />
            <Text style={styles.title}>Keyboard Shortcuts</Text>
          </View>
          <IconButton
            icon="close"
            size={24}
            onPress={onDismiss}
            iconColor={colors.textMuted}
          />
        </View>

        <Text style={styles.subtitle}>
          Use these shortcuts with a connected keyboard on tablet or desktop
        </Text>

        <Divider style={styles.divider} />

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {Object.keys(CATEGORY_LABELS).map(renderCategory)}

          {/* Tip */}
          <View style={styles.tipContainer}>
            <MaterialCommunityIcons
              name="lightbulb-outline"
              size={16}
              color={colors.accent}
            />
            <Text style={styles.tipText}>
              Press <Text style={styles.tipHighlight}>?</Text> anytime to show this help
            </Text>
          </View>
        </ScrollView>

        <Pressable style={styles.closeButton} onPress={onDismiss}>
          <Text style={styles.closeButtonText}>Got it</Text>
        </Pressable>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: {
    margin: 20,
    borderRadius: 16,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  divider: {
    marginHorizontal: 20,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  category: {
    marginBottom: 24,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  shortcutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  shortcutDescription: {
    fontSize: 14,
    color: colors.textPrimary,
    flex: 1,
  },
  shortcutKeys: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  keyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    minWidth: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  keyText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
    fontFamily: 'monospace',
  },
  keySeparator: {
    fontSize: 12,
    color: colors.textMuted,
    marginHorizontal: 2,
  },
  tipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surfaceSecondary,
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  tipText: {
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
  },
  tipHighlight: {
    fontWeight: 'bold',
    color: colors.accent,
    fontFamily: 'monospace',
  },
  closeButton: {
    backgroundColor: colors.accent,
    margin: 20,
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default KeyboardShortcutsHelp;
