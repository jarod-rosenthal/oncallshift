import React, { useState, useEffect } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  Linking,
  Pressable,
} from 'react-native';
import {
  Text,
  Card,
  Avatar,
  ActivityIndicator,
  Chip,
  Searchbar,
  IconButton,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import * as apiService from '../services/apiService';
import * as hapticService from '../services/hapticService';

interface TeamMember {
  id: string;
  fullName: string;
  email: string;
  role: 'admin' | 'member';
  isOnCall: boolean;
  serviceName?: string;
  phoneNumber?: string;
}

export default function TeamScreen({ navigation }: any) {
  const { colors, theme } = useAppTheme();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchTeamData();
  }, []);

  const fetchTeamData = async () => {
    try {
      // Fetch on-call data to identify who's on-call
      const onCallData = await apiService.getOnCallData();

      // Create team member list from on-call data
      // In a real app, you'd have a dedicated team endpoint
      const teamMembers: TeamMember[] = onCallData.map(oc => ({
        id: oc.oncallUser.id,
        fullName: oc.oncallUser.fullName,
        email: oc.oncallUser.email,
        role: 'member' as const,
        isOnCall: true,
        serviceName: oc.service.name,
      }));

      // Add current user if not in list
      const profile = await apiService.getUserProfile();
      const userExists = teamMembers.some(m => m.id === profile.id);
      if (!userExists) {
        teamMembers.unshift({
          id: profile.id,
          fullName: profile.fullName,
          email: profile.email,
          role: profile.role,
          isOnCall: false,
          phoneNumber: profile.phoneNumber,
        });
      }

      setMembers(teamMembers);
    } catch (error) {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchTeamData();
  };

  const getInitials = (name: string) => {
    return name
      ?.split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?';
  };

  const handleCall = async (phoneNumber: string) => {
    await hapticService.lightTap();
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const handleEmail = async (email: string) => {
    await hapticService.lightTap();
    Linking.openURL(`mailto:${email}`);
  };

  const filteredMembers = members.filter(member =>
    member.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderMember = ({ item }: { item: TeamMember }) => (
    <Card style={styles(colors).memberCard}>
      <Card.Content style={styles(colors).memberContent}>
        <View style={styles(colors).memberRow}>
          <View style={styles(colors).avatarContainer}>
            <Avatar.Text
              size={48}
              label={getInitials(item.fullName)}
              style={[
                styles(colors).avatar,
                item.isOnCall && styles(colors).avatarOnCall,
              ]}
            />
            {item.isOnCall && (
              <View style={styles(colors).onCallBadge}>
                <MaterialCommunityIcons name="phone" size={12} color="#fff" />
              </View>
            )}
          </View>
          <View style={styles(colors).memberInfo}>
            <View style={styles(colors).nameRow}>
              <Text variant="titleMedium" style={styles(colors).memberName}>
                {item.fullName}
              </Text>
              {item.role === 'admin' && (
                <Chip
                  compact
                  style={styles(colors).adminChip}
                  textStyle={styles(colors).adminChipText}
                >
                  Admin
                </Chip>
              )}
            </View>
            <Text variant="bodySmall" style={styles(colors).memberEmail}>
              {item.email}
            </Text>
            {item.isOnCall && item.serviceName && (
              <View style={styles(colors).onCallInfo}>
                <MaterialCommunityIcons name="server" size={12} color={colors.success} />
                <Text style={styles(colors).onCallText}>
                  On-call for {item.serviceName}
                </Text>
              </View>
            )}
          </View>
          <View style={styles(colors).actions}>
            <IconButton
              icon="email-outline"
              size={20}
              iconColor={colors.textSecondary}
              onPress={() => handleEmail(item.email)}
            />
            {item.phoneNumber && (
              <IconButton
                icon="phone-outline"
                size={20}
                iconColor={colors.textSecondary}
                onPress={() => handleCall(item.phoneNumber!)}
              />
            )}
          </View>
        </View>
      </Card.Content>
    </Card>
  );

  if (loading) {
    return (
      <View style={[styles(colors).container, styles(colors).centerContent]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles(colors).loadingText}>Loading team...</Text>
      </View>
    );
  }

  return (
    <View style={styles(colors).container}>
      {/* Search Bar */}
      <View style={styles(colors).searchContainer}>
        <Searchbar
          placeholder="Search team members..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles(colors).searchBar}
          iconColor={colors.textMuted}
          placeholderTextColor={colors.textMuted}
          inputStyle={{ color: colors.textPrimary }}
        />
      </View>

      {/* Stats */}
      <View style={styles(colors).statsRow}>
        <View style={styles(colors).statItem}>
          <Text style={styles(colors).statNumber}>{members.length}</Text>
          <Text style={styles(colors).statLabel}>Team Members</Text>
        </View>
        <View style={styles(colors).statDivider} />
        <View style={styles(colors).statItem}>
          <Text style={[styles(colors).statNumber, { color: colors.success }]}>
            {members.filter(m => m.isOnCall).length}
          </Text>
          <Text style={styles(colors).statLabel}>On-Call Now</Text>
        </View>
      </View>

      {/* Team List */}
      <FlatList
        data={filteredMembers}
        renderItem={renderMember}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles(colors).listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.accent]}
          />
        }
        ListEmptyComponent={
          <View style={styles(colors).emptyContainer}>
            <MaterialCommunityIcons
              name="account-group-outline"
              size={64}
              color={colors.textMuted}
            />
            <Text variant="titleMedium" style={styles(colors).emptyText}>
              No team members found
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: colors.textSecondary,
  },
  searchContainer: {
    padding: 16,
    paddingBottom: 8,
    backgroundColor: colors.surface,
  },
  searchBar: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 10,
    elevation: 0,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: 16,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  listContent: {
    padding: 16,
  },
  memberCard: {
    marginBottom: 8,
    backgroundColor: colors.surface,
    borderRadius: 12,
  },
  memberContent: {
    paddingVertical: 12,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    backgroundColor: colors.accent,
  },
  avatarOnCall: {
    backgroundColor: colors.success,
  },
  onCallBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: colors.success,
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  memberName: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  adminChip: {
    backgroundColor: colors.accent + '20',
    height: 20,
  },
  adminChipText: {
    color: colors.accent,
    fontSize: 10,
    lineHeight: 12,
  },
  memberEmail: {
    color: colors.textSecondary,
    marginTop: 2,
  },
  onCallInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  onCallText: {
    fontSize: 12,
    color: colors.success,
  },
  actions: {
    flexDirection: 'row',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    color: colors.textSecondary,
    marginTop: 16,
  },
});
