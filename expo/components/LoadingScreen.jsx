import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Colors from '@/constants/colors';

class ErrorBoundary extends React.Component


{
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      return <FallbackComponent error={this.state.error} />;
    }

    return this.props.children;
  }
}

const DefaultErrorFallback = ({ error }) =>
<View style={errorStyles.container}>
    <Text style={errorStyles.title}>Something went wrong</Text>
    <Text style={errorStyles.message}>
      {error?.message || 'An unexpected error occurred'}
    </Text>
  </View>;


const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: 20
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 8
  },
  message: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center'
  }
});

const LoadingScreen = React.memo(({
  message = 'Loading...',
  showSpinner = true
}) => {
  return (
    <View style={styles.container}>
      {showSpinner &&
      <ActivityIndicator
        size="large"
        color={Colors.primary}
        style={styles.spinner} />

      }
      <Text style={styles.message}>{message}</Text>
    </View>);

});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: 20
  },
  spinner: {
    marginBottom: 16
  },
  message: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
    fontWeight: '500'
  }
});

LoadingScreen.displayName = 'LoadingScreen';

export default LoadingScreen;
export { ErrorBoundary };