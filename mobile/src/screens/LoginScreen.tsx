import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Surface,
  useTheme,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as authService from '../services/authService';
import { initializePushNotifications } from '../services/notificationService';

interface LoginScreenProps {
  navigation: any;
  onLoginSuccess?: () => void;
}

export default function LoginScreen({ navigation, onLoginSuccess }: LoginScreenProps) {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Dynamic styles based on current theme
  const dynamicStyles = {
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    logoContainer: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: theme.colors.surface,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      marginBottom: 20,
    },
    subtitle: {
      color: theme.colors.onSurfaceVariant,
    },
    formContainer: {
      padding: 24,
      borderRadius: 16,
      backgroundColor: theme.colors.surface,
    },
    input: {
      marginBottom: 16,
      backgroundColor: theme.colors.surface,
    },
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    setLoading(true);
    try {
      await authService.signIn(email, password);

      initializePushNotifications().catch(_err => {
        // Push notifications may not be available on all devices
      });

      if (onLoginSuccess) {
        onLoginSuccess();
      } else {
        navigation.replace('AlertList');
      }
    } catch (error: any) {
      Alert.alert(
        'Login Failed',
        error.message || 'Invalid email or password. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={dynamicStyles.container}
    >
      <View style={styles.content}>
        {/* Logo/Title */}
        <View style={styles.header}>
          <Surface style={dynamicStyles.logoContainer} elevation={2}>
            <MaterialCommunityIcons
              name="bell-ring"
              size={48}
              color={theme.colors.primary}
            />
          </Surface>
          <Text variant="headlineLarge" style={[styles.title, { color: theme.colors.primary }]}>
            OnCallShift
          </Text>
          <Text variant="bodyLarge" style={dynamicStyles.subtitle}>
            Stay on top of incidents
          </Text>
        </View>

        {/* Login Form */}
        <Surface style={dynamicStyles.formContainer} elevation={1}>
          <TextInput
            mode="outlined"
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            left={<TextInput.Icon icon="email-outline" />}
            style={dynamicStyles.input}
            outlineStyle={styles.inputOutline}
          />
          <TextInput
            mode="outlined"
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            left={<TextInput.Icon icon="lock-outline" />}
            right={
              <TextInput.Icon
                icon={showPassword ? 'eye-off' : 'eye'}
                onPress={() => setShowPassword(!showPassword)}
              />
            }
            style={dynamicStyles.input}
            outlineStyle={styles.inputOutline}
          />

          <Button
            mode="contained"
            onPress={handleLogin}
            loading={loading}
            disabled={loading}
            style={styles.button}
            contentStyle={styles.buttonContent}
            labelStyle={styles.buttonLabel}
          >
            Sign In
          </Button>

          <Button
            mode="text"
            onPress={() => navigation.navigate('ForgotPassword')}
            style={styles.linkButton}
          >
            Forgot Password?
          </Button>
        </Surface>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  inputOutline: {
    borderRadius: 12,
  },
  button: {
    marginTop: 8,
    borderRadius: 12,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  linkButton: {
    marginTop: 12,
  },
});
