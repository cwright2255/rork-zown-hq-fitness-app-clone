// components/PromptModal.jsx
//
// Reusable, app-styled replacement for Alert.prompt (which is a native
// iOS-only dialog that can't be restyled - see the conversation that led
// to this file). Matches this app's existing Modal convention (built-in
// RN Modal, animationType="slide", transparent, onRequestClose) already
// used in app/community.jsx and components/RecipeImportModal.jsx.
//
// Two ways to use it:
// 1. Single field: pass `fields` with one entry - renders one input and
//    a single Save/Cancel pair. Used for Log Weight and Target Weight.
// 2. Multi-step: pass `fields` with several entries - renders one input
//    at a time with Back/Next, and the final step's button reads
//    `submitLabel` instead of "Next". Used for Add Goal (title, target,
//    unit).
import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';

export default function PromptModal({
  visible,
  title,
  fields, // [{ key, label, placeholder, keyboardType }]
  submitLabel = 'Save',
  onCancel,
  onSubmit, // (values: { [key]: string }) => void | Promise<void>
}) {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setStep(0);
      setValues({});
      setSubmitting(false);
    }
  }, [visible]);

  if (!fields || fields.length === 0) return null;
  const field = fields[step];
  const isLastStep = step === fields.length - 1;

  const handleNext = async () => {
    if (!isLastStep) {
      setStep((s) => s + 1);
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {fields.length > 1 && (
            <Text style={styles.stepIndicator}>Step {step + 1} of {fields.length}</Text>
          )}
          <Text style={styles.label}>{field.label}</Text>
          <TextInput
            style={styles.input}
            placeholder={field.placeholder}
            placeholderTextColor="#999"
            keyboardType={field.keyboardType || 'default'}
            value={values[field.key] || ''}
            onChangeText={(text) => setValues((v) => ({ ...v, [field.key]: text }))}
            autoFocus
          />
          <View style={styles.btnRow}>
            {step > 0 ? (
              <Pressable style={styles.secondaryBtn} onPress={() => setStep((s) => s - 1)}>
                <Text style={styles.secondaryBtnText}>Back</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.secondaryBtn} onPress={onCancel}>
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </Pressable>
            )}
            <Pressable
              style={[styles.primaryBtn, submitting && { opacity: 0.6 }]}
              onPress={handleNext}
              disabled={submitting}
            >
              <Text style={styles.primaryBtnText}>
                {isLastStep ? submitLabel : 'Next'}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  card: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 36 },
  title: { fontSize: 18, fontWeight: '700', color: '#1A1A2E', marginBottom: 4 },
  stepIndicator: { fontSize: 12, color: '#999', marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#666', marginTop: 12, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: '#1A1A2E',
  },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 24 },
  secondaryBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: '#F0F0F0' },
  secondaryBtnText: { fontSize: 14, fontWeight: '600', color: '#666' },
  primaryBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: '#000' },
  primaryBtnText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
});
