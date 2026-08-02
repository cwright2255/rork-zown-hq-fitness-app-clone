import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { Eye, EyeOff, Mail, Lock, User, ChevronLeft, Target, Dumbbell, Flame, TrendingUp, Activity, Zap } from 'lucide-react-native';
import { radius, spacing, typography } from '@/constants/theme';
import PrimaryButton from '@/components/PrimaryButton';
import { useUserStore } from '@/store/userStore';
import { authService } from '@/services/authService';
import { tokens } from '../../../theme/tokens';



const GOALS = [
  { id: 'muscle', label: 'Build Muscle', icon: Dumbbell },
  { id: 'weight', label: 'Lose Weight', icon: Flame },
  { id: 'endurance', label: 'Endurance', icon: TrendingUp },
  { id: 'strength', label: 'Strength', icon: Target },
];

const ACTIVITY_LEVELS = [
  { id: 'beginner', label: 'Beginner', description: 'New to training or returning after a break', icon: Activity },
  { id: 'intermediate', label: 'Intermediate', description: 'Consistent training for 6+ months', icon: Zap },
  { id: 'advanced', label: 'Advanced', description: 'Training 4+ days/week for years', icon: Flame },
];

export default function RegisterScreen() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [goal, setGoal] = useState(null);
  const [activityLevel, setActivityLevel] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { setUser } = useUserStore();

  const updateFormData = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const validateStep1 = () => {
    const { name, email, password, confirmPassword } = formData;
    if (!name || !email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return false;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return false;
    }
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters long');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 1) {
      if (!validateStep1()) return;
      setStep(2);
    } else if (step === 2) {
      if (!goal) {
        Alert.alert('Select a goal', 'Choose what you want to focus on');
        return;
      }
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else if (router.canGoBack()) {
      (router.canGoBack() ? router.back() : router.replace('/'));
    } else {
      router.replace('/auth/login');
    }
  };

  const handleRegister = useCallback(async () => {
    if (!activityLevel) {
      Alert.alert('Select activity level', 'Choose your current level');
      return;
    }
    const { name, email, password } = formData;
    setIsLoading(true);
    try {
      const result = await authService.register(name, email, password);
      setUser({ ...result.user, goal, activityLevel });
      router.replace('/onboarding');
    } catch (error) {
      console.error('[Register] Failed', error);
      Alert.alert('Registration Failed', error?.message || 'Please try again');
    } finally {
      setIsLoading(false);
    }
  }, [formData, goal, activityLevel, setUser]);

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack} hitSlop={8}>
          <ChevronLeft size={24} color={'#000000'} />
        </TouchableOpacity>
        <Text style={styles.brand}>ZOWN HQ</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.dotsRow}>
        {[1, 2, 3].map((n) => (
          <View
            key={n}
            style={[styles.dot, step === n && styles.dotActive, step > n && styles.dotDone]}
          />
        ))}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {step === 1 && (
            <View>
              <Text style={styles.title}>Create account</Text>
              <Text style={styles.subtitle}>Start owning your day</Text>

              <View style={styles.form}>
                <View style={styles.inputRow}>
                  <User size={18} color={'#666666'} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Full Name"
                    placeholderTextColor={'#666666'}
                    value={formData.name}
                    onChangeText={(v) => updateFormData('name', v)}
                    autoCapitalize="words"
                  />
                </View>

                <View style={styles.inputRow}>
                  <Mail size={18} color={'#666666'} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Email"
                    placeholderTextColor={'#666666'}
                    value={formData.email}
                    onChangeText={(v) => updateFormData('email', v)}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.inputRow}>
                  <Lock size={18} color={'#666666'} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Password"
                    placeholderTextColor={'#666666'}
                    value={formData.password}
                    onChangeText={(v) => updateFormData('password', v)}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
                    {showPassword ? <EyeOff size={18} color={'#666666'} /> : <Eye size={18} color={'#666666'} />}
                  </TouchableOpacity>
                </View>

                <View style={styles.inputRow}>
                  <Lock size={18} color={'#666666'} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Confirm Password"
                    placeholderTextColor={'#666666'}
                    value={formData.confirmPassword}
                    onChangeText={(v) => updateFormData('confirmPassword', v)}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} hitSlop={8}>
                    {showConfirmPassword ? <EyeOff size={18} color={'#666666'} /> : <Eye size={18} color={'#666666'} />}
                  </TouchableOpacity>
                </View>

                <PrimaryButton title="Continue" onPress={handleNext} style={styles.submit} />

                <TouchableOpacity style={styles.linkButton} onPress={() => router.push('/auth/login')}>
                  <Text style={styles.linkLight}>
                    Already have an account? <Text style={styles.linkStrong}>Sign In</Text>
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {step === 2 && (
            <View>
              <Text style={styles.title}>What's your goal?</Text>
              <Text style={styles.subtitle}>Pick your main focus</Text>

              <View style={styles.gridRow}>
                {GOALS.map((g) => {
                  const Icon = g.icon;
                  const selected = goal === g.id;
                  return (
                    <TouchableOpacity
                      key={g.id}
                      activeOpacity={0.85}
                      style={[styles.goalCard, selected && styles.goalCardActive]}
                      onPress={() => setGoal(g.id)}>
                      <Icon size={28} color={selected ? '#000' : '#000000'} />
                      <Text style={[styles.goalLabel, selected && styles.goalLabelActive]}>
                        {g.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <PrimaryButton title="Continue" onPress={handleNext} style={styles.submit} />
            </View>
          )}

          {step === 3 && (
            <View>
              <Text style={styles.title}>Your activity level</Text>
              <Text style={styles.subtitle}>How experienced are you?</Text>

              <View style={{ gap: spacing.md }}>
                {ACTIVITY_LEVELS.map((a) => {
                  const Icon = a.icon;
                  const selected = activityLevel === a.id;
                  return (
                    <TouchableOpacity
                      key={a.id}
                      activeOpacity={0.85}
                      style={[styles.activityCard, selected && styles.activityCardActive]}
                      onPress={() => setActivityLevel(a.id)}>
                      <View style={[styles.activityIcon, selected && styles.activityIconActive]}>
                        <Icon size={20} color={selected ? '#000' : '#000000'} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.activityLabel}>{a.label}</Text>
                        <Text style={styles.activityDesc}>{a.description}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <PrimaryButton
                testID="registerSubmit"
                title="Create Account"
                onPress={handleRegister}
                loading={isLoading}
                style={styles.submit}
              />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
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
  brand: { fontSize: 20, fontWeight: '800', color: '#000000', letterSpacing: -0.3 },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: tokens.spacing.sm,
    marginVertical: spacing.md,
  },
  dot: {
    width: 8, height: 8, borderRadius: tokens.radius.xs,
    backgroundColor: '#E5E5E5',
  },
  dotActive: {
    width: 24,
    backgroundColor: '#000000',
  },
  dotDone: {
    backgroundColor: '#666666',
  },
  keyboardView: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  title: { ...typography.h1, color: '#000000', marginBottom: spacing.xs },
  subtitle: { ...typography.bodySmall, color: '#666666', marginBottom: spacing.xl },
  form: { gap: spacing.md },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: radius.md,
    paddingHorizontal: spacing.base,
    height: 56,
  },
  inputIcon: { marginRight: spacing.md },
  input: { flex: 1, fontSize: 16, color: '#000000' },
  submit: { marginTop: spacing.lg },
  linkButton: { alignItems: 'center', paddingVertical: spacing.md },
  linkLight: { ...typography.bodySmall, color: '#666666' },
  linkStrong: { color: '#000000', fontWeight: '700' },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  goalCard: {
    width: '47%',
    aspectRatio: 1,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.base,
  },
  goalCardActive: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  goalLabel: { ...typography.h4, color: '#000000', textAlign: 'center' },
  goalLabelActive: { color: tokens.colors.dark_navy.text_primary },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: radius.lg,
    padding: spacing.base,
    gap: spacing.md,
  },
  activityCardActive: {
    borderColor: '#000000',
  },
  activityIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#EEEEEE',
    alignItems: 'center', justifyContent: 'center',
  },
  activityIconActive: {
    backgroundColor: '#000000',
  },
  activityLabel: { ...typography.h4, color: '#000000', marginBottom: 2 },
  activityDesc: { ...typography.bodySmall, color: '#666666' },
});
