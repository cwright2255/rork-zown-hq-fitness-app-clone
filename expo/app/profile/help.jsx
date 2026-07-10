import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  FlatList,
  LayoutAnimation,
  UIManager
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { lightColors as colors, spacing, radius } from '../../../theme/tokens';
import { chatAI } from '../../services/aiService';

// Enable layout animation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const FAQ_DATA = [
  {
    category: "Getting Started",
    items: [
      {
        question: "How do I create my fitness profile?",
        answer: "To set up your profile, go to the Profile tab and tap 'Edit Profile'. Here you can update your name, bio, target weight, height, and general fitness level. Your goals can be set and updated in the Progress tab."
      },
      {
        question: "How do I start my first workout?",
        answer: "Head over to the Workouts tab in the main navigation. You can select one of the featured fitness programs or tap 'Quick Workout' to begin an active session immediately."
      },
      {
        question: "How do I connect my wearable device?",
        answer: "Go to Settings (accessible from your Profile tab) and find 'Connected Services'. Tap the service you want to sync (like Apple Health, Garmin, or Fitbit) and complete the authorization prompt."
      },
      {
        question: "What's the best way to track my progress?",
        answer: "Use the Progress tab to record measurements like body weight, body fat %, and custom goals. Tracking consistently will update your live progress graphs automatically."
      }
    ]
  },
  {
    category: "Workouts & Running",
    items: [
      {
        question: "How do I track a workout?",
        answer: "Select any workout from your workout list and press 'Start'. The app will guide you through each exercise, complete with timers, rep targets, and rest intervals."
      },
      {
        question: "How does GPS tracking work for runs?",
        answer: "When starting an outdoor run from the Active Run screen, the app will request location access. Our GPS service maps your path, calculates real-time pace, and logs the final distance."
      },
      {
        question: "Can I create custom workouts?",
        answer: "Custom workout builder is coming soon! For now, you can choose from dozens of professional programs designed for any skill level."
      },
      {
        question: "How do I use the Spotify integration?",
        answer: "Connect your Spotify account in Settings. Once connected, a mini-player bar will automatically appear at the bottom during any active workout or run."
      },
      {
        question: "What are workout streaks?",
        answer: "Streaks represent the consecutive number of days you complete at least one activity. Keep logging a run or workout daily to grow your streak, visible on your Home dashboard."
      },
      {
        question: "How do I log a run manually?",
        answer: "Go to 'Running Log' in your Profile, tap the '+' button in the top corner, fill in your distance and time, then save."
      }
    ]
  },
  {
    category: "Nutrition & Health",
    items: [
      {
        question: "How do I log meals?",
        answer: "Go to the Nutrition tab and tap 'Log Meal'. You can search for food items via Passio.ai search, use the barcode scanner, or snap a photo for automatic AI recognition."
      },
      {
        question: "How does the barcode scanner work?",
        answer: "Tap the barcode icon inside the Log Meal screen, center the package barcode in your camera view, and the app will instantly match it with our product database."
      },
      {
        question: "How do I track water intake?",
        answer: "You can quickly log water using the quick hydration card (+1 glass / reset) on your main Home dashboard or detail it in the Nutrition section."
      },
      {
        question: "What are macro targets?",
        answer: "Macro targets are your custom target limits for Protein, Carbs, and Fats. You can change these targets in Nutrition settings to align with weight loss or muscle building."
      },
      {
        question: "How does the recipe saver work?",
        answer: "Copy a link to any recipe online, navigate to the Recipes section, and click 'Add Recipe'. Paste the URL, and our AI scanner will parse the structured ingredients and cooking guidelines."
      }
    ]
  },
  {
    category: "Social & Gamification",
    items: [
      {
        question: "How do leaderboards work?",
        answer: "The Leaderboard in the Social section ranks you and your friends based on weekly XP earned, workouts completed, and streak duration. It resets every Sunday."
      },
      {
        question: "What is Battle Pass?",
        answer: "Our Battle Pass is a seasonal reward path. Complete daily and weekly tasks (like 'Run 5km' or 'Log 3 Liters of Water') to gain Battle Pass levels and unlock premium badges."
      },
      {
        question: "How do I add friends?",
        answer: "Navigate to the Social tab, tap the add-friend icon (person with a plus), and look up your friend's profile name to send them a challenge request."
      },
      {
        question: "What are achievements?",
        answer: "Achievements are permanent milestone badges earned for completing special fitness targets (e.g. running 50 total miles or logging a 7-day streak)."
      }
    ]
  },
  {
    category: "Account & Settings",
    items: [
      {
        question: "How do I change my units (km/mi, kg/lbs)?",
        answer: "Open your profile tab, tap settings, and toggle between Imperial and Metric in the 'Units & Preferences' section."
      },
      {
        question: "How do I export my data?",
        answer: "Under Settings > Account, tap 'Export Data'. The app will generate a structured CSV ZIP of your historical weight logs, runs, and logged workouts."
      },
      {
        question: "How do I delete my account?",
        answer: "Navigate to Settings > Danger Zone and tap 'Delete Account'. This requires double confirmation and will permanently delete your database records and media files."
      },
      {
        question: "Is my data private?",
        answer: "Yes, you have complete control. Go to Settings > Privacy to adjust who can search your profile, join your duels, or see your weekly workout feed."
      },
      {
        question: "How do I reset my password?",
        answer: "If logged in, go to Settings > Account > Change Password to send a recovery link. If logged out, tap 'Forgot Password' on the login screen."
      }
    ]
  },
  {
    category: "Troubleshooting",
    items: [
      {
        question: "The app isn't syncing my data",
        answer: "Check your internet connection and pull down to refresh on any dashboard. If Firestore syncing stalls, check if you are logged into your correct profile."
      },
      {
        question: "GPS isn't working during runs",
        answer: "Please verify that Location services are set to 'Always Allow' or 'While Using the App' for ZOWN in your phone's system settings."
      },
      {
        question: "I'm not receiving notifications",
        answer: "Go to Settings > Notifications and ensure ZOWN alerts are enabled on both the app and your phone's general settings."
      },
      {
        question: "A screen shows an error",
        answer: "Force close the app and launch it again. If a layout issue remains, please submit a snapshot or contact support@zownhq.com."
      }
    ]
  }
];

