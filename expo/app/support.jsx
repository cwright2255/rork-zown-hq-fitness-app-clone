import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { ChevronDown, ChevronUp, Mail, MessageCircle } from 'lucide-react-native';
import ScreenHeader from '@/components/ScreenHeader';
import PrimaryButton from '@/components/PrimaryButton';

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';

const FAQS = [
  { q: 'How do I track my workouts?', a: 'Navigate to the Workouts tab, select a program, and tap "Start" to begin tracking.' },
  { q: 'Can I sync wearable devices?', a: 'Yes, go to Settings > Wearables to connect Apple Health, Garmin, Whoop, and more.' },
  { q: 'How do I log nutrition?', a: 'Tap Nutrition in the menu, then use "Log Food" to search, scan a barcode, or pick from recipes.' },
  { q: 'What are XP and badges?', a: 'XP tracks your activity progress. Badges are earned by hitting specific milestones.' },
  { q: 'How do I cancel my subscription?', a: 'Manage your subscription via App Store or Play Store settings.' },
];

export default function SupportScreen() {
  const [open, setOpen] = useState(null);

  return (
    <View style={styles.container}>
      <ScreenHeader title="Support" showBack />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={styles.sectionLabel}>Frequently Asked</Text>
        {FAQS.map((f, i) => {
          const isOpen = open === i;
          return (
            <TouchableOpacity
              key={i}
              style={styles.faqCard}
              onPress={() => setOpen(isOpen ? null : i)}>
              <View style={styles.faqRow}>
                <Text style={styles.faqQ}>{f.q}</Text>
                {isOpen ? <ChevronUp size={18} color="#999" /> : <ChevronDown size={18} color="#999" />}
              </View>
              {isOpen ? <Text style={styles.faqA}>{f.a}</Text> : null}
            </TouchableOpacity>
          );
        })}

        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Contact Us</Text>
        <PrimaryButton
          title="Email Support"
          variant="outline"
          onPress={() => Linking.openURL('mailto:support@zownhq.com')}
        />
        <View style={{ height: 10 }} />
        <PrimaryButton
          title="Live Chat"
          variant="outline"
          onPress={() => Linking.openURL('https://zownhq.com/chat')}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  sectionLabel: {
    fontSize: 12, fontWeight: '600', letterSpacing: 0.8,
    textTransform: 'uppercase', color: '#999', marginBottom: 12,
  },
  faqCard: {
    backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#2A2A2A',
    borderRadius: 16, padding: 16, marginBottom: 8,
  },
  faqRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  faqQ: { color: '#fff', fontSize: 14, fontWeight: '600', flex: 1, marginRight: 12 },
  faqA: { color: '#999', fontSize: 13, lineHeight: 19, marginTop: 10 },
});
