import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { tokens } from '../../theme/tokens';

export class ScreenErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('[ZownHQ Screen]', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>{String(this.state.error?.message || this.state.error)}</Text>
          <TouchableOpacity style={styles.button} onPress={() => this.setState({ hasError: false, error: null })}>
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: tokens.colors.dark_navy.text_primary },
  title: { fontSize: 18, fontWeight: '700', color: tokens.colors.dark_navy.bg_primary, marginBottom: 8 },
  message: { fontSize: 13, color: tokens.colors.dark_navy.text_muted, textAlign: 'center', marginBottom: 24 },
  button: { backgroundColor: tokens.colors.dark_navy.bg_primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 28 },
  buttonText: { color: tokens.colors.dark_navy.text_primary, fontWeight: '700' },
});

export default ScreenErrorBoundary;
