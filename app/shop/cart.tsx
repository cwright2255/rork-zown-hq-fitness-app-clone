import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Alert } from 'react-native';
import { router, Stack } from 'expo-router';
import { Trash, Plus, Minus, ChevronRight, ShoppingBag } from 'lucide-react-native';
import Colors from '@/constants/colors';
import Button from '@/components/Button';
import { useShopStore } from '@/store/shopStore';
import { Product, ProductVariant } from '@/types';
import BottomNavigation from '@/components/BottomNavigation';

export default function CartScreen() {
  interface CartItem {
    productId: string;
    variantId?: string;
    quantity: number;
  }
  
  const { 
    products, 
    cart, 
    removeFromCart, 
    updateCartItemQuantity, 
    clearCart, 
    getCartTotal 
  } = useShopStore() as {
    products: Product[];
    cart: CartItem[];
    removeFromCart: (index: number) => void;
    updateCartItemQuantity: (index: number, quantity: number) => void;
    clearCart: () => void;
    getCartTotal: () => number;
  };
  
  const [cartItems, setCartItems] = useState<{
    product: Product;
    variant?: ProductVariant;
    quantity: number;
    index: number; // Add index to track position in cart array
  }[]>([]);
  
  useEffect(() => {
    // Map cart items to products and variants
    const items = cart.map((item: CartItem, index: number) => {
      const product = products.find((p: Product) => p.id === item.productId);
      if (!product) return null;
      
      const variant = item.variantId 
        ? product.variants?.find((v: ProductVariant) => v.id === item.variantId) 
        : undefined;
      
      return {
        product,
        variant,
        quantity: item.quantity,
        index // Store the index of the item in the cart array
      };
    }).filter(Boolean) as {
      product: Product;
      variant?: ProductVariant;
      quantity: number;
      index: number;
    }[];
    
    setCartItems(items);
  }, [cart, products]);
  
  const handleRemoveItem = (index: number) => {
    Alert.alert(
      "Remove Item",
      "Are you sure you want to remove this item from your cart?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Remove", 
          style: "destructive", 
          onPress: () => removeFromCart(index) 
        }
      ]
    );
  };
  
  const handleUpdateQuantity = (index: number, quantity: number) => {
    if (quantity < 1) {
      handleRemoveItem(index);
      return;
    }
    
    updateCartItemQuantity(index, quantity);
  };
  
  const handleClearCart = () => {
    if (cartItems.length === 0) return;
    
    Alert.alert(
      "Clear Cart",
      "Are you sure you want to remove all items from your cart?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Clear", 
          style: "destructive", 
          onPress: clearCart 
        }
      ]
    );
  };
  
  const handleCheckout = () => {
    Alert.alert(
      "Checkout",
      "This is a demo app. In a real app, this would proceed to checkout.",
      [
        { text: "OK" }
      ]
    );
  };
  
  const subtotal = getCartTotal();
  const shipping = subtotal > 0 ? 5.99 : 0;
  const total = subtotal + shipping;
  
  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{
          title: 'Shopping Cart',
          headerRight: () => (
            cartItems.length > 0 ? (
              <TouchableOpacity 
                style={styles.headerButton}
                onPress={handleClearCart}
              >
                <Text style={styles.clearText}>Clear</Text>
              </TouchableOpacity>
            ) : null
          ),
        }} 
      />
      
      <View style={styles.contentContainer}>
        {cartItems.length > 0 ? (
          <>
            <ScrollView 
              style={styles.itemsContainer}
              contentContainerStyle={styles.itemsList}
              showsVerticalScrollIndicator={false}
            >
              {cartItems.map((item, idx) => (
                <View 
                  key={`${item.product.id}-${item.variant?.id || 'default'}-${idx}`}
                  style={[
                    styles.cartItem,
                    idx < cartItems.length - 1 && styles.cartItemBorder
                  ]}
                >
                  <Image
                    source={{ uri: item.product.imageUrl }}
                    style={styles.itemImage}
                    resizeMode="cover"
                  />
                  
                  <View style={styles.itemDetails}>
                    <Text style={styles.itemName}>{item.product.name}</Text>
                    
                    {item.variant && (
                      <Text style={styles.itemVariant}>{item.variant.name}</Text>
                    )}
                    
                    <Text style={styles.itemPrice}>
                      ${(item.variant?.price ?? item.product.price).toFixed(2)}
                    </Text>
                    
                    <View style={styles.itemActions}>
                      <View style={styles.quantityControls}>
                        <TouchableOpacity 
                          style={styles.quantityButton}
                          onPress={() => handleUpdateQuantity(
                            item.index, 
                            item.quantity - 1
                          )}
                        >
                          <Minus size={16} color={Colors.text.primary} />
                        </TouchableOpacity>
                        
                        <Text style={styles.quantityText}>{item.quantity}</Text>
                        
                        <TouchableOpacity 
                          style={styles.quantityButton}
                          onPress={() => handleUpdateQuantity(
                            item.index, 
                            item.quantity + 1
                          )}
                        >
                          <Plus size={16} color={Colors.text.primary} />
                        </TouchableOpacity>
                      </View>
                      
                      <TouchableOpacity 
                        style={styles.removeButton}
                        onPress={() => handleRemoveItem(item.index)}
                      >
                        <Trash size={16} color={Colors.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
            
            <View style={styles.summaryContainer}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>${subtotal.toFixed(2)}</Text>
              </View>
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Shipping</Text>
                <Text style={styles.summaryValue}>${shipping.toFixed(2)}</Text>
              </View>
              
              <View style={[styles.summaryRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>${total.toFixed(2)}</Text>
              </View>
              
              <Button
                title="Proceed to Checkout"
                onPress={handleCheckout}
                style={styles.checkoutButton}
              />
              
              <TouchableOpacity 
                style={styles.continueShoppingButton}
                onPress={() => router.back()}
              >
                <Text style={styles.continueShoppingText}>Continue Shopping</Text>
                <ChevronRight size={16} color={Colors.primary} />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <ShoppingBag size={64} color={Colors.text.tertiary} />
            <Text style={styles.emptyTitle}>Your cart is empty</Text>
            <Text style={styles.emptyText}>
              Looks like you haven't added any products to your cart yet.
            </Text>
            <Button
              title="Start Shopping"
              onPress={() => router.replace('/shop')}
              style={styles.startShoppingButton}
            />
          </View>
        )}
      </View>
      
      {/* Bottom Navigation */}
      <BottomNavigation />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  contentContainer: {
    flex: 1,
    paddingBottom: 60, // Add padding for bottom navigation
  },
  headerButton: {
    padding: 8,
  },
  clearText: {
    fontSize: 16,
    color: Colors.error,
  },
  itemsContainer: {
    flex: 1,
  },
  itemsList: {
    padding: 16,
  },
  cartItem: {
    flexDirection: 'row',
    paddingVertical: 16,
  },
  cartItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  itemDetails: {
    flex: 1,
    marginLeft: 16,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  itemVariant: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  itemActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quantityText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginHorizontal: 12,
    minWidth: 20,
    textAlign: 'center',
  },
  removeButton: {
    padding: 8,
  },
  summaryContainer: {
    backgroundColor: Colors.card,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 16,
    color: Colors.text.secondary,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primary,
  },
  checkoutButton: {
    width: '100%',
    marginBottom: 12,
  },
  continueShoppingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueShoppingText: {
    fontSize: 16,
    color: Colors.primary,
    marginRight: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  startShoppingButton: {
    minWidth: 200,
  },
});