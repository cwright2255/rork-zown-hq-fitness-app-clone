import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { 
  MessageCircle, 
  Phone, 
  Mail, 
  HelpCircle, 
  Book, 
  Send,
  ChevronRight,
  ExternalLink
} from 'lucide-react-native';
import Colors from '@/constants/colors';

export default function SupportScreen() {
  const [activeTab, setActiveTab] = useState<'help' | 'contact'>('help');
  const [contactForm, setContactForm] = useState({
    subject: '',
    message: '',
    email: '',
  });

  const faqData = [
    {
      id: '1',
      question: 'How do I track my workouts?',
      answer: 'Go to the Workouts tab, select a workout plan, and tap "Start Workout" to begin tracking your exercises, sets, and reps.',
    },
    {
      id: '2',
      question: 'Can I sync with my fitness tracker?',
      answer: 'Yes! Go to Settings > Wearables to connect your Fitbit, Apple Watch, Garmin, or other compatible devices.',
    },
    {
      id: '3',
      question: 'How do I log my meals?',
      answer: 'Navigate to the Nutrition tab, tap the "+" button, and either scan a barcode or search for foods to log your meals.',
    },
    {
      id: '4',
      question: 'What is the Champion Pass?',
      answer: 'Champion Pass is our premium subscription that unlocks advanced features, exclusive workouts, and personalized coaching.',
    },
    {
      id: '5',
      question: 'How do I join challenges?',
      answer: 'Visit the Community tab, go to Challenges, and tap "Join Challenge" on any active challenge that interests you.',
    },
    {
      id: '6',
      question: 'Can I create custom workouts?',
      answer: 'Absolutely! Go to Workouts > Create Custom, and build your own workout with exercises from our extensive library.',
    },
  ];

  const handleContactSubmit = () => {
    if (!contactForm.subject || !contactForm.message || !contactForm.email) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    // Simulate sending message
    Alert.alert(
      'Message Sent',
      'Thank you for contacting us! We will get back to you within 24 hours.',
      [
        {
          text: 'OK',
          onPress: () => setContactForm({ subject: '', message: '', email: '' }),
        },
      ]
    );
  };

  const handlePhoneCall = () => {
    Linking.openURL('tel:+1-800-FITNESS');
  };

  const handleEmail = () => {
    Linking.openURL('mailto:support@fitnessapp.com');
  };

  const renderHelp = () => (
    <ScrollView style={styles.content}>
      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.quickActionButton} onPress={handlePhoneCall}>
          <Phone size={24} color={Colors.primary.main} />
          <Text style={styles.quickActionText}>Call Support</Text>
          <Text style={styles.quickActionSubtext}>1-800-FITNESS</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.quickActionButton} onPress={handleEmail}>
          <Mail size={24} color={Colors.primary.main} />
          <Text style={styles.quickActionText}>Email Us</Text>
          <Text style={styles.quickActionSubtext}>support@fitnessapp.com</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>

      {faqData.map((faq) => (
        <View key={faq.id} style={styles.faqItem}>
          <TouchableOpacity style={styles.faqQuestion}>
            <HelpCircle size={20} color={Colors.primary.main} />
            <Text style={styles.faqQuestionText}>{faq.question}</Text>
            <ChevronRight size={16} color={Colors.text.secondary} />
          </TouchableOpacity>
          <Text style={styles.faqAnswer}>{faq.answer}</Text>
        </View>
      ))}

      <View style={styles.resourcesSection}>
        <Text style={styles.sectionTitle}>Additional Resources</Text>
        
        <TouchableOpacity style={styles.resourceItem}>
          <Book size={20} color={Colors.primary.main} />
          <Text style={styles.resourceText}>User Guide</Text>
          <ExternalLink size={16} color={Colors.text.secondary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.resourceItem}>
          <MessageCircle size={20} color={Colors.primary.main} />
          <Text style={styles.resourceText}>Community Forum</Text>
          <ExternalLink size={16} color={Colors.text.secondary} />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderContact = () => (
    <ScrollView style={styles.content}>
      <Text style={styles.sectionTitle}>Contact Support</Text>
      
      <View style={styles.form}>
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Email Address</Text>
          <TextInput
            style={styles.input}
            placeholder="your.email@example.com"
            value={contactForm.email}
            onChangeText={(text) => setContactForm(prev => ({ ...prev, email: text }))}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Subject</Text>
          <TextInput
            style={styles.input}
            placeholder="What can we help you with?"
            value={contactForm.subject}
            onChangeText={(text) => setContactForm(prev => ({ ...prev, subject: text }))}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Message</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Please describe your issue or question in detail..."
            value={contactForm.message}
            onChangeText={(text) => setContactForm(prev => ({ ...prev, message: text }))}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity style={styles.submitButton} onPress={handleContactSubmit}>
          <Send size={16} color="white" />
          <Text style={styles.submitButtonText}>Send Message</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.responseTime}>
        <Text style={styles.responseTimeText}>
          💬 We typically respond within 24 hours during business days
        </Text>
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Support', headerShown: false }} />
      
      <View style={styles.header}>
        <Text style={styles.title}>Support Center</Text>
      </View>

      <View style={styles.tabContainer}>
        {(['help', 'contact'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'help' && renderHelp()}
      {activeTab === 'contact' && renderContact()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 4,
  },
  activeTab: {
    backgroundColor: Colors.primary.main,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  activeTabText: {
    color: 'white',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  quickActionButton: {
    flex: 1,
    backgroundColor: Colors.background.secondary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginTop: 8,
  },
  quickActionSubtext: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 16,
  },
  faqItem: {
    backgroundColor: Colors.background.secondary,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  faqQuestion: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  faqQuestionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  faqAnswer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  resourcesSection: {
    marginTop: 24,
  },
  resourceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background.secondary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  resourceText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  input: {
    backgroundColor: Colors.background.secondary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text.primary,
  },
  textArea: {
    height: 120,
    paddingTop: 12,
  },
  submitButton: {
    backgroundColor: Colors.primary.main,
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  responseTime: {
    backgroundColor: Colors.background.secondary,
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    alignItems: 'center',
  },
  responseTimeText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
});