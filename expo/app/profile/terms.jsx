import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { tokens } from '../../../theme/tokens';

export default function TermsOfService() {
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
        <Text style={styles.headerTitle}>Terms of Service</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.lastUpdated}>Last updated: July 2026</Text>
        
        <Text style={styles.paragraph}>
          Welcome to ZOWN HQ. Please read these Terms of Service ("Terms") carefully as they govern your access to and use of our fitness tracking, workout planning, nutrition logging, and social features via our mobile application.
        </Text>

        <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
        <Text style={styles.bodyText}>
          By creating an account or using the ZOWN HQ mobile application ("Service"), you agree to be bound by these Terms and our Privacy Policy. If you do not agree, do not use the Service. You must be at least 13 years old to use the Service.
        </Text>

        <Text style={styles.sectionTitle}>2. Description of Service</Text>
        <Text style={styles.bodyText}>
          ZOWN HQ is a comprehensive digital fitness companion offering workout tracking, GPS-assisted run tracking, meal/nutrition logging, metrics computation, and gamified progress systems including leveling, XP rewards, and peer challenges. All features are designed for motivational and recreational purposes.
        </Text>

        <Text style={styles.sectionTitle}>3. User Accounts</Text>
        <Text style={styles.bodyText}>
          To unlock the full suite of tracking tools, you must register for an account. You are solely responsible for keeping your login credentials confidential and secure. Only one account is permitted per person. You must provide accurate, current info, and we reserve the right to suspend or terminate accounts that breach these terms.
        </Text>

        <Text style={styles.sectionTitle}>4. User Content</Text>
        <Text style={styles.bodyText}>
          You retain complete ownership of any data, images, logs, recipes, or custom workouts you create or upload ("User Content"). By submitting User Content, you grant ZOWN HQ a worldwide, non-exclusive, royalty-free license to host, display, and distribute this content within the app (subject to your privacy settings). Any form of harassment, spam, illegal content, or intellectual property infringement is strictly prohibited.
        </Text>

        <Text style={styles.sectionTitle}>5. Health & Fitness Disclaimer</Text>
        <Text style={styles.alertText}>
          WARNING: ZOWN HQ IS NOT A MEDICAL DEVICE AND DOES NOT PROVIDE PROFESSIONAL MEDICAL ADVICE, DIAGNOSIS, OR TREATMENT.
        </Text>
        <Text style={styles.bodyText}>
          Consult with a certified physician or health professional before starting any new training program, cardio routine, or dietary regimen. Calorie expenditures, active duration metrics, heart rate estimates, and body composition predictions are algorithmic calculations, not medical measurements. ZOWN HQ assumes no liability for injuries, physical strain, or complications resulting from exercises, guides, or recipes suggested inside the app.
        </Text>

        <Text style={styles.sectionTitle}>6. Privacy</Text>
        <Text style={styles.bodyText}>
          Your privacy is vital to us. Our data collection practices, storage mechanisms, and disclosure rules are fully described in our Privacy Policy, which is accessible directly inside the app settings.
        </Text>

        <Text style={styles.sectionTitle}>7. Third-Party Services</Text>
        <Text style={styles.bodyText}>
          Our application integrates with external services to provide rich features, including Spotify (audio controls), Google Firebase (cloud hosting), ExerciseDB (exercise guides), Radar.io (geocoding/location maps), and Passio.ai (food indexing). Your interaction with these components is subject to their respective terms. We do not control and are not responsible for any third-party downtime or data discrepancies.
        </Text>

        <Text style={styles.sectionTitle}>8. Intellectual Property</Text>
        <Text style={styles.bodyText}>
          The design systems, source code, visual identity, graphics, icons, calculations, and overall brand elements of ZOWN HQ are the sole proprietary property of ZOWN HQ. Any open source libraries incorporated are explicitly compiled and listed on our Open Source Licenses page.
        </Text>

        <Text style={styles.sectionTitle}>9. Limitation of Liability</Text>
        <Text style={styles.bodyText}>
          The Service is provided on an "AS IS" and "AS AVAILABLE" basis. We offer no warranties, express or implied, regarding constant availability, accuracy of GPS data, or technical uptime. In no event shall ZOWN HQ or its contributors be liable for indirect, incidental, special, or consequential damages resulting from your use of or inability to use the platform.
        </Text>

        <Text style={styles.sectionTitle}>10. Modifications</Text>
        <Text style={styles.bodyText}>
          We reserve the right to amend or replace these Terms at any time. If a revision is material, we will provide an in-app notification prior to implementation. Continued use of ZOWN HQ after updates constitute acceptance of the modified Terms.
        </Text>

        <Text style={styles.sectionTitle}>11. Governing Law</Text>
        <Text style={styles.bodyText}>
          These Terms and any associated disputes shall be governed by, construed, and enforced in accordance with the laws of the United States.
        </Text>

        <Text style={styles.sectionTitle}>12. Contact</Text>
        <Text style={[styles.bodyText, { marginBottom: 40 }]}>
          For queries, feedback, or compliance questions, please contact support at support@zownhq.com.
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
  alertText: {
    fontFamily: tokens.typography?.fontBold || 'System',
    fontSize: 13,
    fontWeight: '800',
    color: '#D32F2F',
    lineHeight: 18,
    marginBottom: 12,
  },
});
