import { create } from 'zustand';

export const useOrderStore = create((set) => ({
  orders: [
    {
      id: '12345',
      orderDate: 'March 15, 2024',
      status: 'shipped',
      total: 89.97,
      deliveryAddress: '123 Main St, Apt 4B\nNew York, NY 10001',
      estimatedDelivery: 'March 18, 2024',
      items: [
        {
          id: '1',
          name: 'Whey Protein Powder',
          image: 'https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=200&h=200&fit=crop',
          quantity: 1,
          price: 49.99,
        },
        {
          id: '2',
          name: 'Resistance Bands Set',
          image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=200&h=200&fit=crop',
          quantity: 1,
          price: 24.99,
        },
        {
          id: '3',
          name: 'Yoga Mat',
          image: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=200&h=200&fit=crop',
          quantity: 1,
          price: 14.99,
        },
      ],
      trackingEvents: [
        {
          title: 'Order Placed',
          description: 'Your order has been received and is being processed',
          timestamp: 'March 15, 2024 at 2:30 PM',
          completed: true,
        },
        {
          title: 'Order Confirmed',
          description: 'Payment confirmed and order approved',
          timestamp: 'March 15, 2024 at 3:15 PM',
          completed: true,
        },
        {
          title: 'Preparing for Shipment',
          description: 'Items are being picked and packed',
          timestamp: 'March 16, 2024 at 9:00 AM',
          completed: true,
        },
        {
          title: 'Shipped',
          description: 'Package has left our facility',
          timestamp: 'March 16, 2024 at 4:30 PM',
          completed: true,
        },
        {
          title: 'In Transit',
          description: 'Package is on its way to you',
          completed: false,
        },
        {
          title: 'Out for Delivery',
          description: 'Package is out for delivery',
          completed: false,
        },
        {
          title: 'Delivered',
          description: 'Package has been delivered',
          completed: false,
        },
      ],
    },
    {
      id: '12346',
      orderDate: 'March 10, 2024',
      status: 'delivered',
      total: 34.99,
      deliveryAddress: '123 Main St, Apt 4B\nNew York, NY 10001',
      items: [
        {
          id: '4',
          name: 'Pre-Workout Supplement',
          image: 'https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=200&h=200&fit=crop',
          quantity: 1,
          price: 34.99,
        },
      ],
      trackingEvents: [
        {
          title: 'Order Placed',
          description: 'Your order has been received and is being processed',
          timestamp: 'March 10, 2024 at 1:00 PM',
          completed: true,
        },
        {
          title: 'Order Confirmed',
          description: 'Payment confirmed and order approved',
          timestamp: 'March 10, 2024 at 1:30 PM',
          completed: true,
        },
        {
          title: 'Shipped',
          description: 'Package has left our facility',
          timestamp: 'March 11, 2024 at 10:00 AM',
          completed: true,
        },
        {
          title: 'Delivered',
          description: 'Package has been delivered',
          timestamp: 'March 12, 2024 at 2:15 PM',
          completed: true,
        },
      ],
    },
  ],
  addOrder: (order) =>
    set((state) => ({
      orders: [
        {
          ...order,
          id: Math.random().toString(36).substr(2, 9),
        },
        ...state.orders,
      ],
    })),
  updateOrderStatus: (orderId, status) =>
    set((state) => ({
      orders: state.orders.map((order) =>
        order.id === orderId ? { ...order, status } : order
      ),
    })),
}));