import React, { useEffect, useRef, useState } from 'react';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { View, Platform, Pressable } from 'react-native';
import { PaperProvider, ActivityIndicator, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';

// Theme Context
import { ThemeProvider, useAppTheme } from './src/context/ThemeContext';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import AlertListScreen from './src/screens/AlertListScreen';
import AlertDetailScreen from './src/screens/AlertDetailScreen';
import OnCallScreen from './src/screens/OnCallScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import ScheduleScreen from './src/screens/ScheduleScreen';
import TeamScreen from './src/screens/TeamScreen';
import AnalyticsScreen from './src/screens/AnalyticsScreen';
import InboxScreen from './src/screens/InboxScreen';
import MoreScreen from './src/screens/MoreScreen';

// Components
import { ToastProvider, OfflineBanner } from './src/components';

// Services
import { setupNotificationListeners, getLastNotificationResponse, registerForPushNotifications, setBadgeCount } from './src/services/notificationService';
import { isAuthenticated, addAuthStateListener } from './src/services/authService';
import * as apiService from './src/services/apiService';
import * as biometricService from './src/services/biometricService';
import * as hapticService from './src/services/hapticService';
import * as settingsService from './src/services/settingsService';
import * as crashReporting from './src/services/crashReportingService';
import * as soundService from './src/services/soundService';
import * as updateService from './src/services/updateService';
import * as backgroundRefreshService from './src/services/backgroundRefreshService';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

type TabIconName = 'alert-circle' | 'alert-circle-outline' | 'phone-in-talk' | 'phone-in-talk-outline' | 'inbox' | 'inbox-outline' | 'dots-horizontal-circle' | 'dots-horizontal-circle-outline';

const tabIcons: Record<string, { focused: TabIconName; unfocused: TabIconName }> = {
  Incidents: { focused: 'alert-circle', unfocused: 'alert-circle-outline' },
  OnCall: { focused: 'phone-in-talk', unfocused: 'phone-in-talk-outline' },
  Inbox: { focused: 'inbox', unfocused: 'inbox-outline' },
  More: { focused: 'dots-horizontal-circle', unfocused: 'dots-horizontal-circle-outline' },
};

// Deep linking configuration
const linking = {
  prefixes: [Linking.createURL('/'), 'oncallshift://', 'https://oncallshift.com'],
  config: {
    screens: {
      Main: {
        screens: {
          Incidents: 'incidents',
          OnCall: 'oncall',
          Inbox: 'inbox',
          More: 'more',
        },
      },
      AlertDetail: 'incidents/:id',
      Schedule: 'schedule/:id',
      Team: 'team',
      Analytics: 'analytics',
      Settings: 'settings',
      Profile: 'profile',
    },
  },
};

// Main tab navigator with theme support
function MainTabs({ onLogout, incidentCount, unreadCount }: { navigation: any; onLogout: () => void; incidentCount: number; unreadCount: number }) {
  const { colors } = useAppTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const iconName = focused
            ? tabIcons[route.name]?.focused
            : tabIcons[route.name]?.unfocused;
          return <MaterialCommunityIcons name={iconName || 'help'} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 24 : 12,
          height: Platform.OS === 'ios' ? 88 : 68,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: 2,
        },
        headerStyle: {
          backgroundColor: colors.primary,
          elevation: 4,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 4,
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: '600',
          fontSize: 18,
        },
      })}
    >
      <Tab.Screen
        name="Incidents"
        component={AlertListScreen}
        options={{
          title: 'Incidents',
          tabBarBadge: incidentCount > 0 ? incidentCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.error,
            fontSize: 10,
            fontWeight: '600',
            minWidth: 18,
            height: 18,
          },
        }}
      />
      <Tab.Screen
        name="OnCall"
        component={OnCallScreen}
        options={{ title: 'On-Call' }}
      />
      <Tab.Screen
        name="Inbox"
        component={InboxScreen}
        options={{
          title: 'Inbox',
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.primary,
            fontSize: 10,
            fontWeight: '600',
            minWidth: 18,
            height: 18,
          },
        }}
      />
      <Tab.Screen
        name="More"
        options={{ title: 'More' }}
      >
        {(props) => <MoreScreen {...props} onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

// Main app content with theme
function AppContent() {
  const { theme, colors, isDark } = useAppTheme();
  const navigationRef = useRef<NavigationContainerRef<any>>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [biometricVerified, setBiometricVerified] = useState(false);
  const [checkingBiometric, setCheckingBiometric] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [incidentCount, setIncidentCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    // Initialize crash reporting
    crashReporting.initCrashReporting();
    crashReporting.addBreadcrumb('App initialized', 'app.lifecycle');

    // Initialize haptics and sounds
    await hapticService.initHaptics();
    await soundService.initSoundService();

    // Check for app updates
    updateService.initUpdateCheck();

    // Check onboarding status
    const onboardingComplete = await settingsService.isOnboardingComplete();
    setShowOnboarding(!onboardingComplete);

    // Check auth
    await checkAuth();

    // Listen for auth state changes
    const unsubscribe = addAuthStateListener((authenticated) => {
      if (!authenticated) {
        setIsLoggedIn(false);
        setBiometricVerified(false);
      }
    });

    return () => {
      unsubscribe();
    };
  };

  useEffect(() => {
    if (isLoggedIn && !biometricVerified && !checkingBiometric) {
      checkBiometricAuth();
    }
  }, [isLoggedIn, biometricVerified]);

  const checkBiometricAuth = async () => {
    const biometricEnabled = await biometricService.isBiometricEnabled();
    const capability = await biometricService.getBiometricCapability();

    if (biometricEnabled && capability.isAvailable) {
      setCheckingBiometric(true);
      const result = await biometricService.authenticateWithBiometrics(
        'Unlock OnCallShift'
      );
      if (result.success) {
        setBiometricVerified(true);
        await hapticService.success();
      }
      setCheckingBiometric(false);
    } else {
      setBiometricVerified(true);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      // Set user context for crash reporting
      apiService.getUserProfile().then((profile) => {
        crashReporting.setUserContext(profile.id, profile.email, profile.fullName);
        crashReporting.addBreadcrumb('User logged in', 'auth', { userId: profile.id });
      }).catch(err => console.error('Failed to get user profile for crash reporting:', err));

      // Register background refresh
      backgroundRefreshService.registerBackgroundFetch().then((registered) => {
        console.log('Background refresh registered:', registered);
      });

      registerForPushNotifications().then(async (token) => {
        if (token) {
          try {
            await apiService.registerDevice({
              token,
              platform: Platform.OS as 'ios' | 'android',
              appVersion: '1.0.0',
            });
            console.log('Device registered for push notifications');
          } catch (err) {
            console.error('Failed to register device:', err);
          }
        }
      });

      // Update badge count and unread notifications
      updateBadgeCount();
      updateUnreadCount();

      getLastNotificationResponse().then((response) => {
        if (response) {
          handleNotificationResponse(response);
        }
      });

      const cleanup = setupNotificationListeners(
        (notification) => {
          console.log('Notification received in foreground:', notification.request.content);
          // Update badge count and unread notifications when notification arrives
          updateBadgeCount();
          updateUnreadCount();
        },
        (response) => {
          handleNotificationResponse(response);
        }
      );

      return cleanup;
    }
  }, [isLoggedIn]);

  const updateBadgeCount = async () => {
    try {
      const incidents = await apiService.getIncidents('triggered');
      const count = incidents.length;
      setIncidentCount(count);
      await setBadgeCount(count);
    } catch (error) {
      console.error('Failed to update badge count:', error);
    }
  };

  const updateUnreadCount = async () => {
    try {
      const count = await apiService.getUnreadNotificationCount();
      setUnreadCount(count);
    } catch (error) {
      // Silently fail - unread count is not critical
      console.log('Failed to fetch unread count:', error);
    }
  };

  const checkAuth = async () => {
    try {
      const authenticated = await isAuthenticated();
      setIsLoggedIn(authenticated);
    } catch (err) {
      setIsLoggedIn(false);
    }
  };

  const handleNotificationResponse = (response: Notifications.NotificationResponse) => {
    const data = response.notification.request.content.data;
    const actionId = response.actionIdentifier;

    // Handle quick actions from notification
    if (actionId === 'acknowledge' && data?.incidentId) {
      apiService.acknowledgeIncident(data.incidentId as string)
        .then(() => {
          hapticService.success();
          updateBadgeCount();
        })
        .catch(err => console.error('Failed to acknowledge:', err));
      return;
    }

    if (actionId === 'resolve' && data?.incidentId) {
      apiService.resolveIncident(data.incidentId as string)
        .then(() => {
          hapticService.success();
          updateBadgeCount();
        })
        .catch(err => console.error('Failed to resolve:', err));
      return;
    }

    // Default: open incident detail
    if (data?.incidentId && navigationRef.current) {
      navigationRef.current.navigate('AlertDetail', {
        alert: {
          id: data.incidentId,
          summary: data.summary || 'Incident',
          severity: data.severity || 'info',
          state: data.state || 'triggered',
          service: { id: '', name: data.serviceName || 'Service' },
          triggeredAt: new Date().toISOString(),
        },
      });
    }
  };

  const handleLogin = () => {
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    crashReporting.addBreadcrumb('User logged out', 'auth');
    crashReporting.clearUserContext();
    setIsLoggedIn(false);
    setBiometricVerified(false);
    setIncidentCount(0);
    setUnreadCount(0);
    setBadgeCount(0);
  };

  const handleOnboardingComplete = async () => {
    await settingsService.setOnboardingComplete(true);
    setShowOnboarding(false);
  };

  // Show loading while checking auth
  if (isLoggedIn === null) {
    return (
      <PaperProvider theme={theme}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
          <MaterialCommunityIcons name="bell-ring" size={64} color={colors.accent} />
          <Text variant="headlineMedium" style={{ color: colors.accent, marginTop: 16, fontWeight: 'bold' }}>
            OnCallShift
          </Text>
          <ActivityIndicator size="small" color={colors.accent} style={{ marginTop: 24 }} />
        </View>
      </PaperProvider>
    );
  }

  // Show onboarding for new users
  if (showOnboarding && !isLoggedIn) {
    return (
      <PaperProvider theme={theme}>
        <OnboardingScreen onComplete={handleOnboardingComplete} />
      </PaperProvider>
    );
  }

  // Show biometric lock screen
  if (isLoggedIn && !biometricVerified) {
    return (
      <PaperProvider theme={theme}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, padding: 40 }}>
          <View style={{
            width: 120,
            height: 120,
            borderRadius: 60,
            backgroundColor: colors.surface,
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 4,
          }}>
            <MaterialCommunityIcons name="lock" size={56} color={colors.accent} />
          </View>
          <Text variant="headlineSmall" style={{ color: colors.textPrimary, marginTop: 24, fontWeight: 'bold', textAlign: 'center' }}>
            OnCallShift is Locked
          </Text>
          <Text variant="bodyLarge" style={{ color: colors.textSecondary, marginTop: 8, textAlign: 'center' }}>
            Authenticate to continue
          </Text>
          <Pressable
            style={{
              marginTop: 32,
              width: '100%',
              backgroundColor: colors.accent,
              borderRadius: 12,
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onPress={checkBiometricAuth}
          >
            <MaterialCommunityIcons
              name="fingerprint"
              size={24}
              color="#fff"
              style={{ marginRight: 8 }}
            />
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
              Unlock with Biometrics
            </Text>
          </Pressable>
        </View>
      </PaperProvider>
    );
  }

  return (
    <PaperProvider theme={theme}>
      <ToastProvider>
        <View style={{ flex: 1 }}>
          <OfflineBanner />
          <NavigationContainer ref={navigationRef} linking={linking}>
            <StatusBar style={isDark ? 'light' : 'dark'} />
            <Stack.Navigator
              screenOptions={{
                headerStyle: {
                  backgroundColor: colors.primary,
                  elevation: 4,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.2,
                  shadowRadius: 4,
                },
                headerTintColor: '#fff',
                headerTitleStyle: {
                  fontWeight: '600',
                  fontSize: 18,
                },
                headerBackTitleVisible: false,
              }}
            >
              {!isLoggedIn ? (
                <>
                  <Stack.Screen
                    name="Login"
                    options={{ headerShown: false }}
                  >
                    {(props) => <LoginScreen {...props} onLoginSuccess={handleLogin} />}
                  </Stack.Screen>
                  <Stack.Screen
                    name="ForgotPassword"
                    component={ForgotPasswordScreen}
                    options={{ headerShown: false }}
                  />
                </>
              ) : (
                <>
                  <Stack.Screen
                    name="Main"
                    options={{ headerShown: false }}
                  >
                    {(props) => <MainTabs {...props} onLogout={handleLogout} incidentCount={incidentCount} unreadCount={unreadCount} />}
                  </Stack.Screen>
                  <Stack.Screen
                    name="AlertDetail"
                    component={AlertDetailScreen}
                    options={{ title: 'Incident Details' }}
                  />
                  <Stack.Screen
                    name="Schedule"
                    component={ScheduleScreen}
                    options={{ title: 'Schedule' }}
                  />
                  <Stack.Screen
                    name="Team"
                    component={TeamScreen}
                    options={{ title: 'Team' }}
                  />
                  <Stack.Screen
                    name="Analytics"
                    component={AnalyticsScreen}
                    options={{ title: 'Analytics' }}
                  />
                  <Stack.Screen
                    name="Settings"
                    options={{ title: 'Settings' }}
                  >
                    {(props) => <SettingsScreen {...props} onLogout={handleLogout} />}
                  </Stack.Screen>
                </>
              )}
            </Stack.Navigator>
          </NavigationContainer>
        </View>
      </ToastProvider>
    </PaperProvider>
  );
}

// Root component with ThemeProvider
export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
