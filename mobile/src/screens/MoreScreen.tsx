import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  Alert,
  Linking,
} from 'react-native';
import {
  Text,
  Card,
  List,
  Divider,
  Avatar,
  ActivityIndicator,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Application from 'expo-application';
import * as apiService from '../services/apiService';
import type { UserProfile } from '../services/apiService';
import { signOut } from '../services/authService';
import * as hapticService from '../services/hapticService';
import { useAppTheme } from '../context/ThemeContext';
import { colors } from '../theme';
import { OwnerAvatar } from '../components';

interface MoreScreenProps {
  navigation: any;
  onLogout: () => void;
}

interface MenuItem {
  id: string;
  title: string;
  subtitle?: string;
  icon: string;
  screen?: string;
  action?: () => void;
  showChevron?: boolean;
  badge?: string | number;
}

export default function MoreScreen({ navigation, onLogout }: MoreScreenProps) {
  const { colors } = useAppTheme();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const appVersion = Application.nativeApplicationVersion || '1.0.0';
  const buildNumber = Application.nativeBuildVersion || '1';

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const data = await apiService.getUserProfile();
      setProfile(data);
    } catch (err: any) {
      console.error('Failed to fetch profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    hapticService.warning();
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            onLogout();
          },
        },
      ]
    );
  };

  const isAdmin = profile?.role === 'admin';

  const menuSections: { title: string; items: MenuItem[] }[] = [
    {
      title: 'Your Account',
      items: [
        {
          id: 'profile',
          title: 'Profile',
          subtitle: profile?.email || 'Manage your profile',
          icon: 'account-circle',
          screen: 'Settings',
          showChevron: true,
        },
        {
          id: 'availability',
          title: 'Availability',
          subtitle: 'On-call hours & blackout dates',
          icon: 'calendar-clock',
          screen: 'Availability',
          showChevron: true,
        },
        {
          id: 'oncall-calendar',
          title: 'My On-Call Calendar',
          subtitle: 'View your upcoming shifts',
          icon: 'calendar-month',
          screen: 'OnCallCalendar',
          showChevron: true,
        },
        {
          id: 'contact-methods',
          title: 'Contact Methods',
          subtitle: 'Manage notification preferences',
          icon: 'card-account-phone',
          screen: 'ContactMethods',
          showChevron: true,
        },
      ],
    },
    // Admin section - only shown to admins
    ...(isAdmin ? [{
      title: 'Administration',
      items: [
        {
          id: 'setup-wizard',
          title: 'Setup Wizard',
          subtitle: 'Add services, runbooks & team',
          icon: 'wizard-hat',
          screen: 'SetupWizard',
          showChevron: true,
        },
        {
          id: 'escalation-policies',
          title: 'Escalation Policies',
          subtitle: 'Manage escalation rules',
          icon: 'arrow-decision',
          screen: 'EscalationPolicies',
          showChevron: true,
        },
        {
          id: 'manage-schedules',
          title: 'Manage Schedules',
          subtitle: 'Configure on-call rotations',
          icon: 'calendar-edit',
          screen: 'ManageSchedules',
          showChevron: true,
        },
        {
          id: 'manage-services',
          title: 'Manage Services',
          subtitle: 'Configure services & integrations',
          icon: 'server-security',
          screen: 'ManageServices',
          showChevron: true,
        },
        {
          id: 'manage-users',
          title: 'Manage Users',
          subtitle: 'Invite users & manage roles',
          icon: 'account-cog',
          screen: 'ManageUsers',
          showChevron: true,
        },
        {
          id: 'teams',
          title: 'Teams',
          subtitle: 'Organize users into teams',
          icon: 'account-group-outline',
          screen: 'Teams',
          showChevron: true,
        },
        {
          id: 'integrations',
          title: 'Integrations',
          subtitle: 'Slack, webhooks & more',
          icon: 'connection',
          screen: 'Integrations',
          showChevron: true,
        },
        {
          id: 'routing-rules',
          title: 'Routing Rules',
          subtitle: 'Route alerts to services',
          icon: 'router',
          screen: 'RoutingRules',
          showChevron: true,
        },
      ],
    }] : []),
    {
      title: 'Team & Analytics',
      items: [
        {
          id: 'team',
          title: 'Team',
          subtitle: 'View team members',
          icon: 'account-group',
          screen: 'Team',
          showChevron: true,
        },
        {
          id: 'analytics',
          title: 'Analytics',
          subtitle: 'Incident metrics & reports',
          icon: 'chart-bar',
          screen: 'Analytics',
          showChevron: true,
        },
      ],
    },
    {
      title: 'App Settings',
      items: [
        {
          id: 'settings',
          title: 'Settings',
          subtitle: 'Notifications, theme, security',
          icon: 'cog',
          screen: 'Settings',
          showChevron: true,
        },
      ],
    },
    {
      title: 'Support',
      items: [
        {
          id: 'help',
          title: 'Help & Feedback',
          subtitle: 'Get support or send feedback',
          icon: 'help-circle',
          action: () => Linking.openURL('https://oncallshift.com/support'),
          showChevron: true,
        },
        {
          id: 'about',
          title: 'About',
          subtitle: `Version ${appVersion} (${buildNumber})`,
          icon: 'information',
          showChevron: false,
        },
      ],
    },
  ];

  const handleMenuPress = (item: MenuItem) => {
    hapticService.lightTap();
    if (item.action) {
      item.action();
    } else if (item.screen) {
      navigation.navigate(item.screen);
    }
  };

  const renderMenuItem = (item: MenuItem) => (
    <Pressable
      key={item.id}
      onPress={() => handleMenuPress(item)}
      style={({ pressed }) => [
        styles.menuItem,
        { backgroundColor: pressed ? colors.surfaceVariant : 'transparent' },
      ]}
    >
      <View style={styles.menuItemContent}>
        <View style={[styles.iconContainer, { backgroundColor: `${colors.primary}15` }]}>
          <MaterialCommunityIcons
            name={item.icon as any}
            size={22}
            color={colors.primary}
          />
        </View>
        <View style={styles.menuItemText}>
          <Text variant="bodyLarge" style={{ color: colors.textPrimary }}>
            {item.title}
          </Text>
          {item.subtitle && (
            <Text variant="bodySmall" style={{ color: colors.textSecondary }}>
              {item.subtitle}
            </Text>
          )}
        </View>
        {item.badge && (
          <View style={[styles.badge, { backgroundColor: colors.error }]}>
            <Text variant="labelSmall" style={{ color: '#fff' }}>
              {item.badge}
            </Text>
          </View>
        )}
        {item.showChevron && (
          <MaterialCommunityIcons
            name="chevron-right"
            size={24}
            color={colors.textMuted}
          />
        )}
      </View>
    </Pressable>
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Profile Header */}
      <Card style={[styles.profileCard, { backgroundColor: colors.surface }]}>
        <Card.Content style={styles.profileContent}>
          <OwnerAvatar
            name={profile?.fullName || profile?.email || 'User'}
            email={profile?.email}
            size={64}
          />
          <View style={styles.profileInfo}>
            <Text variant="titleLarge" style={{ color: colors.textPrimary, fontWeight: '600' }}>
              {profile?.fullName || 'User'}
            </Text>
            <Text variant="bodyMedium" style={{ color: colors.textSecondary }}>
              {profile?.email}
            </Text>
            {profile?.role && (
              <View style={[styles.roleBadge, { backgroundColor: `${colors.primary}20` }]}>
                <Text variant="labelSmall" style={{ color: colors.primary }}>
                  {profile.role}
                </Text>
              </View>
            )}
          </View>
        </Card.Content>
      </Card>

      {/* Menu Sections */}
      {menuSections.map((section, index) => (
        <View key={section.title} style={styles.section}>
          <Text
            variant="labelMedium"
            style={[styles.sectionTitle, { color: colors.textMuted }]}
          >
            {section.title.toUpperCase()}
          </Text>
          <Card style={[styles.sectionCard, { backgroundColor: colors.surface }]}>
            {section.items.map((item, itemIndex) => (
              <React.Fragment key={item.id}>
                {renderMenuItem(item)}
                {itemIndex < section.items.length - 1 && (
                  <Divider style={{ marginLeft: 56 }} />
                )}
              </React.Fragment>
            ))}
          </Card>
        </View>
      ))}

      {/* Sign Out Button */}
      <Pressable
        onPress={handleLogout}
        style={({ pressed }) => [
          styles.signOutButton,
          { backgroundColor: pressed ? `${colors.error}15` : 'transparent' },
        ]}
      >
        <MaterialCommunityIcons name="logout" size={20} color={colors.error} />
        <Text variant="bodyLarge" style={[styles.signOutText, { color: colors.error }]}>
          Sign Out
        </Text>
      </Pressable>

      {/* Footer */}
      <Text variant="bodySmall" style={[styles.footer, { color: colors.textMuted }]}>
        OnCallShift v{appVersion} ({buildNumber})
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileCard: {
    margin: 16,
    borderRadius: 16,
    elevation: 2,
  },
  profileContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  profileInfo: {
    marginLeft: 16,
    flex: 1,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  section: {
    marginTop: 8,
  },
  sectionTitle: {
    marginLeft: 16,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  sectionCard: {
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 1,
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItemText: {
    flex: 1,
    marginLeft: 12,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 8,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.3)',
  },
  signOutText: {
    marginLeft: 8,
    fontWeight: '600',
  },
  footer: {
    textAlign: 'center',
    marginTop: 24,
  },
});
