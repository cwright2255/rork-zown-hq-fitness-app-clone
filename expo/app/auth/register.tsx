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
import { Eye, EyeOff, Mail, Lock, User, Apple } from 'lucide-react-native';
import { useUserStore } from '@/store/userStore';
import { authService, AuthProvider } from '@/services/authService';

interface UserStoreState {
  setUser: (user: any) => void;
}

export default function RegisterScreen() {
  const [formData, setFormData] = useState<{ name: string; email: string; password: string; confirmPassword: string }>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [socialLoading, setSocialLoading] = useState<AuthProvider | null>(null);

  const { setUser } = useUserStore() as UserStoreState;

  const updateFormData = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleRegister = async () => {
    const { name, email, password, confirmPassword } = formData;

    if (!name || !email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters long');
      return;
    }

    setIsLoading(true);
    try {
      const result = await authService.register(name, email, password);
      setUser(result.user);
      router.replace('/onboarding' as any);
    } catch {
      Alert.alert('Registration Failed', 'Please try again');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocial = useCallback(async (provider: AuthProvider) => {
    try {
      setSocialLoading(provider);
      const result = await authService.loginWithProvider(provider);
      setUser(result.user);
      router.replace('/onboarding' as any);
    } catch {
      Alert.alert('Sign-up failed', 'Please try again.');
    } finally {
      setSocialLoading(null);
    }
  }, [setUser]);

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.diagonalHeader}>
        <View style={styles.whiteSlice} />
        <View style={styles.logoCenterContainer}>
          <Image 
            source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/eqtu2hf6sno9snll0zcru' }}
            style={styles.logoCenter} 
            testID="register-logo-zown"
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
          <View style={styles.form}>
            <View style={styles.inputUnderline}>
              <User size={18} color={'#9CA3AF'} style={styles.inlineIcon} />
              <TextInput
                style={styles.inputDark}
                placeholder="Full Name"
                placeholderTextColor="#9CA3AF"
                value={formData.name}
                onChangeText={(value) => updateFormData('name', value)}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputUnderline}>
              <Mail size={18} color={'#9CA3AF'} style={styles.inlineIcon} />
              <TextInput
                style={styles.inputDark}
                placeholder="Email"
                placeholderTextColor="#9CA3AF"
                value={formData.email}
                onChangeText={(value) => updateFormData('email', value)}
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
                value={formData.password}
                onChangeText={(value) => updateFormData('password', value)}
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

            <View style={styles.inputUnderline}>
              <Lock size={18} color={'#9CA3AF'} style={styles.inlineIcon} />
              <TextInput
                style={styles.inputDark}
                placeholder="Confirm Password"
                placeholderTextColor="#9CA3AF"
                value={formData.confirmPassword}
                onChangeText={(value) => updateFormData('confirmPassword', value)}
                secureTextEntry={!showConfirmPassword}
              />
              <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                {showConfirmPassword ? (
                  <EyeOff size={18} color={'#9CA3AF'} />
                ) : (
                  <Eye size={18} color={'#9CA3AF'} />
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              testID="registerSubmit"
              style={[styles.primaryPill, isLoading && styles.disabled]}
              onPress={handleRegister}
              disabled={isLoading}
            >
              {isLoading ? <ActivityIndicator color="#111827" /> : (
                <Text style={styles.primaryPillText}>Create Account</Text>
              )}
            </TouchableOpacity>

            <View style={styles.socialRow}>
              <TouchableOpacity
                testID="googleSignUp"
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
                  testID="appleSignUp"
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
                testID="metaSignUp"
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
              onPress={() => router.push('/auth/login' as any)}
            >
              <Text style={styles.linkLight}>
                Already have an account? <Text style={styles.linkStrong}>Sign In</Text>
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
  diagonalHeader: {
    height: 240,
    position: 'relative',
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  whiteSlice: {
    position: 'absolute',
    top: -160,
    left: -100,
    right: -100,
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
  },
  logoCenter: {
    width: 200,
    height: 60,
  },

  headerContent: {
    position: 'absolute',
    right: 16,
    bottom: 10,
  },
  brandWord: {
    color: '#fff',
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: 1,
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
    fontWeight: '800',
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
    fontWeight: '600',
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
    fontWeight: '700',
  },
  socialRow: {
    flexDirection: 'row',
    gap: 12,
  },
  socialIcon: {
    width: 18,
    height: 18,
  },
});
