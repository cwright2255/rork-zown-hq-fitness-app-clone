import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Animated,
  Dimensions
} from 'react-native';
import { useRouter } from 'expo-router';
import { useUserStore } from '@/store/userStore';
import { ChevronLeft } from 'lucide-react-native';

const { width } = Dimensions.get('window');

// Option Lists
const GOALS = [
  { id: 'lose_weight', label: 'Lose Weight', icon: '⚖️' },
  { id: 'build_muscle', label: 'Build Muscle', icon: '💪' },
  { id: 'improve_endurance', label: 'Improve Endurance', icon: '❤️' },
  { id: 'stay_active', label: 'Stay Active', icon: '🏃' },
  { id: 'train_for_race', label: 'Train for a Race', icon: '⏱️' },
  { id: 'eat_healthier', label: 'Eat Healthier', icon: '🍎' },
  { id: 'reduce_stress', label: 'Reduce Stress', icon: '🧠' }
];

const ACTIVITY_LEVELS = [
  { id: 'sedentary', label: 'Sedentary', desc: 'Little to no exercise, desk job' },
  { id: 'lightly_active', label: 'Lightly Active', desc: 'Light exercise or sports 1-3 days/week' },
  { id: 'moderately_active', label: 'Moderately Active', desc: 'Moderate exercise or sports 3-5 days/week' },
  { id: 'very_active', label: 'Very Active', desc: 'Hard exercise or sports 6-7 days/week' },
  { id: 'extremely_active', label: 'Extremely Active', desc: 'Very hard exercise, physical job or athlete' }
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { user, completeOnboarding, saveProfile, loadProfile } = useUserStore();

  // Step indicator
  const [step, setStep] = useState(1);

  // Form Fields State
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('Prefer not to say');
  
  // Height / Weight units and values
  const [isMetric, setIsMetric] = useState(true);
  const [heightVal, setHeightVal] = useState(''); // cm or feet portion
  const [heightInches, setHeightInches] = useState(''); // inches portion if imperial
  const [weightVal, setWeightVal] = useState(''); // kg or lbs

  const [activityLevel, setActivityLevel] = useState('moderately_active');
  const [selectedGoals, setSelectedGoals] = useState([]);
  
  // Workout preferences
  const [daysPerWeek, setDaysPerWeek] = useState('3');
  const [duration, setDuration] = useState('30min');
  const [timeOfDay, setTimeOfDay] = useState('Morning');

  // Load initial name from user store if present
  useEffect(() => {
    if (user?.name) {
      setName(user.name);
    }
  }, [user]);

  // Handle goals toggling (1-3 goals)
  const toggleGoal = (id) => {
    if (selectedGoals.includes(id)) {
      setSelectedGoals(selectedGoals.filter(g => g !== id));
    } else {
      if (selectedGoals.length < 3) {
        setSelectedGoals([...selectedGoals, id]);
      }
    }
  };

  // Convert height to cm for storage
  const getCalculatedHeight = () => {
    if (isMetric) {
      return parseFloat(heightVal) || 175;
    } else {
      const ft = parseFloat(heightVal) || 5;
      const inch = parseFloat(heightInches) || 7;
      return Math.round((ft * 12 + inch) * 2.54);
    }
  };

  // Convert weight to kg for storage
  const getCalculatedWeight = () => {
    if (isMetric) {
      return parseFloat(weightVal) || 70;
    } else {
      const lbs = parseFloat(weightVal) || 150;
      return Math.round(lbs * 0.453592);
    }
  };

  // Save profile and finish
  const handleFinish = async () => {
    try {
      const calculatedHeight = getCalculatedHeight();
      const calculatedWeight = getCalculatedWeight();

      // Setup clean, well-structured user object matching Firestore requirements
      const profileData = {
        name: name || 'User',
        dob: dob || '1995-01-01',
        gender: gender,
        fitnessMetrics: {
          height: calculatedHeight,
          weight: calculatedWeight,
          activityLevel: activityLevel,
          targetGoals: selectedGoals
        },
        preferences: {
          units: isMetric ? 'metric' : 'imperial',
          workoutDaysPerWeek: parseInt(daysPerWeek) || 3,
          preferredDuration: duration,
          preferredTimeOfDay: timeOfDay,
          notifications: {
            workouts: true,
            nutrition: true,
            social: true
          }
        }
      };

      // Set state in store
      useUserStore.setState({
        user: {
          ...user,
          ...profileData
        }
      });

      // Mark onboarding as completed
      completeOnboarding();

      // Sync user profile to Firestore
      if (user?.uid) {
        await saveProfile(user.uid);
      }

      // Navigate home
      router.replace('/hq');
    } catch (e) {
      console.error('[Onboarding] Save error:', e);
      // Fallback redirect
      completeOnboarding();
      router.replace('/hq');
    }
  };

  const nextStep = () => {
    if (step < 6) setStep(step + 1);
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  // Render current step helper
  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <View style={styles.stepContainer}>
            <View style={styles.logoContainer}>
              <Text style={styles.logoText}>ZOWN</Text>
              <Text style={styles.taglineText}>OWN THE DAY</Text>
            </View>
            <View style={styles.welcomeInfo}>
              <Text style={styles.titleText}>Let's set up your fitness profile</Text>
              <Text style={styles.descText}>
                We will personalize your workouts, trackers, achievements, and nutrition recommendations based on your profile details.
              </Text>
            </View>
            <TouchableOpacity style={styles.blackButton} onPress={nextStep}>
              <Text style={styles.blackButtonText}>Get Started</Text>
            </TouchableOpacity>
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.titleText}>About You</Text>
            <Text style={styles.descText}>Tell us a bit about yourself to begin.</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>FULL NAME</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Carlton Wright"
                placeholderTextColor="#999"
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>DATE OF BIRTH</Text>
              <TextInput
                style={styles.textInput}
                placeholder="YYYY-MM-DD (e.g. 1995-04-12)"
                placeholderTextColor="#999"
                value={dob}
                onChangeText={setDob}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>GENDER</Text>
              <View style={styles.segmentedContainer}>
                {['Male', 'Female', 'Prefer not to say'].map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[styles.segmentButton, gender === g && styles.segmentButtonActive]}
                    onPress={() => setGender(g)}
                  >
                    <Text style={[styles.segmentButtonText, gender === g && styles.segmentButtonTextActive]}>
                      {g}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity style={styles.blackButton} onPress={nextStep}>
              <Text style={styles.blackButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.titleText}>Body Metrics</Text>
            <Text style={styles.descText}>Enter your starting measurements.</Text>

            {/* Metric/Imperial toggle */}
            <View style={styles.unitToggleRow}>
              <TouchableOpacity
                style={[styles.unitToggleBtn, isMetric && styles.unitToggleBtnActive]}
                onPress={() => setIsMetric(true)}
              >
                <Text style={[styles.unitToggleText, isMetric && styles.unitToggleTextActive]}>Metric (cm/kg)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.unitToggleBtn, !isMetric && styles.unitToggleBtnActive]}
                onPress={() => setIsMetric(false)}
              >
                <Text style={[styles.unitToggleText, !isMetric && styles.unitToggleTextActive]}>Imperial (ft/lbs)</Text>
              </TouchableOpacity>
            </View>

            {/* Height Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>HEIGHT</Text>
              {isMetric ? (
                <View style={styles.numericInputWrapper}>
                  <TextInput
                    style={styles.numericInput}
                    placeholder="175"
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                    value={heightVal}
                    onChangeText={setHeightVal}
                  />
                  <Text style={styles.inputUnitLabel}>cm</Text>
                </View>
              ) : (
                <View style={styles.imperialHeightRow}>
                  <View style={[styles.numericInputWrapper, { flex: 1 }]}>
                    <TextInput
                      style={styles.numericInput}
                      placeholder="5"
                      placeholderTextColor="#999"
                      keyboardType="numeric"
                      value={heightVal}
                      onChangeText={setHeightVal}
                    />
                    <Text style={styles.inputUnitLabel}>ft</Text>
                  </View>
                  <View style={{ width: 16 }} />
                  <View style={[styles.numericInputWrapper, { flex: 1 }]}>
                    <TextInput
                      style={styles.numericInput}
                      placeholder="7"
                      placeholderTextColor="#999"
                      keyboardType="numeric"
                      value={heightInches}
                      onChangeText={setHeightInches}
                    />
                    <Text style={styles.inputUnitLabel}>in</Text>
                  </View>
                </View>
              )}
            </View>

            {/* Weight Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>CURRENT WEIGHT</Text>
              <View style={styles.numericInputWrapper}>
                <TextInput
                  style={styles.numericInput}
                  placeholder={isMetric ? "70" : "150"}
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                  value={weightVal}
                  onChangeText={setWeightVal}
                />
                <Text style={styles.inputUnitLabel}>{isMetric ? "kg" : "lbs"}</Text>
              </View>
            </View>

            {/* Activity Level Selector */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>ACTIVITY LEVEL</Text>
              <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                {ACTIVITY_LEVELS.map((act) => {
                  const isSel = activityLevel === act.id;
                  return (
                    <TouchableOpacity
                      key={act.id}
                      style={[styles.activityCard, isSel && styles.cardSelected]}
                      onPress={() => setActivityLevel(act.id)}
                    >
                      <Text style={[styles.cardTitle, isSel && styles.cardTitleSelected]}>{act.label}</Text>
                      <Text style={[styles.cardDesc, isSel && styles.cardDescSelected]}>{act.desc}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <TouchableOpacity style={styles.blackButton} onPress={nextStep}>
              <Text style={styles.blackButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        );

      case 4:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.titleText}>Your Goals</Text>
            <Text style={styles.descText}>Select up to 3 goals for personalizing your tracking.</Text>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.goalsGrid}>
              {GOALS.map((goal) => {
                const isSel = selectedGoals.includes(goal.id);
                return (
                  <TouchableOpacity
                    key={goal.id}
                    style={[styles.goalCard, isSel && styles.cardSelected]}
                    onPress={() => toggleGoal(goal.id)}
                  >
                    <Text style={styles.goalIcon}>{goal.icon}</Text>
                    <Text style={[styles.goalLabel, isSel && styles.goalLabelSelected]}>{goal.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={[styles.blackButton, selectedGoals.length === 0 && styles.btnDisabled]}
              disabled={selectedGoals.length === 0}
              onPress={nextStep}
            >
              <Text style={styles.blackButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        );

      case 5:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.titleText}>Preferences</Text>
            <Text style={styles.descText}>How and when do you prefer to exercise?</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>WORKOUT DAYS PER WEEK</Text>
              <View style={styles.pillsRow}>
                {['1', '2', '3', '4', '5', '6', '7'].map((d) => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.pillBtn, daysPerWeek === d && styles.pillBtnActive]}
                    onPress={() => setDaysPerWeek(d)}
                  >
                    <Text style={[styles.pillText, daysPerWeek === d && styles.pillTextActive]}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>PREFERRED WORKOUT DURATION</Text>
              <View style={styles.pillsRow}>
                {['15min', '30min', '45min', '60min+'].map((dur) => (
                  <TouchableOpacity
                    key={dur}
                    style={[styles.pillBtn, duration === dur && styles.pillBtnActive]}
                    onPress={() => setDuration(dur)}
                  >
                    <Text style={[styles.pillText, duration === dur && styles.pillTextActive]}>{dur}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>PREFERRED TIME OF DAY</Text>
              <View style={styles.pillsRow}>
                {['Morning', 'Afternoon', 'Evening'].map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.pillBtn, timeOfDay === t && styles.pillBtnActive]}
                    onPress={() => setTimeOfDay(t)}
                  >
                    <Text style={[styles.pillText, timeOfDay === t && styles.pillTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity style={styles.blackButton} onPress={nextStep}>
              <Text style={styles.blackButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        );

      case 6:
        return (
          <View style={styles.stepContainer}>
            <View style={styles.successCelebration}>
              <Text style={styles.celebrationIcon}>🎉</Text>
              <Text style={styles.titleText}>All Set!</Text>
              <Text style={styles.descText}>Your profile is ready to go.</Text>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>PROFILE SUMMARY</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Name</Text>
                <Text style={styles.summaryValue}>{name || 'Not provided'}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Goals Selected</Text>
                <Text style={styles.summaryValue}>{selectedGoals.length} goals</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Weekly Routine</Text>
                <Text style={styles.summaryValue}>{daysPerWeek} days/week, {duration}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Units</Text>
                <Text style={styles.summaryValue}>{isMetric ? 'Metric' : 'Imperial'}</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.blackButton} onPress={handleFinish}>
              <Text style={styles.blackButtonText}>Let's Go!</Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header bar with Back button and progress dots */}
      <View style={styles.headerBar}>
        {step > 1 && step < 6 ? (
          <TouchableOpacity style={styles.backBtn} onPress={prevStep}>
            <ChevronLeft size={24} color="#000000" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
        
        {/* Progress Dots */}
        <View style={styles.progressDotsContainer}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <View
              key={i}
              style={[
                styles.progressDot,
                step === i && styles.progressDotActive,
                step > i && styles.progressDotCompleted
              ]}
            />
          ))}
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {renderStepContent()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5'
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center'
  },
  progressDotsContainer: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 4
  },
  progressDotActive: {
    width: 16,
    backgroundColor: '#000000'
  },
  progressDotCompleted: {
    backgroundColor: '#333333'
  },
  scrollContent: {
    flexGrow: 1,
  },
  stepContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between'
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 40
  },
  logoText: {
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: 4,
    color: '#000000'
  },
  taglineText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 6,
    color: '#666666',
    marginTop: 8
  },
  welcomeInfo: {
    marginBottom: 40
  },
  titleText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 12,
    lineHeight: 34
  },
  descText: {
    fontSize: 15,
    color: '#666666',
    lineHeight: 22,
    marginBottom: 24
  },
  blackButton: {
    backgroundColor: '#000000',
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4
  },
  blackButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700'
  },
  btnDisabled: {
    opacity: 0.5
  },
  inputGroup: {
    marginBottom: 24
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#666666',
    letterSpacing: 1.5,
    marginBottom: 8
  },
  textInput: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#EAEAEA',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#000000'
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#EAEAEA'
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8
  },
  segmentButtonActive: {
    backgroundColor: '#000000'
  },
  segmentButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666'
  },
  segmentButtonTextActive: {
    color: '#FFFFFF'
  },
  unitToggleRow: {
    flexDirection: 'row',
    marginBottom: 24,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 4
  },
  unitToggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8
  },
  unitToggleBtnActive: {
    backgroundColor: '#000000'
  },
  unitToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666666'
  },
  unitToggleTextActive: {
    color: '#FFFFFF'
  },
  numericInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#EAEAEA',
    borderRadius: 12,
    paddingHorizontal: 16
  },
  numericInput: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: '#000000'
  },
  inputUnitLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#666666'
  },
  imperialHeightRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  activityCard: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#EAEAEA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12
  },
  cardSelected: {
    backgroundColor: '#000000',
    borderColor: '#000000'
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4
  },
  cardTitleSelected: {
    color: '#FFFFFF'
  },
  cardDesc: {
    fontSize: 12,
    color: '#666666',
    lineHeight: 16
  },
  cardDescSelected: {
    color: '#CCCCCC'
  },
  goalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingBottom: 16
  },
  goalCard: {
    width: (width - 64) / 2,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#EAEAEA',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  goalIcon: {
    fontSize: 32,
    marginBottom: 12
  },
  goalLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'center'
  },
  goalLabelSelected: {
    color: '#FFFFFF'
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8
  },
  pillBtn: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#EAEAEA',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    minWidth: 44,
    alignItems: 'center'
  },
  pillBtnActive: {
    backgroundColor: '#000000',
    borderColor: '#000000'
  },
  pillText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666'
  },
  pillTextActive: {
    color: '#FFFFFF'
  },
  successCelebration: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20
  },
  celebrationIcon: {
    fontSize: 64,
    marginBottom: 16
  },
  summaryCard: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#EAEAEA',
    borderRadius: 16,
    padding: 20,
    marginVertical: 16
  },
  summaryTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#666666',
    letterSpacing: 1.5,
    marginBottom: 16
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EAEAEA'
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666666'
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000'
  }
});
