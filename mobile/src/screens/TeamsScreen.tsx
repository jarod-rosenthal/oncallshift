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
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useAppTheme } from '../context/ThemeContext';
import { colors } from '../theme';
import { useToast, OwnerAvatar } from '../components';
import * as apiService from '../services/apiService';
import type { Team, UserProfile } from '../services/apiService';
import * as hapticService from '../services/hapticService';

type NavigationProp = StackNavigationProp<any>;

export default function TeamsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { colors } = useAppTheme();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [menuVisible, setMenuVisible] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  // Form state
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [teamsData, profile] = await Promise.all([
        apiService.getTeams(),
        apiService.getUserProfile(),
      ]);
      setTeams(teamsData);
      setCurrentUser(profile);
    } catch (error: any) {
      showToast({ message: 'Failed to load teams', type: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, []);

  const handleCreateTeam = async () => {
    if (!teamName.trim()) {
      showToast({ message: 'Team name is required', type: 'error' });
      return;
    }

    setSaving(true);
    try {
      await apiService.createTeam({
        name: teamName.trim(),
        description: teamDescription.trim() || undefined,
      });
      hapticService.success();
      showToast({ message: 'Team created', type: 'success' });
      setShowCreateModal(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      showToast({ message: error.response?.data?.error || 'Failed to create team', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTeam = (team: Team) => {
    hapticService.warning();
    Alert.alert(
      'Delete Team',
      `Are you sure you want to delete "${team.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.deleteTeam(team.id);
              hapticService.success();
              showToast({ message: 'Team deleted', type: 'success' });
              fetchData();
            } catch (error: any) {
              showToast({ message: error.response?.data?.error || 'Failed to delete team', type: 'error' });
            }
          },
        },
      ]
    );
  };

  const resetForm = () => {
    setTeamName('');
    setTeamDescription('');
  };

  const isAdmin = currentUser?.role === 'admin';

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text variant="bodyLarge" style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading teams...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
      >
        {teams.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="account-group" size={64} color={colors.textMuted} />
            <Text variant="titleMedium" style={[styles.emptyTitle, { color: colors.textSecondary }]}>
              No Teams Yet
            </Text>
            <Text variant="bodyMedium" style={[styles.emptyText, { color: colors.textMuted }]}>
              Create teams to organize your users and resources.
            </Text>
            {isAdmin && (
              <Button
                mode="contained"
                onPress={() => {
                  hapticService.lightTap();
                  setShowCreateModal(true);
                }}
                style={styles.emptyButton}
              >
                Create First Team
              </Button>
            )}
          </View>
        ) : (
          teams.map((team) => (
            <Card
              key={team.id}
              style={[styles.teamCard, { backgroundColor: colors.surface }]}
              onPress={() => navigation.navigate('TeamDetail', { teamId: team.id })}
            >
              <Card.Content style={styles.teamContent}>
                <View style={styles.teamIcon}>
                  <MaterialCommunityIcons name="account-group" size={32} color={colors.primary} />
                </View>
                <View style={styles.teamInfo}>
                  <Text variant="titleMedium" style={{ color: colors.textPrimary, fontWeight: '600' }}>
                    {team.name}
                  </Text>
                  {team.description && (
                    <Text
                      variant="bodySmall"
                      style={{ color: colors.textSecondary, marginTop: 2 }}
                      numberOfLines={1}
                    >
                      {team.description}
                    </Text>
                  )}
                  <View style={styles.teamMeta}>
                    <Chip
                      compact
                      icon="account-multiple"
                      style={[styles.metaChip, { backgroundColor: `${colors.primary}15` }]}
                      textStyle={{ color: colors.primary, fontSize: 11 }}
                    >
                      {team.memberCount} {team.memberCount === 1 ? 'member' : 'members'}
                    </Chip>
                    {team.members && team.members.length > 0 && (
                      <View style={styles.memberPreview}>
                        {team.members.slice(0, 3).map((member, index) => (
                          <View
                            key={member.id}
                            style={[
                              styles.memberAvatarWrapper,
                              { marginLeft: index > 0 ? -8 : 0, zIndex: 3 - index },
                            ]}
                          >
                            <OwnerAvatar
                              name={member.user?.fullName || member.user?.email || '?'}
                              email={member.user?.email}
                              size={24}
                            />
                          </View>
                        ))}
                        {team.memberCount > 3 && (
                          <Text variant="labelSmall" style={{ color: colors.textMuted, marginLeft: 4 }}>
                            +{team.memberCount - 3}
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                </View>
                {isAdmin && (
                  <Menu
                    visible={menuVisible === team.id}
                    onDismiss={() => setMenuVisible(null)}
                    anchor={
                      <IconButton
                        icon="dots-vertical"
                        size={20}
                        onPress={() => setMenuVisible(team.id)}
                      />
                    }
                  >
                    <Menu.Item
                      onPress={() => {
                        setMenuVisible(null);
                        navigation.navigate('TeamDetail', { teamId: team.id });
                      }}
                      title="View Details"
                      leadingIcon="eye"
                    />
                    <Divider />
                    <Menu.Item
                      onPress={() => {
                        setMenuVisible(null);
                        handleDeleteTeam(team);
                      }}
                      title="Delete"
                      leadingIcon="delete"
                      titleStyle={{ color: colors.error }}
                    />
                  </Menu>
                )}
              </Card.Content>
            </Card>
          ))
        )}
      </ScrollView>

      {isAdmin && (
        <FAB
          icon="plus"
          style={[styles.fab, { backgroundColor: colors.primary }]}
          color="#fff"
          onPress={() => {
            hapticService.lightTap();
            setShowCreateModal(true);
          }}
        />
      )}

      {/* Create Team Modal */}
      <Portal>
        <Modal
          visible={showCreateModal}
          onDismiss={() => {
            setShowCreateModal(false);
            resetForm();
          }}
          contentContainerStyle={[styles.modal, { backgroundColor: colors.surface }]}
        >
          <Text variant="titleLarge" style={[styles.modalTitle, { color: colors.textPrimary }]}>
            Create Team
          </Text>
          <Text variant="bodyMedium" style={{ color: colors.textSecondary, marginBottom: 16 }}>
            Teams help you organize users and resources together.
          </Text>
          <TextInput
            label="Team Name"
            value={teamName}
            onChangeText={setTeamName}
            mode="outlined"
            style={styles.input}
            autoFocus
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
            <Button
              mode="text"
              onPress={() => {
                setShowCreateModal(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button mode="contained" onPress={handleCreateTeam} loading={saving} disabled={saving}>
              Create Team
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
  emptyButton: {
    marginTop: 24,
  },
  teamCard: {
    marginBottom: 12,
    borderRadius: 12,
  },
  teamContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teamIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamInfo: {
    flex: 1,
    marginLeft: 12,
  },
  teamMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  metaChip: {
    borderRadius: 4,
  },
  memberPreview: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberAvatarWrapper: {
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 14,
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
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
});
