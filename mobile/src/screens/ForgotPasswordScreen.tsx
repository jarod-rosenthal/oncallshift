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
import { useAppTheme } from '../context/ThemeContext';
import { colors } from '../theme';

interface ForgotPasswordScreenProps {
  navigation: any;
}

export default function ForgotPasswordScreen({ navigation }: ForgotPasswordScreenProps) {
  const theme = useTheme();
  const { colors } = useAppTheme();
  const themedStyles = styles(colors);
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSendCode = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    setLoading(true);
    try {
      await authService.forgotPassword(email);
      Alert.alert(
        'Code Sent',
        'A verification code has been sent to your email address.',
        [{ text: 'OK', onPress: () => setStep('code') }]
      );
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.message || 'Failed to send verification code. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!code) {
      Alert.alert('Error', 'Please enter the verification code');
      return;
    }

    if (!newPassword || newPassword.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await authService.confirmPassword(email, code, newPassword);
      Alert.alert(
        'Password Reset',
        'Your password has been reset successfully. Please sign in with your new password.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.message || 'Failed to reset password. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={themedStyles.container}
    >
      <View style={themedStyles.content}>
        {/* Header */}
        <View style={themedStyles.header}>
          <Surface style={themedStyles.iconContainer} elevation={2}>
            <MaterialCommunityIcons
              name={step === 'email' ? 'email-outline' : 'lock-reset'}
              size={48}
              color={theme.colors.primary}
            />
          </Surface>
          <Text variant="headlineMedium" style={themedStyles.title}>
            {step === 'email' ? 'Forgot Password?' : 'Reset Password'}
          </Text>
          <Text variant="bodyLarge" style={themedStyles.subtitle}>
            {step === 'email'
              ? "Enter your email and we'll send you a code to reset your password"
              : 'Enter the code we sent you and your new password'}
          </Text>
        </View>

        {/* Form */}
        <Surface style={themedStyles.formContainer} elevation={1}>
          {step === 'email' ? (
            <>
              <TextInput
                mode="outlined"
                label="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                left={<TextInput.Icon icon="email-outline" />}
                style={themedStyles.input}
                outlineStyle={themedStyles.inputOutline}
              />

              <Button
                mode="contained"
                onPress={handleSendCode}
                loading={loading}
                disabled={loading}
                style={themedStyles.button}
                contentStyle={themedStyles.buttonContent}
                labelStyle={themedStyles.buttonLabel}
              >
                Send Reset Code
              </Button>
            </>
          ) : (
            <>
              <TextInput
                mode="outlined"
                label="Verification Code"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                left={<TextInput.Icon icon="numeric" />}
                style={themedStyles.input}
                outlineStyle={themedStyles.inputOutline}
              />

              <TextInput
                mode="outlined"
                label="New Password"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                left={<TextInput.Icon icon="lock-outline" />}
                right={
                  <TextInput.Icon
                    icon={showPassword ? 'eye-off' : 'eye'}
                    onPress={() => setShowPassword(!showPassword)}
                  />
                }
                style={themedStyles.input}
                outlineStyle={themedStyles.inputOutline}
              />

              <TextInput
                mode="outlined"
                label="Confirm New Password"
                value={confirmNewPassword}
                onChangeText={setConfirmNewPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                left={<TextInput.Icon icon="lock-check-outline" />}
                style={themedStyles.input}
                outlineStyle={themedStyles.inputOutline}
              />

              <Button
                mode="contained"
                onPress={handleResetPassword}
                loading={loading}
                disabled={loading}
                style={themedStyles.button}
                contentStyle={themedStyles.buttonContent}
                labelStyle={themedStyles.buttonLabel}
              >
                Reset Password
              </Button>

              <Button
                mode="text"
                onPress={() => setStep('email')}
                style={themedStyles.linkButton}
              >
                Didn't receive the code? Send again
              </Button>
            </>
          )}

          <Button
            mode="text"
            onPress={() => navigation.goBack()}
            style={themedStyles.linkButton}
            icon="arrow-left"
          >
            Back to Sign In
          </Button>
        </Surface>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  formContainer: {
    padding: 24,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  input: {
    marginBottom: 16,
    backgroundColor: colors.surface,
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
