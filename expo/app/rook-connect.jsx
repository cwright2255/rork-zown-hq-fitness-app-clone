import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, Linking } from 'react-native';
import { Activity } from 'lucide-react-native';
import ScreenHeader from '@/components/ScreenHeader';
import PrimaryButton from '@/components/PrimaryButton';
import { tokens } from '../../theme/tokens';

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';

export default function RookConnectScreen() {
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    setLoading(true);
    try {
      const url = process.env.EXPO_PUBLIC_ROOK_CONNECT_URL;
      if (url) {
        await Linking.openURL(url);
      } else {
        Alert.alert('ROOK', 'Connect URL is not configured.');
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to open ROOK connect.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Connect Health Data" showBack />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.iconWrap}>
          <Activity size={80} color={tokens.colors.background.default} />
        </View>
        <Text style={styles.title}>Connect with ROOK</Text>
        <Text style={styles.desc}>
          Securely sync data from Apple Health, Google Fit, Garmin, Fitbit, Oura, Whoop,
          and more through ROOK. Track your fitness, sleep, and body metrics all in one place.
        </Text>
        <PrimaryButton title="Connect with ROOK" onPress={handleConnect} loading={loading} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.grayscale.black },
  scroll: { padding: 24, alignItems: 'stretch', gap: 20 },
  iconWrap: {
    alignSelf: 'center', marginTop: 40, marginBottom: 20,
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: tokens.colors.ink.darker, borderWidth: 1, borderColor: '#2A2A2A',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 24, fontWeight: '700', color: tokens.colors.background.default, textAlign: 'center', letterSpacing: -0.5 },
  desc: { fontSize: 14, color: '#999', textAlign: 'center', lineHeight: 22, marginBottom: 20 },
});
