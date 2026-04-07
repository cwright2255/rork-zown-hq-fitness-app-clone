import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Music, ExternalLink, TestTube } from 'lucide-react-native';
import Colors from '@/constants/colors';
import Card from '@/components/Card';
import Button from '@/components/Button';
import { useSpotifyStore } from '@/store/spotifyStore';
import { spotifyService } from '@/services/spotifyService';

export default function SpotifyTest() {
  const { isConnected, user, connectSpotifyImplicit } = useSpotifyStore();
  const [testResults, setTestResults] = useState<string[]>([]);

  const addTestResult = (result: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result}`]);
  };

  const testAuthUrl = async () => {
    try {
      const url = await spotifyService.getAuthorizationUrl();
      addTestResult(`✅ Auth URL generated: ${String(url).substring(0, 100)}...`);
      console.log('Full auth URL:', url);
    } catch (error) {
      addTestResult(`❌ Auth URL failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const testCallbackHandling = async () => {
    // Simulate a callback with test data
    const testFragment = 'access_token=test_token&token_type=Bearer&expires_in=3600&state=test_state';
    try {
      const result = await connectSpotifyImplicit('#' + testFragment);
      addTestResult(`${result ? '✅' : '❌'} Callback handling: ${result ? 'Success' : 'Failed'}`);
    } catch (error) {
      addTestResult(`❌ Callback handling failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const testServiceStatus = () => {
    try {
      const status = spotifyService.getServiceStatus();
      addTestResult(`✅ Service status: ${JSON.stringify(status, null, 2)}`);
      console.log('Service status:', status);
    } catch (error) {
      addTestResult(`❌ Service status failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Spotify Integration Test',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text.primary,
        }}
      />
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <Card variant="elevated" style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <TestTube size={24} color={Colors.primary} />
            <Text style={styles.statusTitle}>Integration Test Suite</Text>
          </View>
          
          <Text style={styles.statusText}>
            Connection Status: {isConnected ? '✅ Connected' : '❌ Not Connected'}
          </Text>
          
          {user && (
            <Text style={styles.statusText}>
              User: {user.display_name || user.id}
            </Text>
          )}
        </Card>

        <Card variant="elevated" style={styles.testCard}>
          <Text style={styles.sectionTitle}>Test Functions</Text>
          
          <View style={styles.buttonContainer}>
            <Button
              title="Test Auth URL"
              onPress={testAuthUrl}
              variant="primary"
              style={styles.testButton}
            />
            
            <Button
              title="Test Callback"
              onPress={testCallbackHandling}
              variant="secondary"
              style={styles.testButton}
            />
            
            <Button
              title="Service Status"
              onPress={testServiceStatus}
              variant="outline"
              style={styles.testButton}
            />
            
            <Button
              title="Clear Results"
              onPress={clearResults}
              variant="danger"
              style={styles.testButton}
            />
          </View>
        </Card>

        <Card variant="elevated" style={styles.resultsCard}>
          <Text style={styles.sectionTitle}>Test Results</Text>
          
          {testResults.length === 0 ? (
            <Text style={styles.noResultsText}>No test results yet</Text>
          ) : (
            <ScrollView style={styles.resultsScroll} nestedScrollEnabled>
              {testResults.map((result, index) => (
                <Text key={index} style={styles.resultText}>
                  {result}
                </Text>
              ))}
            </ScrollView>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  statusCard: {
    marginBottom: 16,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  testCard: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 16,
  },
  buttonContainer: {
    gap: 12,
  },
  testButton: {
    marginBottom: 0,
  },
  resultsCard: {
    marginBottom: 16,
  },
  noResultsText: {
    fontSize: 14,
    color: Colors.text.secondary,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  resultsScroll: {
    maxHeight: 300,
  },
  resultText: {
    fontSize: 12,
    color: Colors.text.primary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 4,
    paddingVertical: 2,
  },
});