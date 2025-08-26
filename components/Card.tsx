import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Colors from '@/constants/colors';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: 'none' | 'small' | 'medium' | 'large';
}

const Card: React.FC<CardProps> = React.memo(({
  children,
  style,
  variant = 'default',
  padding = 'medium',
}) => {
  // Memoize card style calculation
  const cardStyle = React.useMemo(() => {
    let baseStyle: ViewStyle = {};
    
    // Variant styles
    switch (variant) {
      case 'default':
        baseStyle = styles.defaultCard;
        break;
      case 'elevated':
        baseStyle = styles.elevatedCard;
        break;
      case 'outlined':
        baseStyle = styles.outlinedCard;
        break;
    }
    
    // Padding styles
    switch (padding) {
      case 'none':
        return { ...baseStyle, padding: 0 };
      case 'small':
        return { ...baseStyle, padding: Colors.spacing.md };
      case 'medium':
        return { ...baseStyle, padding: Colors.spacing.lg };
      case 'large':
        return { ...baseStyle, padding: Colors.spacing.xxl };
      default:
        return baseStyle;
    }
  }, [variant, padding]);
  
  return (
    <View style={[cardStyle, style]}>
      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  defaultCard: {
    backgroundColor: Colors.card,
    borderRadius: Colors.radius.large,
    padding: Colors.spacing.lg,
  },
  elevatedCard: {
    backgroundColor: Colors.card,
    borderRadius: Colors.radius.large,
    padding: Colors.spacing.lg,
    ...Colors.shadow.medium,
  },
  outlinedCard: {
    backgroundColor: Colors.card,
    borderRadius: Colors.radius.large,
    padding: Colors.spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
});

Card.displayName = 'Card';

export default Card;