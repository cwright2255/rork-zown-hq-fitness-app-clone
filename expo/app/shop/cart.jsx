import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

const INITIAL_CART = [
  { id: '1', name: 'Performance Tee', brand: 'ZOWN', price: 45, qty: 1, size: 'M', icon: 'shirt-outline' },
  { id: '2', name: 'Training Shorts', brand: 'ZOWN', price: 55, qty: 1, size: 'L', icon: 'cut-outline' },
  { id: '3', name: 'Resistance Bands', brand: 'ZOWN', price: 35, qty: 2, size: 'Set', icon: 'fitness-outline' },
];

export default function CartScreen() {
  const [items, setItems] = useState(INITIAL_CART);

  const updateQty = (id, delta) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, qty: Math.max(0, it.qty + delta) } : it).filter(it => it.qty > 0));
  };
  const removeItem = (id) => setItems(prev => prev.filter(it => it.id !== id));

  const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);
  const tax = Math.round(subtotal * 0.08 * 100) / 100;
  const total = subtotal + tax;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}><Ionicons name="chevron-back" size={22} color="#000" /></Pressable>
        <Text style={s.headerTitle}>Cart</Text>
        <View style={s.badge}><Text style={s.badgeText}>{items.reduce((s,i) => s+i.qty, 0)}</Text></View>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={{ paddingBottom: 20 }}>
        {items.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="cart-outline" size={48} color="#CCC" />
            <Text style={s.emptyText}>Your cart is empty</Text>
            <Pressable style={s.shopBtn} onPress={() => router.back()}><Text style={s.shopBtnText}>Continue Shopping</Text></Pressable>
          </View>
        ) : (
          <>
            {items.map(it => (
              <View key={it.id} style={s.itemRow}>
                <View style={s.itemImg}><Ionicons name={it.icon} size={24} color="#999" /></View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={s.itemBrand}>{it.brand}</Text>
                  <Text style={s.itemName}>{it.name}</Text>
                  <Text style={s.itemSize}>Size: {it.size}</Text>
                </View>
                <View style={s.qtyRow}>
                  <Pressable style={s.qtyBtn} onPress={() => updateQty(it.id, -1)}><Text style={s.qtyBtnText}>-</Text></Pressable>
                  <Text style={s.qtyNum}>{it.qty}</Text>
                  <Pressable style={s.qtyBtn} onPress={() => updateQty(it.id, 1)}><Text style={s.qtyBtnText}>+</Text></Pressable>
                </View>
                <Text style={s.itemPrice}>${(it.price * it.qty).toFixed(2)}</Text>
                <Pressable onPress={() => removeItem(it.id)}><Ionicons name="close-circle-outline" size={20} color="#999" /></Pressable>
              </View>
            ))}

            <View style={s.summaryCard}>
              <View style={s.summaryRow}><Text style={s.summaryLabel}>Subtotal</Text><Text style={s.summaryVal}>${subtotal.toFixed(2)}</Text></View>
              <View style={s.summaryRow}><Text style={s.summaryLabel}>Shipping</Text><Text style={[s.summaryVal,{color:'#22C55E'}]}>Free</Text></View>
              <View style={s.summaryRow}><Text style={s.summaryLabel}>Tax</Text><Text style={s.summaryVal}>${tax.toFixed(2)}</Text></View>
              <View style={[s.summaryRow,{borderTopWidth:1,borderTopColor:'#E0E0E0',paddingTop:12,marginTop:8}]}>
                <Text style={[s.summaryLabel,{fontWeight:'700',fontSize:16}]}>Total</Text>
                <Text style={[s.summaryVal,{fontWeight:'800',fontSize:18}]}>${total.toFixed(2)}</Text>
              </View>
            </View>

            <Pressable style={s.checkoutBtn}><Text style={s.checkoutText}>Checkout</Text></Pressable>
            <Pressable style={s.continueLink} onPress={() => router.back()}><Text style={s.continueText}>Continue Shopping</Text></Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#FFF'},
  header:{flexDirection:'row',alignItems:'center',paddingHorizontal:16,paddingVertical:12,borderBottomWidth:1,borderBottomColor:'#F0F0F0'},
  backBtn:{width:36,height:36,justifyContent:'center',alignItems:'center'},
  headerTitle:{flex:1,textAlign:'center',fontSize:18,fontWeight:'700',color:'#000'},
  badge:{backgroundColor:'#000',width:24,height:24,borderRadius:12,justifyContent:'center',alignItems:'center'},
  badgeText:{fontSize:11,fontWeight:'700',color:'#FFF'},
  scroll:{flex:1},
  empty:{alignItems:'center',paddingTop:80},
  emptyText:{fontSize:16,color:'#999',marginTop:12,marginBottom:20},
  shopBtn:{backgroundColor:'#000',paddingHorizontal:24,paddingVertical:12,borderRadius:20},
  shopBtnText:{fontSize:14,fontWeight:'700',color:'#FFF'},
  itemRow:{flexDirection:'row',alignItems:'center',paddingHorizontal:20,paddingVertical:14,borderBottomWidth:1,borderBottomColor:'#F5F5F5'},
  itemImg:{width:80,height:80,borderRadius:12,backgroundColor:'#F0F0F0',justifyContent:'center',alignItems:'center'},
  itemBrand:{fontSize:10,color:'#999',textTransform:'uppercase'},
  itemName:{fontSize:14,fontWeight:'600',color:'#000',marginTop:2},
  itemSize:{fontSize:12,color:'#999',marginTop:2},
  qtyRow:{flexDirection:'row',alignItems:'center',marginRight:12},
  qtyBtn:{width:28,height:28,borderRadius:14,backgroundColor:'#F0F0F0',justifyContent:'center',alignItems:'center'},
  qtyBtnText:{fontSize:16,fontWeight:'700',color:'#333'},
  qtyNum:{fontSize:14,fontWeight:'700',color:'#000',marginHorizontal:10},
  itemPrice:{fontSize:14,fontWeight:'700',color:'#000',marginRight:10,width:60,textAlign:'right'},
  summaryCard:{marginHorizontal:20,marginTop:20,backgroundColor:'#F8F8F8',borderRadius:16,padding:16},
  summaryRow:{flexDirection:'row',justifyContent:'space-between',marginBottom:8},
  summaryLabel:{fontSize:14,color:'#666'},
  summaryVal:{fontSize:14,fontWeight:'600',color:'#000'},
  checkoutBtn:{backgroundColor:'#000',height:52,borderRadius:26,justifyContent:'center',alignItems:'center',marginHorizontal:20,marginTop:16},
  checkoutText:{fontSize:16,fontWeight:'700',color:'#FFF'},
  continueLink:{alignItems:'center',marginTop:12},
  continueText:{fontSize:14,fontWeight:'600',color:'#999'},
});
