import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Alert,
  Linking,
  Pressable,
} from 'react-native';
import {
  Text,
  Card,
  Avatar,
  Switch,
  Button,
  Divider,
  List,
  ActivityIndicator,
  RadioButton,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Application from 'expo-application';
import * as apiService from '../services/apiService';
import type { UserProfile } from '../services/apiService';
import { signOut } from '../services/authService';
import * as biometricService from '../services/biometricService';
import * as hapticService from '../services/hapticService';
import * as settingsService from '../services/settingsService';
import { useAppTheme } from '../context/ThemeContext';
import { clearAllSettings } from '../services/settingsService';
import { OwnerAvatar } from '../components';

interface SettingsScreenProps {
  navigation: any;
  onLogout: () => void;
}

export default function SettingsScreen({ navigation, onLogout }: SettingsScreenProps) {
  const { theme, colors, themeMode, setThemeMode, isDark } = useAppTheme();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState(false);

  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricCapability, setBiometricCapability] = useState<biometricService.BiometricCapability | null>(null);
  const [hapticEnabled, setHapticEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showThemeOptions, setShowThemeOptions] = useState(false);

  const appVersion = Application.nativeApplicationVersion || '1.0.0';
  const buildNumber = Application.nativeBuildVersion || '1';

  const fetchProfile = async () => {
    try {
      const data = await apiService.getUserProfile();
      setProfile(data);
      setPushEnabled(data.settings?.notificationPreferences?.push ?? true);
      setEmailEnabled(data.settings?.notificationPreferences?.email ?? true);
    } catch (err: any) {
      console.error('Failed to fetch profile:', err);
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    checkBiometricCapability();
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const haptic = await settingsService.isHapticEnabled();
    const sound = await settingsService.isSoundEnabled();
    setHapticEnabled(haptic);
    setSoundEnabled(sound);
  };

  const checkBiometricCapability = async () => {
    const capability = await biometricService.getBiometricCapability();
    setBiometricCapability(capability);
    if (capability.isAvailable) {
      const enabled = await biometricService.isBiometricEnabled();
      setBiometricEnabled(enabled);
    }
  };

  const handleToggleBiometric = async (value: boolean) => {
    await hapticService.lightTap();
    if (value) {
      const result = await biometricService.authenticateWithBiometrics(
        'Verify your identity to enable biometric login'
      );
      if (result.success) {
        await biometricService.setBiometricEnabled(true);
        setBiometricEnabled(true);
        await hapticService.success();
      } else {
        await hapticService.error();
        Alert.alert('Error', result.error || 'Failed to enable biometric authentication');
      }
    } else {
      await biometricService.setBiometricEnabled(false);
      setBiometricEnabled(false);
    }
  };

  const handleToggleHaptic = async (value: boolean) => {
    setHapticEnabled(value);
    await hapticService.setHapticEnabled(value);
    if (value) {
      await hapticService.success();
    }
  };

  const handleToggleSound = async (value: boolean) => {
    await hapticService.lightTap();
    setSoundEnabled(value);
    await settingsService.setSoundEnabled(value);
  };

  const handleThemeChange = async (value: settingsService.ThemeMode) => {
    await hapticService.selectionChanged();
    setThemeMode(value);
    setShowThemeOptions(false);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchProfile();
  };

  const handleTogglePush = async (value: boolean) => {
    await hapticService.lightTap();
    setPushEnabled(value);
    try {
      setUpdating(true);
      await apiService.updateUserProfile({
        notificationPreferences: {
          ...profile?.settings?.notificationPreferences,
          push: value,
        },
      });
      await hapticService.success();
    } catch (err) {
      await hapticService.error();
      setPushEnabled(!value);
      Alert.alert('Error', 'Failed to update notification settings');
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleEmail = async (value: boolean) => {
    await hapticService.lightTap();
    setEmailEnabled(value);
    try {
      setUpdating(true);
      await apiService.updateUserProfile({
        notificationPreferences: {
          ...profile?.settings?.notificationPreferences,
          email: value,
        },
      });
      await hapticService.success();
    } catch (err) {
      await hapticService.error();
      setEmailEnabled(!value);
      Alert.alert('Error', 'Failed to update notification settings');
    } finally {
      setUpdating(false);
    }
  };

  const handleLogout = () => {
    hapticService.mediumTap();
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await hapticService.heavyTap();
              await clearAllSettings();
              await signOut();
              onLogout();
            } catch (err) {
              Alert.alert('Error', 'Failed to logout');
            }
          },
        },
      ]
    );
  };

  const getInitials = (name: string) => {
    return name
      ?.split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?';
  };

  const getThemeModeLabel = (mode: settingsService.ThemeMode) => {
    switch (mode) {
      case 'light': return 'Light';
      case 'dark': return 'Dark';
      case 'system': return 'System';
    }
  };

  const getThemeModeIcon = (mode: settingsService.ThemeMode) => {
    switch (mode) {
      case 'light': return 'white-balance-sunny';
      case 'dark': return 'moon-waning-crescent';
      case 'system': return 'theme-light-dark';
    }
  };

  if (loading) {
    return (
      <View style={[styles(colors).container, styles(colors).centerContent]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text variant="bodyLarge" style={styles(colors).loadingText}>
          Loading profile...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles(colors).container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[theme.colors.primary]}
        />
      }
    >
      {/* Account Card */}
      <Card style={styles(colors).card} mode="elevated">
        <Card.Content>
          <View style={styles(colors).sectionHeader}>
            <MaterialCommunityIcons name="account-circle-outline" size={24} color={colors.accent} />
            <Text variant="titleMedium" style={styles(colors).sectionTitle}>
              Account
            </Text>
          </View>

          <View style={styles(colors).profileHeader}>
            <OwnerAvatar
              name={profile?.fullName || ''}
              email={profile?.email || ''}
              size={64}
            />
            <View style={styles(colors).profileInfo}>
              <Text variant="titleLarge" style={styles(colors).profileName}>
                {profile?.fullName}
              </Text>
              <Text variant="bodyMedium" style={styles(colors).profileEmail}>
                {profile?.email}
              </Text>
              <View style={styles(colors).profileMeta}>
                <View style={styles(colors).roleBadge}>
                  <Text style={styles(colors).roleText}>
                    {profile?.role?.toUpperCase()}
                  </Text>
                </View>
                <Text variant="bodySmall" style={styles(colors).orgText}>
                  {profile?.organization?.name}
                </Text>
              </View>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Preferences Card */}
      <Card style={styles(colors).card} mode="elevated">
        <Card.Content>
          <View style={styles(colors).sectionHeader}>
            <MaterialCommunityIcons name="cog-outline" size={24} color={colors.accent} />
            <Text variant="titleMedium" style={styles(colors).sectionTitle}>
              Preferences
            </Text>
          </View>

          <Pressable onPress={() => setShowThemeOptions(!showThemeOptions)}>
            <View style={styles(colors).settingRow}>
              <View style={styles(colors).settingInfo}>
                <Text variant="bodyLarge" style={styles(colors).settingLabel}>
                  Theme
                </Text>
                <Text variant="bodySmall" style={styles(colors).settingDescription}>
                  {getThemeModeLabel(themeMode)}
                </Text>
              </View>
              <MaterialCommunityIcons
                name={getThemeModeIcon(themeMode)}
                size={24}
                color={colors.accent}
              />
            </View>
          </Pressable>

          {showThemeOptions && (
            <View style={styles(colors).themeOptions}>
              <RadioButton.Group onValueChange={(v) => handleThemeChange(v as settingsService.ThemeMode)} value={themeMode}>
                <View style={styles(colors).radioRow}>
                  <RadioButton.Android value="system" color={colors.accent} />
                  <Pressable onPress={() => handleThemeChange('system')}>
                    <Text style={styles(colors).radioLabel}>System Default</Text>
                  </Pressable>
                </View>
                <View style={styles(colors).radioRow}>
                  <RadioButton.Android value="light" color={colors.accent} />
                  <Pressable onPress={() => handleThemeChange('light')}>
                    <Text style={styles(colors).radioLabel}>Light</Text>
                  </Pressable>
                </View>
                <View style={styles(colors).radioRow}>
                  <RadioButton.Android value="dark" color={colors.accent} />
                  <Pressable onPress={() => handleThemeChange('dark')}>
                    <Text style={styles(colors).radioLabel}>Dark</Text>
                  </Pressable>
                </View>
              </RadioButton.Group>
            </View>
          )}

          <Divider style={styles(colors).settingDivider} />

          <View style={styles(colors).settingRow}>
            <View style={styles(colors).settingInfo}>
              <Text variant="bodyLarge" style={styles(colors).settingLabel}>
                Haptic Feedback
              </Text>
              <Text variant="bodySmall" style={styles(colors).settingDescription}>
                Vibrate on actions
              </Text>
            </View>
            <Switch
              value={hapticEnabled}
              onValueChange={handleToggleHaptic}
              color={colors.accent}
            />
          </View>

          <Divider style={styles(colors).settingDivider} />

          <View style={styles(colors).settingRow}>
            <View style={styles(colors).settingInfo}>
              <Text variant="bodyLarge" style={styles(colors).settingLabel}>
                Sound Effects
              </Text>
              <Text variant="bodySmall" style={styles(colors).settingDescription}>
                Play sounds for alerts
              </Text>
            </View>
            <Switch
              value={soundEnabled}
              onValueChange={handleToggleSound}
              color={colors.accent}
            />
          </View>

          {biometricCapability?.isAvailable && (
            <>
              <Divider style={styles(colors).settingDivider} />
              <View style={styles(colors).settingRow}>
                <View style={styles(colors).settingInfo}>
                  <Text variant="bodyLarge" style={styles(colors).settingLabel}>
                    {biometricService.getBiometricTypeName(biometricCapability.biometricType)}
                  </Text>
                  <Text variant="bodySmall" style={styles(colors).settingDescription}>
                    Use to unlock the app
                  </Text>
                </View>
                <Switch
                  value={biometricEnabled}
                  onValueChange={handleToggleBiometric}
                  color={colors.accent}
                />
              </View>
            </>
          )}
        </Card.Content>
      </Card>

      {/* Notifications Card */}
      <Card style={styles(colors).card} mode="elevated">
        <Card.Content>
          <View style={styles(colors).sectionHeader}>
            <MaterialCommunityIcons name="bell-outline" size={24} color={colors.accent} />
            <Text variant="titleMedium" style={styles(colors).sectionTitle}>
              Notifications
            </Text>
          </View>

          <View style={styles(colors).settingRow}>
            <View style={styles(colors).settingInfo}>
              <Text variant="bodyLarge" style={styles(colors).settingLabel}>
                Push Notifications
              </Text>
              <Text variant="bodySmall" style={styles(colors).settingDescription}>
                Receive push alerts for new incidents
              </Text>
            </View>
            <Switch
              value={pushEnabled}
              onValueChange={handleTogglePush}
              color={colors.accent}
              disabled={updating}
            />
          </View>

          <Divider style={styles(colors).settingDivider} />

          <View style={styles(colors).settingRow}>
            <View style={styles(colors).settingInfo}>
              <Text variant="bodyLarge" style={styles(colors).settingLabel}>
                Email Notifications
              </Text>
              <Text variant="bodySmall" style={styles(colors).settingDescription}>
                Receive email alerts for incidents
              </Text>
            </View>
            <Switch
              value={emailEnabled}
              onValueChange={handleToggleEmail}
              color={colors.accent}
              disabled={updating}
            />
          </View>
        </Card.Content>
      </Card>

      {/* About Card */}
      <Card style={styles(colors).card} mode="elevated">
        <Card.Content>
          <View style={styles(colors).sectionHeader}>
            <MaterialCommunityIcons name="information-outline" size={24} color={colors.accent} />
            <Text variant="titleMedium" style={styles(colors).sectionTitle}>
              About
            </Text>
          </View>

          <List.Item
            title="Version"
            description={`${appVersion} (${buildNumber})`}
            left={(props) => <List.Icon {...props} icon="tag" color={colors.textSecondary} />}
            titleStyle={styles(colors).listTitle}
            descriptionStyle={styles(colors).listDescription}
          />

          <Pressable onPress={() => Linking.openURL('https://oncallshift.com/privacy')}>
            <List.Item
              title="Privacy Policy"
              left={(props) => <List.Icon {...props} icon="shield-account" color={colors.textSecondary} />}
              right={(props) => <List.Icon {...props} icon="chevron-right" color={colors.textMuted} />}
              titleStyle={styles(colors).linkTitle}
            />
          </Pressable>

          <Pressable onPress={() => Linking.openURL('https://oncallshift.com/terms')}>
            <List.Item
              title="Terms of Service"
              left={(props) => <List.Icon {...props} icon="file-document" color={colors.textSecondary} />}
              right={(props) => <List.Icon {...props} icon="chevron-right" color={colors.textMuted} />}
              titleStyle={styles(colors).linkTitle}
            />
          </Pressable>

          <Pressable onPress={() => Linking.openURL('mailto:support@oncallshift.com')}>
            <List.Item
              title="Contact Support"
              left={(props) => <List.Icon {...props} icon="help-circle" color={colors.textSecondary} />}
              right={(props) => <List.Icon {...props} icon="chevron-right" color={colors.textMuted} />}
              titleStyle={styles(colors).linkTitle}
            />
          </Pressable>

          <Divider style={styles(colors).settingDivider} />

          <Pressable onPress={handleLogout}>
            <List.Item
              title="Sign Out"
              left={(props) => <List.Icon {...props} icon="logout" color={colors.error} />}
              right={(props) => <List.Icon {...props} icon="chevron-right" color={colors.textMuted} />}
              titleStyle={styles(colors).logoutTitle}
            />
          </Pressable>
        </Card.Content>
      </Card>

      <View style={styles(colors).bottomPadding} />
    </ScrollView>
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
  card: {
    margin: 16,
    marginBottom: 0,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileInfo: {
    marginLeft: 16,
    flex: 1,
  },
  profileName: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  profileEmail: {
    color: colors.textSecondary,
    marginTop: 2,
  },
  profileMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  roleBadge: {
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  roleText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  orgText: {
    color: colors.textMuted,
  },
  listTitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  listDescription: {
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  linkTitle: {
    fontSize: 16,
    color: colors.textPrimary,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    color: colors.textPrimary,
    fontWeight: '500',
  },
  settingDescription: {
    color: colors.textSecondary,
    marginTop: 2,
  },
  settingDivider: {
    marginVertical: 12,
    backgroundColor: colors.border,
  },
  themeOptions: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  radioLabel: {
    color: colors.textPrimary,
    fontSize: 16,
  },
  logoutTitle: {
    fontSize: 16,
    color: colors.error,
    fontWeight: '500',
  },
  bottomPadding: {
    height: 40,
  },
});
