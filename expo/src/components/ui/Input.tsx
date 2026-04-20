import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Colors, Radius, Spacing, Typography } from '../../constants/tokens';

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  secureTextEntry?: boolean;
  accessibilityLabel?: string;
  containerStyle?: ViewStyle;
}

export function Input({
  label,
  error,
  secureTextEntry = false,
  accessibilityLabel,
  containerStyle,
  ...rest
}: InputProps) {
  const [hidden, setHidden] = useState(secureTextEntry);

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputWrap, !!error && styles.inputWrapError]}>
        <TextInput
          {...rest}
          secureTextEntry={hidden}
          placeholderTextColor={Colors.text.disabled}
          style={styles.input}
          accessibilityLabel={accessibilityLabel ?? label}
        />
        {secureTextEntry ? (
          <TouchableOpacity
            onPress={() => setHidden((h) => !h)}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            style={styles.toggle}
          >
            <Text style={styles.toggleText}>{hidden ? 'Show' : 'Hide'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  label: {
    color: Colors.text.secondary,
    fontSize: Typography.size.sm,
    marginBottom: Spacing.xs,
    fontWeight: Typography.weight.medium,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
  },
  inputWrapError: {
    borderColor: Colors.error,
  },
  input: {
    flex: 1,
    color: Colors.text.primary,
    fontSize: Typography.size.base,
    paddingVertical: Spacing.md - 4,
  },
  toggle: { paddingHorizontal: Spacing.sm },
  toggleText: {
    color: Colors.primary,
    fontSize: Typography.size.sm,
    fontWeight: Typography.weight.semibold,
  },
  errorText: {
    color: Colors.error,
    fontSize: Typography.size.xs,
    marginTop: Spacing.xs,
  },
});

export default Input;
