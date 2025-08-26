import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Package, Truck, CheckCircle, Clock, MapPin } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useOrderStore } from '@/store/orderStore';

export default function OrderTrackingScreen() {
  const { orders } = useOrderStore();
  const [selectedOrder, setSelectedOrder] = useState(orders[0]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processing':
        return <Clock size={20} color={Colors.primary.main} />;
      case 'shipped':
        return <Truck size={20} color={Colors.primary.main} />;
      case 'delivered':
        return <CheckCircle size={20} color="#10B981" />;
      default:
        return <Package size={20} color={Colors.text.secondary} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processing':
        return Colors.primary.main;
      case 'shipped':
        return '#3B82F6';
      case 'delivered':
        return '#10B981';
      default:
        return Colors.text.secondary;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Order Tracking', headerShown: false }} />
      
      <View style={styles.header}>
        <Text style={styles.title}>Order Tracking</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Order Selection */}
        <Text style={styles.sectionTitle}>Your Orders</Text>
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.orderTabs}>
          {orders.map((order) => (
            <TouchableOpacity
              key={order.id}
              style={[
                styles.orderTab,
                selectedOrder?.id === order.id && styles.selectedOrderTab,
              ]}
              onPress={() => setSelectedOrder(order)}
            >
              <Text style={[
                styles.orderTabText,
                selectedOrder?.id === order.id && styles.selectedOrderTabText,
              ]}>
                #{order.id}
              </Text>
              <Text style={[
                styles.orderTabStatus,
                selectedOrder?.id === order.id && styles.selectedOrderTabStatus,
              ]}>
                {order.status}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {selectedOrder && (
          <>
            {/* Order Details */}
            <View style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <Text style={styles.orderNumber}>Order #{selectedOrder.id}</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedOrder.status) + '20' }]}>
                  {getStatusIcon(selectedOrder.status)}
                  <Text style={[styles.statusText, { color: getStatusColor(selectedOrder.status) }]}>
                    {selectedOrder.status.charAt(0).toUpperCase() + selectedOrder.status.slice(1)}
                  </Text>
                </View>
              </View>

              <Text style={styles.orderDate}>Ordered on {selectedOrder.orderDate}</Text>
              <Text style={styles.orderTotal}>Total: ${selectedOrder.total}</Text>
            </View>

            {/* Tracking Timeline */}
            <View style={styles.timelineCard}>
              <Text style={styles.timelineTitle}>Tracking Timeline</Text>
              
              {selectedOrder.trackingEvents.map((event, index) => (
                <View key={index} style={styles.timelineItem}>
                  <View style={styles.timelineIconContainer}>
                    <View style={[
                      styles.timelineIcon,
                      event.completed && styles.timelineIconCompleted,
                    ]}>
                      {event.completed ? (
                        <CheckCircle size={16} color="white" />
                      ) : (
                        <View style={styles.timelineIconEmpty} />
                      )}
                    </View>
                    {index < selectedOrder.trackingEvents.length - 1 && (
                      <View style={[
                        styles.timelineLine,
                        event.completed && styles.timelineLineCompleted,
                      ]} />
                    )}
                  </View>
                  
                  <View style={styles.timelineContent}>
                    <Text style={[
                      styles.timelineEventTitle,
                      event.completed && styles.timelineEventTitleCompleted,
                    ]}>
                      {event.title}
                    </Text>
                    <Text style={styles.timelineEventDescription}>
                      {event.description}
                    </Text>
                    {event.timestamp && (
                      <Text style={styles.timelineEventTime}>
                        {event.timestamp}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>

            {/* Delivery Address */}
            <View style={styles.addressCard}>
              <View style={styles.addressHeader}>
                <MapPin size={20} color={Colors.primary.main} />
                <Text style={styles.addressTitle}>Delivery Address</Text>
              </View>
              <Text style={styles.addressText}>{selectedOrder.deliveryAddress}</Text>
            </View>

            {/* Order Items */}
            <View style={styles.itemsCard}>
              <Text style={styles.itemsTitle}>Order Items</Text>
              
              {selectedOrder.items.map((item) => (
                <View key={item.id} style={styles.orderItem}>
                  <Image source={{ uri: item.image }} style={styles.itemImage} />
                  <View style={styles.itemDetails}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemQuantity}>Qty: {item.quantity}</Text>
                    <Text style={styles.itemPrice}>${item.price}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Estimated Delivery */}
            {selectedOrder.estimatedDelivery && (
              <View style={styles.deliveryCard}>
                <Text style={styles.deliveryTitle}>Estimated Delivery</Text>
                <Text style={styles.deliveryDate}>{selectedOrder.estimatedDelivery}</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 16,
  },
  orderTabs: {
    marginBottom: 24,
  },
  orderTab: {
    backgroundColor: Colors.background.secondary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 12,
    minWidth: 100,
    alignItems: 'center',
  },
  selectedOrderTab: {
    backgroundColor: Colors.primary.main,
  },
  orderTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  selectedOrderTabText: {
    color: 'white',
  },
  orderTabStatus: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  selectedOrderTabStatus: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  orderCard: {
    backgroundColor: Colors.background.secondary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  orderDate: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  orderTotal: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  timelineCard: {
    backgroundColor: Colors.background.secondary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 16,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timelineIconContainer: {
    alignItems: 'center',
    marginRight: 16,
  },
  timelineIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.text.secondary,
  },
  timelineIconCompleted: {
    backgroundColor: Colors.primary.main,
    borderColor: Colors.primary.main,
  },
  timelineIconEmpty: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.text.secondary,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: Colors.text.secondary,
    marginTop: 8,
  },
  timelineLineCompleted: {
    backgroundColor: Colors.primary.main,
  },
  timelineContent: {
    flex: 1,
    paddingTop: 4,
  },
  timelineEventTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  timelineEventTitleCompleted: {
    color: Colors.text.primary,
    fontWeight: '600',
  },
  timelineEventDescription: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  timelineEventTime: {
    fontSize: 11,
    color: Colors.text.secondary,
  },
  addressCard: {
    backgroundColor: Colors.background.secondary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  addressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  addressText: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  itemsCard: {
    backgroundColor: Colors.background.secondary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  itemsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 16,
  },
  orderItem: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  itemDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  itemQuantity: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginBottom: 2,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary.main,
  },
  deliveryCard: {
    backgroundColor: Colors.primary.main + '20',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  deliveryTitle: {
    fontSize: 14,
    color: Colors.primary.main,
    marginBottom: 4,
  },
  deliveryDate: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.primary.main,
  },
});