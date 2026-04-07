import { Product } from '@/types';

export const mockProducts: Product[] = [
  {
    id: 'p1',
    name: 'Premium Fitness T-Shirt',
    description: 'High-performance moisture-wicking fabric designed for intense workouts. This premium t-shirt keeps you cool and dry during any activity.',
    price: 29.99,
    imageUrl: 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=500',
    category: 'apparel',
    rating: 4.8,
    reviewCount: 124,
    collectionIds: ['c1', 'c3'],
    variants: [
      {
        id: 'v1',
        name: 'Small - Black',
        price: 29.99,
        inStock: true,
        attributes: {
          size: 'S',
          color: 'Black'
        }
      },
      {
        id: 'v2',
        name: 'Medium - Black',
        price: 29.99,
        inStock: true,
        attributes: {
          size: 'M',
          color: 'Black'
        }
      },
      {
        id: 'v3',
        name: 'Large - Black',
        price: 29.99,
        inStock: false,
        attributes: {
          size: 'L',
          color: 'Black'
        }
      }
    ]
  },
  {
    id: 'p2',
    name: 'Adjustable Dumbbell Set',
    description: 'Space-saving adjustable dumbbells that replace 15 sets of weights. Adjust the weight with the twist of a dial, from 5 to 52.5 pounds.',
    price: 349.99,
    imageUrl: 'https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=500',
    category: 'equipment',
    rating: 4.9,
    reviewCount: 89,
    collectionIds: ['c2']
  },
  {
    id: 'p3',
    name: 'Compression Leggings',
    description: 'High-waisted compression leggings with phone pockets. Four-way stretch fabric provides maximum comfort and support during workouts.',
    price: 49.99,
    imageUrl: 'https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=500',
    category: 'apparel',
    rating: 4.7,
    reviewCount: 203,
    collectionIds: ['c1', 'c3'],
    variants: [
      {
        id: 'v4',
        name: 'Small',
        price: 49.99,
        inStock: true,
        attributes: {
          size: 'S'
        }
      },
      {
        id: 'v5',
        name: 'Medium',
        price: 49.99,
        inStock: true,
        attributes: {
          size: 'M'
        }
      },
      {
        id: 'v6',
        name: 'Large',
        price: 49.99,
        inStock: true,
        attributes: {
          size: 'L'
        }
      }
    ]
  },
  {
    id: 'p4',
    name: 'Foam Roller',
    description: 'High-density foam roller for muscle recovery and myofascial release. Textured surface provides targeted pressure to help relieve muscle tension.',
    price: 24.99,
    imageUrl: 'https://images.unsplash.com/photo-1517130038641-a774d04afb3c?w=500',
    category: 'recovery',
    rating: 4.5,
    reviewCount: 67,
    collectionIds: ['c2', 'c4']
  },
  {
    id: 'p5',
    name: 'Wireless Earbuds',
    description: 'Sweat-resistant wireless earbuds with 8-hour battery life. Perfect for workouts with secure fit and premium sound quality.',
    price: 89.99,
    imageUrl: 'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=500',
    category: 'accessories',
    rating: 4.6,
    reviewCount: 152,
    collectionIds: ['c4']
  },
  {
    id: 'p6',
    name: 'Protein Powder - Chocolate',
    description: '25g of protein per serving with minimal sugar and fat. Made with 100% whey protein isolate for maximum absorption and muscle recovery.',
    price: 39.99,
    imageUrl: 'https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=500',
    category: 'nutrition',
    rating: 4.4,
    reviewCount: 218,
    collectionIds: ['c5'],
    variants: [
      {
        id: 'v7',
        name: '1 lb',
        price: 39.99,
        inStock: true,
        attributes: {
          size: '1 lb'
        }
      },
      {
        id: 'v8',
        name: '2 lb',
        price: 69.99,
        inStock: true,
        attributes: {
          size: '2 lb'
        }
      },
      {
        id: 'v9',
        name: '5 lb',
        price: 129.99,
        inStock: false,
        attributes: {
          size: '5 lb'
        }
      }
    ]
  },
  {
    id: 'p7',
    name: 'Resistance Bands Set',
    description: 'Set of 5 resistance bands with different resistance levels. Includes handles, ankle straps, and door anchor for a complete home workout.',
    price: 34.99,
    imageUrl: 'https://images.unsplash.com/photo-1598971639058-b12b6401582c?w=500',
    category: 'equipment',
    rating: 4.7,
    reviewCount: 94,
    collectionIds: ['c2', 'c4']
  },
  {
    id: 'p8',
    name: 'Fitness Tracker',
    description: 'Advanced fitness tracker with heart rate monitoring, sleep tracking, and 7-day battery life. Waterproof design for swimming and showering.',
    price: 129.99,
    imageUrl: 'https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?w=500',
    category: 'accessories',
    rating: 4.8,
    reviewCount: 176,
    collectionIds: ['c4']
  },
  {
    id: 'p9',
    name: 'Yoga Mat',
    description: 'Non-slip, eco-friendly yoga mat with alignment markings. 6mm thickness provides cushioning for joints while maintaining stability.',
    price: 59.99,
    imageUrl: 'https://images.unsplash.com/photo-1592432678016-e910b452f9a2?w=500',
    category: 'equipment',
    rating: 4.6,
    reviewCount: 83,
    collectionIds: ['c2', 'c4']
  },
  {
    id: 'p10',
    name: 'Pre-Workout Supplement',
    description: 'Clean energy pre-workout with no artificial colors or flavors. Provides sustained energy, focus, and improved performance without the crash.',
    price: 44.99,
    imageUrl: 'https://images.unsplash.com/photo-1612532275214-e4ca76d0e4d1?w=500',
    category: 'nutrition',
    rating: 4.3,
    reviewCount: 127,
    collectionIds: ['c5'],
    variants: [
      {
        id: 'v10',
        name: 'Berry Blast',
        price: 44.99,
        inStock: true,
        attributes: {
          flavor: 'Berry Blast'
        }
      },
      {
        id: 'v11',
        name: 'Tropical Punch',
        price: 44.99,
        inStock: true,
        attributes: {
          flavor: 'Tropical Punch'
        }
      },
      {
        id: 'v12',
        name: 'Watermelon',
        price: 44.99,
        inStock: false,
        attributes: {
          flavor: 'Watermelon'
        }
      }
    ]
  },
  {
    id: 'p11',
    name: 'Running Shoes',
    description: 'Lightweight running shoes with responsive cushioning and breathable mesh upper. Designed for road running with durable rubber outsole.',
    price: 119.99,
    imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500',
    category: 'apparel',
    rating: 4.7,
    reviewCount: 215,
    collectionIds: ['c1', 'c3'],
    variants: [
      {
        id: 'v13',
        name: 'Size 8',
        price: 119.99,
        inStock: true,
        attributes: {
          size: '8'
        }
      },
      {
        id: 'v14',
        name: 'Size 9',
        price: 119.99,
        inStock: true,
        attributes: {
          size: '9'
        }
      },
      {
        id: 'v15',
        name: 'Size 10',
        price: 119.99,
        inStock: true,
        attributes: {
          size: '10'
        }
      },
      {
        id: 'v16',
        name: 'Size 11',
        price: 119.99,
        inStock: false,
        attributes: {
          size: '11'
        }
      }
    ]
  },
  {
    id: 'p12',
    name: 'Shaker Bottle',
    description: 'BPA-free shaker bottle with mixing ball for smooth protein shakes. Leak-proof design with measurement markings and secure flip cap.',
    price: 14.99,
    imageUrl: 'https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=500',
    category: 'accessories',
    rating: 4.5,
    reviewCount: 68,
    collectionIds: ['c4', 'c5']
  }
];