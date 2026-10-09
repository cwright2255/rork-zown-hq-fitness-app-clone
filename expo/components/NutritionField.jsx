import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';

// One labelled text box with room for a hint or an error under it. Used by the
// create-food and quick-add forms.
export default function NutritionField({
  label, value, onChangeText, error, hint, testID, placeholder,
  keyboardType = 'decimal-pad', maxLength, autoFocus = false,
}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        testID={testID}
        accessibilityLabel={label}
        style={[styles.input, error ? styles.inputError : null]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#999999"
        keyboardType={keyboardType}
        maxLength={maxLength}
        autoFocus={autoFocus}
        autoCorrect={false}
      />
      {error ? (
        <Text testID={testID ? `${testID}-error` : undefined} style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: '#000000', marginBottom: 6 },
  input: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDDDDD', borderRadius: 12,
    height: 48, paddingHorizontal: 14, color: '#000000', fontSize: 15,
  },
  inputError: { borderColor: '#EF4444' },
  error: { color: '#EF4444', fontSize: 12, marginTop: 4 },
  hint: { color: '#999999', fontSize: 12, marginTop: 4 },
});
