import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import { useAppTheme } from '../context/ThemeContext';

const formatDistanceToNow = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

interface HandoffNote {
  id: string;
  content: string;
  shiftEndTime: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  fromUser: {
    id: string;
    fullName: string | null;
    email: string;
  } | null;
  toUser: {
    id: string;
    fullName: string | null;
    email: string;
  } | null;
  isForMe: boolean;
}

interface ShiftHandoffNotesProps {
  scheduleId: string;
  scheduleName?: string;
  compact?: boolean;
  showCreateButton?: boolean;
}

export function ShiftHandoffNotes({
  scheduleId,
  scheduleName,
  compact = false,
  showCreateButton = true,
}: ShiftHandoffNotesProps) {
  const { colors } = useAppTheme();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState('');

  // Dynamic styles based on theme
  const themedStyles = {
    container: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: '600' as const,
      color: colors.textPrimary,
    },
    noteCard: {
      backgroundColor: colors.background,
      borderRadius: 8,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    noteCardUnread: {
      backgroundColor: colors.warning + '20',
      borderColor: colors.warning,
    },
    authorName: {
      fontSize: 14,
      fontWeight: '500' as const,
      color: colors.textPrimary,
    },
    noteTime: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    noteContent: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    emptyText: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 8,
    },
    emptySubtext: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 4,
      textAlign: 'center' as const,
    },
    modalContainer: {
      flex: 1,
      backgroundColor: colors.background,
    },
    modalHeader: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'center' as const,
      padding: 16,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: 17,
      fontWeight: '600' as const,
      color: colors.textPrimary,
    },
    modalCancel: {
      fontSize: 16,
      color: colors.textSecondary,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '600' as const,
      color: colors.textSecondary,
      marginBottom: 12,
      textTransform: 'uppercase' as const,
    },
    createSection: {
      padding: 16,
      backgroundColor: colors.surface,
      margin: 16,
      borderRadius: 12,
    },
    noteInput: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      fontSize: 15,
      color: colors.textPrimary,
      minHeight: 120,
    },
    charCount: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: 'right' as const,
      marginTop: 4,
    },
  };

  // Fetch handoff notes
  const { data, isLoading, error } = useQuery({
    queryKey: ['handoff-notes', scheduleId],
    queryFn: async () => {
      const response = await apiClient.get(`/schedules/${scheduleId}/handoff-notes`);
      return response.data;
    },
    enabled: !!scheduleId,
  });

  // Mark note as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (noteId: string) => {
      await apiClient.put(`/schedules/${scheduleId}/handoff-notes/${noteId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['handoff-notes', scheduleId] });
    },
  });

  // Create note mutation
  const createNoteMutation = useMutation({
    mutationFn: async (content: string) => {
      await apiClient.post(`/schedules/${scheduleId}/handoff-notes`, {
        content,
        shiftEndTime: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['handoff-notes', scheduleId] });
      setNewNoteContent('');
      setShowModal(false);
    },
    onError: () => {
      Alert.alert('Error', 'Failed to create handoff note');
    },
  });

  // Delete note mutation
  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      await apiClient.delete(`/schedules/${scheduleId}/handoff-notes/${noteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['handoff-notes', scheduleId] });
    },
  });

  const handleMarkAsRead = useCallback((noteId: string) => {
    markAsReadMutation.mutate(noteId);
  }, [markAsReadMutation]);

  const handleCreateNote = useCallback(() => {
    if (newNoteContent.trim()) {
      createNoteMutation.mutate(newNoteContent.trim());
    }
  }, [newNoteContent, createNoteMutation]);

  const handleDeleteNote = useCallback((noteId: string) => {
    Alert.alert(
      'Delete Note',
      'Are you sure you want to delete this note?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteNoteMutation.mutate(noteId),
        },
      ]
    );
  }, [deleteNoteMutation]);

  const notes: HandoffNote[] = data?.notes || [];
  const unreadCount = data?.unreadCount || 0;
  const unreadNotes = notes.filter(n => !n.isRead && n.isForMe);

  if (isLoading) {
    return (
      <View style={[themedStyles.container, compact && styles.containerCompact]}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (error || !data) {
    return null;
  }

  // Compact view - just show badge if there are unread notes
  if (compact) {
    if (unreadCount === 0) return null;

    return (
      <TouchableOpacity
        style={[styles.compactContainer, { backgroundColor: colors.warning + '20' }]}
        onPress={() => setShowModal(true)}
      >
        <Ionicons name="document-text" size={18} color={colors.warning} />
        <Text style={[styles.compactText, { color: colors.warning }]}>
          {unreadCount} handoff note{unreadCount !== 1 ? 's' : ''} from previous shift
        </Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </TouchableOpacity>
    );
  }

  // Full view
  const renderNote = ({ item }: { item: HandoffNote }) => {
    const fromName = item.fromUser?.fullName || item.fromUser?.email || 'Unknown';
    const timeAgo = formatDistanceToNow(new Date(item.createdAt));

    return (
      <View style={[themedStyles.noteCard, !item.isRead && themedStyles.noteCardUnread]}>
        <View style={styles.noteHeader}>
          <View style={styles.noteAuthor}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarText}>
                {fromName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={themedStyles.authorName}>{fromName}</Text>
              <Text style={themedStyles.noteTime}>{timeAgo}</Text>
            </View>
          </View>
          {!item.isRead && item.isForMe && (
            <View style={[styles.unreadBadge, { backgroundColor: colors.warning }]}>
              <Text style={styles.unreadBadgeText}>New</Text>
            </View>
          )}
        </View>

        <Text style={themedStyles.noteContent}>{item.content}</Text>

        <View style={styles.noteActions}>
          {!item.isRead && item.isForMe && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleMarkAsRead(item.id)}
            >
              <Ionicons name="checkmark-circle-outline" size={18} color={colors.primary} />
              <Text style={[styles.actionButtonText, { color: colors.primary }]}>Mark as read</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={themedStyles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="document-text" size={20} color={colors.primary} />
          <Text style={themedStyles.headerTitle}>Shift Handoff Notes</Text>
          {unreadCount > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.error }]}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        {showCreateButton && (
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: colors.primary }]}
            onPress={() => setShowModal(true)}
          >
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {notes.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="document-text-outline" size={32} color={colors.textMuted} />
          <Text style={themedStyles.emptyText}>No handoff notes</Text>
          <Text style={themedStyles.emptySubtext}>
            Leave notes for the next person on-call
          </Text>
        </View>
      ) : (
        <FlatList
          data={notes}
          renderItem={renderNote}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}

      {/* Create Note Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={themedStyles.modalContainer}>
          <View style={themedStyles.modalHeader}>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Text style={themedStyles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={themedStyles.modalTitle}>
              {unreadNotes.length > 0 ? 'Handoff Notes' : 'New Handoff Note'}
            </Text>
            <TouchableOpacity
              onPress={handleCreateNote}
              disabled={!newNoteContent.trim() || createNoteMutation.isPending}
            >
              <Text
                style={[
                  styles.modalSave,
                  { color: colors.primary },
                  (!newNoteContent.trim() || createNoteMutation.isPending) && { color: colors.textMuted },
                ]}
              >
                {createNoteMutation.isPending ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Show unread notes first */}
          {unreadNotes.length > 0 && (
            <View style={styles.unreadSection}>
              <Text style={themedStyles.sectionTitle}>From Previous Shift</Text>
              <FlatList
                data={unreadNotes}
                renderItem={renderNote}
                keyExtractor={(item) => item.id}
                ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                style={styles.unreadList}
              />
            </View>
          )}

          {/* Create new note */}
          <View style={themedStyles.createSection}>
            <Text style={themedStyles.sectionTitle}>Leave a Note for Next Shift</Text>
            <TextInput
              style={themedStyles.noteInput}
              placeholder="What should the next person know? (ongoing issues, context, tips...)"
              placeholderTextColor={colors.textMuted}
              value={newNoteContent}
              onChangeText={setNewNoteContent}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={2000}
            />
            <Text style={themedStyles.charCount}>
              {newNoteContent.length}/2000
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  containerCompact: {
    padding: 8,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  compactText: {
    flex: 1,
    fontSize: 14,
    color: '#92400e',
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  badge: {
    backgroundColor: '#ef4444',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: '#6366f1',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
  },
  emptySubtext: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
    textAlign: 'center',
  },
  noteCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  noteCardUnread: {
    backgroundColor: '#fef3c7',
    borderColor: '#fcd34d',
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  noteAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  authorName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  noteTime: {
    fontSize: 12,
    color: '#6b7280',
  },
  unreadBadge: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  noteContent: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  noteActions: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionButtonText: {
    fontSize: 13,
    color: '#6366f1',
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
  },
  modalCancel: {
    fontSize: 16,
    color: '#6b7280',
  },
  modalSave: {
    fontSize: 16,
    color: '#6366f1',
    fontWeight: '600',
  },
  modalSaveDisabled: {
    color: '#9ca3af',
  },
  unreadSection: {
    padding: 16,
    maxHeight: '40%',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  unreadList: {
    flexGrow: 0,
  },
  createSection: {
    padding: 16,
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
  },
  noteInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#111827',
    minHeight: 120,
  },
  charCount: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'right',
    marginTop: 4,
  },
});

export default ShiftHandoffNotes;
