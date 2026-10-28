import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Image,
  useWindowDimensions,
} from 'react-native';
import { router, Stack } from 'expo-router';
import Svg, { Polygon } from 'react-native-svg';
import { Ionicons, FontAwesome6 } from '@expo/vector-icons';
import { useUserStore } from '@/store/userStore';
import { authService } from '@/services/authService';
import { loginLayout } from '@/lib/loginLayout';
import { hasLaunchSplashPlayed, markLaunchSplashPlayed } from '@/lib/launchSplash';
import ZownGlitchSplash from '@/components/ZownGlitchSplash';

// Sign in with Apple has its own button, which Apple requires. Loaded defensively: a build without the
// native module still shows the rest of the screen.
let AppleAuthentication = null;
try {
  AppleAuthentication = require('expo-apple-authentication');
} catch (e) {
  AppleAuthentication = null;
}

// One outlined pill for Google or Meta.
function ProviderPill({ testID, label, icon, working, dimmed, onPress }) {
  return (
    <TouchableOpacity
      testID={testID}
      style={[styles.pill, dimmed && styles.pillDimmed]}
      onPress={onPress}
      disabled={working || dimmed}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`Sign in with ${label}`}>
      {working ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : (
        <>
          {icon}
          <Text style={styles.pillText}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [busyProvider, setBusyProvider] = useState(null); // 'apple' | 'google' | 'meta' while that sign-in is open
  const [appleAvailable, setAppleAvailable] = useState(false);
  const { setUser } = useUserStore();
  const { width: screenWidth } = useWindowDimensions();
  const layout = loginLayout(screenWidth);
  const busy = isLoading || busyProvider !== null;

  // Sign in with Apple is only offered where the phone can do it.
  useEffect(() => {
    if (!AppleAuthentication) return undefined;
    let cancelled = false;
    Promise.resolve()
      .then(() => AppleAuthentication.isAvailableAsync())
      .then((ok) => { if (!cancelled) setAppleAvailable(!!ok); })
      .catch(() => { if (!cancelled) setAppleAvailable(false); });
    return () => { cancelled = true; };
  }, []);

  // The launch splash (components/ZownGlitchSplash.jsx) plays over this screen once each time the app is opened, then slides
  // up to reveal it. Reaching this screen again in the same session (after signing out) does not play it again.
  const [showSplash, setShowSplash] = useState(() => !hasLaunchSplashPlayed());
  useEffect(() => { markLaunchSplashPlayed(); }, []);

  /* auth */
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

  // Apple, Google or Meta (services/socialAuth.js). An account these create goes to onboarding, like a new
  // email account; one that already existed goes home, like an email sign-in. Closing the sheet says nothing.
  // `signingIn` is a ref, not state: a second tap in the same moment would still see the old state.
  const signingIn = useRef(false);
  const handleProvider = useCallback(async (provider) => {
    if (signingIn.current || isLoading) return;
    signingIn.current = true;
    setErrorMsg('');
    setBusyProvider(provider);
    try {
      const result = await authService.loginWithProvider(provider);
      if (!result || !result.user) {
        setErrorMsg('Sign-in failed. Please try again.');
        return;
      }
      setUser(result.user);
      if (result.isNewUser) {
        router.replace('/onboarding');
      } else {
        useUserStore.getState().completeOnboarding();
        router.replace('/hq');
      }
    } catch (error) {
      if (error && error.code === 'cancelled') return;
      setErrorMsg((error && error.message) || 'Sign-in failed. Please try again.');
    } finally {
      signingIn.current = false;
      setBusyProvider(null);
    }
  }, [isLoading, setUser]);

  const taglineStyle = [styles.tagline, { fontSize: layout.tagline.fontSize, lineHeight: layout.tagline.lineHeight }];

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* login content */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          showsVerticalScrollIndicator={false}>

          {/* white above the line, black below it; the line rises to the right at lib/loginLayout.js's angle */}
          <View style={{ height: layout.headerHeight }} testID="login-header">
            <Svg width={layout.width} height={layout.headerHeight} style={StyleSheet.absoluteFill}>
              <Polygon points={layout.whitePoints} fill="#FFFFFF" />
            </Svg>
            <Image
              source={require('@/assets/branding/zown-wordmark.png')}
              style={{ position: 'absolute', ...layout.logo }}
              resizeMode="contain"
              accessibilityLabel="ZOWN"
              testID="login-logo"
            />
            {/* tagline, on the black below the line */}
            <View style={{ position: 'absolute', top: layout.tagline.top, right: layout.tagline.right, alignItems: 'flex-end' }}>
              <Text style={taglineStyle}>OWN THE</Text>
              <Text style={taglineStyle}>DAY</Text>
            </View>
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
              <Ionicons name="mail-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#9CA3AF"
                value={email}
                onChangeText={(t) => { setEmail(t); setErrorMsg(''); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                returnKeyType="next"
                editable={!busy}
              />
            </View>

            {/* password */}
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#9CA3AF"
                value={password}
                onChangeText={(t) => { setPassword(t); setErrorMsg(''); }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                editable={!busy}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#9CA3AF"
                />
              </TouchableOpacity>
            </View>

            {/* enter button */}
            <TouchableOpacity
              style={[styles.enterBtn, busy && styles.enterBtnDisabled]}
              onPress={handleLogin}
              disabled={busy}
              activeOpacity={0.85}>
              {isLoading ? (
                <ActivityIndicator size="small" color="#000000" />
              ) : (
                <Text style={styles.enterBtnText}>Enter</Text>
              )}
            </TouchableOpacity>

            {/* Sign in with Apple: Apple's own button, only where the phone offers it */}
            {AppleAuthentication && appleAvailable ? (
              <View
                style={[styles.appleWrap, busy && styles.pillDimmed]}
                pointerEvents={busy ? 'none' : 'auto'}>
                <AppleAuthentication.AppleAuthenticationButton
                  testID="login-apple"
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE_OUTLINE}
                  cornerRadius={24}
                  style={styles.appleBtn}
                  onPress={() => handleProvider('apple')}
                />
              </View>
            ) : null}

            {/* Google and Meta */}
            <View style={styles.pillRow}>
              <ProviderPill
                testID="login-google"
                label="Google"
                icon={<FontAwesome6 name="google" brand size={17} color="#FFFFFF" />}
                working={busyProvider === 'google'}
                dimmed={busy && busyProvider !== 'google'}
                onPress={() => handleProvider('google')}
              />
              <ProviderPill
                testID="login-meta"
                label="Meta"
                icon={<FontAwesome6 name="meta" brand size={17} color="#FFFFFF" />}
                working={busyProvider === 'meta'}
                dimmed={busy && busyProvider !== 'meta'}
                onPress={() => handleProvider('meta')}
              />
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

      {/* launch splash, on top until it has slid away */}
      {showSplash ? <ZownGlitchSplash onFinish={() => setShowSplash(false)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    backgroundColor: '#000000',
    paddingBottom: 32,
  },

  /* tagline: white, on the black below the line */
  tagline: {
    color: '#FFFFFF',
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'right',
  },

  /* form */
  form: {
    paddingHorizontal: 24,
    paddingTop: 8,
    gap: 16,
  },
  errorBox: {
    backgroundColor: 'rgba(255,22,84,0.15)',
    borderRadius: 10,
    padding: 10,
  },
  errorText: {
    color: '#FF6B8A',
    fontSize: 13,
    textAlign: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingVertical: 10,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#FFFFFF',
    paddingVertical: 6,
  },

  /* enter button */
  enterBtn: {
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  enterBtnDisabled: {
    opacity: 0.6,
  },
  enterBtnText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },

  /* Apple, Google, Meta */
  appleWrap: {
    height: 48,
  },
  appleBtn: {
    width: '100%',
    height: 48,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 12,
  },
  pill: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pillDimmed: {
    opacity: 0.5,
  },
  pillText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  /* links */
  forgotBtn: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  forgotText: {
    color: '#E5E7EB',
    fontSize: 13,
  },
  signUpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  signUpGray: {
    color: '#9CA3AF',
    fontSize: 13,
  },
  signUpBold: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
