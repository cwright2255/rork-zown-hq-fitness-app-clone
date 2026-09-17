import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useUserStore } from '@/store/userStore';

// Same options as app/onboarding.jsx's GOALS/NUTRITION_PREFERENCES -
// onboarding is a one-time flow with no way back in once completed, so
// these need to live here too for ongoing adjustment, not just at
// signup. Kept identical to onboarding's lists (same ids) so a value
// set in either place means the same thing in both.
const GOALS = [
  { id: 'lose_weight', label: 'Lose Weight' },
  { id: 'build_muscle', label: 'Build Muscle' },
  { id: 'improve_endurance', label: 'Improve Endurance' },
  { id: 'stay_active', label: 'Stay Active' },
  { id: 'train_for_race', label: 'Train for a Race' },
  { id: 'eat_healthier', label: 'Eat Healthier' },
  { id: 'reduce_stress', label: 'Reduce Stress' },
];

const NUTRITION_PREFERENCES = [
  { id: 'no_preference', label: 'No Preference' },
  { id: 'vegetarian', label: 'Vegetarian' },
  { id: 'vegan', label: 'Vegan' },
  { id: 'pescatarian', label: 'Pescatarian' },
  { id: 'paleo', label: 'Paleo' },
  { id: 'keto', label: 'Keto' },
  { id: 'intermittent_fasting', label: 'Intermittent Fasting' },
  { id: 'gluten_free', label: 'Gluten-Free' },
];

// Real, new: surfaced on the workout side (exercise warnings, and a
// future input to AI-generated plans) so exercises that commonly
// stress a reported area can be flagged. Multi-select, no cap - unlike
// Goals above, there's no natural reason to limit how many injury
// areas someone reports, and leaving all unselected already means "no
// injuries" without needing an explicit "None" option.
const INJURIES = [
  { id: 'knee', label: 'Knee' },
  { id: 'shoulder', label: 'Shoulder' },
  { id: 'lower_back', label: 'Lower Back' },
  { id: 'hip', label: 'Hip' },
  { id: 'ankle', label: 'Ankle' },
  { id: 'wrist', label: 'Wrist' },
  { id: 'elbow', label: 'Elbow' },
  { id: 'neck', label: 'Neck' },
];

