import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Clock, Dumbbell } from 'lucide-react-native';
import { Exercise } from '@/types';
import Colors from '@/constants/colors';
import Card from './Card';

interface ExerciseItemProps {
  exercise: Exercise;
  index: number;
  isLast?: boolean;
}

const ExerciseItem: React.FC<ExerciseItemProps> = ({
  exercise,
  index,
  isLast = false,
}) => {
  const { name, description, sets, reps, duration, restTime, imageUrl, equipment } = exercise;
  
  // Default image if none provided
  const defaultImage = 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=500';
  
  return (
    <Card 
      variant="outlined" 
      style={[
        styles.card,
        isLast ? styles.lastCard : styles.card
      ]}
    >
      <View style={styles.header}>
        <View style={styles.indexContainer}>
          <Text style={styles.index}>{index + 1}</Text>
        </View>
        <Text style={styles.name}>{name}</Text>
      </View>
      
      <View style={styles.content}>
        <Image
          source={{ uri: imageUrl || defaultImage }}
          style={styles.image}
          resizeMode="cover"
        />
        
        <View style={styles.details}>
          <Text style={styles.description} numberOfLines={3}>
            {description}
          </Text>
          
          <View style={styles.stats}>
            {duration ? (
              <View style={styles.statItem}>
                <Clock size={14} color={Colors.text.secondary} />
                <Text style={styles.statText}>{duration}s</Text>
              </View>
            ) : (
              <View style={styles.statItem}>
                <Text style={styles.statText}>{sets ?? 3} sets × {reps ?? 10} reps</Text>
              </View>
            )}
            
            <View style={styles.statItem}>
              <Clock size={14} color={Colors.text.secondary} />
              <Text style={styles.statText}>{restTime}s rest</Text>
            </View>
          </View>
          
          {equipment && equipment.length > 0 && (
            <View style={styles.equipment}>
              <Dumbbell size={14} color={Colors.text.secondary} />
              <Text style={styles.equipmentText}>
                {equipment.join(', ')}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: Colors.spacing.lg,
  },
  lastCard: {
    marginBottom: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Colors.spacing.md,
  },
  indexContainer: {
    width: 24,
    height: 24,
    borderRadius: Colors.radius.medium,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Colors.spacing.sm,
  },
  index: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.inverse,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  content: {
    flexDirection: 'row',
  },
  image: {
    width: 100,
    height: 100,
    borderRadius: Colors.radius.small,
  },
  details: {
    flex: 1,
    marginLeft: Colors.spacing.md,
  },
  description: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: Colors.spacing.sm,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Colors.spacing.sm,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Colors.spacing.xs,
  },
  statText: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  equipment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Colors.spacing.xs,
  },
  equipmentText: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
});

export default ExerciseItem;