import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useUserStore } from '@/store/userStore';

export function ErrorBoundary({ error, retry }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: '#000', marginBottom: 8 }}>Something went wrong</Text>
      <Text style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>{error?.message}</Text>
      <Pressable onPress={retry} style={{ backgroundColor: '#000', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20 }}>
        <Text style={{ color: '#fff', fontWeight: '600' }}>Try Again</Text>
      </Pressable>
    </View>
  );
}

export default function EditProfileScreen() {
  const { user, updateUser } = useUserStore();

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [weight, setWeight] = useState(user?.fitnessMetrics?.weight?.toString() || '');
  const [height, setHeight] = useState(user?.fitnessMetrics?.height?.toString() || '');
  const [age, setAge] = useState(user?.fitnessMetrics?.age?.toString() || '');
  const [fitnessLevel, setFitnessLevel] = useState(user?.fitnessLevel || 'intermediate');
  const [isSaving, setIsSaving] = useState(false);

  const LEVELS = ['beginner', 'intermediate', 'advanced', 'elite'];

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateUser({
        name: name.trim(),
        bio: bio.trim(),
        fitnessLevel,
        fitnessMetrics: {
          ...(user?.fitnessMetrics || {}),
          weight: weight ? parseFloat(weight) : null,
          height: height ? parseFloat(height) : null,
          age: age ? parseInt(age) : null,
        },
      });
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
        {renderInput('Email', email, setEmail, { placeholder: 'Email', keyboardType: 'email-address', editable: false })}
        {renderInput('Bio', bio, setBio, { placeholder: 'Tell us about yourself', multiline: true, style: [s.input, { height: 80, textAlignVertical: 'top' }] })}

        <Text style={s.sectionLabel}>Fitness Details</Text>
        {renderInput('Weight (lbs)', weight, setWeight, { placeholder: '175', keyboardType: 'numeric' })}
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
  levelRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  levelPill: { backgroundColor: '#F0F0F0', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  levelPillActive: { backgroundColor: '#000' },
  levelText: { fontSize: 13, fontWeight: '600', color: '#333' },
  levelTextActive: { color: '#FFF' },
});
