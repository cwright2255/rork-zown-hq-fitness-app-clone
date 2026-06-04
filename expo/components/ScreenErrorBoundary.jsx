import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

export function ScreenErrorBoundary({ error, retry }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.message}>{error?.message || 'An unexpected error occurred'}</Text>
      {retry && (
        <Pressable onPress={retry} style={styles.button}>
          <Text style={styles.buttonText}>Try Again</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', padding: 24 },
  title: { fontSize: 18, fontWeight: '700', color: '#000', marginBottom: 8 },
  message: { fontSize: 13, color: '#666', textAlign: 'center', marginBottom: 20 },
  button: { backgroundColor: '#000', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20 },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});

export default ScreenErrorBoundary;
