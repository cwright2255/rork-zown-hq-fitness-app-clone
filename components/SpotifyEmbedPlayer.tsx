import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import { X, Minimize2, Maximize2 } from 'lucide-react-native';
import Colors from '@/constants/colors';

interface SpotifyEmbedPlayerProps {
  trackId: string;
  trackName?: string;
  artistName?: string;
  onClose?: () => void;
  compact?: boolean;
}

function SpotifyEmbedPlayerNative({ trackId, trackName, artistName, onClose, compact = false }: SpotifyEmbedPlayerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(!compact);

  const embedUrl = `https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0`;
  const height = isExpanded ? 352 : 80;

  let WebViewComponent: any = null;
  try {
    WebViewComponent = require('react-native-webview').WebView;
  } catch {
    return (
      <View style={[styles.container, { height: 80 }]}>
        <Text style={styles.errorText}>WebView not available</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { height: height + 40 }]}>
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          {trackName && (
            <Text style={styles.headerTrackName} numberOfLines={1}>{trackName}</Text>
          )}
          {artistName && (
            <Text style={styles.headerArtistName} numberOfLines={1}>{artistName}</Text>
          )}
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <Minimize2 size={16} color="#fff" />
            ) : (
              <Maximize2 size={16} color="#fff" />
            )}
          </TouchableOpacity>
          {onClose && (
            <TouchableOpacity style={styles.headerButton} onPress={onClose}>
              <X size={16} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </View>
      <View style={[styles.webviewContainer, { height }]}>
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color="#1DB954" />
            <Text style={styles.loadingText}>Loading player...</Text>
          </View>
        )}
        <WebViewComponent
          source={{ uri: embedUrl }}
          style={[styles.webview, { height }]}
          onLoadEnd={() => setIsLoading(false)}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          scrollEnabled={false}
          bounces={false}
          originWhitelist={['*']}
        />
      </View>
    </View>
  );
}

function SpotifyEmbedPlayerWeb({ trackId, trackName, artistName, onClose, compact = false }: SpotifyEmbedPlayerProps) {
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [isLoading, setIsLoading] = useState(true);

  const embedUrl = `https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0`;
  const height = isExpanded ? 352 : 80;

  return (
    <View style={[styles.container, { height: height + 40 }]}>
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          {trackName && (
            <Text style={styles.headerTrackName} numberOfLines={1}>{trackName}</Text>
          )}
          {artistName && (
            <Text style={styles.headerArtistName} numberOfLines={1}>{artistName}</Text>
          )}
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <Minimize2 size={16} color="#fff" />
            ) : (
              <Maximize2 size={16} color="#fff" />
            )}
          </TouchableOpacity>
          {onClose && (
            <TouchableOpacity style={styles.headerButton} onPress={onClose}>
              <X size={16} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </View>
      <View style={[styles.webviewContainer, { height }]}>
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color="#1DB954" />
            <Text style={styles.loadingText}>Loading player...</Text>
          </View>
        )}
        <iframe
          src={embedUrl}
          width="100%"
          height={height}
          frameBorder="0"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          style={{ borderRadius: 12, border: 'none' } as any}
          onLoad={() => setIsLoading(false)}
        />
      </View>
    </View>
  );
}

export default function SpotifyEmbedPlayer(props: SpotifyEmbedPlayerProps) {
  if (Platform.OS === 'web') {
    return <SpotifyEmbedPlayerWeb {...props} />;
  }
  return <SpotifyEmbedPlayerNative {...props} />;
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#111',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    height: 40,
    backgroundColor: '#1a1a1a',
  },
  headerInfo: {
    flex: 1,
    marginRight: 12,
  },
  headerTrackName: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#fff',
  },
  headerArtistName: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  webviewContainer: {
    width: '100%',
    overflow: 'hidden',
  },
  webview: {
    width: '100%',
    backgroundColor: 'transparent',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111',
    zIndex: 10,
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  errorText: {
    fontSize: 13,
    color: Colors.text.secondary,
    textAlign: 'center',
    padding: 20,
  },
});
