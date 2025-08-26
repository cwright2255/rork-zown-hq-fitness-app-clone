import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Plus } from 'lucide-react-native';
import { FoodItem as FoodItemType } from '@/types';
import Colors from '@/constants/colors';
import Card from './Card';

interface FoodItemProps {
  food: FoodItemType;
  onPress: () => void;
  onAdd?: () => void;
  showAddButton?: boolean;
}

const FoodItem: React.FC<FoodItemProps> = ({
  food,
  onPress,
  onAdd,
  showAddButton = true,
}) => {
  const { name, servingSize, calories, protein, carbs, fat, imageUrl } = food;
  
  // Default image if none provided
  const defaultImage = 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=500';
  
  const handleAddPress = (e: any) => {
    e.stopPropagation();
    if (onAdd) onAdd();
  };
  
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <Card variant="outlined" style={styles.card}>
        <View style={styles.container}>
          <Image
            source={{ uri: imageUrl || defaultImage }}
            style={styles.image}
            resizeMode="cover"
          />
          
          <View style={styles.content}>
            <Text style={styles.name} numberOfLines={1}>{name}</Text>
            <Text style={styles.serving}>{servingSize}</Text>
            
            <View style={styles.macros}>
              <Text style={styles.calories}>{calories} cal</Text>
              <View style={styles.macroDetails}>
                <Text style={styles.macro}>P: {protein}g</Text>
                <Text style={styles.macro}>C: {carbs}g</Text>
                <Text style={styles.macro}>F: {fat}g</Text>
              </View>
            </View>
          </View>
          
          {showAddButton && (
            <TouchableOpacity 
              style={styles.addButton} 
              onPress={handleAddPress}
              activeOpacity={0.8}
            >
              <Plus size={20} color={Colors.text.inverse} />
            </TouchableOpacity>
          )}
        </View>
      </Card>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: Colors.spacing.md,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  image: {
    width: 60,
    height: 60,
    borderRadius: Colors.radius.small,
  },
  content: {
    flex: 1,
    marginLeft: Colors.spacing.md,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 2,
  },
  serving: {
    fontSize: 12,
    color: Colors.text.tertiary,
    marginBottom: 4,
  },
  macros: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calories: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  macroDetails: {
    flexDirection: 'row',
    gap: 8,
  },
  macro: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  addButton: {
    backgroundColor: Colors.primary,
    width: 32,
    height: 32,
    borderRadius: Colors.radius.large,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Colors.spacing.sm,
  },
});

export default FoodItem;