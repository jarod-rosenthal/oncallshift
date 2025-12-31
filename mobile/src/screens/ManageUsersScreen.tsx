import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import {
  Text,
  Card,
  FAB,
  Portal,
  Modal,
  Button,
  TextInput,
  ActivityIndicator,
  Chip,
  IconButton,
  Menu,
  Divider,
  SegmentedButtons,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import { useToast, OwnerAvatar } from '../components';
import * as apiService from '../services/apiService';
import type { User } from '../services/apiService';
import * as hapticService from '../services/hapticService';

const ROLE_OPTIONS = [
  { value: 'member', label: 'Member' },
  { value: 'admin', label: 'Admin' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

export default function ManageUsersScreen() {
  const { colors } = useAppTheme();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [menuVisible, setMenuVisible] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member');
  const [userRole, setUserRole] = useState<'member' | 'admin'>('member');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersData, profile] = await Promise.all([
        apiService.getTeamMembers(),
        apiService.getUserProfile(),
      ]);
      setUsers(usersData);
      // Find current user in users list by matching profile ID
      const current = usersData.find(u => u.id === profile.id) || null;
      setCurrentUser(current);
    } catch (error: any) {
      console.error('Failed to fetch users:', error);
      showToast({ message: 'Failed to load users', type: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, []);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      showToast({ message: 'Email is required', type: 'error' });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail.trim())) {
      showToast({ message: 'Please enter a valid email address', type: 'error' });
      return;
    }

    setSaving(true);
    try {
      await apiService.inviteUser(inviteEmail.trim().toLowerCase(), inviteRole);
      hapticService.success();
      showToast({ message: 'Invitation sent', type: 'success' });
      setShowInviteModal(false);
      resetInviteForm();
      fetchData();
    } catch (error: any) {
      console.error('Failed to invite user:', error);
      showToast({ message: error.message || 'Failed to send invitation', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateRole = async () => {
    if (!selectedUser) return;

    // Prevent changing own role
    if (selectedUser.id === currentUser?.id) {
      showToast({ message: "You cannot change your own role", type: 'error' });
      return;
    }

    setSaving(true);
    try {
      await apiService.updateUserRole(selectedUser.id, userRole);
      hapticService.success();
      showToast({ message: 'Role updated', type: 'success' });
      setShowEditModal(false);
      fetchData();
    } catch (error: any) {
      console.error('Failed to update role:', error);
      showToast({ message: error.message || 'Failed to update role', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = (user: User) => {
    if (user.id === currentUser?.id) {
      showToast({ message: "You cannot deactivate yourself", type: 'error' });
      return;
    }

    hapticService.warning();
    Alert.alert(
      'Deactivate User',
      `Are you sure you want to deactivate ${user.fullName || user.email}? They will no longer be able to access the system.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.updateUserStatus(user.id, false);
              hapticService.success();
              showToast({ message: 'User deactivated', type: 'success' });
              fetchData();
            } catch (error: any) {
              showToast({ message: error.message || 'Failed to deactivate user', type: 'error' });
            }
          },
        },
      ]
    );
  };

  const handleReactivate = async (user: User) => {
    try {
      await apiService.updateUserStatus(user.id, true);
      hapticService.success();
      showToast({ message: 'User reactivated', type: 'success' });
      fetchData();
    } catch (error: any) {
      showToast({ message: error.message || 'Failed to reactivate user', type: 'error' });
    }
  };

  const handleResendInvite = async (user: User) => {
    try {
      await apiService.inviteUser(user.email, user.role);
      hapticService.success();
      showToast({ message: 'Invitation resent', type: 'success' });
    } catch (error: any) {
      showToast({ message: error.message || 'Failed to resend invitation', type: 'error' });
    }
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setUserRole(user.role);
    setShowEditModal(true);
    setMenuVisible(null);
  };

  const resetInviteForm = () => {
    setInviteEmail('');
    setInviteRole('member');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return colors.success;
      case 'inactive':
        return colors.error;
      default:
        return colors.textMuted;
    }
  };

  const filteredUsers = users.filter((user) => {
    if (filterStatus === 'all') return true;
    return user.status === filterStatus;
  });

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text variant="bodyLarge" style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading users...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Filter Bar */}
      <View style={[styles.filterBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent}>
          <Chip
            selected={filterStatus === 'all'}
            onPress={() => setFilterStatus('all')}
            style={styles.filterChip}
          >
            All ({users.length})
          </Chip>
          <Chip
            selected={filterStatus === 'active'}
            onPress={() => setFilterStatus('active')}
            style={styles.filterChip}
          >
            Active
          </Chip>
          <Chip
            selected={filterStatus === 'inactive'}
            onPress={() => setFilterStatus('inactive')}
            style={styles.filterChip}
          >
            Inactive
          </Chip>
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
      >
        {filteredUsers.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="account-group" size={64} color={colors.textMuted} />
            <Text variant="titleMedium" style={[styles.emptyTitle, { color: colors.textSecondary }]}>
              No Users Found
            </Text>
            <Text variant="bodyMedium" style={[styles.emptyText, { color: colors.textMuted }]}>
              {filterStatus === 'all'
                ? 'Invite team members to get started.'
                : `No ${filterStatus} users found.`}
            </Text>
          </View>
        ) : (
          filteredUsers.map((user) => (
            <Card key={user.id} style={[styles.userCard, { backgroundColor: colors.surface }]}>
              <Card.Content style={styles.userContent}>
                <OwnerAvatar
                  name={user.fullName || user.email}
                  email={user.email}
                  size={48}
                />
                <View style={styles.userInfo}>
                  <View style={styles.userNameRow}>
                    <Text variant="titleMedium" style={{ color: colors.textPrimary, fontWeight: '600' }}>
                      {user.fullName || 'No Name'}
                    </Text>
                    {user.id === currentUser?.id && (
                      <Chip
                        compact
                        style={[styles.youChip, { backgroundColor: `${colors.primary}15` }]}
                        textStyle={{ color: colors.primary, fontSize: 10 }}
                      >
                        You
                      </Chip>
                    )}
                  </View>
                  <Text variant="bodySmall" style={{ color: colors.textSecondary }}>
                    {user.email}
                  </Text>
                  <View style={styles.userMeta}>
                    <Chip
                      compact
                      style={[styles.roleChip, { backgroundColor: user.role === 'admin' ? `${colors.warning}20` : `${colors.primary}15` }]}
                      textStyle={{ color: user.role === 'admin' ? colors.warning : colors.primary, fontSize: 11 }}
                    >
                      {user.role}
                    </Chip>
                    <View style={styles.statusBadge}>
                      <View style={[styles.statusDot, { backgroundColor: getStatusColor((user as any).status || 'active') }]} />
                      <Text variant="labelSmall" style={{ color: colors.textMuted }}>
                        {(user as any).status || 'active'}
                      </Text>
                    </View>
                  </View>
                </View>
                <Menu
                  visible={menuVisible === user.id}
                  onDismiss={() => setMenuVisible(null)}
                  anchor={
                    <IconButton
                      icon="dots-vertical"
                      size={20}
                      onPress={() => setMenuVisible(user.id)}
                    />
                  }
                >
                  <Menu.Item
                    onPress={() => openEditModal(user)}
                    title="Change Role"
                    leadingIcon="shield-account"
                    disabled={user.id === currentUser?.id}
                  />
                  <Divider />
                  {user.status === 'inactive' ? (
                    <Menu.Item
                      onPress={() => {
                        setMenuVisible(null);
                        handleReactivate(user);
                      }}
                      title="Reactivate"
                      leadingIcon="account-check"
                      titleStyle={{ color: colors.success }}
                    />
                  ) : (
                    <Menu.Item
                      onPress={() => {
                        setMenuVisible(null);
                        handleDeactivate(user);
                      }}
                      title="Deactivate"
                      leadingIcon="account-off"
                      titleStyle={{ color: colors.error }}
                      disabled={user.id === currentUser?.id}
                    />
                  )}
                </Menu>
              </Card.Content>
            </Card>
          ))
        )}
      </ScrollView>

      <FAB
        icon="account-plus"
        style={[styles.fab, { backgroundColor: colors.primary }]}
        color="#fff"
        onPress={() => {
          hapticService.lightTap();
          setShowInviteModal(true);
        }}
      />

      {/* Invite Modal */}
      <Portal>
        <Modal
          visible={showInviteModal}
          onDismiss={() => {
            setShowInviteModal(false);
            resetInviteForm();
          }}
          contentContainerStyle={[styles.modal, { backgroundColor: colors.surface }]}
        >
          <Text variant="titleLarge" style={[styles.modalTitle, { color: colors.textPrimary }]}>
            Invite User
          </Text>
          <Text variant="bodyMedium" style={{ color: colors.textSecondary, marginBottom: 16 }}>
            Send an invitation email to a new team member.
          </Text>
          <TextInput
            label="Email Address"
            value={inviteEmail}
            onChangeText={setInviteEmail}
            mode="outlined"
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
          />
          <Text variant="labelMedium" style={{ color: colors.textSecondary, marginBottom: 8 }}>
            Role
          </Text>
          <SegmentedButtons
            value={inviteRole}
            onValueChange={(value) => setInviteRole(value as 'member' | 'admin')}
            buttons={ROLE_OPTIONS}
            style={styles.segmentedButtons}
          />
          <View style={styles.roleDescription}>
            {inviteRole === 'admin' ? (
              <View style={styles.roleInfo}>
                <MaterialCommunityIcons name="shield-account" size={20} color={colors.warning} />
                <Text variant="bodySmall" style={{ color: colors.textSecondary, marginLeft: 8, flex: 1 }}>
                  Admins can manage users, services, schedules, and escalation policies.
                </Text>
              </View>
            ) : (
              <View style={styles.roleInfo}>
                <MaterialCommunityIcons name="account" size={20} color={colors.primary} />
                <Text variant="bodySmall" style={{ color: colors.textSecondary, marginLeft: 8, flex: 1 }}>
                  Users can acknowledge/resolve incidents and view schedules.
                </Text>
              </View>
            )}
          </View>
          <View style={styles.modalActions}>
            <Button
              mode="text"
              onPress={() => {
                setShowInviteModal(false);
                resetInviteForm();
              }}
            >
              Cancel
            </Button>
            <Button mode="contained" onPress={handleInvite} loading={saving} disabled={saving}>
              Send Invite
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* Edit Role Modal */}
      <Portal>
        <Modal
          visible={showEditModal}
          onDismiss={() => setShowEditModal(false)}
          contentContainerStyle={[styles.modal, { backgroundColor: colors.surface }]}
        >
          <Text variant="titleLarge" style={[styles.modalTitle, { color: colors.textPrimary }]}>
            Change Role
          </Text>
          <View style={styles.selectedUserInfo}>
            <OwnerAvatar
              name={selectedUser?.fullName || selectedUser?.email || ''}
              email={selectedUser?.email}
              size={40}
            />
            <View style={{ marginLeft: 12 }}>
              <Text variant="bodyLarge" style={{ color: colors.textPrimary }}>
                {selectedUser?.fullName || 'No Name'}
              </Text>
              <Text variant="bodySmall" style={{ color: colors.textSecondary }}>
                {selectedUser?.email}
              </Text>
            </View>
          </View>
          <SegmentedButtons
            value={userRole}
            onValueChange={(value) => setUserRole(value as 'member' | 'admin')}
            buttons={ROLE_OPTIONS}
            style={styles.segmentedButtons}
          />
          <View style={styles.modalActions}>
            <Button mode="text" onPress={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button mode="contained" onPress={handleUpdateRole} loading={saving} disabled={saving}>
              Update Role
            </Button>
          </View>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
  },
  filterBar: {
    borderBottomWidth: 1,
  },
  filterContent: {
    padding: 12,
    gap: 8,
  },
  filterChip: {
    marginRight: 4,
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyTitle: {
    marginTop: 16,
    fontWeight: '600',
  },
  emptyText: {
    marginTop: 8,
    textAlign: 'center',
  },
  userCard: {
    marginBottom: 12,
    borderRadius: 12,
  },
  userContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  youChip: {
    borderRadius: 4,
  },
  userMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  roleChip: {
    borderRadius: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
  modal: {
    margin: 20,
    padding: 24,
    borderRadius: 16,
  },
  modalTitle: {
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    marginBottom: 16,
  },
  segmentedButtons: {
    marginBottom: 16,
  },
  roleDescription: {
    marginBottom: 16,
  },
  roleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 8,
  },
  selectedUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 8,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
});
