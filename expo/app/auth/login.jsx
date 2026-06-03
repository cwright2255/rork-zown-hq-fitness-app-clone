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
  StatusBar,
  ActivityIndicator,
  Image,
  Dimensions,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react-native';
import { useUserStore } from '@/store/userStore';
import { authService } from '@/services/authService';

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';

const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const { setUser } = useUserStore();

  const handleLogin = useCallback(async () => {
    setErrorMsg('');
    if (!email.trim()) {
      setErrorMsg('Please enter your email');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your password');
      return;
    }
    setIsLoading(true);
    try {
      const result = await authService.login(email.trim(), password);
      if (result && result.user) {
        setUser(result.user);
        useUserStore.getState().completeOnboarding();
        router.replace('/hq');
      } else {
        setErrorMsg('Login failed. Please try again.');
      }
    } catch (error) {
      const msg = error?.message || 'An error occurred during login';
      if (msg.includes('invalid-credential') || msg.includes('wrong-password') || msg.includes('user-not-found')) {
        setErrorMsg('Invalid email or password');
      } else if (msg.includes('too-many-requests')) {
        setErrorMsg('Too many attempts. Please try again later.');
      } else if (msg.includes('network')) {
        setErrorMsg('Network error. Check your connection.');
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setIsLoading(false);
    }
  }, [email, password, setUser]);

  const handleGoogleLogin = () => {
    Alert.alert('Google Sign-In', 'Google authentication will be available soon.', [{ text: 'OK' }]);
  };

  const handleMetaLogin = () => {
    Alert.alert('Meta Sign-In', 'Meta authentication will be available soon.', [{ text: 'OK' }]);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          bounces={false}>

          {/* Diagonal white header with logo */}
          <View style={styles.headerSection}>
            <View style={styles.whiteDiagonal}>
              <View style={styles.diagonalInner} />
            </View>
            <View style={styles.logoContainer}>
              <Image
                source={require('@/assets/branding/zown-logo-512.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
          </View>

          {/* "OWN THE DAY" tagline */}
          <View style={styles.taglineSection}>
            <Text style={styles.tagline}>OWN THE DAY</Text>
          </View>

          {/* Form section */}
          <View style={styles.formSection}>
            {/* Error message */}
            {errorMsg ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            ) : null}

            {/* Email input */}
            <View style={styles.inputRow}>
              <Mail size={20} color="#666666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#666666"
                value={email}
                onChangeText={(t) => { setEmail(t); setErrorMsg(''); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                returnKeyType="next"
                editable={!isLoading}
              />
            </View>

            {/* Password input */}
            <View style={styles.inputRow}>
              <Lock size={20} color="#666666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#666666"
                value={password}
                onChangeText={(t) => { setPassword(t); setErrorMsg(''); }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                editable={!isLoading}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                {showPassword ? (
                  <EyeOff size={20} color="#666666" />
                ) : (
                  <Eye size={20} color="#666666" />
                )}
              </TouchableOpacity>
            </View>

            {/* Enter button */}
            <TouchableOpacity
              style={[styles.enterBtn, isLoading && styles.enterBtnDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.8}>
              {isLoading ? (
                <ActivityIndicator size="small" color="#000000" />
              ) : (
                <Text style={styles.enterBtnText}>Enter</Text>
              )}
            </TouchableOpacity>

            {/* Social login row */}
            <View style={styles.socialRow}>
              <TouchableOpacity style={styles.socialBtn} onPress={handleGoogleLogin} activeOpacity={0.7}>
                <Text style={styles.socialBtnIcon}>G</Text>
                <Text style={styles.socialBtnText}>Google</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.socialBtn} onPress={handleMetaLogin} activeOpacity={0.7}>
                <Text style={styles.socialBtnIcon}>{String.fromCodePoint(8734)}</Text>
                <Text style={styles.socialBtnText}>Meta</Text>
              </TouchableOpacity>
            </View>

            {/* Forgot password */}
            <TouchableOpacity
              style={styles.forgotBtn}
              onPress={() => router.push('/auth/forgot-password')}>
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>

            {/* Sign up */}
            <View style={styles.signUpRow}>
              <Text style={styles.signUpLabel}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/auth/register')}>
                <Text style={styles.signUpLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const HEADER_HEIGHT = height * 0.30;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
  },

  /* ── Header / diagonal ── */
  headerSection: {
    height: HEADER_HEIGHT,
    position: 'relative',
    overflow: 'hidden',
  },
  whiteDiagonal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HEADER_HEIGHT + 60,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  diagonalInner: {
    position: 'absolute',
    bottom: -30,
    left: -20,
    right: -20,
    height: 80,
    backgroundColor: '#000000',
    transform: [{ skewY: '-6deg' }],
  },
  logoContainer: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  logo: {
    width: 56,
    height: 56,
  },

  /* ── Tagline ── */
  taglineSection: {
    paddingTop: 32,
    paddingBottom: 24,
    alignItems: 'center',
  },
  tagline: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 4,
    textAlign: 'center',
  },

  /* ── Form ── */
  formSection: {
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 22, 84, 0.15)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#FF1654',
    fontSize: 14,
    textAlign: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    marginBottom: 24,
    paddingBottom: 8,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
    paddingVertical: 8,
  },
  eyeBtn: {
    padding: 4,
  },

  /* ── Enter button ── */
  enterBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 24,
    minHeight: 56,
  },
  enterBtnDisabled: {
    opacity: 0.7,
  },
  enterBtnText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1,
  },

  /* ── Social buttons ── */
  socialRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  socialBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    paddingVertical: 14,
    gap: 8,
  },
  socialBtnIcon: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  socialBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  /* ── Footer links ── */
  forgotBtn: {
    alignItems: 'center',
    marginBottom: 24,
  },
  forgotText: {
    color: '#AAAAAA',
    fontSize: 14,
  },
  signUpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signUpLabel: {
    color: '#AAAAAA',
    fontSize: 14,
  },
  signUpLink: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
