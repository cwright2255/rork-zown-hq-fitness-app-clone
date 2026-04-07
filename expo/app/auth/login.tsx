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
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { Eye, EyeOff, Mail, Lock, Apple } from 'lucide-react-native';
import { useUserStore } from '@/store/userStore';
import { authService, AuthProvider } from '@/services/authService';

interface UserStoreState {
  setUser: (user: any) => void;
  completeOnboarding: () => void;
}

export default function LoginScreen() {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [mfaCode, setMfaCode] = useState<string>('');
  const [showMFA, setShowMFA] = useState<boolean>(false);
  const [socialLoading, setSocialLoading] = useState<AuthProvider | null>(null);

  const { setUser } = useUserStore() as UserStoreState;

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
        // For existing users logging in, assume they've completed onboarding
        // In a real app, this would be determined by user data from the server
        (useUserStore.getState() as UserStoreState).completeOnboarding();
        router.replace('/hq' as any);
      }
    } catch (error) {
      console.error('[Login] Failed', error);
      Alert.alert('Login Failed', 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocial = useCallback(async (provider: AuthProvider) => {
    try {
      console.log('[Social Login] Provider', provider);
      setSocialLoading(provider);
      const result = await authService.loginWithProvider(provider);
      setUser(result.user);
      // For social login, assume existing users have completed onboarding
      // In a real app, this would be determined by user data from the server
      (useUserStore.getState() as UserStoreState).completeOnboarding();
      router.replace('/hq' as any);
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
      // For MFA users, assume they've completed onboarding
      (useUserStore.getState() as UserStoreState).completeOnboarding();
      router.replace('/hq' as any);
    } catch {
      Alert.alert('Verification Failed', 'Invalid verification code');
    } finally {
      setIsLoading(false);
    }
  };

  if (showMFA) {
    return (
      <SafeAreaView style={styles.mfaContainer}>
        <Stack.Screen options={{ title: 'Verify' }} />
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.mfaHeader}>
              <Text style={styles.mfaTitle}>Two-Factor Authentication</Text>
              <Text style={styles.mfaSubtitle}>
                Enter the 6-digit code sent to your device
              </Text>
            </View>

            <View style={styles.form}>
              <View style={styles.inputUnderline}>
                <TextInput
                  style={styles.inputDark}
                  placeholder="Enter 6-digit code"
                  placeholderTextColor="#9CA3AF"
                  value={mfaCode}
                  onChangeText={setMfaCode}
                  keyboardType="number-pad"
                  maxLength={6}
                  textAlign="center"
                />
              </View>

              <TouchableOpacity
                style={[styles.primaryPill, isLoading && styles.disabled]}
                onPress={handleMFAVerification}
                disabled={isLoading}
              >
                <Text style={styles.primaryPillText}>
                  {isLoading ? 'Verifying...' : 'Verify'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => setShowMFA(false)}
              >
                <Text style={styles.linkLight}>Back to Login</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.diagonalHeader}>
        <View style={styles.whiteSlice} />
        <View style={styles.logoCenterContainer}>
          <Image 
            source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/vweh81504p0fox25qu1wk' }}
            style={styles.logoCenter} 
            testID="login-logo-zown"
            resizeMode="contain"
            accessibilityLabel="ZOWN Logo"
          />
        </View>
        <View style={styles.headerContent}>
          <Text style={styles.brandWord}>OWN THE DAY</Text>
        </View>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.form} testID="login-form">
            <View style={styles.inputUnderline}>
              <Mail size={18} color={'#9CA3AF'} style={styles.inlineIcon} />
              <TextInput
                style={styles.inputDark}
                placeholder="Email"
                placeholderTextColor="#9CA3AF"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputUnderline}>
              <Lock size={18} color={'#9CA3AF'} style={styles.inlineIcon} />
              <TextInput
                style={styles.inputDark}
                placeholder="Password"
                placeholderTextColor="#9CA3AF"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                {showPassword ? (
                  <EyeOff size={18} color={'#9CA3AF'} />
                ) : (
                  <Eye size={18} color={'#9CA3AF'} />
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              testID="emailSignInButton"
              style={[styles.primaryPill, isLoading && styles.disabled]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? <ActivityIndicator color="#111827" /> : (
                <Text style={styles.primaryPillText}>Enter</Text>
              )}
            </TouchableOpacity>

            <View style={styles.socialRow}>
              <TouchableOpacity
                testID="googleSignIn"
                style={styles.outlinePill}
                onPress={() => handleSocial('google')}
                disabled={socialLoading === 'google'}
              >
                {socialLoading === 'google' ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Image source={{ uri: 'https://cdn.simpleicons.org/google/FFF' }} style={styles.socialIcon} />
                    <Text style={styles.outlineText}>Google</Text>
                  </>
                )}
              </TouchableOpacity>

              {Platform.OS !== 'web' && (
                <TouchableOpacity
                  testID="appleSignIn"
                  style={styles.outlinePill}
                  onPress={() => handleSocial('apple')}
                  disabled={socialLoading === 'apple'}
                >
                  {socialLoading === 'apple' ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Apple size={18} color={'#fff'} />
                      <Text style={styles.outlineText}>Apple</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              <TouchableOpacity
                testID="metaSignIn"
                style={styles.outlinePill}
                onPress={() => handleSocial('meta')}
                disabled={socialLoading === 'meta'}
              >
                {socialLoading === 'meta' ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Image source={{ uri: 'https://cdn.simpleicons.org/meta/FFF' }} style={styles.socialIcon} />
                    <Text style={styles.outlineText}>Meta</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => router.push('/auth/forgot-password' as any)}
            >
              <Text style={styles.linkLight}>Forgot Password?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => router.push('/auth/register' as any)}
            >
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
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  mfaContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  diagonalHeader: {
    height: 220,
    position: 'relative',
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  whiteSlice: {
    position: 'absolute',
    top: -230,
    left: -140,
    right: -60,
    height: 360,
    backgroundColor: '#fff',
    transform: [{ rotate: '-18deg' }],
  },
  logoCenterContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 3,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateY: -24 }],
  },
  logoCenter: {
    width: 200,
    height: 60,
  },
  headerContent: {
    position: 'absolute',
    right: 16,
    bottom: -12,
    zIndex: 2,
    alignItems: 'flex-end',
  },
  brandWord: {
    color: '#fff',
    fontSize: 42,
    fontWeight: '900' as const,
    letterSpacing: 1,
    textAlign: 'right' as const,
    maxWidth: 260,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  form: {
    gap: 16,
  },
  inlineIcon: {
    marginRight: 8,
  },
  inputUnderline: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
    paddingVertical: 6,
  },
  inputDark: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    paddingVertical: 8,
  },
  primaryPill: {
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryPillText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '800' as const,
  },
  outlinePill: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  outlineText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  disabled: {
    opacity: 0.6,
  },
  linkButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  linkLight: {
    color: '#E5E7EB',
    fontSize: 13,
  },
  linkStrong: {
    color: '#fff',
    fontWeight: '700' as const,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 12,
  },
  socialIcon: {
    width: 18,
    height: 18,
  },
  mfaHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  mfaTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: '#fff',
    marginBottom: 6,
  },
  mfaSubtitle: {
    fontSize: 14,
    color: '#D1D5DB',
  },
});