import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, TextInput, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

const INITIAL_MESSAGES = [
  { id: '1', type: 'timestamp', text: 'Today, 2:30 PM' },
  { id: '2', type: 'received', kind: 'workout', workout: { name: 'Outdoor Cy...', duration: '24 mins', calories: '1,282 Kcal', icon: 'bicycle-outline' } },
  { id: '3', type: 'sent', text: "That's amazing! How was the ride? I want to start cycling too" },
  { id: '4', type: 'sent', text: "I just did my HIIT session and I'm dead \u{1F605}" },
  { id: '5', type: 'received', text: "It was great! The weather was perfect. You should definitely try it \u{1F6B4}" },
  { id: '6', type: 'received', kind: 'map', text: "Join me in this challenge, it's very interesting. Join now \u{1F4AA}" },
  { id: '7', type: 'sent', text: "I'm in! Let's do it this weekend" },
  { id: '8', type: 'received', text: "Perfect! See you Saturday at 8am \u{1F64C}" },
];

export default function ChatScreen() {
  const { name } = useLocalSearchParams();
  const contactName = name || 'Chat';
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [msgText, setMsgText] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100);
  }, []);

  const handleSend = () => {
    if (!msgText.trim()) return;
    const newMsg = { id: Date.now().toString(), type: 'sent', text: msgText.trim() };
    setMessages(prev => [...prev, newMsg]);
    setMsgText('');
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  };

  const renderMessage = (msg) => {
    if (msg.type === 'timestamp') {
      return <Text key={msg.id} style={s.timestamp}>{msg.text}</Text>;
    }

    if (msg.type === 'sent') {
      return (
        <View key={msg.id} style={s.sentRow}>
          <View style={s.sentBubble}>
            <Text style={s.sentText}>{msg.text}</Text>
          </View>
        </View>
      );
    }

    if (msg.type === 'received' && msg.kind === 'workout') {
      return (
        <View key={msg.id} style={s.receivedRow}>
          <View style={s.receivedAvSmall}><Ionicons name="person" size={12} color="#999" /></View>
          <View style={s.workoutBubble}>
            <View style={s.workoutRow}>
              <View style={s.workoutIcon}><Ionicons name={msg.workout.icon} size={18} color="#FFF" /></View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#000' }}>{msg.workout.name}</Text>
                <Text style={{ fontSize: 12, color: '#999' }}>{msg.workout.duration}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="flame-outline" size={14} color="#000" style={{ marginRight: 4 }} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#000' }}>{msg.workout.calories}</Text>
              </View>
            </View>
          </View>
        </View>
      );
    }

    if (msg.type === 'received' && msg.kind === 'map') {
      return (
        <View key={msg.id} style={s.receivedRow}>
          <View style={s.receivedAvSmall}><Ionicons name="person" size={12} color="#999" /></View>
          <View style={s.mapBubble}>
            <View style={s.mapArea}>
              <View style={[s.mapPin, { top: 30, left: 60 }]}><Ionicons name="person" size={12} color="#FFF" /></View>
              <View style={[s.mapPin, { top: 60, right: 50 }]}><Ionicons name="person" size={12} color="#FFF" /></View>
              <Ionicons name="map-outline" size={28} color="#B0B0B0" />
            </View>
            <View style={{ padding: 12 }}>
              <Text style={{ fontSize: 14, color: '#000', lineHeight: 20 }}>{msg.text}</Text>
            </View>
          </View>
        </View>
      );
    }

    // Default received text
    return (
      <View key={msg.id} style={s.receivedRow}>
        <View style={s.receivedAvSmall}><Ionicons name="person" size={12} color="#999" /></View>
        <View style={s.receivedBubble}>
          <Text style={s.receivedText}>{msg.text}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={['top','bottom']}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#000" />
        </Pressable>
        <View style={s.headerAvatar}><Ionicons name="person" size={20} color="#999" /></View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={s.headerName}>{contactName}</Text>
          <Text style={s.headerStatus}>Online</Text>
        </View>
        <Pressable style={s.menuBtn}><Ionicons name="ellipsis-vertical" size={20} color="#000" /></Pressable>
      </View>

      {/* Shared Workout Card */}
      <View style={s.sharedWorkout}>
        <View style={s.sharedIcon}><Ionicons name="bicycle-outline" size={18} color="#FFF" /></View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#000' }}>Outdoor Cy...</Text>
          <Text style={{ fontSize: 12, color: '#999' }}>24 mins</Text>
        </View>
        <Ionicons name="flame-outline" size={14} color="#000" style={{ marginRight: 4 }} />
        <Text style={{ fontSize: 13, fontWeight: '700', color: '#000' }}>1,282 Kcal</Text>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
        <ScrollView
          ref={scrollRef}
          style={s.chatArea}
          contentContainerStyle={{ paddingVertical: 8 }}
          showsVerticalScrollIndicator={false}
        >
          {messages.map(renderMessage)}
        </ScrollView>

        {/* Input Bar */}
        <View style={s.inputBar}>
          <Pressable><Ionicons name="attach-outline" size={22} color="#666" /></Pressable>
          <TextInput
            style={s.textInput}
            placeholder="Type message..."
            placeholderTextColor="#999"
            value={msgText}
            onChangeText={setMsgText}
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
          <Pressable style={{ marginRight: 10 }}><Ionicons name="location-outline" size={22} color="#666" /></Pressable>
          <Pressable style={s.sendBtn} onPress={handleSend}>
            <Ionicons name="send" size={16} color="#FFF" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
      {/* TODO: Replace local state with real-time messaging via Firestore or WebSocket */}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },

  /* Header */
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E0E0E0', justifyContent: 'center', alignItems: 'center' },
  headerName: { fontSize: 16, fontWeight: '700', color: '#000' },
  headerStatus: { fontSize: 12, color: '#22C55E', marginTop: 1 },
  menuBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },

  /* Shared Workout */
  sharedWorkout: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', borderRadius: 16, padding: 12, marginHorizontal: 16, marginTop: 12, marginBottom: 8 },
  sharedIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },

  /* Chat */
  chatArea: { flex: 1 },
  timestamp: { textAlign: 'center', fontSize: 11, color: '#999', marginVertical: 16 },

  /* Sent */
  sentRow: { alignItems: 'flex-end', marginHorizontal: 16, marginBottom: 8 },
  sentBubble: { maxWidth: '75%', backgroundColor: '#FF8A9B', borderRadius: 20, borderBottomRightRadius: 4, padding: 14 },
  sentText: { fontSize: 15, color: '#FFF', lineHeight: 22 },

  /* Received */
  receivedRow: { flexDirection: 'row', alignItems: 'flex-end', marginLeft: 16, marginRight: 60, marginBottom: 8 },
  receivedAvSmall: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E0E0E0', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  receivedBubble: { maxWidth: '85%', backgroundColor: '#F5F5F5', borderRadius: 20, borderBottomLeftRadius: 4, padding: 14 },
  receivedText: { fontSize: 15, color: '#000', lineHeight: 22 },

  /* Workout bubble */
  workoutBubble: { backgroundColor: '#F5F5F5', borderRadius: 16, padding: 12, maxWidth: '85%' },
  workoutRow: { flexDirection: 'row', alignItems: 'center' },
  workoutIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },

  /* Map bubble */
  mapBubble: { width: 250, borderRadius: 16, overflow: 'hidden', backgroundColor: '#F5F5F5' },
  mapArea: { height: 140, backgroundColor: '#E8E8E8', justifyContent: 'center', alignItems: 'center' },
  mapPin: { position: 'absolute', width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: '#FF8A9B', backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },

  /* Input Bar */
  inputBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F0F0F0', backgroundColor: '#FFF' },
  textInput: { flex: 1, backgroundColor: '#F5F5F5', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, fontSize: 14, marginHorizontal: 10, color: '#000' },
  sendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
});
