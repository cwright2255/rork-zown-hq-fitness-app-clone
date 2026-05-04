import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Send, ArrowLeft } from 'lucide-react-native';
import ScreenHeader from '@/components/ScreenHeader';
import { tokens } from '../../theme/tokens';

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';

const CONVERSATIONS = [
  { id: '1', name: 'Sarah Johnson', initials: 'SJ', last: 'Great workout today! Want to join me tomorrow?', time: '2m', unread: 2 },
  { id: '2', name: 'Morning Runners', initials: 'MR', last: 'Who is up for a 6 AM run?', time: '1h', unread: 0 },
  { id: '3', name: 'Alex Rodriguez', initials: 'AR', last: 'Congrats on completing Week 5!', time: '3h', unread: 1 },
  { id: '4', name: 'Emma Wilson', initials: 'EW', last: 'Smoothie recipe incoming ð¥¤', time: '1d', unread: 0 },
];

const MOCK_MESSAGES = [
  { id: 'm1', own: false, text: 'Hey! How did your workout go today?', time: '10:30 AM' },
  { id: 'm2', own: true, text: 'It was amazing! Completed my first 5K without stopping.', time: '10:32 AM' },
  { id: 'm3', own: false, text: 'That is incredible! Congratulations!', time: '10:33 AM' },
  { id: 'm4', own: false, text: 'Want to join me for a run tomorrow?', time: '2:15 PM' },
];

export default function MessagingScreen() {
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    if (selected) {
      setMessages(MOCK_MESSAGES);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [selected]);

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages([...messages, { id: `m-${Date.now()}`, own: true, text: input, time: 'Now' }]);
    setInput('');
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  };

  if (selected) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScreenHeader
          title={selected.name}
          showBack
          onBack={() => setSelected(null)}
        />
        <ScrollView
          ref={scrollRef}
          style={styles.threadScroll}
          contentContainerStyle={{ padding: 16 }}>
          {messages.map(m => (
            <View
              key={m.id}
              style={[styles.bubbleRow, { justifyContent: m.own ? 'flex-end' : 'flex-start' }]}>
              <View style={[styles.bubble, m.own ? styles.bubbleOwn : styles.bubbleOther]}>
                <Text style={m.own ? styles.bubbleOwnText : styles.bubbleOtherText}>
                  {m.text}
                </Text>
                <Text style={[styles.bubbleTime, m.own && { color: '#333' }]}>{m.time}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
        <View style={styles.inputBar}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Message..."
            placeholderTextColor="#666"
            style={styles.input}
          />
          <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
            <Send size={18} color={tokens.colors.grayscale.black} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Messages" />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {CONVERSATIONS.map(c => (
          <TouchableOpacity
            key={c.id}
            style={styles.convCard}
            onPress={() => setSelected(c)}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{c.initials}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.convName}>{c.name}</Text>
              <Text style={styles.convLast} numberOfLines={1}>{c.last}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.convTime}>{c.time}</Text>
              {c.unread > 0 ? (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>{c.unread}</Text>
                </View>
              ) : null}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.grayscale.black },
  convCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: tokens.colors.ink.darker, borderWidth: 1, borderColor: '#2A2A2A',
    borderRadius: 16, padding: 12, marginBottom: 8,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#2A2A2A',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: tokens.colors.background.default, fontWeight: '700', fontSize: 14 },
  convName: { color: tokens.colors.background.default, fontSize: 15, fontWeight: '600' },
  convLast: { color: '#999', fontSize: 13, marginTop: 2 },
  convTime: { color: '#666', fontSize: 12 },
  unreadBadge: {
    marginTop: 4, backgroundColor: tokens.colors.background.default,
    minWidth: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  unreadText: { color: tokens.colors.grayscale.black, fontSize: 11, fontWeight: '700' },
  threadScroll: { flex: 1 },
  bubbleRow: { flexDirection: 'row', marginBottom: 8 },
  bubble: { maxWidth: '75%', padding: 12, borderRadius: 16 },
  bubbleOwn: { backgroundColor: tokens.colors.background.default, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: tokens.colors.ink.darker, borderWidth: 1, borderColor: '#2A2A2A', borderBottomLeftRadius: 4 },
  bubbleOwnText: { color: tokens.colors.grayscale.black, fontSize: 14 },
  bubbleOtherText: { color: tokens.colors.background.default, fontSize: 14 },
  bubbleTime: { fontSize: 10, color: '#999', marginTop: 4, alignSelf: 'flex-end' },
  inputBar: {
    flexDirection: 'row', alignItems: 'center',
    padding: 12, gap: 8,
    borderTopWidth: 1, borderTopColor: '#2A2A2A',
    backgroundColor: tokens.colors.grayscale.black,
  },
  input: {
    flex: 1,
    backgroundColor: tokens.colors.ink.darker, borderWidth: 1, borderColor: '#2A2A2A',
    borderRadius: 24, paddingHorizontal: 16, height: 44,
    color: tokens.colors.background.default, fontSize: 14,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: tokens.colors.background.default,
    alignItems: 'center', justifyContent: 'center',
  },
});