export default function EditProfileScreen() {
  const { user, updateUser, saveProfile } = useUserStore();

  const [name, setName] = useState(user?.name || '');
  // Real fix: strips a leading "@" the person may have typed themselves
  // (a completely natural thing to do, given "@username" is how every
  // other app shows a handle) - without this, the helper text below
  // ("Shown as @{username}") would render a literal "@@" for anyone who
  // typed the symbol.
  const [username, setUsername] = useState((user?.username || '').replace(/^@+/, ''));
  const [email, setEmail] = useState(user?.email || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [weight, setWeight] = useState(user?.fitnessMetrics?.weight?.toString() || '');
  const [targetWeight, setTargetWeight] = useState(user?.targetWeightKg ? Math.round(user.targetWeightKg / 0.453592).toString() : '');
  // Real fix: fitnessMetrics.height is always stored in cm by
  // onboarding (see getCalculatedHeight in app/onboarding.jsx), but
  // this field is labeled "Height (in)" and was reading/writing that
  // same raw number as if it were already inches, with no conversion.
  // Converts to inches for display here, matching how targetWeight
  // above already converts kg to lbs for the same reason. Falls back to
  // empty (not "0") when unset, so this reads like the real empty
  // state Age below already showed rather than a misleading zero.
  const [height, setHeight] = useState(user?.fitnessMetrics?.height ? Math.round(user.fitnessMetrics.height / 2.54).toString() : '');
  // Real fix: onboarding stores age at the top level (user.age), not
  // nested under fitnessMetrics - this was reading a path onboarding
  // never writes to, so it always fell back to empty/placeholder
  // regardless of the real age on file.
  const [age, setAge] = useState(user?.age?.toString() || '');
  const [fitnessLevel, setFitnessLevel] = useState(user?.fitnessLevel || 'intermediate');
  // Real fields onboarding.jsx already writes to (fitnessMetrics.targetGoals,
  // fitnessMetrics.nutritionPreference) - reading the same real data here,
  // not a separate copy.
  const [selectedGoals, setSelectedGoals] = useState(user?.fitnessMetrics?.targetGoals || []);
  const [nutritionPreference, setNutritionPreference] = useState(user?.fitnessMetrics?.nutritionPreference || 'no_preference');
  const [selectedInjuries, setSelectedInjuries] = useState(user?.fitnessMetrics?.injuries || []);
  const [isSaving, setIsSaving] = useState(false);

  const LEVELS = ['beginner', 'intermediate', 'advanced', 'elite'];

  const toggleGoal = (id) => {
    if (selectedGoals.includes(id)) {
      setSelectedGoals(selectedGoals.filter((g) => g !== id));
    } else if (selectedGoals.length < 3) {
      setSelectedGoals([...selectedGoals, id]);
    }
  };

  const toggleInjury = (id) => {
    if (selectedInjuries.includes(id)) {
      setSelectedInjuries(selectedInjuries.filter((i) => i !== id));
    } else {
      setSelectedInjuries([...selectedInjuries, id]);
    }
  };

  // Real, read-only - gender is set once during onboarding (see
  // app/onboarding.jsx) and intentionally isn't editable from here, so
  // this always reflects exactly what the person selected when they
  // created their profile, not something that can drift afterward.
  const gender = user?.gender;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateUser({
        name: name.trim(),
        username: username.trim().replace(/\s+/g, '').replace(/^@+/, ''),
        bio: bio.trim(),
        fitnessLevel,
        // Real fix: targetWeightKg is the field another session already
        // wired into saveProfile's Firestore whitelist (see the comment
        // there) - this screen's own field was writing to
        // fitnessMetrics.targetWeight instead, a disconnected duplicate
        // nothing else reads. Converts the lbs this field collects to kg
        // the same way onboarding.jsx already converts weight (* 0.453592),
        // so both target-weight write paths agree on the same unit.
        targetWeightKg: targetWeight ? Math.round(parseFloat(targetWeight) * 0.453592) : null,
        // Real fix: age belongs at the top level (user.age), matching
        // exactly where onboarding.jsx actually writes it - saving it
        // under fitnessMetrics instead meant a saved edit here would
        // never actually correct the real, misread value.
        age: age ? parseInt(age) : null,
        fitnessMetrics: {
          ...(user?.fitnessMetrics || {}),
          weight: weight ? parseFloat(weight) : null,
          // Real fix: converts inches back to cm before saving, matching
          // the unit onboarding.jsx actually stores here - previously
          // this field saved the raw inches number directly into a
          // centimeters field with no conversion either way.
          height: height ? Math.round(parseFloat(height) * 2.54) : null,
          targetGoals: selectedGoals,
          nutritionPreference: nutritionPreference,
          injuries: selectedInjuries,
        },
      });
      // Real fix: this screen previously only updated local state and
      // never actually synced to Firestore (unlike the photo-edit
      // handler in app/profile.jsx, which does call saveProfile) - every
      // edit made here, old fields and these new ones alike, was silently
      // local-only.
      if (user?.uid) {
        await saveProfile(user.uid);
      }
      Alert.alert('Profile Updated', 'Your changes have been saved.');
      router.back();
    } catch (e) {
      Alert.alert('Error', 'Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const renderInput = (label, value, onChangeText, props = {}) => (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput style={s.input} value={value} onChangeText={onChangeText} placeholderTextColor="#999" {...props} />
    </View>
  );

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#000" />
        </Pressable>
        <Text style={s.headerTitle}>Edit Profile</Text>
        <Pressable onPress={handleSave} disabled={isSaving}>
          <Text style={[s.saveBtn, isSaving && { opacity: 0.5 }]}>{isSaving ? 'Saving...' : 'Save'}</Text>
        </Pressable>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Avatar */}
        <View style={s.avatarSection}>
          <View style={s.avatar}><Ionicons name="person" size={40} color="#999" /></View>
          <Pressable style={s.changePhotoBtn}>
            <Text style={s.changePhotoText}>Change Photo</Text>
          </Pressable>
        </View>

        {renderInput('Name', name, setName, { placeholder: 'Your name', autoCapitalize: 'words' })}
        {renderInput('Username', username, setUsername, { placeholder: 'yourname', autoCapitalize: 'none', autoCorrect: false })}
        <Text style={s.helperText}>Shown as @{username || 'yourname'} on social and shared posts</Text>
        {renderInput('Email', email, setEmail, { placeholder: 'Email', keyboardType: 'email-address', editable: false })}
        {renderInput('Bio', bio, setBio, { placeholder: 'Tell us about yourself', multiline: true, style: [s.input, { height: 80, textAlignVertical: 'top' }] })}

        {gender ? (
          <View style={s.field}>
            <Text style={s.label}>Gender</Text>
            <View style={s.readOnlyRow}>
              <Text style={s.readOnlyText}>{gender}</Text>
            </View>
            <Text style={s.helperTextBelow}>Set when your profile was created</Text>
          </View>
        ) : null}

        <Text style={s.sectionLabel}>Fitness Details</Text>
        {renderInput('Weight (lbs)', weight, setWeight, { placeholder: '175', keyboardType: 'numeric' })}
        {renderInput('Target Weight (lbs)', targetWeight, setTargetWeight, { placeholder: '165', keyboardType: 'numeric' })}
        {renderInput('Height (in)', height, setHeight, { placeholder: '70', keyboardType: 'numeric' })}
        {renderInput('Age', age, setAge, { placeholder: '28', keyboardType: 'numeric' })}

        <View style={s.field}>
          <Text style={s.label}>Fitness Level</Text>
          <View style={s.levelRow}>
            {LEVELS.map(l => (
              <Pressable key={l} style={[s.levelPill, fitnessLevel === l && s.levelPillActive]} onPress={() => setFitnessLevel(l)}>
                <Text style={[s.levelText, fitnessLevel === l && s.levelTextActive]}>{l.charAt(0).toUpperCase() + l.slice(1)}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Text style={s.sectionLabel}>Goals</Text>
        <View style={s.field}>
          <Text style={s.helperTextTight}>Select up to 3</Text>
          <View style={s.levelRow}>
            {GOALS.map((g) => {
              const active = selectedGoals.includes(g.id);
              return (
                <Pressable key={g.id} style={[s.levelPill, active && s.levelPillActive]} onPress={() => toggleGoal(g.id)}>
                  <Text style={[s.levelText, active && s.levelTextActive]}>{g.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Text style={s.sectionLabel}>Nutrition Preference</Text>
        <View style={s.field}>
          <View style={s.levelRow}>
            {NUTRITION_PREFERENCES.map((p) => {
              const active = nutritionPreference === p.id;
              return (
                <Pressable key={p.id} style={[s.levelPill, active && s.levelPillActive]} onPress={() => setNutritionPreference(p.id)}>
                  <Text style={[s.levelText, active && s.levelTextActive]}>{p.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Text style={s.sectionLabel}>Injuries</Text>
        <View style={s.field}>
          <Text style={s.helperTextTight}>Used to flag exercises that may not be a good fit</Text>
          <View style={s.levelRow}>
            {INJURIES.map((i) => {
              const active = selectedInjuries.includes(i.id);
              return (
                <Pressable key={i.id} style={[s.levelPill, active && s.levelPillActive]} onPress={() => toggleInjury(i.id)}>
                  <Text style={[s.levelText, active && s.levelTextActive]}>{i.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: '#000' },
  saveBtn: { fontSize: 16, fontWeight: '700', color: '#000' },
  scroll: { flex: 1 },
  avatarSection: { alignItems: 'center', paddingVertical: 24 },
  avatar: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#E0E0E0', justifyContent: 'center', alignItems: 'center' },
  changePhotoBtn: { marginTop: 10 },
  changePhotoText: { fontSize: 14, fontWeight: '600', color: '#000' },
  sectionLabel: { fontSize: 16, fontWeight: '700', color: '#000', paddingHorizontal: 20, marginTop: 24, marginBottom: 8 },
  field: { paddingHorizontal: 20, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#666', marginBottom: 6 },
  input: { backgroundColor: '#F5F5F5', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#000' },
  helperText: { fontSize: 12, color: '#999', paddingHorizontal: 20, marginTop: -10, marginBottom: 16 },
  helperTextTight: { fontSize: 12, color: '#999', marginBottom: 8 },
  helperTextBelow: { fontSize: 12, color: '#999', marginTop: 6 },
  readOnlyRow: { backgroundColor: '#F5F5F5', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  readOnlyText: { fontSize: 15, color: '#666' },
  levelRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  levelPill: { backgroundColor: '#F0F0F0', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  levelPillActive: { backgroundColor: '#000' },
  levelText: { fontSize: 13, fontWeight: '600', color: '#333' },
  levelTextActive: { color: '#FFF' },
});
