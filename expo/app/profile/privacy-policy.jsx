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
        <Text style={styles.lastUpdated}>Last updated: October 2026</Text>

        <Text style={styles.paragraph}>
          This policy explains what ZOWN HQ collects, why we collect it, who it is shared with, and the choices you have. ZOWN HQ is an early (alpha) release, so features and this policy may change.
        </Text>

        <Text style={styles.sectionTitle}>1. Information We Collect</Text>
        <Text style={styles.bulletItem}>• <Text style={styles.bold}>Account</Text>: your name and email address. Your password is handled by Firebase Authentication; we never see it.</Text>
        <Text style={styles.bulletItem}>• <Text style={styles.bold}>Profile and body metrics</Text>: age, gender, height, weight, goals, and body measurements you enter or that a body scan estimates. Body-scan photos are analyzed on your device. We save the resulting measurements and estimates, not the photos.</Text>
        <Text style={styles.bulletItem}>• <Text style={styles.bold}>Fitness activity</Text>: workouts, sets, runs, walks and hikes, steps, and recovery data (sleep, resting heart rate and heart-rate variability) if you connect Apple Health or a wearable. A daily record of these readings is saved to your account, so the trend charts on the Health page come back on a new phone.</Text>
        <Text style={styles.bulletItem}>• <Text style={styles.bold}>Location</Text>: GPS points while you record a run, walk or hike (including in the background while a recording is active), and your approximate location when you look up weather or nearby trails. For the Local 5K virtual race, a rough map square (about 7 miles across) for where your run started, and the squares around where you are when you look at its board; never your exact position. Only with your permission.</Text>
        <Text style={styles.bulletItem}>• <Text style={styles.bold}>Nutrition</Text>: food and water logs, meal plans, and recipes you save or import.</Text>
        <Text style={styles.bulletItem}>• <Text style={styles.bold}>Calendar</Text>: the events you schedule (title, day and time, notes, how often it repeats, and when to remind you), and the workouts and meals the AI coach adds to it after you say yes. They are saved to your account so a new phone gets them back. Reminders are set on your phone.</Text>
        <Text style={styles.bulletItem}>• <Text style={styles.bold}>Social content</Text>: your public name and avatar, posts, comments, photos or videos you post, messages, who you follow, and challenge, duel or virtual race activity (your finishing times).</Text>
        <Text style={styles.bulletItem}>• <Text style={styles.bold}>Device and diagnostics</Text>: crash reports (with your account ID attached), device model, operating system and app version, usage events, and a notification token if you turn on notifications.</Text>

        <Text style={styles.sectionTitle}>2. How We Use Your Information</Text>
        <Text style={styles.bulletItem}>• To run the app: your history, plans, goals, progress, streaks, XP and rewards.</Text>
        <Text style={styles.bulletItem}>• To power social features such as the leaderboard, feed, groups, messages and duels.</Text>
        <Text style={styles.bulletItem}>• To send reminders and alerts you have turned on.</Text>
        <Text style={styles.bulletItem}>• To find and fix crashes and bugs.</Text>
        <Text style={styles.bodyText}>
          We do not sell your personal information and we do not use it for advertising. Data from Apple Health is used only to provide fitness features inside ZOWN HQ.
        </Text>

        <Text style={styles.sectionTitle}>3. AI Features</Text>
        <Text style={styles.bodyText}>
          The AI coach, workout and challenge generation, nutrition suggestions, progress summaries, body-composition insights, and the photo food scanner send the information they need (for example your goals, age, measurements, the text you type, or the meal photo you take) through our servers to OpenAI, which generates the response. We do not store meal photos you send for scanning. AI output can be wrong and is not medical advice.
        </Text>

        <Text style={styles.sectionTitle}>4. Services That Receive Your Data</Text>
        <Text style={styles.bulletItem}>• <Text style={styles.bold}>Google Firebase</Text>: sign-in, database, file storage, cloud functions, crash reporting (Crashlytics) and analytics.</Text>
        <Text style={styles.bulletItem}>• <Text style={styles.bold}>OpenAI</Text>: AI features described above.</Text>
        <Text style={styles.bulletItem}>• <Text style={styles.bold}>Radar, Google Places, TrailAPI and the U.S. National Weather Service</Text>: your coordinates or search text, to show a place name, find trails and places, and show weather.</Text>
        <Text style={styles.bulletItem}>• <Text style={styles.bold}>OpenStreetMap (Overpass)</Text>: the map point of a trail you open, to find its marked paths. Not your own location.</Text>
        <Text style={styles.bulletItem}>• <Text style={styles.bold}>CalorieAPI and Spoonacular</Text>: food searches, barcodes you scan, and recipe links you import.</Text>
        <Text style={styles.bulletItem}>• <Text style={styles.bold}>Exercise and muscle-diagram providers</Text>: exercise search terms and muscle groups. No personal profile data.</Text>
        <Text style={styles.bulletItem}>• <Text style={styles.bold}>Our 3D body-model service</Text>: your height, weight, gender, body-fat estimate and waist and hip measurements, to draw your body model.</Text>
        <Text style={styles.bulletItem}>• <Text style={styles.bold}>Spotify and Apple Music</Text>: only if you connect them, to control playback.</Text>
        <Text style={styles.bulletItem}>• <Text style={styles.bold}>Apple Health and ROOK</Text>: only if you connect them, to bring in health and wearable data you choose to share.</Text>

        <Text style={styles.sectionTitle}>5. What Other Users Can See</Text>
        <Text style={styles.bodyText}>
          Your public name and avatar, posts and comments are visible to other signed-in users. Your leaderboard entry (name, avatar, XP, level, streak and distance) is visible unless you turn off Show in Leaderboards in Settings. So are your virtual race results on the race boards: your name, avatar, finishing time and, for the Local 5K, the rough map square where you started. Turning off Show in Leaderboards takes them off the boards. Messages are visible to the people in the conversation. Your workouts, body metrics, nutrition logs, calendar and virtual journey progress are private to your account.
        </Text>

        <Text style={styles.sectionTitle}>6. Keeping and Deleting Your Data</Text>
        <Text style={styles.bodyText}>
          We keep your data while your account is active. You can delete your account at any time in Settings &gt; Danger Zone. Deleting it permanently erases your email address, profile, workouts, nutrition, calendar and body-scan records, posts, comments, likes, messages, duels, challenge entries, virtual race times, uploaded photos and videos, and your leaderboard entry from our servers, and then removes your sign-in. Conversations and duels you shared with other people are removed for them too. This cannot be undone.
        </Text>
        <Text style={styles.bodyText}>
          A few things sit outside our servers. Firebase keeps crash reports for a limited time. OpenAI may keep AI requests for a short period under its own policy. Anything you connected to Spotify, Apple Music, Apple Health or ROOK stays in those services, where you can remove it yourself. To get a copy of your data before you delete it, email privacy@zownhq.com from the address on your account.
        </Text>

        <Text style={styles.sectionTitle}>7. Security</Text>
        <Text style={styles.bodyText}>
          Your data is stored with Google Firebase, which encrypts it in transit and at rest. Our database rules limit private records to your own account. No system is perfectly secure, so we cannot guarantee absolute security.
        </Text>

        <Text style={styles.sectionTitle}>8. Your Choices</Text>
        <Text style={styles.bulletItem}>• Turn location, camera, photos, Apple Health and notification access on or off in your device settings at any time.</Text>
        <Text style={styles.bulletItem}>• Control who can find you and see your activity under Settings &gt; Privacy, and hide yourself from leaderboards.</Text>
        <Text style={styles.bulletItem}>• Disconnect Spotify, Apple Music or wearables in Settings.</Text>

        <Text style={styles.sectionTitle}>9. Children's Privacy</Text>
        <Text style={styles.bodyText}>
          ZOWN HQ is not for children under 13. We do not knowingly collect information from them, and we will remove any account we learn belongs to a child under 13.
        </Text>

        <Text style={styles.sectionTitle}>10. Cookies and Analytics</Text>
        <Text style={styles.bodyText}>
          The app does not use web cookies. It uses Firebase Analytics and Crashlytics to measure how the app performs and to find crashes.
        </Text>

        <Text style={styles.sectionTitle}>11. Changes to This Policy</Text>
        <Text style={styles.bodyText}>
          We may update this policy. When we make an important change we will tell you in the app, and the date at the top will change.
        </Text>

        <Text style={styles.sectionTitle}>12. Contact</Text>
        <Text style={[styles.bodyText, { marginBottom: 40 }]}>
          For privacy questions or requests, email privacy@zownhq.com. For general support, email support@zownhq.com.
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
  bulletItem: {
    fontFamily: tokens.typography?.fontRegular || 'System',
    fontSize: 14,
    lineHeight: 20,
    color: '#333333',
    marginBottom: 8,
    paddingLeft: 8,
  },
  bold: {
    fontWeight: '700',
    color: '#000000',
  },
});