const QUICK_QUESTIONS = [
  "How do I lose weight?",
  "Best workout for beginners?",
  "How much protein do I need?",
  "Running tips for 5K"
];

function FAQAccordionItem({ item }) {
  const [expanded, setExpanded] = useState(false);

  const handleToggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  return (
    <View style={styles.faqCard}>
      <Pressable style={styles.faqHeader} onPress={handleToggle}>
        <Text style={styles.faqQuestion}>{item.question}</Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color="#000000"
          style={styles.chevron}
        />
      </Pressable>
      {expanded && (
        <View style={styles.faqAnswerContainer}>
          <Text style={styles.faqAnswer}>{item.answer}</Text>
        </View>
      )}
    </View>
  );
}

function FAQCategorySection({ category, query }) {
  const [expanded, setExpanded] = useState(true);

  // Filter items matching query
  const filteredItems = category.items.filter(item =>
    item.question.toLowerCase().includes(query.toLowerCase()) ||
    item.answer.toLowerCase().includes(query.toLowerCase())
  );

  if (filteredItems.length === 0) return null;

  const handleToggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  return (
    <View style={styles.categoryContainer}>
      <Pressable style={styles.categoryHeader} onPress={handleToggle}>
        <Text style={styles.categoryTitle}>{category.category}</Text>
        <View style={styles.categoryPill}>
          <Text style={styles.categoryCount}>{filteredItems.length}</Text>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            color="#000000"
            style={{ marginLeft: 4 }}
          />
        </View>
      </Pressable>
      {expanded && (
        <View style={styles.categoryList}>
          {filteredItems.map((item, index) => (
            <FAQAccordionItem key={index} item={item} />
          ))}
        </View>
      )}
    </View>
  );
}

