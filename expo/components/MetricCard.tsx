import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Activity, Droplets, Flame, Footprints, Moon, Heart, BatteryCharging, Scale, Beef, Dumbbell, Stars } from 'lucide-react-native';
import Colors from '@/constants/colors';

interface MetricCardProps {
  title: string;
  value: number;
  target: number;
  unit: string;
  icon: 'activity' | 'droplets' | 'flame' | 'footprints' | 'moon' | 'heart' | 'battery-charging' | 'scale' | 'beef' | 'dumbbell' | 'stairs';
}

const MetricCard = ({ title, value, target, unit, icon }: MetricCardProps) => {
  const progress = Math.min(value / target, 1);
  
  const renderIcon = () => {
    switch (icon) {
      case 'activity':
        return <Activity size={24} color="#6366f1" />;
      case 'droplets':
        return <Droplets size={24} color="#0ea5e9" />;
      case 'flame':
        return <Flame size={24} color="#ef4444" />;
      case 'footprints':
        return <Footprints size={24} color="#10b981" />;
      case 'stairs':
        return <Stars size={24} color="#10b981" />;
      case 'moon':
        return <Moon size={24} color="#8b5cf6" />;
      case 'heart':
        return <Heart size={24} color="#ec4899" />;
      case 'battery-charging':
        return <BatteryCharging size={24} color="#f59e0b" />;
      case 'scale':
        return <Scale size={24} color="#64748b" />;
      case 'beef':
        return <Beef size={24} color="#84cc16" />;
      case 'dumbbell':
        return <Dumbbell size={24} color="#8b5cf6" />;
      default:
        return <Activity size={24} color="#6366f1" />;
    }
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {renderIcon()}
        <Text style={styles.title}>{title}</Text>
      </View>
      
      <View style={styles.valueContainer}>
        <Text style={styles.value}>{value.toLocaleString()}</Text>
        <Text style={styles.unit}>{unit}</Text>
      </View>
      
      <View style={styles.progressContainer}>
        <View style={styles.progressBackground}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.target}>{Math.round(progress * 100)}% of {target.toLocaleString()}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.card,
    borderRadius: Colors.radius.medium,
    padding: Colors.spacing.lg,
    marginRight: Colors.spacing.md,
    width: 180,
    ...Colors.shadow.small,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Colors.spacing.md,
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text.secondary,
    marginLeft: Colors.spacing.sm,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: Colors.spacing.md,
  },
  value: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  unit: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginLeft: Colors.spacing.xs,
    marginBottom: 2,
  },
  progressContainer: {
    marginTop: Colors.spacing.xs,
  },
  progressBackground: {
    height: 6,
    backgroundColor: Colors.inactive,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: Colors.spacing.xs + 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  target: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
});

export default MetricCard;