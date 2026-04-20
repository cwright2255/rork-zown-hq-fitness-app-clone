import React, { useState } from 'react';
import { Image, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Colors, Radius, Typography } from '../../constants/tokens';

type AvatarSize = 'sm' | 'md' | 'lg';

interface AvatarProps {
  uri?: string | null;
  name?: string;
  size?: AvatarSize;
  accessibilityLabel?: string;
  style?: ViewStyle;
}

const sizeMap: Record<AvatarSize, number> = { sm: 32, md: 48, lg: 64 };

function initials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]![0] ?? '' : '';
  return (first + last).toUpperCase() || '?';
}

export function Avatar({
  uri,
  name,
  size = 'md',
  accessibilityLabel,
  style,
}: AvatarProps) {
  const [errored, setErrored] = useState(false);
  const dim = sizeMap[size];
  const showImage = !!uri && !errored;

  return (
    <View
      accessibilityLabel={accessibilityLabel ?? name ?? 'User avatar'}
      style={[
        styles.base,
        { width: dim, height: dim, borderRadius: Radius.full },
        style,
      ]}
    >
      {showImage ? (
        <Image
          source={{ uri: uri! }}
          style={{ width: dim, height: dim, borderRadius: Radius.full }}
          onError={() => setErrored(true)}
        />
      ) : (
        <Text
          style={[
            styles.initials,
            { fontSize: dim * 0.4 },
          ]}
        >
          {initials(name)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initials: {
    color: Colors.text.primary,
    fontWeight: Typography.weight.semibold,
  },
});

export default Avatar;
