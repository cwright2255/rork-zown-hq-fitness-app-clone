import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Send, Search, Plus, Phone, Video, MoreHorizontal } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useUserStore } from '@/store/userStore';

interface UserType {
  id: string;
  name: string;
  profileImage?: string;
}

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  content: string;
  timestamp: string;
  type: 'text' | 'image' | 'workout' | 'achievement';
  metadata?: any;
}

interface Conversation {
  id: string;
  participants: {
    id: string;
    name: string;
    avatar: string;
    isOnline: boolean;
  }[];
  lastMessage: Message;
  unreadCount: number;
  type: 'direct' | 'group';
  groupName?: string;
  groupAvatar?: string;
}

export default function MessagingScreen() {
  const { user } = useUserStore() as { user: UserType | null };
  const [activeTab, setActiveTab] = useState<'conversations' | 'chat'>('conversations');
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);

  // Mock conversations data
  const [conversations] = useState<Conversation[]>([
    {
      id: '1',
      type: 'direct',
      participants: [
        {
          id: '2',
          name: 'Sarah Johnson',
          avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face',
          isOnline: true,
        }
      ],
      lastMessage: {
        id: 'msg1',
        senderId: '2',
        senderName: 'Sarah Johnson',
        senderAvatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face',
        content: 'Great workout today! Want to join me for a run tomorrow?',
        timestamp: '2 min ago',
        type: 'text'
      },
      unreadCount: 2
    },
    {
      id: '2',
      type: 'group',
      groupName: 'Morning Runners',
      groupAvatar: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=150&h=150&fit=crop',
      participants: [
        {
          id: '3',
          name: 'Mike Chen',
          avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
          isOnline: false,
        },
        {
          id: '4',
          name: 'Emma Wilson',
          avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
          isOnline: true,
        }
      ],
      lastMessage: {
        id: 'msg2',
        senderId: '3',
        senderName: 'Mike Chen',
        senderAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
        content: 'Who is up for a 6 AM run in the park?',
        timestamp: '1 hour ago',
        type: 'text'
      },
      unreadCount: 0
    },
    {
      id: '3',
      type: 'direct',
      participants: [
        {
          id: '5',
          name: 'Alex Rodriguez',
          avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face',
          isOnline: false,
        }
      ],
      lastMessage: {
        id: 'msg3',
        senderId: '5',
        senderName: 'Alex Rodriguez',
        senderAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face',
        content: 'Congrats on completing Week 5 of C25K! 🏃‍♂️',
        timestamp: '3 hours ago',
        type: 'text'
      },
      unreadCount: 1
    }
  ]);

  // Mock messages for selected conversation
  const mockMessages: Message[] = [
    {
      id: 'msg1',
      senderId: '2',
      senderName: 'Sarah Johnson',
      senderAvatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face',
      content: 'Hey! How did your workout go today?',
      timestamp: '10:30 AM',
      type: 'text'
    },
    {
      id: 'msg2',
      senderId: user?.id || 'current-user',
      senderName: user?.name || 'You',
      senderAvatar: user?.profileImage || '',
      content: 'It was amazing! Completed my first 5K run without stopping 🏃‍♂️',
      timestamp: '10:32 AM',
      type: 'text'
    },
    {
      id: 'msg3',
      senderId: '2',
      senderName: 'Sarah Johnson',
      senderAvatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face',
      content: 'That is incredible! Congratulations! 🎉',
      timestamp: '10:33 AM',
      type: 'text'
    },
    {
      id: 'msg4',
      senderId: '2',
      senderName: 'Sarah Johnson',
      senderAvatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face',
      content: 'Great workout today! Want to join me for a run tomorrow?',
      timestamp: '2:15 PM',
      type: 'text'
    }
  ];

  useEffect(() => {
    if (selectedConversation) {
      setMessages(mockMessages);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversation]);

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedConversation || !user) return;

    const message: Message = {
      id: Date.now().toString(),
      senderId: user.id,
      senderName: user.name,
      senderAvatar: user.profileImage || '',
      content: newMessage.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'text'
    };

    setMessages(prev => [...prev, message]);
    setNewMessage('');
    
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const openConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setActiveTab('chat');
  };

  const renderConversationsList = () => (
    <View style={styles.conversationsContainer}>
      <View style={styles.searchContainer}>
        <Search size={20} color={Colors.text.secondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search conversations..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={Colors.text.secondary}
        />
      </View>

      <ScrollView style={styles.conversationsList}>
        {conversations
          .filter(conv => 
            searchQuery === '' || 
            (conv.type === 'direct' 
              ? conv.participants[0].name.toLowerCase().includes(searchQuery.toLowerCase())
              : conv.groupName?.toLowerCase().includes(searchQuery.toLowerCase())
            )
          )
          .map((conversation) => (
            <TouchableOpacity
              key={conversation.id}
              style={styles.conversationItem}
              onPress={() => openConversation(conversation)}
            >
              <View style={styles.conversationAvatar}>
                <Image
                  source={{ 
                    uri: conversation.type === 'direct' 
                      ? conversation.participants[0].avatar 
                      : conversation.groupAvatar 
                  }}
                  style={styles.avatarImage}
                />
                {conversation.type === 'direct' && conversation.participants[0].isOnline && (
                  <View style={styles.onlineIndicator} />
                )}
              </View>

              <View style={styles.conversationContent}>
                <View style={styles.conversationHeader}>
                  <Text style={styles.conversationName}>
                    {conversation.type === 'direct' 
                      ? conversation.participants[0].name 
                      : conversation.groupName
                    }
                  </Text>
                  <Text style={styles.conversationTime}>
                    {conversation.lastMessage.timestamp}
                  </Text>
                </View>

                <View style={styles.conversationFooter}>
                  <Text style={styles.lastMessage} numberOfLines={1}>
                    {conversation.lastMessage.content}
                  </Text>
                  {conversation.unreadCount > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadCount}>
                        {conversation.unreadCount}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          ))}
      </ScrollView>

      <TouchableOpacity style={styles.newChatButton}>
        <Plus size={24} color="white" />
      </TouchableOpacity>
    </View>
  );

  const renderChat = () => {
    if (!selectedConversation) return null;

    const otherParticipant = selectedConversation.type === 'direct' 
      ? selectedConversation.participants[0] 
      : null;

    return (
      <KeyboardAvoidingView 
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.chatHeader}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => setActiveTab('conversations')}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>

          <View style={styles.chatHeaderInfo}>
            <Image
              source={{ 
                uri: selectedConversation.type === 'direct' 
                  ? otherParticipant?.avatar 
                  : selectedConversation.groupAvatar 
              }}
              style={styles.chatHeaderAvatar}
            />
            <View>
              <Text style={styles.chatHeaderName}>
                {selectedConversation.type === 'direct' 
                  ? otherParticipant?.name 
                  : selectedConversation.groupName
                }
              </Text>
              {selectedConversation.type === 'direct' && (
                <Text style={styles.chatHeaderStatus}>
                  {otherParticipant?.isOnline ? 'Online' : 'Last seen recently'}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.chatHeaderActions}>
            <TouchableOpacity style={styles.chatHeaderAction}>
              <Phone size={20} color={Colors.text.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.chatHeaderAction}>
              <Video size={20} color={Colors.text.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.chatHeaderAction}>
              <MoreHorizontal size={20} color={Colors.text.primary} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView 
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
        >
          {messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.messageItem,
                message.senderId === user?.id ? styles.sentMessage : styles.receivedMessage
              ]}
            >
              {message.senderId !== user?.id && (
                <Image
                  source={{ uri: message.senderAvatar }}
                  style={styles.messageAvatar}
                />
              )}
              
              <View
                style={[
                  styles.messageBubble,
                  message.senderId === user?.id ? styles.sentBubble : styles.receivedBubble
                ]}
              >
                <Text
                  style={[
                    styles.messageText,
                    message.senderId === user?.id ? styles.sentText : styles.receivedText
                  ]}
                >
                  {message.content}
                </Text>
                <Text
                  style={[
                    styles.messageTime,
                    message.senderId === user?.id ? styles.sentTime : styles.receivedTime
                  ]}
                >
                  {message.timestamp}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={styles.messageInputContainer}>
          <TextInput
            style={styles.messageInput}
            placeholder="Type a message..."
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
            maxLength={500}
            placeholderTextColor={Colors.text.secondary}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              { opacity: newMessage.trim() ? 1 : 0.5 }
            ]}
            onPress={handleSendMessage}
            disabled={!newMessage.trim()}
          >
            <Send size={20} color="white" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Messages', headerShown: false }} />
      
      {activeTab === 'conversations' ? (
        <>
          <View style={styles.header}>
            <Text style={styles.title}>Messages</Text>
          </View>
          {renderConversationsList()}
        </>
      ) : (
        renderChat()
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.card,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  conversationsContainer: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    marginHorizontal: 20,
    marginVertical: 16,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text.primary,
  },
  conversationsList: {
    flex: 1,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.card,
  },
  conversationAvatar: {
    position: 'relative',
    marginRight: 16,
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.success,
    borderWidth: 2,
    borderColor: Colors.background,
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  conversationTime: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  conversationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    fontSize: 14,
    color: Colors.text.secondary,
    flex: 1,
  },
  unreadBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  unreadCount: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  newChatButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  chatContainer: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.card,
  },
  backButton: {
    marginRight: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: Colors.primary,
  },
  chatHeaderInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatHeaderAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  chatHeaderName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  chatHeaderStatus: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  chatHeaderActions: {
    flexDirection: 'row',
    gap: 16,
  },
  chatHeaderAction: {
    padding: 4,
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  messagesContent: {
    padding: 16,
  },
  messageItem: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  sentMessage: {
    justifyContent: 'flex-end',
  },
  receivedMessage: {
    justifyContent: 'flex-start',
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  sentBubble: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  receivedBubble: {
    backgroundColor: Colors.card,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  sentText: {
    color: 'white',
  },
  receivedText: {
    color: Colors.text.primary,
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  sentTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  receivedTime: {
    color: Colors.text.secondary,
  },
  messageInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.card,
  },
  messageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 12,
    maxHeight: 100,
    fontSize: 16,
    color: Colors.text.primary,
    backgroundColor: Colors.background,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
});