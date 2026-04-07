import React from 'react';
import { View, StyleSheet } from 'react-native';
import Colors from '@/constants/colors';

export interface ProgressBarProps {
  progress: number;
  height?: number;
  progressColor?: string;
  backgroundColor?: string;
  style?: object;
}

const ProgressBar = ({
  progress,
  height = 8,
  progressColor = Colors.primary,
  backgroundColor = `${Colors.primary}20`,
  style
}: ProgressBarProps) => {
  // Ensure progress is between 0 and 1
  const clampedProgress = Math.min(Math.max(progress, 0), 1);
  
  return (
    <View style={[
      styles.container, 
      { height, backgroundColor },
      style
    ]}>
      <View 
        style={[
          styles.progress, 
          { 
            width: `${clampedProgress * 100}%`,
            backgroundColor: progressColor,
            height
          }
        ]} 
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: Colors.radius.small,
    overflow: 'hidden',
  },
  progress: {
    height: '100%',
    borderRadius: Colors.radius.small,
  },
});

export default ProgressBar;