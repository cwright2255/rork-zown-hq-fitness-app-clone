import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { Mail } from 'lucide-react-native';
import { router } from 'expo-router';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handleReset = async () => {
    if (!email) {
      Alert.alert('Error', 'Enter your email');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      Alert.alert('Email sent', 'Check your inbox for reset instructions.');
      router.back();
    }, 1000);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Reset password</Text>
        <Text style={styles.subtitle}>We'll send a link to your email</Text>

        <View style={styles.inputContainer}>
          <Mail size={20} color={Colors.text.secondary} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Email"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        <TouchableOpacity
          testID="send-reset"
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleReset}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? 'Sending...' : 'Send reset link'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, padding: 24, gap: 12, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '800', color: Colors.text.primary },
  subtitle: { fontSize: 14, color: Colors.text.secondary, marginBottom: 12 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: Colors.text.primary },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
});
