import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking, Image, SafeAreaView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { tokens } from '../../../theme/tokens';

const LICENSES_DATA = [
  {
    category: 'Framework & Core',
    items: [
      { name: 'React', license: 'MIT', repo: 'facebook/react', url: 'https://github.com/facebook/react' },
      { name: 'React Native', license: 'MIT', repo: 'facebook/react-native', url: 'https://github.com/facebook/react-native' },
      { name: 'Expo', license: 'MIT', repo: 'expo/expo', url: 'https://github.com/expo/expo' },
      { name: 'Expo Router', license: 'MIT', repo: 'expo/router', url: 'https://github.com/expo/router' }
    ]
  },
  {
    category: 'UI, Maps & Animation',
    items: [
      { name: 'React Native Reanimated', license: 'MIT', repo: 'software-mansion/react-native-reanimated', url: 'https://github.com/software-mansion/react-native-reanimated' },
      { name: 'React Native Safe Area Context', license: 'MIT', repo: 'th3rdwave/react-native-safe-area-context', url: 'https://github.com/th3rdwave/react-native-safe-area-context' },
      { name: 'React Native SVG', license: 'MIT', repo: 'software-mansion/react-native-svg', url: 'https://github.com/software-mansion/react-native-svg' },
      { name: 'Lucide React Native', license: 'ISC', repo: 'lucide-icons/lucide', url: 'https://github.com/lucide-icons/lucide' },
      { name: '@expo/vector-icons', license: 'MIT', repo: 'expo/vector-icons', url: 'https://github.com/expo/vector-icons' },
      { name: 'React Native Chart Kit', license: 'MIT', repo: 'indiespirit/react-native-chart-kit', url: 'https://github.com/indiespirit/react-native-chart-kit' },
      { name: 'React Native Maps', license: 'MIT', repo: 'react-native-maps/react-native-maps', url: 'https://github.com/react-native-maps/react-native-maps' },
      { name: 'Leaflet', license: 'BSD-2-Clause', repo: 'Leaflet/Leaflet', url: 'https://github.com/Leaflet/Leaflet' }
    ]
  },
  {
    category: 'State & Data',
    items: [
      { name: 'Zustand', license: 'MIT', repo: 'pmndrs/zustand', url: 'https://github.com/pmndrs/zustand' },
      { name: '@react-native-async-storage/async-storage', license: 'MIT', repo: 'react-native-async-storage/async-storage', url: 'https://github.com/react-native-async-storage/async-storage' },
      { name: 'Firebase JS SDK', license: 'Apache 2.0', repo: 'firebase/firebase-js-sdk', url: 'https://github.com/firebase/firebase-js-sdk' },
      { name: '@trpc/server', license: 'MIT', repo: 'trpc/trpc', url: 'https://github.com/trpc/trpc' },
      { name: '@tanstack/react-query', license: 'MIT', repo: 'TanStack/query', url: 'https://github.com/TanStack/query' }
    ]
  },
  {
    category: 'Services & SDKs',
    items: [
      { name: 'Axios', license: 'MIT', repo: 'axios/axios', url: 'https://github.com/axios/axios' },
      { name: 'Expo Auth Session', license: 'MIT', repo: 'expo/expo', url: 'https://github.com/expo/expo/tree/main/packages/expo-auth-session' },
      { name: 'Expo Location', license: 'MIT', repo: 'expo/expo', url: 'https://github.com/expo/expo/tree/main/packages/expo-location' },
      { name: 'Expo Notifications', license: 'MIT', repo: 'expo/expo', url: 'https://github.com/expo/expo/tree/main/packages/expo-notifications' },
      { name: 'Expo Image Picker', license: 'MIT', repo: 'expo/expo', url: 'https://github.com/expo/expo/tree/main/packages/expo-image-picker' },
      { name: 'Expo Web Browser', license: 'MIT', repo: 'expo/expo', url: 'https://github.com/expo/expo/tree/main/packages/expo-web-browser' },
      { name: 'React Native Rook SDK', license: 'MIT', repo: 'Rookout/rook-sdk', url: 'https://github.com/Rookout/rook-sdk' }
    ]
  },
  {
    category: 'Utilities',
    items: [
      { name: 'Zod', license: 'MIT', repo: 'colinhacks/zod', url: 'https://github.com/colinhacks/zod' },
      { name: 'Superjson', license: 'MIT', repo: 'blitz-js/superjson', url: 'https://github.com/blitz-js/superjson' },
      { name: 'Hono', license: 'MIT', repo: 'honojs/hono', url: 'https://github.com/honojs/hono' }
    ]
  }
];

export default function OpenSourceLicenses() {
  const [collapsed, setCollapsed] = useState({});

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/profile');
    }
  };

  const toggleCategory = (title) => {
    setCollapsed(prev => ({
      ...prev,
      [title]: !prev[title]
    }));
  };

  const handleOpenLink = (url) => {
    Linking.openURL(url).catch(err => console.error("Failed to open URL:", err));
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </Pressable>
        <Text style={styles.headerTitle}>Open Source Licenses</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.subtitle}>
          ZOWN HQ is built with the following open source software. We are deeply grateful to these developer communities and creators for their contributions.
        </Text>

        {LICENSES_DATA.map((cat, catIdx) => {
          const isCollapsed = collapsed[cat.category];
          return (
            <View key={catIdx} style={styles.categoryBlock}>
              <Pressable 
                style={styles.categoryHeader} 
                onPress={() => toggleCategory(cat.category)}
              >
                <Text style={styles.categoryTitle}>{cat.category}</Text>
                <Ionicons 
                  name={isCollapsed ? "chevron-forward" : "chevron-down"} 
                  size={20} 
                  color="#666666" 
                />
              </Pressable>

              {!isCollapsed && (
                <View style={styles.itemsList}>
                  {cat.items.map((item, itemIdx) => (
                    <View key={itemIdx} style={styles.itemCard}>
                      <View style={styles.itemMeta}>
                        <Text style={styles.itemName}>{item.name}</Text>
                        <View style={styles.licenseBadge}>
                          <Text style={styles.licenseText}>{item.license}</Text>
                        </View>
                      </View>
                      <Text style={styles.itemRepo}>{item.repo}</Text>
                      <Pressable 
                        style={styles.linkButton} 
                        onPress={() => handleOpenLink(item.url)}
                      >
                        <Text style={styles.linkText}>View on GitHub</Text>
                        <Ionicons name="open-outline" size={14} color="#0066CC" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}
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
  subtitle: {
    fontFamily: tokens.typography?.fontRegular || 'System',
    fontSize: 14,
    lineHeight: 20,
    color: '#666666',
    marginBottom: 24,
  },
  categoryBlock: {
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    borderRadius: 8,
    overflow: 'hidden',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FAFAFA',
  },
  categoryTitle: {
    fontFamily: tokens.typography?.fontBold || 'System',
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
  },
  itemsList: {
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  itemCard: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  itemName: {
    fontFamily: tokens.typography?.fontBold || 'System',
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  licenseBadge: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  licenseText: {
    fontFamily: tokens.typography?.fontMedium || 'System',
    fontSize: 10,
    fontWeight: '600',
    color: '#666666',
  },
  itemRepo: {
    fontFamily: tokens.typography?.fontRegular || 'System',
    fontSize: 12,
    color: '#666666',
    marginBottom: 8,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  linkText: {
    fontFamily: tokens.typography?.fontMedium || 'System',
    fontSize: 12,
    fontWeight: '600',
    color: '#0066CC',
    marginRight: 4,
  },
});
