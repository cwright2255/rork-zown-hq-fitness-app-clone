import Colors from './colors';

export const subscriptionPlans = [
  {
    id: 'free',
    tier: 'free',
    name: 'Free',
    displayName: 'Free Member',
    description: 'Get started with essential fitness features',
    monthlyPrice: 0,
    yearlyPrice: 0,
    badge: {
      color: Colors.subscription.free.background,
      textColor: Colors.subscription.free.text,
      label: 'Free'
    },
    xpMultiplier: 1.0,
    championPassAccess: 'basic',
    aiRecommendations: 1,
    priority: 1,
    features: [
      {
        id: 'basic_workouts',
        name: 'Basic Workouts',
        description: 'Access to essential workout routines',
        icon: 'dumbbell',
        available: true
      },
      {
        id: 'limited_running',
        name: 'Limited Running Programs',
        description: 'Access to beginner running programs',
        icon: 'run',
        available: true
      },
      {
        id: 'basic_challenges',
        name: 'Basic Challenges',
        description: 'Participate in community challenges',
        icon: 'trophy',
        available: true
      },
      {
        id: 'community_basic',
        name: 'Community Access',
        description: 'Connect with other fitness enthusiasts',
        icon: 'users',
        available: true
      },
      {
        id: 'basic_tracking',
        name: 'Basic Progress Tracking',
        description: 'Track workouts and basic metrics',
        icon: 'chart',
        available: true
      },
      {
        id: 'champion_pass_basic',
        name: 'Champion Pass (Basic)',
        description: 'Access to free tier rewards',
        icon: 'award',
        available: true
      },
      {
        id: 'ai_recommendations_limited',
        name: '1 AI Recommendation/Month',
        description: 'Get personalized fitness advice',
        icon: 'brain',
        available: true
      }
    ]
  },
  {
    id: 'standard',
    tier: 'standard',
    name: 'Standard',
    displayName: 'Standard Member',
    description: 'Unlock advanced features and premium content',
    monthlyPrice: 19.99,
    yearlyPrice: 159.99,
    badge: {
      color: Colors.subscription.standard.background,
      textColor: Colors.subscription.standard.text,
      label: 'Standard'
    },
    xpMultiplier: 1.5,
    championPassAccess: 'full',
    aiRecommendations: -1, // unlimited
    priority: 2,
    features: [
      {
        id: 'all_free_features',
        name: 'All Free Features',
        description: 'Everything from the free tier',
        icon: 'check',
        available: true
      },
      {
        id: 'full_running_programs',
        name: 'Full Running Programs',
        description: 'Access to all running programs and training plans',
        icon: 'run',
        available: true,
        highlight: true
      },
      {
        id: 'advanced_analytics',
        name: 'Advanced Analytics',
        description: 'Detailed progress tracking and insights',
        icon: 'chart-line',
        available: true,
        highlight: true
      },
      {
        id: 'unlimited_ai_recommendations',
        name: 'Unlimited AI Recommendations',
        description: 'Get personalized advice anytime',
        icon: 'brain',
        available: true,
        highlight: true
      },
      {
        id: 'champion_pass_full',
        name: 'Champion Pass (Full)',
        description: 'Access to all Champion Pass rewards',
        icon: 'award',
        available: true
      },
      {
        id: 'priority_support',
        name: 'Priority Support',
        description: 'Get help faster with priority customer support',
        icon: 'headphones',
        available: true
      },
      {
        id: 'third_party_sync',
        name: 'Third-Party App Sync',
        description: 'Connect with fitness trackers and apps',
        icon: 'link',
        available: true
      },
      {
        id: 'discount_codes',
        name: 'Exclusive Discounts',
        description: 'Special discounts on fitness gear and supplements',
        icon: 'percent',
        available: true
      }
    ]
  },
  {
    id: 'elite',
    tier: 'elite',
    name: 'Elite',
    displayName: 'Elite Member',
    description: 'The ultimate fitness experience with VIP perks',
    monthlyPrice: 49.99,
    yearlyPrice: 399.99,
    badge: {
      color: Colors.subscription.elite.background,
      textColor: Colors.subscription.elite.text,
      label: 'Elite'
    },
    xpMultiplier: 2.0,
    championPassAccess: 'vip',
    aiRecommendations: -1, // unlimited
    priority: 3,
    features: [
      {
        id: 'all_standard_features',
        name: 'All Standard Features',
        description: 'Everything from the standard tier',
        icon: 'check',
        available: true
      },
      {
        id: 'vip_challenges',
        name: 'VIP-Only Challenges',
        description: 'Exclusive challenges with premium rewards',
        icon: 'crown',
        available: true,
        highlight: true
      },
      {
        id: 'virtual_coaching',
        name: '1-on-1 Virtual Coaching',
        description: 'Personal coaching sessions with certified trainers',
        icon: 'user-check',
        available: true,
        highlight: true
      },
      {
        id: 'family_sharing',
        name: 'Family Account Sharing',
        description: 'Share your subscription with up to 4 family members',
        icon: 'users',
        available: true,
        highlight: true
      },
      {
        id: 'champion_pass_vip',
        name: 'Champion Pass (VIP)',
        description: 'Exclusive VIP rewards and early access',
        icon: 'star',
        available: true
      },
      {
        id: 'early_access',
        name: 'Early Access',
        description: 'Be the first to try new features and content',
        icon: 'zap',
        available: true
      },
      {
        id: 'telehealth_credits',
        name: 'Telehealth Session Credits',
        description: 'Monthly credits for virtual health consultations',
        icon: 'heart',
        available: true
      },
      {
        id: 'premium_gear',
        name: 'Premium Gear Delivery',
        description: 'Exclusive fitness gear delivered to your door',
        icon: 'package',
        available: true
      }
    ]
  }
];

export const getSubscriptionPlan = (tier) => {
  return subscriptionPlans.find(plan => plan.tier === tier) || subscriptionPlans[0];
};

export const getNextTier = (currentTier) => {
  const currentIndex = subscriptionPlans.findIndex(plan => plan.tier === currentTier);
  if (currentIndex < subscriptionPlans.length - 1) {
    return subscriptionPlans[currentIndex + 1];
  }
  return null;
};