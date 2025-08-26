import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { Check, X, ShoppingCart, Trash2, Plus } from 'lucide-react-native';
import Colors from '@/constants/colors';

import Button from '@/components/Button';
import { useRecipeStore, GroceryItem } from '@/store/recipeStore';

interface GroceryListProps {
  visible: boolean;
  onClose: () => void;
}

export default function GroceryList({ visible, onClose }: GroceryListProps) {
  const { groceryList, savedRecipes, toggleGroceryItem, removeGroceryItem, clearGroceryList, generateGroceryList } = useRecipeStore();
  const [selectedRecipes, setSelectedRecipes] = useState<string[]>([]);
  const [showRecipeSelector, setShowRecipeSelector] = useState(false);

  useEffect(() => {
    if (visible) {
      // Load data when component becomes visible
    }
  }, [visible]);

  const groupedGroceries = groceryList.reduce((acc, item) => {
    const category = item.category || 'Other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {} as Record<string, GroceryItem[]>);

  const categories = Object.keys(groupedGroceries).sort();
  const completedItems = groceryList.filter(item => item.checked).length;
  const totalItems = groceryList.length;

  const handleToggleRecipe = (recipeId: string) => {
    setSelectedRecipes(prev => 
      prev.includes(recipeId) 
        ? prev.filter(id => id !== recipeId)
        : [...prev, recipeId]
    );
  };

  const handleGenerateGroceryList = () => {
    if (selectedRecipes.length === 0) {
      Alert.alert('No Recipes Selected', 'Please select at least one recipe to generate a grocery list.');
      return;
    }

    generateGroceryList(selectedRecipes);
    setShowRecipeSelector(false);
    setSelectedRecipes([]);
    Alert.alert('Success', 'Grocery list generated successfully!');
  };

  const handleClearList = () => {
    Alert.alert(
      'Clear Grocery List',
      'Are you sure you want to clear the entire grocery list?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear', 
          style: 'destructive',
          onPress: () => clearGroceryList()
        }
      ]
    );
  };

  const renderGroceryItem = ({ item }: { item: GroceryItem }) => (
    <TouchableOpacity
      style={[styles.groceryItem, item.checked && styles.checkedItem]}
      onPress={() => toggleGroceryItem(item.id)}
      activeOpacity={0.7}
    >
      <View style={styles.itemContent}>
        <TouchableOpacity
          style={[styles.checkbox, item.checked && styles.checkedBox]}
          onPress={() => toggleGroceryItem(item.id)}
        >
          {item.checked && <Check size={16} color={Colors.text.inverse} />}
        </TouchableOpacity>
        
        <View style={styles.itemDetails}>
          <Text style={[styles.itemName, item.checked && styles.checkedText]}>
            {item.amount} {item.unit} {item.ingredient}
          </Text>
          {item.recipes.length > 0 && (
            <Text style={styles.itemRecipes}>
              For: {item.recipes.join(', ')}
            </Text>
          )}
        </View>
      </View>
      
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => removeGroceryItem(item.id)}
      >
        <Trash2 size={16} color={Colors.text.tertiary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderCategory = ({ item: category }: { item: string }) => (
    <View style={styles.categorySection}>
      <Text style={styles.categoryTitle}>{category}</Text>
      <FlatList
        data={groupedGroceries[category]}
        renderItem={renderGroceryItem}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
      />
    </View>
  );

  const renderRecipeSelector = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={[styles.recipeItem, selectedRecipes.includes(item.id) && styles.selectedRecipeItem]}
      onPress={() => handleToggleRecipe(item.id)}
    >
      <View style={styles.recipeContent}>
        <Text style={styles.recipeName}>{item.name}</Text>
        <Text style={styles.recipeServings}>{item.servings} servings</Text>
      </View>
      <View style={[styles.recipeCheckbox, selectedRecipes.includes(item.id) && styles.selectedCheckbox]}>
        {selectedRecipes.includes(item.id) && <Check size={16} color={Colors.text.inverse} />}
      </View>
    </TouchableOpacity>
  );

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <ShoppingCart size={24} color={Colors.primary} />
          <Text style={styles.title}>Grocery List</Text>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <X size={24} color={Colors.text.primary} />
        </TouchableOpacity>
      </View>

      {totalItems > 0 && (
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>
            {completedItems} of {totalItems} items completed
          </Text>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${totalItems > 0 ? (completedItems / totalItems) * 100 : 0}%` }
              ]} 
            />
          </View>
        </View>
      )}

      <View style={styles.actionButtons}>
        <Button
          title="Add from Recipes"
          onPress={() => setShowRecipeSelector(true)}
          variant="outline"
          style={styles.actionButton}
          icon={<Plus size={16} color={Colors.primary} />}
        />
        {totalItems > 0 && (
          <Button
            title="Clear All"
            onPress={handleClearList}
            variant="outline"
            style={styles.actionButton}
            icon={<Trash2 size={16} color={Colors.error} />}
          />
        )}
      </View>

      {showRecipeSelector ? (
        <View style={styles.recipeSelectorContainer}>
          <Text style={styles.selectorTitle}>Select Recipes</Text>
          <FlatList
            data={savedRecipes}
            renderItem={renderRecipeSelector}
            keyExtractor={(item) => item.id}
            style={styles.recipeList}
          />
          <View style={styles.selectorActions}>
            <Button
              title="Cancel"
              onPress={() => {
                setShowRecipeSelector(false);
                setSelectedRecipes([]);
              }}
              variant="outline"
              style={styles.selectorButton}
            />
            <Button
              title={`Generate List (${selectedRecipes.length})`}
              onPress={handleGenerateGroceryList}
              disabled={selectedRecipes.length === 0}
              style={styles.selectorButton}
            />
          </View>
        </View>
      ) : (
        <View style={styles.content}>
          {totalItems === 0 ? (
            <View style={styles.emptyContainer}>
              <ShoppingCart size={48} color={Colors.text.tertiary} />
              <Text style={styles.emptyTitle}>No items in your grocery list</Text>
              <Text style={styles.emptyText}>
                Add recipes to generate a grocery list automatically
              </Text>
            </View>
          ) : (
            <FlatList
              data={categories}
              renderItem={renderCategory}
              keyExtractor={(item) => item}
              contentContainerStyle={styles.listContainer}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text.primary,
  },
  closeButton: {
    padding: 4,
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.card,
  },
  progressText: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: Colors.inactive,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  actionButton: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  listContainer: {
    padding: 20,
  },
  categorySection: {
    marginBottom: 24,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text.primary,
    marginBottom: 12,
  },
  groceryItem: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  checkedItem: {
    opacity: 0.6,
  },
  itemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkedBox: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.text.primary,
    marginBottom: 2,
  },
  checkedText: {
    textDecorationLine: 'line-through',
    color: Colors.text.secondary,
  },
  itemRecipes: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  deleteButton: {
    padding: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  recipeSelectorContainer: {
    flex: 1,
    padding: 20,
  },
  selectorTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text.primary,
    marginBottom: 16,
  },
  recipeList: {
    flex: 1,
  },
  recipeItem: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedRecipeItem: {
    borderColor: Colors.primary,
    backgroundColor: `${Colors.primary}10`,
  },
  recipeContent: {
    flex: 1,
  },
  recipeName: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.text.primary,
    marginBottom: 2,
  },
  recipeServings: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  recipeCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedCheckbox: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  selectorActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  selectorButton: {
    flex: 1,
  },
});