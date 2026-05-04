import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Activity, Droplets, Flame, Footprints, Moon, Heart, BatteryCharging, Scale, Beef, Dumbbell, Stars } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { tokens } from '../../theme/tokens';

const MetricCard = ({ title, value, target, unit, icon }) => {
  const progress = Math.min(value / target, 1);

  const renderIcon = () => {
    switch (icon) {
      case 'activity':
        return <Activity size={24} color=tokens.colors.brand.base />;
      case 'droplets':
        return <Droplets size={24} color=tokens.colors.third_party.twitter.base />;
      case 'flame':
        return <Flame size={24} color=tokens.colors.legacy.legacy_ef4444 />;
      case 'footprints':
        return <Footprints size={24} color=tokens.colors.green.base />;
      case 'stairs':
        return <Stars size={24} color=tokens.colors.green.base />;
      case 'moon':
        return <Moon size={24} color=tokens.colors.primary.base />;
      case 'heart':
        return <Heart size={24} color=tokens.colors.fuschia.100 />;
      case 'battery-charging':
        return <BatteryCharging size={24} color=tokens.colors.legacy.legacy_f59e0b />;
      case 'scale':
        return <Scale size={24} color=tokens.colors.text.base />;
      case 'beef':
        return <Beef size={24} color=tokens.colors.green.light />;
      case 'dumbbell':
        return <Dumbbell size={24} color=tokens.colors.primary.base />;
      default:
        return <Activity size={24} color=tokens.colors.brand.base />;
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
    </View>);

};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.card,
    borderRadius: Colors.radius.medium,
    padding: Colors.spacing.lg,
    marginRight: Colors.spacing.md,
    width: 180,
    ...Colors.shadow.small
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Colors.spacing.md
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text.secondary,
    marginLeft: Colors.spacing.sm
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: Colors.spacing.md
  },
  value: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text.primary
  },
  unit: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginLeft: Colors.spacing.xs,
    marginBottom: 2
  },
  progressContainer: {
    marginTop: Colors.spacing.xs
  },
  progressBackground: {
    height: 6,
    backgroundColor: Colors.inactive,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: Colors.spacing.xs + 2
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3
  },
  target: {
    fontSize: 12,
    color: Colors.text.secondary
  }
});

export default MetricCard;