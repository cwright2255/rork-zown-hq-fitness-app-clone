import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Colors from '@/constants/colors';
import { ExpBreakdown } from '@/types';

interface ExpBreakdownChartProps {
  breakdown: ExpBreakdown;
}

const ExpBreakdownChart: React.FC<ExpBreakdownChartProps> = ({ breakdown }) => {
  // Calculate percentages for each category
  const percentages = useMemo(() => {
    const total = breakdown.total || breakdown.workouts + breakdown.nutrition + breakdown.social || 1;
    return {
      mainMissions: ((breakdown.mainMissions || 0) / total) * 100,
      sideMissions: ((breakdown.sideMissions || 0) / total) * 100,
      meals: ((breakdown.meals || breakdown.nutrition || 0) / total) * 100,
      workouts: ((breakdown.workouts || 0) / total) * 100,
      events: ((breakdown.events || breakdown.social || 0) / total) * 100,
    };
  }, [breakdown]);

  // Define colors for each category
  const categoryColors = {
    mainMissions: '#6366F1', // Indigo
    sideMissions: '#8B5CF6', // Purple
    meals: '#10B981', // Green
    workouts: '#F59E0B', // Amber
    events: '#EF4444', // Red
  };

  return (
    <View style={styles.container}>
      <View style={styles.chartContainer}>
        {/* Bar chart */}
        <View style={styles.barChart}>
          {Object.entries(percentages).map(([key, percentage]) => (
            <View key={key} style={styles.barContainer}>
              <Text style={styles.barLabel}>
                {key === 'mainMissions' ? 'Main Missions' :
                 key === 'sideMissions' ? 'Side Missions' :
                 key === 'meals' ? 'Meals' :
                 key === 'workouts' ? 'Workouts' :
                 'Events'}
              </Text>
              <View style={styles.barWrapper}>
                <View 
                  style={[
                    styles.bar, 
                    { 
                      width: `${Math.max(percentage, 1)}%`,
                      backgroundColor: categoryColors[key as keyof typeof categoryColors]
                    }
                  ]}
                />
                <Text style={styles.percentageText}>
                  {Math.round(percentage)}%
                </Text>
              </View>
              <Text style={styles.valueText}>
                {(breakdown[key as keyof ExpBreakdown] || 0).toLocaleString()} XP
              </Text>
            </View>
          ))}
        </View>

        {/* Summary */}
        <View style={styles.summaryContainer}>
          <Text style={styles.summaryTitle}>Total XP</Text>
          <Text style={styles.summaryValue}>{(breakdown.total || breakdown.workouts + breakdown.nutrition + breakdown.social || 0).toLocaleString()}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  chartContainer: {
    width: '100%',
  },
  barChart: {
    width: '100%',
  },
  barContainer: {
    marginBottom: 12,
    width: '100%',
  },
  barLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  barWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 20,
    backgroundColor: Colors.inactive,
    borderRadius: 4,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: 4,
  },
  percentageText: {
    position: 'absolute',
    left: 8,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.inverse,
  },
  valueText: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
    textAlign: 'right',
  },
  summaryContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primary,
  },
});

export default React.memo(ExpBreakdownChart);