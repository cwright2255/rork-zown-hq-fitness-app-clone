import React, { memo } from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import Colors from '@/constants/colors';

interface MemoizedCardProps {
  children?: React.ReactNode;
  title?: string;
  subtitle?: string;
  style?: ViewStyle;
  titleStyle?: TextStyle;
  subtitleStyle?: TextStyle;
  padding?: number;
  margin?: number;
  backgroundColor?: string;
  borderRadius?: number;
  elevation?: number;
  shadowOpacity?: number;
}

const MemoizedCard: React.FC<MemoizedCardProps> = memo(({
  children,
  title,
  subtitle,
  style,
  titleStyle,
  subtitleStyle,
  padding = 16,
  margin = 0,
  backgroundColor = Colors.card,
  borderRadius = 12,
  elevation = 2,
  shadowOpacity = 0.1,
}) => {
  const cardStyle: ViewStyle = {
    backgroundColor,
    borderRadius,
    padding,
    margin,
    elevation,
    shadowColor: Colors.text.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity,
    shadowRadius: 4,
    ...style,
  };

  return (
    <View style={cardStyle}>
      {title && (
        <Text style={[styles.title, titleStyle]}>
          {title}
        </Text>
      )}
      {subtitle && (
        <Text style={[styles.subtitle, subtitleStyle]}>
          {subtitle}
        </Text>
      )}
      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 12,
  },
});

MemoizedCard.displayName = 'MemoizedCard';

export default MemoizedCard;