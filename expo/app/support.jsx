import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking, Platform } from 'react-native';
import { ChevronDown, ChevronUp, Mail, MessageCircle } from 'lucide-react-native';
import ScreenHeader from '@/components/ScreenHeader';
import PrimaryButton from '@/components/PrimaryButton';
import { tokens } from '../../theme/tokens';



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
      <ScrollView contentContainerStyle={{ padding: tokens.spacing.md, paddingBottom: 40 }}>
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
                {isOpen ? <ChevronUp size={18} color="#999999" /> : <ChevronDown size={18} color="#999999" />}
              </View>
              {isOpen ? <Text style={styles.faqA}>{f.a}</Text> : null}
            </TouchableOpacity>
          );
        })}

        <Text style={[styles.sectionLabel, { marginTop: tokens.spacing.lg }]}>Contact Us</Text>
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

// Real fix: previously backgroundColor: tokens.colors.dark_navy.text_primary
// (a "text" token used as a background - resolves to white, so this
// wasn't visibly broken the way some other screens were, but it's the
// same underlying bug) and color: tokens.colors.dark_navy.text_muted/
// text_primary throughout (light grays and white meant for a dark
// background, applied to what's actually meant to be a light screen).
// Plain hex used directly here instead of routing through the
// dark_navy token group at all, matching the same fix already applied
// to constants/theme.js and app/nutrition.jsx - white #FFFFFF
// background, cards with app/hq.jsx's own exact shadow (not the
// previous border), black text. tokens.spacing/tokens.radius are
// untouched - not part of this color-token bug, out of scope for it.
const cardShadow = Platform.select({
  ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  android: { elevation: 3 },
  default: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  sectionLabel: {
    fontSize: 12, fontWeight: '600', letterSpacing: 0.8,
    textTransform: 'uppercase', color: '#999999', marginBottom: 12,
  },
  faqCard: {
    backgroundColor: '#FFFFFF', ...cardShadow,
    borderRadius: tokens.radius.lg, padding: tokens.spacing.md, marginBottom: tokens.spacing.sm,
  },
  faqRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  faqQ: { color: '#000000', fontSize: 14, fontWeight: '600', flex: 1, marginRight: 12 },
  faqA: { color: '#666666', fontSize: 13, lineHeight: 19, marginTop: 10 },
});
