import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Alert, TouchableOpacity } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Stack, router } from 'expo-router';
import { Bell, Lock, HelpCircle, Info, LogOut, Music, ExternalLink } from 'lucide-react-native';
import Colors from '@/constants/colors';
import Button from '@/components/Button';
import Input from '@/components/Input';
import Card from '@/components/Card';
import { useUserStore } from '@/store/userStore';
import { useNutritionStore } from '@/store/nutritionStore';
import { useSpotifyStore } from '@/store/spotifyStore';
import { authService } from '@/services/authService';

WebBrowser.maybeCompleteAuthSession();

const SPOTIFY_CLIENT_ID = 'cb884c0e045d4683bd3f0b38cb0e151e';
const SPOTIFY_SCOPES = [
  'user-read-private',
  'user-read-email',
  'user-top-read',
  'playlist-read-private',
  'playlist-read-collaborative',
  'playlist-modify-private',
  'playlist-modify-public',
  'user-read-currently-playing',
  'user-modify-playback-state',
  'user-read-playback-state',
];

export default function SettingsScreen() {
  const { user, updateUserPreferences, logout } = useUserStore();
  const { dailyGoals, updateDailyGoals } = useNutritionStore();
  const { 
    isConnected: isSpotifyConnected, 
    user: spotifyUser, 
    disconnectSpotify,
    musicPreferences,
    updateMusicPreferences,
    connectSpotifyImplicit
  } = useSpotifyStore();
  
  const [isConnecting, setIsConnecting] = useState(false);
  
  // Spotify doesn't have OIDC discovery, so we define endpoints manually
const discovery = useMemo(() => ({
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token',
}), []);
  
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'zown',
    path: 'spotify-callback',
  });
  
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: SPOTIFY_CLIENT_ID,
      scopes: SPOTIFY_SCOPES,
      usePKCE: true,
      redirectUri,
    },
    discovery
  );
  
  const handleAuthResponse = useCallback(async () => {
    if (response?.type === 'success') {
      setIsConnecting(true);
      try {
        const { code } = response.params;
        console.log('Auth code received:', code ? 'yes' : 'no');
        
        if (code && discovery) {
          const tokenResult = await AuthSession.exchangeCodeAsync(
            {
              clientId: SPOTIFY_CLIENT_ID,
              code,
              redirectUri,
              extraParams: {
                code_verifier: request?.codeVerifier || '',
              },
            },
            discovery
          );
          
          if (tokenResult.accessToken) {
            const fragment = `#access_token=${tokenResult.accessToken}&token_type=Bearer&expires_in=${tokenResult.expiresIn || 3600}`;
            const success = await connectSpotifyImplicit(fragment);
            
            if (success) {
              Alert.alert('Success', 'Spotify connected successfully!');
            } else {
              Alert.alert('Error', 'Failed to connect Spotify. Please try again.');
            }
          }
        }
      } catch (error) {
        console.error('Token exchange error:', error);
        Alert.alert('Error', 'Failed to connect Spotify. Please try again.');
      } finally {
        setIsConnecting(false);
      }
    } else if (response?.type === 'error') {
      console.error('Auth error:', response.error);
      Alert.alert('Error', 'Spotify authorization failed.');
    }
  }, [response, discovery, redirectUri, request?.codeVerifier, connectSpotifyImplicit]);
  
  useEffect(() => {
    handleAuthResponse();
  }, [handleAuthResponse]);
  
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    user?.preferences.notifications?.workouts || false
  );
  
  const [caloriesGoal, setCaloriesGoal] = useState(
    dailyGoals.calories.toString()
  );
  const [proteinGoal, setProteinGoal] = useState(
    dailyGoals.protein.toString()
  );
  const [carbsGoal, setCarbsGoal] = useState(
    dailyGoals.carbs.toString()
  );
  const [fatGoal, setFatGoal] = useState(
    dailyGoals.fat.toString()
  );
  
  const handleToggleNotifications = (value) => {
    setNotificationsEnabled(value);
    updateUserPreferences({ 
      notifications: {
        workouts: value,
        nutrition: user?.preferences.notifications?.nutrition || false,
        social: user?.preferences.notifications?.social || false
      }
    });
  };
  
  const handleSaveNutritionGoals = () => {
    // Validate inputs
    if (!caloriesGoal || !proteinGoal || !carbsGoal || !fatGoal) {
      Alert.alert('Error', 'Please enter all nutrition goals');
      return;
    }
    
    // Update nutrition goals
    updateDailyGoals({
      calories: parseInt(caloriesGoal),
      protein: parseInt(proteinGoal),
      carbs: parseInt(carbsGoal),
      fat: parseInt(fatGoal),
    });
    
    // Show success message
    Alert.alert('Success', 'Nutrition goals updated successfully');
  };
  
  const handleConnectSpotify = async () => {
    try {
      console.log('Initiating Spotify connection with expo-auth-session...');
      console.log('Redirect URI:', redirectUri);
      
      if (!request) {
        Alert.alert('Error', 'Authentication not ready. Please try again.');
        return;
      }
      
      setIsConnecting(true);
      await promptAsync();
    } catch (error) {
      console.error('Failed to initiate Spotify connection:', error);
      Alert.alert('Error', `Failed to connect to Spotify: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsConnecting(false);
    }
  };
  
  const handleDisconnectSpotify = () => {
    Alert.alert(
      'Disconnect Spotify',
      'Are you sure you want to disconnect your Spotify account?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Disconnect', 
          style: 'destructive',
          onPress: async () => {
            await disconnectSpotify();
            Alert.alert('Success', 'Spotify account disconnected');
          }
        }
      ]
    );
  };
  
  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('[Settings] Starting logout process');
              
              // Clear auth service token first
              await authService.logout();
              
              // Clear user store and persisted data
              await logout();
              
              console.log('[Settings] Logout completed, navigating to start screen');
              
              // Force a complete app reset by navigating to index first, then start
              router.replace('/');
              
            } catch (e) {
              console.error('[Settings] Logout error:', e);
              // Even if there's an error, still navigate to start screen
              router.replace('/start');
            }
          },
        },
      ],
    );
  };
  
  const handleAbout = () => {
    Alert.alert(
      "About Zown HQ",
      "Zown HQ is a fitness app designed to help you achieve your fitness goals through personalized workouts, nutrition tracking, and progress monitoring.\n\nVersion 1.0.0",
      [{ text: "OK" }]
    );
  };
  
  const handleHelp = () => {
    Alert.alert(
      "Help & Support",
      "For help and support, please contact us at support@zownhq.com or visit our website at www.zownhq.com.",
      [{ text: "OK" }]
    );
  };
  
  const handlePrivacy = () => {
    Alert.alert(
      "Privacy Policy",
      "This is a demo app. In a real app, this would display the privacy policy.",
      [{ text: "OK" }]
    );
  };
  
  if (!user) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading...</Text>
      </View>
    );
  }
  
  return (
    <>
      <Stack.Screen options={{ title: 'Settings' }} />
      
      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Bell size={20} color={Colors.text.secondary} />
              <Text style={styles.settingText}>Push Notifications</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleToggleNotifications}
              trackColor={{ false: Colors.inactive, true: Colors.primary }}
              thumbColor={Colors.card}
            />
          </View>
        </View>

        {/* Spotify Integration */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Music Integration</Text>
          
          {isSpotifyConnected ? (
            <Card variant="elevated" style={styles.spotifyConnectedCard}>
              <View style={styles.spotifyConnectedHeader}>
                <View style={styles.spotifyConnectedInfo}>
                  <Music size={24} color="#1DB954" />
                  <View style={styles.spotifyConnectedText}>
                    <Text style={styles.spotifyConnectedTitle}>Spotify Connected</Text>
                    <Text style={styles.spotifyConnectedSubtitle}>
                      {spotifyUser?.display_name || 'Connected'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity 
                  style={styles.disconnectButton}
                  onPress={handleDisconnectSpotify}
                >
                  <Text style={styles.disconnectButtonText}>Disconnect</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.musicPreferencesContainer}>
                <Text style={styles.musicPreferencesTitle}>Music Preferences</Text>
                
                <View style={styles.preferenceItem}>
                  <Text style={styles.preferenceLabel}>Energy Level</Text>
                  <Text style={styles.preferenceValue}>
                    {Math.round(musicPreferences.energyLevel * 100)}%
                  </Text>
                </View>
                
                <View style={styles.preferenceItem}>
                  <Text style={styles.preferenceLabel}>Tempo Range</Text>
                  <Text style={styles.preferenceValue}>
                    {musicPreferences.tempoRange.min}-{musicPreferences.tempoRange.max} BPM
                  </Text>
                </View>
                
                <View style={styles.preferenceItem}>
                  <Text style={styles.preferenceLabel}>Explicit Content</Text>
                  <Switch
                    value={musicPreferences.explicitContent}
                    onValueChange={(value) => updateMusicPreferences({ explicitContent: value })}
                    trackColor={{ false: Colors.inactive, true: Colors.primary }}
                    thumbColor={Colors.card}
                  />
                </View>
              </View>
            </Card>
          ) : (
            <Card variant="outlined" style={styles.spotifyDisconnectedCard}>
              <View style={styles.spotifyDisconnectedContent}>
                <Music size={32} color={Colors.text.tertiary} />
                <Text style={styles.spotifyDisconnectedTitle}>Connect Spotify</Text>
                <Text style={styles.spotifyDisconnectedDescription}>
                  Connect your Spotify account to play music during workouts and get personalized recommendations.
                </Text>
                <View style={styles.spotifyButtons}>
                  <Button
                    title={isConnecting ? "Connecting..." : "Connect Spotify"}
                    onPress={handleConnectSpotify}
                    style={styles.connectSpotifyButton}
                    leftIcon={<ExternalLink size={16} color={Colors.text.inverse} />}
                    disabled={!request || isConnecting}
                  />
                  <Button
                    title="Test Integration"
                    onPress={() => router.push('/spotify-integration')}
                    variant="outline"
                    style={styles.testButton}
                  />
                </View>
              </View>
            </Card>
          )}
        </View>
        
        {/* Nutrition Goals */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nutrition Goals</Text>
          
          <Input
            label="Daily Calories"
            value={caloriesGoal}
            onChangeText={setCaloriesGoal}
            placeholder="Enter daily calorie goal"
            keyboardType="number-pad"
          />
          
          <Input
            label="Protein (g)"
            value={proteinGoal}
            onChangeText={setProteinGoal}
            placeholder="Enter protein goal"
            keyboardType="number-pad"
          />
          
          <Input
            label="Carbs (g)"
            value={carbsGoal}
            onChangeText={setCarbsGoal}
            placeholder="Enter carbs goal"
            keyboardType="number-pad"
          />
          
          <Input
            label="Fat (g)"
            value={fatGoal}
            onChangeText={setFatGoal}
            placeholder="Enter fat goal"
            keyboardType="number-pad"
          />
          
          <Button
            title="Save Nutrition Goals"
            onPress={handleSaveNutritionGoals}
            style={styles.saveButton}
          />
        </View>
        
        {/* Account */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          
          <Button
            title="Logout"
            onPress={handleLogout}
            variant="outline"
            leftIcon={<LogOut size={20} color={Colors.error} />}
            style={styles.logoutButton}
            textStyle={styles.logoutButtonText}
          />
        </View>
        
        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          
          <Button
            title="About Zown HQ"
            onPress={handleAbout}
            variant="outline"
            leftIcon={<Info size={20} color={Colors.text.primary} />}
            style={styles.textButton}
            textStyle={styles.textButtonText}
          />
          
          <Button
            title="Help & Support"
            onPress={handleHelp}
            variant="outline"
            leftIcon={<HelpCircle size={20} color={Colors.text.primary} />}
            style={styles.textButton}
            textStyle={styles.textButtonText}
          />
          
          <Button
            title="Privacy Policy"
            onPress={handlePrivacy}
            variant="outline"
            leftIcon={<Lock size={20} color={Colors.text.primary} />}
            style={styles.textButton}
            textStyle={styles.textButtonText}
          />
        </View>
        
        <Text style={styles.versionText}>Version 1.0.0</Text>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    marginBottom: 24,
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingText: {
    fontSize: 16,
    color: Colors.text.primary,
    marginLeft: 12,
  },
  spotifyConnectedCard: {
    padding: 0,
  },
  spotifyConnectedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  spotifyConnectedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spotifyConnectedText: {
    marginLeft: 12,
  },
  spotifyConnectedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  spotifyConnectedSubtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  disconnectButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  disconnectButtonText: {
    fontSize: 14,
    color: Colors.text.primary,
  },
  musicPreferencesContainer: {
    padding: 16,
  },
  musicPreferencesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 12,
  },
  preferenceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  preferenceLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  preferenceValue: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  spotifyDisconnectedCard: {
    padding: 0,
  },
  spotifyDisconnectedContent: {
    alignItems: 'center',
    padding: 24,
  },
  spotifyDisconnectedTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginTop: 12,
    marginBottom: 8,
  },
  spotifyDisconnectedDescription: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  spotifyButtons: {
    gap: 12,
  },
  connectSpotifyButton: {
    paddingHorizontal: 24,
  },
  testButton: {
    paddingHorizontal: 24,
  },
  saveButton: {
    marginTop: 16,
  },
  logoutButton: {
    borderColor: Colors.error,
  },
  logoutButtonText: {
    color: Colors.error,
  },
  textButton: {
    justifyContent: 'flex-start',
    paddingVertical: 12,
    marginVertical: 4,
    backgroundColor: Colors.background,
  },
  textButtonText: {
    color: Colors.text.primary,
    fontSize: 16,
  },
  versionText: {
    fontSize: 14,
    color: Colors.text.tertiary,
    textAlign: 'center',
    marginTop: 16,
  },
});