import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Droplet, Plus, Minus } from 'lucide-react-native';
import Colors from '@/constants/colors';
import Card from '@/components/Card';
import { useUserStore } from '@/store/userStore';
import { useExpStore } from '@/store/expStore';
import { ExpActivity } from '@/types';

interface HydrationTrackerProps {
  onUpdate?: (amount: number) => void;
  initialAmount?: number;
}

const HydrationTracker: React.FC<HydrationTrackerProps> = ({ onUpdate, initialAmount = 0 }) => {
  const { user } = useUserStore();
  const { addExpActivity } = useExpStore();
  
  const [currentAmount, setCurrentAmount] = useState(initialAmount);
  const [dailyGoal, setDailyGoal] = useState(2000); // Default 2000ml (2L)
  const [fillAnimation] = useState(new Animated.Value(0));
  const lastReportedAmountRef = useRef(initialAmount);
  
  // Standard cup sizes in ml
  const cupSizes = [100, 250, 500, 750];
  
  // Load user's hydration data if available
  useEffect(() => {
    if (user?.fitnessMetrics?.water) {
      setCurrentAmount(user.fitnessMetrics.water.current || initialAmount);
      setDailyGoal(user.fitnessMetrics.water.goal || 2000);
    }
  }, [user, initialAmount]);
  
  // Update fill animation when current amount changes
  useEffect(() => {
    const fillPercentage = Math.min(currentAmount / dailyGoal, 1);
    
    Animated.timing(fillAnimation, {
      toValue: fillPercentage,
      duration: 500,
      useNativeDriver: false,
    }).start();
    
    // Only call onUpdate if it exists and if currentAmount has changed from last reported amount
    if (onUpdate && currentAmount !== lastReportedAmountRef.current) {
      lastReportedAmountRef.current = currentAmount;
      onUpdate(currentAmount);
    }
  }, [currentAmount, dailyGoal, fillAnimation, onUpdate]);
  
  // Update component if initialAmount changes
  useEffect(() => {
    if (initialAmount !== currentAmount && initialAmount !== lastReportedAmountRef.current) {
      setCurrentAmount(initialAmount);
      lastReportedAmountRef.current = initialAmount;
    }
  }, [initialAmount, currentAmount]);
  
  const addWater = (amount: number) => {
    const newAmount = currentAmount + amount;
    setCurrentAmount(newAmount);
    
    // Determine which hydration tier to award
    let baseExp = 0;
    
    if (newAmount >= dailyGoal) {
      // Tier 5: Completed daily goal
      baseExp = 55;
    } else if (newAmount >= dailyGoal * 0.8) {
      // Tier 4: 80% of daily goal
      baseExp = 44;
    } else if (newAmount >= dailyGoal * 0.6) {
      // Tier 3: 60% of daily goal
      baseExp = 33;
    } else if (newAmount >= dailyGoal * 0.4) {
      // Tier 2: 40% of daily goal
      baseExp = 22;
    } else if (newAmount >= dailyGoal * 0.2) {
      // Tier 1: 20% of daily goal
      baseExp = 11;
    }
    
    // Only award EXP if we've reached a new tier
    if (baseExp > 0 && currentAmount < dailyGoal * 0.2 && newAmount >= dailyGoal * 0.2) {
      addExpActivity({
        id: Date.now().toString(),
        type: 'workout', // Changed from 'event' to a valid type
        subtype: 'hydration',
        baseExp: 11,
        multiplier: 1.0,
        date: new Date().toISOString().split('T')[0],
        description: 'Hydration Tier 1: 20% of daily goal',
        completed: true
      } as ExpActivity);
    } else if (baseExp > 0 && currentAmount < dailyGoal * 0.4 && newAmount >= dailyGoal * 0.4) {
      addExpActivity({
        id: Date.now().toString(),
        type: 'workout', // Changed from 'event' to a valid type
        subtype: 'hydration',
        baseExp: 22,
        multiplier: 1.0,
        date: new Date().toISOString().split('T')[0],
        description: 'Hydration Tier 2: 40% of daily goal',
        completed: true
      } as ExpActivity);
    } else if (baseExp > 0 && currentAmount < dailyGoal * 0.6 && newAmount >= dailyGoal * 0.6) {
      addExpActivity({
        id: Date.now().toString(),
        type: 'workout', // Changed from 'event' to a valid type
        subtype: 'hydration',
        baseExp: 33,
        multiplier: 1.0,
        date: new Date().toISOString().split('T')[0],
        description: 'Hydration Tier 3: 60% of daily goal',
        completed: true
      } as ExpActivity);
    } else if (baseExp > 0 && currentAmount < dailyGoal * 0.8 && newAmount >= dailyGoal * 0.8) {
      addExpActivity({
        id: Date.now().toString(),
        type: 'workout', // Changed from 'event' to a valid type
        subtype: 'hydration',
        baseExp: 44,
        multiplier: 1.0,
        date: new Date().toISOString().split('T')[0],
        description: 'Hydration Tier 4: 80% of daily goal',
        completed: true
      } as ExpActivity);
    } else if (baseExp > 0 && currentAmount < dailyGoal && newAmount >= dailyGoal) {
      addExpActivity({
        id: Date.now().toString(),
        type: 'workout', // Changed from 'event' to a valid type
        subtype: 'hydration',
        baseExp: 55,
        multiplier: 1.0,
        date: new Date().toISOString().split('T')[0],
        description: 'Hydration Tier 5: 100% of daily goal',
        completed: true
      } as ExpActivity);
    }
  };
  
  const removeWater = (amount: number) => {
    setCurrentAmount(Math.max(0, currentAmount - amount));
  };
  
  const getHydrationStatus = () => {
    const percentage = (currentAmount / dailyGoal) * 100;
    
    if (percentage >= 100) {
      return { text: 'Goal reached! 🎉', color: Colors.success };
    } else if (percentage >= 75) {
      return { text: 'Almost there!', color: Colors.primary };
    } else if (percentage >= 50) {
      return { text: 'Halfway there', color: Colors.primary };
    } else if (percentage >= 25) {
      return { text: 'Keep drinking', color: Colors.warning };
    } else {
      return { text: 'Stay hydrated', color: Colors.error };
    }
  };
  
  const status = getHydrationStatus();
  const fillHeight = fillAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });
  
  return (
    <Card variant="elevated" style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Droplet size={20} color={Colors.primary} />
          <Text style={styles.title}>Hydration Tracker</Text>
        </View>
        <Text style={styles.statusText}>{status.text}</Text>
      </View>
      
      <View style={styles.trackerContainer}>
        <View style={styles.waterBottle}>
          <Animated.View 
            style={[
              styles.waterFill,
              { height: fillHeight, backgroundColor: status.color }
            ]}
          />
          <View style={styles.waterMeasurements}>
            <Text style={styles.waterMeasurement}>2L</Text>
            <Text style={styles.waterMeasurement}>1.5L</Text>
            <Text style={styles.waterMeasurement}>1L</Text>
            <Text style={styles.waterMeasurement}>0.5L</Text>
          </View>
        </View>
        
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{(currentAmount / 1000).toFixed(1)}L</Text>
            <Text style={styles.statLabel}>Current</Text>
          </View>
          
          <View style={styles.statDivider} />
          
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{(dailyGoal / 1000).toFixed(1)}L</Text>
            <Text style={styles.statLabel}>Goal</Text>
          </View>
          
          <View style={styles.statDivider} />
          
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{Math.round((currentAmount / dailyGoal) * 100)}%</Text>
            <Text style={styles.statLabel}>Progress</Text>
          </View>
        </View>
      </View>
      
      <View style={styles.controlsContainer}>
        <TouchableOpacity 
          style={styles.controlButton}
          onPress={() => removeWater(250)}
        >
          <Minus size={20} color={Colors.text.primary} />
        </TouchableOpacity>
        
        <View style={styles.cupSizesContainer}>
          {cupSizes.map((size) => (
            <TouchableOpacity
              key={size}
              style={styles.cupSizeButton}
              onPress={() => addWater(size)}
            >
              <Droplet size={size === 100 ? 16 : size === 250 ? 18 : size === 500 ? 20 : 22} color={Colors.primary} />
              <Text style={styles.cupSizeText}>{size}ml</Text>
            </TouchableOpacity>
          ))}
        </View>
        
        <TouchableOpacity 
          style={styles.controlButton}
          onPress={() => addWater(250)}
        >
          <Plus size={20} color={Colors.text.primary} />
        </TouchableOpacity>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: Colors.spacing.lg,
    marginBottom: Colors.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Colors.spacing.lg,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginLeft: Colors.spacing.sm,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.primary,
  },
  trackerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Colors.spacing.lg,
  },
  waterBottle: {
    width: 60,
    height: 150,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: Colors.radius.small,
    overflow: 'hidden',
    position: 'relative',
    marginRight: Colors.spacing.lg,
  },
  waterFill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.primary,
  },
  waterMeasurements: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: -30,
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  waterMeasurement: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  statsContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: Colors.radius.small,
    padding: Colors.spacing.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: Colors.spacing.xs,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.border,
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  controlButton: {
    width: 40,
    height: 40,
    borderRadius: Colors.radius.xlarge,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cupSizesContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginHorizontal: Colors.spacing.sm,
  },
  cupSizeButton: {
    alignItems: 'center',
    padding: Colors.spacing.sm,
  },
  cupSizeText: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: Colors.spacing.xs,
  },
});

export default HydrationTracker;