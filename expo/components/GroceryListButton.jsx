import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShoppingCart } from 'lucide-react-native';
import GroceryList from '@/components/GroceryList';
import { useRecipeStore } from '@/store/recipeStore';
import { remainingCount } from '@/lib/groceryList';

// A cart button that opens the grocery list full screen. The badge is how many
// lines are still to buy. Used on the Recipes screen and on each recipe.
export default function GroceryListButton() {
  const { groceryList, loadGroceryList } = useRecipeStore();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (loadGroceryList) loadGroceryList();
  }, []);

  const left = remainingCount(groceryList);

  return (
    <>
      <TouchableOpacity
        testID="grocery-open"
        accessibilityLabel="Grocery list"
        onPress={() => setOpen(true)}
        hitSlop={8}
        style={styles.button}>
        <ShoppingCart size={22} color="#000000" />
        {left > 0 ? (
          <View testID="grocery-badge" style={styles.badge}>
            <Text style={styles.badgeText}>{left > 99 ? '99+' : left}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={styles.sheet}>
          <GroceryList visible onClose={() => setOpen(false)} />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute', top: -2, right: -4, minWidth: 18, height: 18, borderRadius: 9,
    paddingHorizontal: 4, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  sheet: { flex: 1, backgroundColor: '#FFFFFF' },
});