export default function HelpSupportScreen() {
  const [activeTab, setActiveTab] = useState('faq'); // 'faq' | 'ai'
  const [searchQuery, setSearchQuery] = useState('');
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatMessageHistory] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: "👋 Hi! I'm ZOWN's AI fitness coach. Ask me anything about workouts, nutrition, running, or your fitness goals!"
    }
  ]);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const scrollViewRef = useRef(null);

  const handleSend = async (textToSend) => {
    const text = textToSend || chatMessage;
    if (!text.trim() || isAiThinking) return;

    const userMsg = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim().slice(0, 500)
    };

    setChatMessageHistory(prev => [...prev, userMsg]);
    setChatMessage('');
    setIsAiThinking(true);

    // Auto-scroll to bottom
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const messagesPayload = chatHistory
        .concat(userMsg)
        .map(m => ({ role: m.role, content: m.content }));

      const response = await chatAI(messagesPayload);
      
      const assistantMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response
      };

      setChatMessageHistory(prev => [...prev, assistantMsg]);
    } catch (e) {
      console.error('[FAQ AI] Error talking to Cloud Function LLM:', e);
      
      // Smart local fallback
      const cleanText = text.toLowerCase();
      let matchedAnswer = '';
      
      for (const cat of FAQ_DATA) {
        for (const item of cat.items) {
          if (cleanText.includes(item.question.toLowerCase().split(' ').slice(0, 3).join(' '))) {
            matchedAnswer = item.answer;
            break;
          }
        }
        if (matchedAnswer) break;
      }

      const fallbackText = matchedAnswer 
        ? matchedAnswer 
        : "Great question! I'd recommend checking the FAQ tab, or contact support@zownhq.com for detailed help.";

      const assistantMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: fallbackText
      };

      setChatMessageHistory(prev => [...prev, assistantMsg]);
    } finally {
      setIsAiThinking(false);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/profile');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </Pressable>
        <Text style={styles.headerTitle}>Help & FAQ</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <Pressable
          style={[styles.tabButton, activeTab === 'faq' && styles.tabButtonActive]}
          onPress={() => setActiveTab('faq')}
        >
          <Text style={[styles.tabLabel, activeTab === 'faq' && styles.tabLabelActive]}>FAQ</Text>
        </Pressable>
        <Pressable
          style={[styles.tabButton, activeTab === 'ai' && styles.tabButtonActive]}
          onPress={() => setActiveTab('ai')}
        >
          <Text style={[styles.tabLabel, activeTab === 'ai' && styles.tabLabelActive]}>AI Assistant</Text>
        </Pressable>
      </View>

      {activeTab === 'faq' ? (
        <View style={styles.tabContent}>
          {/* Search bar */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#666666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search frequently asked questions..."
              placeholderTextColor="#666666"
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color="#666666" />
              </Pressable>
            )}
          </View>

          {/* Accordion Lists */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollList}
          >
            {FAQ_DATA.map((category, index) => (
              <FAQCategorySection key={index} category={category} query={searchQuery} />
            ))}
          </ScrollView>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.tabContent}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          {/* Chat view */}
          <ScrollView
            ref={scrollViewRef}
            contentContainerStyle={styles.chatScroll}
            showsVerticalScrollIndicator={false}
          >
            {chatHistory.map((msg) => (
              <View
                key={msg.id}
                style={[
                  styles.chatBubbleContainer,
                  msg.role === 'user' ? styles.bubbleRight : styles.bubbleLeft
                ]}
              >
                {msg.role !== 'user' && (
                  <View style={styles.avatarContainer}>
                    <Text style={styles.avatarText}>Z</Text>
                  </View>
                )}
                <View
                  style={[
                    styles.chatBubble,
                    msg.role === 'user' ? styles.chatBubbleUser : styles.chatBubbleAssistant
                  ]}
                >
                  <Text
                    style={[
                      styles.chatText,
                      msg.role === 'user' ? styles.chatTextUser : styles.chatTextAssistant
                    ]}
                  >
                    {msg.content}
                  </Text>
                </View>
              </View>
            ))}

            {isAiThinking && (
              <View style={[styles.chatBubbleContainer, styles.bubbleLeft]}>
                <View style={styles.avatarContainer}>
                  <Text style={styles.avatarText}>Z</Text>
                </View>
                <View style={[styles.chatBubble, styles.chatBubbleAssistant, styles.typingBubble]}>
                  <ActivityIndicator size="small" color="#000000" />
                </View>
              </View>
            )}
          </ScrollView>

          {/* Suggested Quick Questions (shows initially or when history is just the welcome message) */}
          {chatHistory.length === 1 && !isAiThinking && (
            <View style={styles.quickQuestionsContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: spacing.md }}>
                {QUICK_QUESTIONS.map((q, idx) => (
                  <Pressable
                    key={idx}
                    style={styles.quickQuestionPill}
                    onPress={() => handleSend(q)}
                  >
                    <Text style={styles.quickQuestionText}>{q}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Input Panel */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Ask ZOWN AI coach..."
              placeholderTextColor="#666666"
              value={chatMessage}
              onChangeText={setChatMessage}
              maxLength={500}
              multiline
            />
            <Pressable
              style={[
                styles.sendCircle,
                (!chatMessage.trim() || isAiThinking) && styles.sendCircleDisabled
              ]}
              onPress={() => handleSend()}
              disabled={!chatMessage.trim() || isAiThinking}
            >
              <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  placeholder: {
    width: 32,
  },
  tabContainer: {
    flexDirection: 'row',
    padding: spacing.xs,
    backgroundColor: '#F5F5F5',
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: radius.md,
  },
  tabButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  tabLabelActive: {
    color: '#000000',
  },
  tabContent: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    margin: spacing.md,
    paddingHorizontal: spacing.sm,
    height: 44,
    borderRadius: radius.md,
  },
  searchIcon: {
    marginRight: spacing.xs,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    color: '#000000',
    fontSize: 14,
  },
  scrollList: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  categoryContainer: {
    marginBottom: spacing.md,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    marginBottom: spacing.xs,
  },
  categoryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAEAEA',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  categoryCount: {
    fontSize: 11,
    fontWeight: '600',
    color: '#000000',
  },
  categoryList: {
    marginTop: spacing.xs,
  },
  faqCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAEAEA',
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  faqQuestion: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#000000',
    marginRight: spacing.sm,
  },
  chevron: {
    marginLeft: spacing.xs,
  },
  faqAnswerContainer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
    paddingTop: spacing.sm,
  },
  faqAnswer: {
    fontSize: 13,
    color: '#555555',
    lineHeight: 18,
  },
  chatScroll: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  chatBubbleContainer: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    alignItems: 'flex-end',
  },
  bubbleLeft: {
    justifyContent: 'flex-start',
  },
  bubbleRight: {
    justifyContent: 'flex-end',
  },
  avatarContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  chatBubble: {
    maxWidth: '75%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  chatBubbleUser: {
    backgroundColor: '#000000',
    borderBottomRightRadius: 2,
  },
  chatBubbleAssistant: {
    backgroundColor: '#F5F5F5',
    borderBottomLeftRadius: 2,
  },
  typingBubble: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatText: {
    fontSize: 14,
    lineHeight: 18,
  },
  chatTextUser: {
    color: '#FFFFFF',
  },
  chatTextAssistant: {
    color: '#000000',
  },
  quickQuestionsContainer: {
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
  quickQuestionPill: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: '#EAEAEA',
  },
  quickQuestionText: {
    fontSize: 13,
    color: '#000000',
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    backgroundColor: '#FFFFFF',
  },
  input: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    maxHeight: 100,
    color: '#000000',
    fontSize: 14,
    marginRight: spacing.sm,
  },
  sendCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendCircleDisabled: {
    backgroundColor: '#CCCCCC',
  }
});
