import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  Animated,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUserStore } from '@/store/userStore';
import { authService } from '@/services/authService';

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';

const { width, height } = Dimensions.get('window');
const DIAGONAL_HEIGHT = 260;

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const { setUser } = useUserStore();

  /* ── splash overlay ── */
  const splashY = useRef(new Animated.Value(0)).current;
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(splashY, {
        toValue: -height,
        duration: 800,
        useNativeDriver: true,
      }).start(() => setSplashDone(true));
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  /* ── auth ── */
  const handleLogin = useCallback(async () => {
    setErrorMsg('');
    if (!email.trim()) { setErrorMsg('Please enter your email'); return; }
    if (!password) { setErrorMsg('Please enter your password'); return; }

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
      const msg = error?.message || 'An error occurred';
      if (msg.includes('invalid-credential') || msg.includes('wrong-password') || msg.includes('user-not-found'))
        setErrorMsg('Invalid email or password');
      else if (msg.includes('too-many-requests'))
        setErrorMsg('Too many attempts. Try again later.');
      else if (msg.includes('network'))
        setErrorMsg('Network error. Check your connection.');
      else setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  }, [email, password, setUser]);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* ── login content ── */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          showsVerticalScrollIndicator={false}>

          {/* diagonal white header */}
          <View style={styles.diagonalWrap}>
            <View style={styles.whiteBlock} />
            <View style={styles.blackCut} />
            <Image
              source={require('@/assets/branding/zown-logo-512.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          {/* tagline */}
          <View style={styles.taglineWrap}>
            <Text style={styles.tagline1}>OWN THE</Text>
            <Text style={styles.tagline2}>DAY</Text>
          </View>

          {/* form */}
          <View style={styles.form}>
            {errorMsg ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            ) : null}

            {/* email */}
            <View style={styles.inputRow}>
              <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#666"
                value={email}
                onChangeText={(t) => { setEmail(t); setErrorMsg(''); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                returnKeyType="next"
                editable={!isLoading}
              />
            </View>

            {/* password */}
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#666"
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
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#666"
                />
              </TouchableOpacity>
            </View>

            {/* enter button */}
            <TouchableOpacity
              style={[styles.enterBtn, isLoading && styles.enterBtnDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.85}>
              {isLoading ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text style={styles.enterBtnText}>Enter</Text>
              )}
            </TouchableOpacity>

            {/* social row */}
            <View style={styles.socialRow}>
              <TouchableOpacity
                style={styles.socialBtn}
                activeOpacity={0.7}
                onPress={() => Alert.alert('Google Sign-In', 'Google authentication coming soon.', [{ text: 'OK' }])}>
                <Text style={styles.socialIcon}>G</Text>
                <Text style={styles.socialLabel}>Google</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.socialBtn}
                activeOpacity={0.7}
                onPress={() => Alert.alert('Meta Sign-In', 'Meta authentication coming soon.', [{ text: 'OK' }])}>
                <Ionicons name="infinite-outline" size={18} color="#fff" />
                <Text style={styles.socialLabel}>Meta</Text>
              </TouchableOpacity>
            </View>

            {/* links */}
            <TouchableOpacity
              style={styles.forgotBtn}
              onPress={() => router.push('/auth/forgot-password')}>
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>

            <View style={styles.signUpRow}>
              <Text style={styles.signUpGray}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/auth/register')}>
                <Text style={styles.signUpBold}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── splash overlay ── */}
      {!splashDone && (
        <Animated.View
          style={[styles.splashOverlay, { transform: [{ translateY: splashY }] }]}
          pointerEvents="none">
          <Image
            source={require('@/assets/branding/zown-logo-512.png')}
            style={styles.splashLogo}
            resizeMode="contain"
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
  },

  /* diagonal header */
  diagonalWrap: {
    height: DIAGONAL_HEIGHT,
    position: 'relative',
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  whiteBlock: {
    position: 'absolute',
    top: -80,
    left: -20,
    right: -80,
    height: 320,
    backgroundColor: '#fff',
    transform: [{ rotate: '8deg' }],
  },
  blackCut: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 0,
  },
  logo: {
    position: 'absolute',
    top: 40,
    left: (width - 140) / 2,
    width: 140,
    height: 42,
    zIndex: 3,
  },

  /* tagline — right-aligned at bottom of header */
  taglineWrap: {
    marginTop: -24,
    paddingRight: 24,
    alignItems: 'flex-end',
    zIndex: 2,
    marginBottom: 20,
  },
  tagline1: {
    color: '#fff',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'right',
    lineHeight: 40,
  },
  tagline2: {
    color: '#fff',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'right',
    lineHeight: 40,
  },

  /* form */
  form: {
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 16,
  },
  errorBox: {
    backgroundColor: 'rgba(255,22,84,0.15)',
    borderRadius: 10,
    padding: 10,
  },
  errorText: {
    color: '#FF1654',
    fontSize: 13,
    textAlign: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    paddingVertical: 8,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#fff',
    paddingVertical: 6,
  },

  /* enter button */
  enterBtn: {
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  enterBtnDisabled: {
    opacity: 0.6,
  },
  enterBtnText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '700',
  },

  /* social */
  socialRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    marginTop: 4,
  },
  socialBtn: {
    width: 130,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  socialIcon: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  socialLabel: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },

  /* links */
  forgotBtn: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  forgotText: {
    color: '#aaa',
    fontSize: 13,
  },
  signUpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  signUpGray: {
    color: '#aaa',
    fontSize: 13,
  },
  signUpBold: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },

  /* splash overlay */
  splashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  splashLogo: {
    width: width * 0.35,
    height: width * 0.35,
  },
});

