import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { Eye, EyeOff, Mail, Lock, Apple, ChevronLeft } from 'lucide-react-native';
import Constants from 'expo-constants';
import { colors, radius, spacing, typography } from '@/constants/theme';
import PrimaryButton from '@/components/PrimaryButton';
import { useUserStore } from '@/store/userStore';
import { authService } from '@/services/authService';

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';

const IS_EXPO_GO = Constants.appOwnership === 'expo';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [showMFA, setShowMFA] = useState(false);
  const [socialLoading, setSocialLoading] = useState(null);

  const { setUser } = useUserStore();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    setIsLoading(true);
    try {
      console.log('[Login] Attempt with email');
      const result = await authService.login(email, password);
      if (result.requiresMFA) {
        setShowMFA(true);
      } else {
        setUser(result.user);
        useUserStore.getState().completeOnboarding();
        router.replace('/hq');
      }
    } catch (error) {
      console.error('[Login] Failed', error);
      Alert.alert('Login Failed', error?.message || 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocial = useCallback(async (provider) => {
    if (IS_EXPO_GO && (provider === 'apple' || provider === 'google' || provider === 'meta')) {
      Alert.alert(
        'Not available in Expo Go',
        `${provider === 'apple' ? 'Apple' : provider === 'google' ? 'Google' : 'Meta'} Sign-In requires a development build. Please use email/password while running in Expo Go.`
      );
      return;
    }
    try {
      setSocialLoading(provider);
      const result = await authService.loginWithProvider(provider);
      setUser(result.user);
      useUserStore.getState().completeOnboarding();
      router.replace('/hq');
    } catch (e) {
      console.error('[Social Login] Error', e);
      Alert.alert('Sign-in failed', 'Please try again.');
    } finally {
      setSocialLoading(null);
    }
  }, [setUser]);

  const handleMFAVerification = async () => {
    if (!mfaCode) {
      Alert.alert('Error', 'Please enter the verification code');
      return;
    }
    setIsLoading(true);
    try {
      const result = await authService.verifyMFA(email, mfaCode);
      setUser(result.user);
      useUserStore.getState().completeOnboarding();
      router.replace('/hq');
    } catch {
      Alert.alert('Verification Failed', 'Invalid verification code');
    } finally {
      setIsLoading(false);
    }
  };

  if (showMFA) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setShowMFA(false)} hitSlop={8}>
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.brand}>ZOWN HQ</Text>
          <View style={styles.backBtn} />
        </View>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>Two-Factor Authentication</Text>
            <Text style={styles.subtitle}>Enter the 6-digit code sent to your device</Text>

            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, { textAlign: 'center', letterSpacing: 4 }]}
                placeholder="000000"
                placeholderTextColor={colors.textTertiary}
                value={mfaCode}
                onChangeText={setMfaCode}
                keyboardType="number-pad"
                maxLength={6}
              />
            </View>

            <PrimaryButton
              title="Verify"
              onPress={handleMFAVerification}
              loading={isLoading}
              style={styles.submit}
            />

            <PrimaryButton
              title="Back to Login"
              variant="ghost"
              onPress={() => setShowMFA(false)}
              style={styles.ghostBtn}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.brandBlock}>
            <Text style={styles.brandLarge}>ZOWN HQ</Text>
            <Text style={styles.tagline}>OWN THE DAY</Text>
          </View>

          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to continue your mission</Text>

          <View style={styles.form} testID="login-form">
            <View style={styles.inputRow}>
              <Mail size={18} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={colors.textTertiary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputRow}>
              <Lock size={18} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={colors.textTertiary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
                {showPassword ? (
                  <EyeOff size={18} color={colors.textSecondary} />
                ) : (
                  <Eye size={18} color={colors.textSecondary} />
                )}
              </TouchableOpacity>
            </View>

            <PrimaryButton
              testID="emailSignInButton"
              title="Sign In"
              onPress={handleLogin}
              loading={isLoading}
              style={styles.submit}
            />

            <PrimaryButton
              title="Forgot Password?"
              variant="ghost"
              onPress={() => router.push('/auth/forgot-password')}
            />

            {!IS_EXPO_GO && Platform.OS !== 'web' ? (
              <PrimaryButton
                testID="appleSignIn"
                title="Continue with Apple"
                variant="outline"
                loading={socialLoading === 'apple'}
                onPress={() => handleSocial('apple')}
                leftIcon={<Apple size={18} color={colors.text} />}
                style={styles.socialBtn}
              />
            ) : null}

            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => router.push('/auth/register')}>
              <Text style={styles.linkLight}>
                Don&apos;t have an account? <Text style={styles.linkStrong}>Sign Up</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    minHeight: 56,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  brand: { fontSize: 20, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  brandBlock: {
    alignItems: 'center',
    marginTop: spacing.xxl,
    marginBottom: spacing.xxl,
  },
  brandLarge: {
    fontSize: 40,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -1,
  },
  tagline: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 6,
    letterSpacing: 2,
  },
  keyboardView: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  title: { ...typography.h1, marginBottom: spacing.xs },
  subtitle: { ...typography.bodySmall, marginBottom: spacing.xl },
  form: { gap: spacing.md },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.base,
    height: 56,
  },
  inputIcon: { marginRight: spacing.md },
  input: { flex: 1, fontSize: 16, color: colors.text },
  submit: { marginTop: spacing.sm },
  ghostBtn: { marginTop: spacing.xs },
  socialBtn: { marginTop: spacing.xs },
  linkButton: { alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.sm },
  linkLight: { ...typography.bodySmall, color: colors.textSecondary },
  linkStrong: { color: colors.text, fontWeight: '700' },
});
