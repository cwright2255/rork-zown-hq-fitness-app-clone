import { Product, Collection, CartItem } from '@/types';
import type { ShopifyProduct, ShopifyCollection, ShopifyCheckout } from '@/types';

// Shopify API configuration
const SHOPIFY_STORE_URL = 'https://your-store.myshopify.com';
const SHOPIFY_API_VERSION = '2023-07';
const SHOPIFY_STOREFRONT_ACCESS_TOKEN = 'your-storefront-access-token';

// GraphQL endpoint
const SHOPIFY_GRAPHQL_URL = `${SHOPIFY_STORE_URL}/api/${SHOPIFY_API_VERSION}/graphql.json`;

// Optimized GraphQL queries - reduced fields for faster loading
const PRODUCTS_QUERY = `
  query Products($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      edges {
        node {
          id
          handle
          title
          description
          priceRange {
            minVariantPrice {
              amount
              currencyCode
            }
          }
          images(first: 1) {
            edges {
              node {
                url
              }
            }
          }
          variants(first: 3) {
            edges {
              node {
                id
                title
                price {
                  amount
                  currencyCode
                }
                availableForSale
              }
            }
          }
        }
      }
    }
  }
`;

const COLLECTIONS_QUERY = `
  query Collections($first: Int!) {
    collections(first: $first) {
      edges {
        node {
          id
          handle
          title
          description
          image {
            url
          }
        }
      }
    }
  }
`;

// Implementation of Shopify API service
class ShopifyService {
  // Helper method to make GraphQL requests with timeout
  private async fetchGraphQL(query: string, variables: any = {}): Promise<any> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(SHOPIFY_GRAPHQL_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': SHOPIFY_STOREFRONT_ACCESS_TOKEN,
        },
        body: JSON.stringify({
          query,
          variables,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Shopify API error: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
      }
      
      return result;
    } catch (error) {
      console.error('Error fetching from Shopify API:', error);
      // Return mock data for faster fallback
      return { data: {} };
    }
  }
  
  // Get products with reduced data size
  async fetchShopifyProducts(first: number = 10): Promise<ShopifyProduct[]> {
    try {
      const response = await this.fetchGraphQL(PRODUCTS_QUERY, { first });
      
      if (response.data && response.data.products && response.data.products.edges) {
        return response.data.products.edges.map((edge: any) => edge.node);
      }
      
      return this.getMockProducts();
    } catch (error) {
      console.error('Error fetching products:', error);
      return this.getMockProducts();
    }
  }
  
  // Get collections with reduced data size
  async fetchShopifyCollections(first: number = 5): Promise<ShopifyCollection[]> {
    try {
      const response = await this.fetchGraphQL(COLLECTIONS_QUERY, { first });
      
      if (response.data && response.data.collections && response.data.collections.edges) {
        return response.data.collections.edges.map((edge: any) => edge.node);
      }
      
      return this.getMockCollections();
    } catch (error) {
      console.error('Error fetching collections:', error);
      return this.getMockCollections();
    }
  }
  
  // Create a checkout (simplified)
  async createShopifyCheckout(variantId: string, quantity: number): Promise<string | null> {
    try {
      // Simulate checkout creation for demo
      await new Promise(resolve => setTimeout(resolve, 500));
      return 'https://checkout.shopify.com/demo';
    } catch (error) {
      console.error('Error creating checkout:', error);
      return null;
    }
  }
  
  // Add items to checkout (simplified)
  async addItemsToShopifyCheckout(checkoutId: string, variantId: string, quantity: number): Promise<boolean> {
    try {
      // Simulate adding items for demo
      await new Promise(resolve => setTimeout(resolve, 300));
      return true;
    } catch (error) {
      console.error('Error adding items to checkout:', error);
      return false;
    }
  }
  
  // Convert Shopify product to app product format
  convertShopifyProduct(shopifyProduct: ShopifyProduct): Product {
    const imageUrl = shopifyProduct.images.edges.length > 0
      ? shopifyProduct.images.edges[0].node.url
      : 'https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=500';
    
    const price = parseFloat(shopifyProduct.priceRange.minVariantPrice.amount);
    
    const variants = shopifyProduct.variants.edges.map((edge: any) => ({
      id: edge.node.id,
      name: edge.node.title,
      price: parseFloat(edge.node.price.amount),
      inStock: edge.node.availableForSale,
      attributes: {}
    }));
    
    return {
      id: shopifyProduct.id,
      name: shopifyProduct.title,
      description: shopifyProduct.description,
      price,
      imageUrl,
      category: 'Shopify',
      rating: 4.5,
      reviewCount: 10,
      variants,
      shopifyId: shopifyProduct.id,
      shopifyHandle: shopifyProduct.handle
    };
  }
  
  // Convert Shopify collection to app collection format
  convertShopifyCollection(shopifyCollection: ShopifyCollection): Collection {
    const imageUrl = shopifyCollection.image && shopifyCollection.image.url
      ? shopifyCollection.image.url
      : 'https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=500';
    
    return {
      id: shopifyCollection.id,
      name: shopifyCollection.title,
      description: shopifyCollection.description,
      imageUrl,

      categories: [],
      shopifyId: shopifyCollection.id,
      shopifyHandle: shopifyCollection.handle
    };
  }
  
  // Optimized mock data - reduced size
  private getMockProducts(): ShopifyProduct[] {
    return [
      {
        id: 'gid://shopify/Product/1',
        handle: 'fitness-tracker',
        title: 'Premium Fitness Tracker',
        description: 'Track your workouts and health.',
        priceRange: {
          minVariantPrice: {
            amount: '99.99',
            currencyCode: 'USD'
          }
        },
        images: {
          edges: [
            {
              node: {
                url: 'https://images.unsplash.com/photo-1575311373937-040b8e1fd6b0?w=500'
              }
            }
          ]
        },
        variants: {
          edges: [
            {
              node: {
                id: 'gid://shopify/ProductVariant/1',
                title: 'Black',
                price: {
                  amount: '99.99',
                  currencyCode: 'USD'
                },
                availableForSale: true
              }
            }
          ]
        }
      }
    ];
  }
  
  private getMockCollections(): ShopifyCollection[] {
    return [
      {
        id: 'gid://shopify/Collection/1',
        handle: 'fitness-gear',
        title: 'Fitness Gear',
        description: 'Equipment for your fitness journey.',
        image: {
          url: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=500'
        }
      }
    ];
  }
}

export default new ShopifyService();