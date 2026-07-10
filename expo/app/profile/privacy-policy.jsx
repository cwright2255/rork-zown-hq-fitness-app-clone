import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { tokens } from '../../../theme/tokens';

export default function PrivacyPolicy() {
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/profile');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </Pressable>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.lastUpdated}>Last updated: July 2026</Text>

        <Text style={styles.paragraph}>
          At ZOWN HQ, your privacy is a core priority. This Privacy Policy details how we handle the collection, processing, and protection of your physical metrics, location data, and other profile assets.
        </Text>

        <Text style={styles.sectionTitle}>1. Information We Collect</Text>
        <Text style={styles.bodyText}>
          We collect info necessary to track your fitness journey, including:
          {"

"}
          • <Text style={styles.bold}>Account Info</Text>: Name, email address, password (securely hashed via Firebase).
          {"
"}
          • <Text style={styles.bold}>Fitness Data</Text>: Completed workouts, duration, calorie expenditure, steps, and target metric logs.
          {"
"}
          • <Text style={styles.bold}>GPS & Location</Text>: GPS paths during run tracking (only with explicit authorization).
          {"
"}
          • <Text style={styles.bold}>Nutrition Assets</Text>: Hydration logs, logged meals, macronutrient counts, and calorie totals.
          {"
"}
          • <Text style={styles.bold}>Physical Metrics</Text>: Height, weight, age, 8-point structural measurements, body scans, and sleep metrics.
          {"
"}
          • <Text style={styles.bold}>Device & Usage Data</Text>: Operating system version, model markers, session latency, and bug/crash logs.
        </Text>

        <Text style={styles.sectionTitle}>2. How We Use Your Information</Text>
        <Text style={styles.bodyText}>
          We utilize your data to serve the following objectives:
          {"

"}
          • Calculating personalized metabolic rates, active goals, and weekly milestones.
          {"
"}
          • populating in-app peer leaderboards, battle pass progression, and active duels.
          {"
"}
          • Managing smart push alerts and hydration triggers.
          {"
"}
          • Tracking app diagnostic performance and debugging code errors.
          {"
"}
          • <Text style={styles.bold}>We never sell, rent, or lease your private physical metrics or profile details to third-party marketing brokers.</Text>
        </Text>

        <Text style={styles.sectionTitle}>3. Data Storage & Security</Text>
        <Text style={styles.bodyText}>
          All user records, health stores, and progression metrics are hosted on Google Firebase with industry-grade SSL encryption both in transit and at rest. Authentications are handled directly via Google's secure Firebase tokens. Profile data remains locked in secure databases and is completely expunged within 30 days of initiating account deletion.
        </Text>

        <Text style={styles.sectionTitle}>4. Third-Party Services</Text>
        <Text style={styles.bodyText}>
          We partner with select APIs to power native features:
          {"

"}
          • <Text style={styles.bold}>Firebase (Google)</Text>: Handles DB persistence and user login auth.
          {"
"}
          • <Text style={styles.bold}>Spotify</Text>: Synchronizes musical playback controls (only if authorized).
          {"
"}
          • <Text style={styles.bold}>Passio.ai & Open Food Facts</Text>: Recognizes barcodes and meals (the raw scans are processed locally; images are not retained).
          {"
"}
          • <Text style={styles.bold}>ExerciseDB</Text>: Syncs instructional exercises. No personal profile data is shared.
          {"
"}
          • <Text style={styles.bold}>Radar.io</Text>: Powers reverse-geocoding of run locations.
        </Text>

        <Text style={styles.sectionTitle}>5. Your Rights (GDPR & CCPA Compliant)</Text>
        <Text style={styles.bodyText}>
          Regardless of your jurisdiction, ZOWN HQ offers global compliance rights:
          {"

"}
          • <Text style={styles.bold}>Access & Export</Text>: Request a full export of your health history at any time.
          {"
"}
          • <Text style={styles.bold}>Erasure</Text>: Instantly remove your account and metrics from Settings > Danger Zone.
          {"
"}
          • <Text style={styles.bold}>Visibility Toggle</Text>: Adjust settings to control who sees your duels and rankings.
        </Text>

        <Text style={styles.sectionTitle}>6. Children's Privacy</Text>
        <Text style={styles.bodyText}>
          ZOWN HQ is not designed for children under 13 years of age. We do not knowingly collect physical metrics or records of minors. If we discover any account belonging to an underage user, it will be immediately removed.
        </Text>

        <Text style={styles.sectionTitle}>7. Location Data</Text>
        <Text style={styles.bodyText}>
          Active GPS tracking is used strictly for run-mapping. We only collect coordinates in the background while your run session is actively recording. This permission can be revoked through your device settings at any time.
        </Text>

        <Text style={styles.sectionTitle}>8. Cookies & Analytics</Text>
        <Text style={styles.bodyText}>
          Being a native mobile application, we do not deploy standard web cookies. We employ native analytics SDKs (such as Firebase Analytics) to track performance, screen views, and user flows.
        </Text>

        <Text style={styles.sectionTitle}>9. Changes to Privacy Policy</Text>
        <Text style={styles.bodyText}>
          We update this policy from time to time. Any material change will be brought to your attention via a prominent system-alert in the app interface.
        </Text>

        <Text style={styles.sectionTitle}>10. Contact</Text>
        <Text style={[styles.bodyText, { marginBottom: 40 }]}>
          For Data Protection inquiries, contact privacy@zownhq.com. For general support, write to support@zownhq.com.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: tokens.typography?.fontBold || 'System',
    fontSize: 18,
    fontWeight: '800',
    color: '#000000',
  },
  placeholder: {
    width: 40,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  lastUpdated: {
    fontFamily: tokens.typography?.fontMedium || 'System',
    fontSize: 13,
    color: '#666666',
    marginBottom: 16,
  },
  paragraph: {
    fontFamily: tokens.typography?.fontRegular || 'System',
    fontSize: 15,
    lineHeight: 22,
    color: '#000000',
    marginBottom: 20,
  },
  sectionTitle: {
    fontFamily: tokens.typography?.fontBold || 'System',
    fontSize: 17,
    fontWeight: '800',
    color: '#000000',
    marginTop: 24,
    marginBottom: 10,
  },
  bodyText: {
    fontFamily: tokens.typography?.fontRegular || 'System',
    fontSize: 14,
    lineHeight: 22,
    color: '#333333',
    marginBottom: 16,
  },
  bold: {
    fontWeight: '700',
    color: '#000000',
  },
});
