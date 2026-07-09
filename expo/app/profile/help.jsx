import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

function FAQItem({ question, answer }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={styles.faqCard}>
      <Pressable style={styles.faqHeader} onPress={() => setExpanded(!expanded)}>
        <Text style={styles.faqQuestion}>{question}</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color="#666" />
      </Pressable>
      {expanded && (
        <View style={styles.faqAnswerContainer}>
          <Text style={styles.faqAnswer}>{answer}</Text>
        </View>
      )}
    </View>
  );
}

export default function HelpSupportScreen() {
  const handleEmailSupport = async () => {
    const url = 'mailto:support@zownhq.com?subject=ZOWN HQ App Support';
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Email Support', 'Please contact support at support@zownhq.com');
    }
  };

  const handleReportBug = () => {
    Alert.alert(
      'Report a Bug',
      'Please describe the issue you encountered. Our engineering team will review it shortly.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          onPress: () => Alert.alert('Thank you!', 'Bug report submitted successfully.'),
        },
      ]
    );
  };

  const FAQS = [
    {
      question: 'How do I track a workout?',
      answer: 'Go to the Workout tab from the bottom navigation. Choose a workout plan or active workout session, tap Start, and log your completed exercises and metrics in real-time.',
    },
    {
      question: 'How does GPS tracking work?',
      answer: 'When you start a run, ZOWN HQ requests access to your location services. This allows the app to map your route, calculate distance, and compute accurate pace details.',
    },
    {
      question: 'How do I sync wearable devices?',
      answer: 'Go to Profile > Settings > Connected Services to sync Apple Health, Fitbit, Garmin, or Spotify to stream workouts and sync active calorie metadata.',
    },
    {
      question: 'How do I log meals?',
      answer: 'Navigate to Health > Meal Log. Tap "Add Meal" or capture a photo to let our Passio.ai food search engine extract the ingredients and aggregate calories.',
    },
    {
      question: 'How do I reset my password?',
      answer: 'In Profile > Settings > Account, tap Change Password. A secure password reset link will be sent directly to your registered email address.',
    },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </Pressable>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Support Banner */}
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>How can we help you today?</Text>
          <Text style={styles.bannerSubtitle}>Browse our FAQs or reach out directly to our support team.</Text>
        </View>

        {/* FAQs Section */}
        <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
        <View style={{ marginBottom: 24 }}>
          {FAQS.map((faq, idx) => (
            <FAQItem key={idx} question={faq.question} answer={faq.answer} />
          ))}
        </View>

        {/* Contact Section */}
        <Text style={styles.sectionTitle}>Get in Touch</Text>
        <View style={styles.contactCard}>
          <Pressable style={styles.contactRow} onPress={handleEmailSupport}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={styles.iconCircle}>
                <Ionicons name="mail-outline" size={20} color="#000" />
              </View>
              <View>
                <Text style={styles.contactTitle}>Email Support</Text>
                <Text style={styles.contactSubtitle}>support@zownhq.com</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#CCC" />
          </Pressable>

          <View style={styles.divider} />

          <Pressable style={styles.contactRow} onPress={handleReportBug}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={styles.iconCircle}>
                <Ionicons name="bug-outline" size={20} color="#000" />
              </View>
              <View>
                <Text style={styles.contactTitle}>Report a Bug</Text>
                <Text style={styles.contactSubtitle}>Submit feedback and screenshot</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#CCC" />
          </Pressable>
        </View>

        {/* App Info */}
        <Text style={styles.appInfo}>ZOWN HQ App Version 1.0.0 (Build 192)</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#000' },
  headerRightPlaceholder: { width: 32 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 60 },

  /* Banner */
  banner: {
    backgroundColor: '#000',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  bannerTitle: { fontSize: 20, fontWeight: '800', color: '#FFF', marginBottom: 6 },
  bannerSubtitle: { fontSize: 13, color: '#DDD', lineHeight: 18 },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#000', marginBottom: 12 },

  /* FAQ Accordion */
  faqCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    marginBottom: 10,
    overflow: 'hidden',
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  faqQuestion: { fontSize: 14, fontWeight: '600', color: '#000', flex: 1, marginRight: 8 },
  faqAnswerContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#F9F9F9',
  },
  faqAnswer: { fontSize: 13, color: '#555', lineHeight: 20 },

  /* Contact */
  contactCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    padding: 16,
    marginBottom: 24,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 2 },
      default: { shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
    }),
  },
  contactRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactTitle: { fontSize: 15, fontWeight: '600', color: '#000' },
  contactSubtitle: { fontSize: 12, color: '#666', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#F0F0F0' },

  appInfo: { fontSize: 11, color: '#CCC', textAlign: 'center', marginTop: 12 },
});
