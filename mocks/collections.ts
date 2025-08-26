import { Collection } from '@/types';

export const mockCollections: Collection[] = [
  {
    id: 'c1',
    name: 'Performance Apparel',
    description: 'High-quality workout clothes designed for maximum comfort and performance.',
    imageUrl: 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=500',
    featured: true,
    categories: ['Clothing', 'Workout Gear', 'Apparel']
  },
  {
    id: 'c2',
    name: 'Home Gym Essentials',
    description: 'Everything you need to build an effective home gym setup.',
    imageUrl: 'https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=500',
    featured: true,
    categories: ['Equipment', 'Home Gym', 'Weights']
  },
  {
    id: 'c3',
    name: 'New Arrivals',
    description: 'The latest additions to our fitness collection.',
    imageUrl: 'https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=500',
    featured: false,
    categories: ['New', 'Featured']
  },
  {
    id: 'c4',
    name: 'Workout Accessories',
    description: 'Enhance your workout with these essential accessories.',
    imageUrl: 'https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?w=500',
    featured: true,
    categories: ['Accessories', 'Gear', 'Workout']
  },
  {
    id: 'c5',
    name: 'Nutrition & Supplements',
    description: 'Fuel your body with premium nutrition products.',
    imageUrl: 'https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=500',
    featured: false,
    categories: ['Nutrition', 'Supplements', 'Health']
  }
];