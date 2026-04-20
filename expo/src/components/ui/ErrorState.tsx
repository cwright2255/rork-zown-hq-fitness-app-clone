import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Colors, Spacing, Typography } from '../../constants/tokens';
import { Button } from './Button';

interface ErrorStateProps {
  message: string;
  title?: string;
  icon?: React.ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  style?: ViewStyle;
}

export function ErrorState({
  message,
  title = 'Something went wrong',
  icon,
  onRetry,
  retryLabel = 'Try again',
  style,
}: ErrorStateProps) {
  return (
    <View
      accessibilityLabel={`Error: ${title}`}
      accessibilityRole="alert"
      style={[styles.container, style]}
    >
      <View style={styles.iconWrap}>
        {icon ?? <Text style={styles.fallbackIcon}>!</Text>}
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? (
        <Button
          label={retryLabel}
          onPress={onRetry}
          variant="primary"
          size="md"
          style={styles.button}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  fallbackIcon: {
    color: Colors.error,
    fontSize: Typography.size['2xl'],
    fontWeight: Typography.weight.bold,
  },
  title: {
    color: Colors.text.primary,
    fontSize: Typography.size.lg,
    fontWeight: Typography.weight.semibold,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  message: {
    color: Colors.text.secondary,
    fontSize: Typography.size.base,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  button: { marginTop: Spacing.sm },
});

export default ErrorState;
