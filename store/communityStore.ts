import { create } from 'zustand';
import { RunningChallenge } from '@/types';

export interface CommunityPost {
  id: string;
  user: {
    id: string;
    name: string;
    avatar: string;
  };
  content: string;
  image?: string;
  likes: number;
  comments: number;
  timeAgo: string;
  type?: 'workout' | 'run' | 'achievement' | 'general';
}

export interface CommunityGroup {
  id: string;
  name: string;
  description: string;
  image: string;
  members: number;
  category?: 'running' | 'strength' | 'yoga' | 'general';
}

export interface CommunityChallenge {
  id: string;
  title: string;
  description: string;
  participants: number;
  timeLeft: string;
  type?: 'running' | 'workout' | 'nutrition';
  reward?: {
    xp: number;
    badge?: string;
  };
}

interface CommunityState {
  posts: CommunityPost[];
  groups: CommunityGroup[];
  challenges: CommunityChallenge[];
  runningChallenges: RunningChallenge[];
  addPost: (post: Omit<CommunityPost, 'id'>) => void;
  likePost: (postId: string) => void;
  initializeRunningChallenges: () => void;
  joinRunningChallenge: (challengeId: string) => void;
}

export const useCommunityStore = create<CommunityState>((set, get) => ({
  posts: [
    {
      id: '1',
      user: {
        id: '1',
        name: 'Sarah Johnson',
        avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face',
      },
      content: 'Just completed my first 5K run! Feeling amazing and ready for the next challenge. Who wants to join me for a morning run tomorrow?',
      image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=300&fit=crop',
      likes: 24,
      comments: 8,
      timeAgo: '2h ago',
      type: 'run'
    },
    {
      id: '2',
      user: {
        id: '2',
        name: 'Mike Chen',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
      },
      content: 'New PR on deadlifts today! 225lbs x 5 reps. The consistency is paying off. Remember, progress is progress no matter how small!',
      likes: 31,
      comments: 12,
      timeAgo: '4h ago',
      type: 'workout'
    },
    {
      id: '3',
      user: {
        id: '3',
        name: 'Emma Wilson',
        avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
      },
      content: 'Meal prep Sunday is done! This week I am focusing on high protein, low carb meals. Grilled chicken, quinoa, and lots of veggies.',
      image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop',
      likes: 18,
      comments: 5,
      timeAgo: '6h ago',
      type: 'general'
    },
    {
      id: '4',
      user: {
        id: '4',
        name: 'Alex Rodriguez',
        avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face',
      },
      content: 'Completed Week 5 of Couch to 5K! The 20-minute continuous run felt impossible at first, but I did it! 🏃‍♂️💪',
      likes: 42,
      comments: 15,
      timeAgo: '1d ago',
      type: 'achievement'
    },
    {
      id: '5',
      user: {
        id: '5',
        name: 'Jessica Lee',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=face',
      },
      content: 'Morning run in the park was incredible today! 6km at a steady pace. The weather was perfect and I saw so many other runners out there. Love this community! 🌅',
      image: 'https://images.unsplash.com/photo-1502904550040-7534597429ae?w=400&h=300&fit=crop',
      likes: 28,
      comments: 9,
      timeAgo: '1d ago',
      type: 'run'
    }
  ],
  groups: [
    {
      id: '1',
      name: 'Morning Runners',
      description: 'Early birds who love to start their day with a run',
      image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=200&h=200&fit=crop',
      members: 1247,
      category: 'running'
    },
    {
      id: '2',
      name: 'Strength Training',
      description: 'Building muscle and getting stronger together',
      image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=200&h=200&fit=crop',
      members: 892,
      category: 'strength'
    },
    {
      id: '3',
      name: 'Yoga & Mindfulness',
      description: 'Finding balance through yoga and meditation',
      image: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=200&h=200&fit=crop',
      members: 634,
      category: 'yoga'
    },
    {
      id: '4',
      name: 'Couch to 5K Support',
      description: 'Support group for C25K program participants',
      image: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=200&h=200&fit=crop',
      members: 2341,
      category: 'running'
    },
    {
      id: '5',
      name: 'Marathon Training',
      description: 'Training for the ultimate running challenge',
      image: 'https://images.unsplash.com/photo-1541252260730-0412e8e2108e?w=200&h=200&fit=crop',
      members: 567,
      category: 'running'
    },
    {
      id: '6',
      name: 'Trail Runners',
      description: 'Exploring nature one trail at a time',
      image: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=200&h=200&fit=crop',
      members: 823,
      category: 'running'
    }
  ],
  challenges: [
    {
      id: '1',
      title: '30-Day Push-up Challenge',
      description: 'Build upper body strength with daily push-ups',
      participants: 2341,
      timeLeft: '12 days',
      type: 'workout',
      reward: {
        xp: 500,
        badge: 'push-up-master'
      }
    },
    {
      id: '2',
      title: 'Step Count Challenge',
      description: 'Walk 10,000 steps every day for a month',
      participants: 1876,
      timeLeft: '8 days',
      type: 'running',
      reward: {
        xp: 300
      }
    },
    {
      id: '3',
      title: 'Hydration Challenge',
      description: 'Drink 8 glasses of water daily',
      participants: 1523,
      timeLeft: '5 days',
      type: 'nutrition',
      reward: {
        xp: 200
      }
    },
    {
      id: '4',
      title: 'Weekly Running Challenge',
      description: 'Run at least 25km this week',
      participants: 987,
      timeLeft: '3 days',
      type: 'running',
      reward: {
        xp: 750,
        badge: 'weekly-runner'
      }
    },
    {
      id: '5',
      title: 'Couch to 5K Group Challenge',
      description: 'Complete Week 1 of C25K with the community',
      participants: 1654,
      timeLeft: '6 days',
      type: 'running',
      reward: {
        xp: 400,
        badge: 'c25k-starter'
      }
    }
  ],
  runningChallenges: [],
  
  addPost: (post) =>
    set((state) => ({
      posts: [
        {
          ...post,
          id: Math.random().toString(36).substr(2, 9),
        },
        ...state.posts,
      ],
    })),
    
  likePost: (postId) =>
    set((state) => ({
      posts: state.posts.map((post) =>
        post.id === postId ? { ...post, likes: post.likes + 1 } : post
      ),
    })),
    
  initializeRunningChallenges: () => {
    const defaultRunningChallenges: RunningChallenge[] = [
      {
        id: 'weekly-distance-community',
        name: 'Community Weekly Distance',
        description: 'Join the community in running 25km this week',
        type: 'distance',
        target: 25,
        unit: 'km',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        participants: 1247,
        reward: {
          xp: 500,
          badge: 'community-runner'
        },
        category: 'weekly',
        progress: 0,
        isJoined: false
      },
      {
        id: 'monthly-consistency-community',
        name: 'Community Consistency Challenge',
        description: 'Run at least 3 times per week with the community',
        type: 'frequency',
        target: 12,
        unit: 'runs',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        participants: 892,
        reward: {
          xp: 1000,
          badge: 'consistent-community-runner',
          title: 'Community Champion'
        },
        category: 'monthly',
        progress: 0,
        isJoined: false
      },
      {
        id: 'virtual-5k-community',
        name: 'Community Virtual 5K',
        description: 'Complete a 5K run with the community this month',
        type: 'distance',
        target: 5,
        unit: 'km',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        participants: 2341,
        reward: {
          xp: 750,
          badge: 'community-5k-finisher'
        },
        category: 'special',
        progress: 0,
        isJoined: false
      }
    ];
    
    set({ runningChallenges: defaultRunningChallenges });
  },
  
  joinRunningChallenge: (challengeId) => {
    const { runningChallenges } = get();
    const updatedChallenges = runningChallenges.map(challenge => 
      challenge.id === challengeId 
        ? { ...challenge, isJoined: true, progress: 0 }
        : challenge
    );
    
    set({ runningChallenges: updatedChallenges });
  }
}));