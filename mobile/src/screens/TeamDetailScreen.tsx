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
  List,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useAppTheme } from '../context/ThemeContext';
import { colors } from '../theme';
import { useToast, OwnerAvatar } from '../components';
import * as apiService from '../services/apiService';
import type { Team, TeamMember, User, UserProfile } from '../services/apiService';
import * as hapticService from '../services/hapticService';

type RouteParams = {
  TeamDetail: { teamId: string };
};

type NavigationProp = StackNavigationProp<any>;

const ROLE_OPTIONS = [
  { value: 'member', label: 'Member' },
  { value: 'manager', label: 'Manager' },
];

export default function TeamDetailScreen() {
  const route = useRoute<RouteProp<RouteParams, 'TeamDetail'>>();
  const navigation = useNavigation<NavigationProp>();
  const { teamId } = route.params;
  const { colors } = useAppTheme();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [team, setTeam] = useState<Team | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'members' | 'resources'>('members');

  // Modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [menuVisible, setMenuVisible] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<'manager' | 'member'>('member');

  useEffect(() => {
    fetchData();
  }, [teamId]);

  const fetchData = async () => {
    try {
      const [teamData, usersData, profile] = await Promise.all([
        apiService.getTeam(teamId),
        apiService.getUsers(),
        apiService.getUserProfile(),
      ]);
      setTeam(teamData);
      setAllUsers(usersData);
      setCurrentUser(profile);
      setTeamName(teamData.name);
      setTeamDescription(teamData.description || '');
    } catch (error: any) {
      console.error('Failed to fetch team:', error);
      showToast({ message: 'Failed to load team', type: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [teamId]);

  const handleUpdateTeam = async () => {
    if (!teamName.trim()) {
      showToast({ message: 'Team name is required', type: 'error' });
      return;
    }

    setSaving(true);
    try {
      await apiService.updateTeam(teamId, {
        name: teamName.trim(),
        description: teamDescription.trim() || undefined,
      });
      hapticService.success();
      showToast({ message: 'Team updated', type: 'success' });
      setShowEditModal(false);
      fetchData();
    } catch (error: any) {
      console.error('Failed to update team:', error);
      showToast({ message: error.response?.data?.error || 'Failed to update team', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleAddMember = async () => {
    if (!selectedUserId) {
      showToast({ message: 'Please select a user', type: 'error' });
      return;
    }

    setSaving(true);
    try {
      await apiService.addTeamMember(teamId, selectedUserId, selectedRole);
      hapticService.success();
      showToast({ message: 'Member added', type: 'success' });
      setShowAddMemberModal(false);
      setSelectedUserId('');
      setSelectedRole('member');
      fetchData();
    } catch (error: any) {
      console.error('Failed to add member:', error);
      showToast({ message: error.response?.data?.error || 'Failed to add member', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateRole = async () => {
    if (!selectedMember) return;

    setSaving(true);
    try {
      await apiService.updateTeamMemberRole(teamId, selectedMember.userId, selectedRole);
      hapticService.success();
      showToast({ message: 'Role updated', type: 'success' });
      setShowRoleModal(false);
      setSelectedMember(null);
      fetchData();
    } catch (error: any) {
      console.error('Failed to update role:', error);
      showToast({ message: error.response?.data?.error || 'Failed to update role', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMember = (member: TeamMember) => {
    hapticService.warning();
    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${member.user?.fullName || member.user?.email} from this team?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.removeTeamMember(teamId, member.userId);
              hapticService.success();
              showToast({ message: 'Member removed', type: 'success' });
              fetchData();
            } catch (error: any) {
              showToast({ message: error.response?.data?.error || 'Failed to remove member', type: 'error' });
            }
          },
        },
      ]
    );
  };

  const openRoleModal = (member: TeamMember) => {
    setSelectedMember(member);
    setSelectedRole(member.role);
    setShowRoleModal(true);
    setMenuVisible(null);
  };

  // Filter users who are not already members
  const availableUsers = allUsers.filter(
    (user) => !team?.members.some((m) => m.userId === user.id)
  );

  const isAdmin = currentUser?.role === 'admin';

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text variant="bodyLarge" style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading team...
        </Text>
      </View>
    );
  }

  if (!team) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <MaterialCommunityIcons name="alert-circle" size={64} color={colors.error} />
        <Text variant="titleMedium" style={{ color: colors.textPrimary, marginTop: 16 }}>
          Team not found
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Team Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerContent}>
          <View style={[styles.teamIcon, { backgroundColor: `${colors.primary}15` }]}>
            <MaterialCommunityIcons name="account-group" size={32} color={colors.primary} />
          </View>
          <View style={styles.headerInfo}>
            <Text variant="titleLarge" style={{ color: colors.textPrimary, fontWeight: '600' }}>
              {team.name}
            </Text>
            {team.description && (
              <Text variant="bodyMedium" style={{ color: colors.textSecondary, marginTop: 2 }}>
                {team.description}
              </Text>
            )}
            <Chip
              compact
              icon="account-multiple"
              style={[styles.memberChip, { backgroundColor: `${colors.primary}15` }]}
              textStyle={{ color: colors.primary, fontSize: 11 }}
            >
              {team.memberCount} {team.memberCount === 1 ? 'member' : 'members'}
            </Chip>
          </View>
          {isAdmin && (
            <IconButton
              icon="pencil"
              size={20}
              onPress={() => setShowEditModal(true)}
            />
          )}
        </View>
      </View>

      {/* Tab Bar */}
      <View style={[styles.tabBar, { backgroundColor: colors.surface }]}>
        <SegmentedButtons
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as 'members' | 'resources')}
          buttons={[
            { value: 'members', label: 'Members', icon: 'account-multiple' },
            { value: 'resources', label: 'Resources', icon: 'folder' },
          ]}
          style={styles.segmentedButtons}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
      >
        {activeTab === 'members' ? (
          <>
            {/* Add Member Button */}
            {isAdmin && (
              <Button
                mode="outlined"
                icon="account-plus"
                onPress={() => setShowAddMemberModal(true)}
                style={styles.addButton}
                disabled={availableUsers.length === 0}
              >
                Add Member
              </Button>
            )}

            {/* Members List */}
            {team.members.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="account-group-outline" size={48} color={colors.textMuted} />
                <Text variant="bodyMedium" style={{ color: colors.textSecondary, marginTop: 12 }}>
                  No members yet
                </Text>
              </View>
            ) : (
              team.members.map((member) => (
                <Card key={member.id} style={[styles.memberCard, { backgroundColor: colors.surface }]}>
                  <Card.Content style={styles.memberContent}>
                    <OwnerAvatar
                      name={member.user?.fullName || member.user?.email || '?'}
                      email={member.user?.email}
                      size={44}
                    />
                    <View style={styles.memberInfo}>
                      <Text variant="titleMedium" style={{ color: colors.textPrimary, fontWeight: '500' }}>
                        {member.user?.fullName || 'Unknown'}
                      </Text>
                      <Text variant="bodySmall" style={{ color: colors.textSecondary }}>
                        {member.user?.email}
                      </Text>
                      <Chip
                        compact
                        style={[
                          styles.roleChip,
                          {
                            backgroundColor:
                              member.role === 'manager' ? `${colors.warning}20` : `${colors.primary}15`,
                          },
                        ]}
                        textStyle={{
                          color: member.role === 'manager' ? colors.warning : colors.primary,
                          fontSize: 10,
                        }}
                      >
                        {member.role}
                      </Chip>
                    </View>
                    {isAdmin && (
                      <Menu
                        visible={menuVisible === member.id}
                        onDismiss={() => setMenuVisible(null)}
                        anchor={
                          <IconButton
                            icon="dots-vertical"
                            size={20}
                            onPress={() => setMenuVisible(member.id)}
                          />
                        }
                      >
                        <Menu.Item
                          onPress={() => openRoleModal(member)}
                          title="Change Role"
                          leadingIcon="shield-account"
                        />
                        <Divider />
                        <Menu.Item
                          onPress={() => {
                            setMenuVisible(null);
                            handleRemoveMember(member);
                          }}
                          title="Remove"
                          leadingIcon="account-remove"
                          titleStyle={{ color: colors.error }}
                        />
                      </Menu>
                    )}
                  </Card.Content>
                </Card>
              ))
            )}
          </>
        ) : (
          <>
            {/* Resources Tab */}
            {team.resources ? (
              <>
                {/* Services */}
                <Text variant="titleMedium" style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  Services
                </Text>
                {team.resources.services.length === 0 ? (
                  <Text variant="bodyMedium" style={{ color: colors.textMuted, marginBottom: 16 }}>
                    No services assigned
                  </Text>
                ) : (
                  team.resources.services.map((service) => (
                    <List.Item
                      key={service.id}
                      title={service.name}
                      left={(props) => <List.Icon {...props} icon="cog" />}
                      style={[styles.resourceItem, { backgroundColor: colors.surface }]}
                    />
                  ))
                )}

                {/* Schedules */}
                <Text variant="titleMedium" style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  Schedules
                </Text>
                {team.resources.schedules.length === 0 ? (
                  <Text variant="bodyMedium" style={{ color: colors.textMuted, marginBottom: 16 }}>
                    No schedules assigned
                  </Text>
                ) : (
                  team.resources.schedules.map((schedule) => (
                    <List.Item
                      key={schedule.id}
                      title={schedule.name}
                      left={(props) => <List.Icon {...props} icon="calendar" />}
                      style={[styles.resourceItem, { backgroundColor: colors.surface }]}
                    />
                  ))
                )}

                {/* Escalation Policies */}
                <Text variant="titleMedium" style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  Escalation Policies
                </Text>
                {team.resources.escalationPolicies.length === 0 ? (
                  <Text variant="bodyMedium" style={{ color: colors.textMuted, marginBottom: 16 }}>
                    No escalation policies assigned
                  </Text>
                ) : (
                  team.resources.escalationPolicies.map((policy) => (
                    <List.Item
                      key={policy.id}
                      title={policy.name}
                      left={(props) => <List.Icon {...props} icon="arrow-up-bold" />}
                      style={[styles.resourceItem, { backgroundColor: colors.surface }]}
                    />
                  ))
                )}
              </>
            ) : (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="folder-outline" size={48} color={colors.textMuted} />
                <Text variant="bodyMedium" style={{ color: colors.textSecondary, marginTop: 12 }}>
                  No resources assigned
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Edit Team Modal */}
      <Portal>
        <Modal
          visible={showEditModal}
          onDismiss={() => setShowEditModal(false)}
          contentContainerStyle={[styles.modal, { backgroundColor: colors.surface }]}
        >
          <Text variant="titleLarge" style={[styles.modalTitle, { color: colors.textPrimary }]}>
            Edit Team
          </Text>
          <TextInput
            label="Team Name"
            value={teamName}
            onChangeText={setTeamName}
            mode="outlined"
            style={styles.input}
          />
          <TextInput
            label="Description (optional)"
            value={teamDescription}
            onChangeText={setTeamDescription}
            mode="outlined"
            style={styles.input}
            multiline
            numberOfLines={2}
          />
          <View style={styles.modalActions}>
            <Button mode="text" onPress={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button mode="contained" onPress={handleUpdateTeam} loading={saving} disabled={saving}>
              Save
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* Add Member Modal */}
      <Portal>
        <Modal
          visible={showAddMemberModal}
          onDismiss={() => {
            setShowAddMemberModal(false);
            setSelectedUserId('');
            setSelectedRole('member');
          }}
          contentContainerStyle={[styles.modal, { backgroundColor: colors.surface }]}
        >
          <Text variant="titleLarge" style={[styles.modalTitle, { color: colors.textPrimary }]}>
            Add Member
          </Text>
          <Text variant="labelMedium" style={{ color: colors.textSecondary, marginBottom: 8 }}>
            Select User
          </Text>
          <ScrollView style={styles.userList}>
            {availableUsers.map((user) => (
              <Card
                key={user.id}
                style={[
                  styles.userCard,
                  {
                    backgroundColor: selectedUserId === user.id ? `${colors.primary}15` : colors.background,
                    borderColor: selectedUserId === user.id ? colors.primary : 'transparent',
                    borderWidth: selectedUserId === user.id ? 1 : 0,
                  },
                ]}
                onPress={() => setSelectedUserId(user.id)}
              >
                <Card.Content style={styles.userCardContent}>
                  <OwnerAvatar name={user.fullName || user.email} email={user.email} size={36} />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text variant="bodyMedium" style={{ color: colors.textPrimary }}>
                      {user.fullName || 'No Name'}
                    </Text>
                    <Text variant="bodySmall" style={{ color: colors.textSecondary }}>
                      {user.email}
                    </Text>
                  </View>
                  {selectedUserId === user.id && (
                    <MaterialCommunityIcons name="check-circle" size={24} color={colors.primary} />
                  )}
                </Card.Content>
              </Card>
            ))}
          </ScrollView>
          <Text variant="labelMedium" style={{ color: colors.textSecondary, marginTop: 16, marginBottom: 8 }}>
            Role
          </Text>
          <SegmentedButtons
            value={selectedRole}
            onValueChange={(value) => setSelectedRole(value as 'manager' | 'member')}
            buttons={ROLE_OPTIONS}
            style={styles.segmentedButtons}
          />
          <View style={styles.modalActions}>
            <Button
              mode="text"
              onPress={() => {
                setShowAddMemberModal(false);
                setSelectedUserId('');
                setSelectedRole('member');
              }}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleAddMember}
              loading={saving}
              disabled={saving || !selectedUserId}
            >
              Add
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* Change Role Modal */}
      <Portal>
        <Modal
          visible={showRoleModal}
          onDismiss={() => {
            setShowRoleModal(false);
            setSelectedMember(null);
          }}
          contentContainerStyle={[styles.modal, { backgroundColor: colors.surface }]}
        >
          <Text variant="titleLarge" style={[styles.modalTitle, { color: colors.textPrimary }]}>
            Change Role
          </Text>
          {selectedMember && (
            <View style={styles.selectedUserInfo}>
              <OwnerAvatar
                name={selectedMember.user?.fullName || selectedMember.user?.email || '?'}
                email={selectedMember.user?.email}
                size={40}
              />
              <View style={{ marginLeft: 12 }}>
                <Text variant="bodyLarge" style={{ color: colors.textPrimary }}>
                  {selectedMember.user?.fullName || 'Unknown'}
                </Text>
                <Text variant="bodySmall" style={{ color: colors.textSecondary }}>
                  {selectedMember.user?.email}
                </Text>
              </View>
            </View>
          )}
          <SegmentedButtons
            value={selectedRole}
            onValueChange={(value) => setSelectedRole(value as 'manager' | 'member')}
            buttons={ROLE_OPTIONS}
            style={styles.segmentedButtons}
          />
          <View style={styles.roleDescription}>
            {selectedRole === 'manager' ? (
              <View style={styles.roleInfo}>
                <MaterialCommunityIcons name="shield-account" size={20} color={colors.warning} />
                <Text variant="bodySmall" style={{ color: colors.textSecondary, marginLeft: 8, flex: 1 }}>
                  Managers can add/remove team members and manage team resources.
                </Text>
              </View>
            ) : (
              <View style={styles.roleInfo}>
                <MaterialCommunityIcons name="account" size={20} color={colors.primary} />
                <Text variant="bodySmall" style={{ color: colors.textSecondary, marginLeft: 8, flex: 1 }}>
                  Members can view team resources and participate in on-call rotations.
                </Text>
              </View>
            )}
          </View>
          <View style={styles.modalActions}>
            <Button
              mode="text"
              onPress={() => {
                setShowRoleModal(false);
                setSelectedMember(null);
              }}
            >
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
  header: {
    padding: 16,
    borderBottomWidth: 1,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  memberChip: {
    alignSelf: 'flex-start',
    marginTop: 8,
    borderRadius: 4,
  },
  tabBar: {
    padding: 12,
  },
  segmentedButtons: {
    marginBottom: 0,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  addButton: {
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  memberCard: {
    marginBottom: 8,
    borderRadius: 12,
  },
  memberContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  roleChip: {
    alignSelf: 'flex-start',
    marginTop: 4,
    borderRadius: 4,
  },
  sectionTitle: {
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 12,
  },
  resourceItem: {
    marginBottom: 4,
    borderRadius: 8,
  },
  modal: {
    margin: 20,
    padding: 24,
    borderRadius: 16,
    maxHeight: '80%',
  },
  modalTitle: {
    fontWeight: '600',
    marginBottom: 16,
  },
  input: {
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  userList: {
    maxHeight: 200,
  },
  userCard: {
    marginBottom: 8,
    borderRadius: 8,
  },
  userCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  selectedUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 8,
  },
  roleDescription: {
    marginTop: 16,
    marginBottom: 8,
  },
  roleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 8,
  },
});
