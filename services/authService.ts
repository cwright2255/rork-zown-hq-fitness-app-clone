import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '@/types';

export type AuthProvider = 'google' | 'apple' | 'meta';

interface LoginResponse {
  user: User;
  token: string;
  requiresMFA?: boolean;
}

interface RegisterResponse {
  user: User;
  token: string;
}

class AuthService {
  private baseUrl = 'https://api.yourapp.com';

  async login(email: string, password: string): Promise<LoginResponse> {
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const mockUser: User = {
        id: '1',
        name: 'John Doe',
        email: email,
        profileImage: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
        joinDate: new Date().toISOString(),
        fitnessLevel: 'intermediate',
        goals: ['weight_loss', 'muscle_gain'],
        exp: 1250,
        level: 5,
        expToNextLevel: 250,
        streak: 7,
        streakData: {
          currentStreak: 7,
          longestStreak: 15,
          streakDates: [],
        },
        preferences: {
          units: 'metric',
          notifications: {
            workouts: true,
            nutrition: true,
            social: true,
          },
          privacy: {
            profileVisible: true,
            shareProgress: true,
          },
        },
        fitnessMetrics: {
          weight: 75,
          height: 180,
          bodyFat: 15,
          muscleMass: 65,
        },
        expSystem: {
          totalExp: 1250,
          level: 5,
          expToNextLevel: 250,
          expSources: {
            workouts: 800,
            nutrition: 300,
            social: 150,
          },
          levelRequirements: { 1: 0, 2: 100, 3: 300, 4: 700, 5: 1200, 6: 2000 },
        },
        xp: 1250,
        subscription: {
          tier: 'free',
          status: 'active',
          startDate: new Date().toISOString(),
          autoRenew: false,
        },
      };

      const token = 'mock-jwt-token';
      await AsyncStorage.setItem('auth_token', token);
      
      return {
        user: mockUser,
        token,
        requiresMFA: Math.random() > 0.7,
      };
    } catch (error) {
      throw new Error('Login failed');
    }
  }

  async register(name: string, email: string, password: string): Promise<RegisterResponse> {
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const mockUser: User = {
        id: Math.random().toString(36).slice(2, 11),
        name,
        email,
        profileImage: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
        joinDate: new Date().toISOString(),
        fitnessLevel: 'beginner',
        goals: [],
        exp: 0,
        level: 1,
        expToNextLevel: 100,
        streak: 0,
        streakData: {
          currentStreak: 0,
          longestStreak: 0,
          streakDates: [],
        },
        preferences: {
          units: 'metric',
          notifications: {
            workouts: true,
            nutrition: true,
            social: true,
          },
          privacy: {
            profileVisible: true,
            shareProgress: true,
          },
        },
        fitnessMetrics: {
          weight: 0,
          height: 0,
          bodyFat: 0,
          muscleMass: 0,
        },
        expSystem: {
          totalExp: 0,
          level: 1,
          expToNextLevel: 100,
          expSources: {
            workouts: 0,
            nutrition: 0,
            social: 0,
          },
          levelRequirements: { 1: 0, 2: 100, 3: 300, 4: 700, 5: 1200 },
        },
        xp: 0,
        subscription: {
          tier: 'free',
          status: 'active',
          startDate: new Date().toISOString(),
          autoRenew: false,
        },
      };

      const token = 'mock-jwt-token';
      await AsyncStorage.setItem('auth_token', token);
      
      return {
        user: mockUser,
        token,
      };
    } catch (error) {
      throw new Error('Registration failed');
    }
  }

  async loginWithProvider(provider: AuthProvider): Promise<LoginResponse> {
    await new Promise(resolve => setTimeout(resolve, 800));
    const displayName = provider === 'google' ? 'Google' : provider === 'apple' ? 'Apple' : 'Meta';
    const mockUser: User = {
      id: `${provider}-${Math.random().toString(36).slice(2, 10)}`,
      name: `${displayName} User`,
      email: `${provider}.user@example.com`,
      profileImage: 'https://images.unsplash.com/photo-1502685104226-ee32379fefbe?w=150&h=150&fit=crop&crop=faces',
      joinDate: new Date().toISOString(),
      fitnessLevel: 'beginner',
      goals: [],
      exp: 0,
      level: 1,
      expToNextLevel: 100,
      streak: 0,
      streakData: {
        currentStreak: 0,
        longestStreak: 0,
        streakDates: [],
      },
      preferences: {
        units: 'metric',
        notifications: { workouts: true, nutrition: true, social: true },
        privacy: { profileVisible: true, shareProgress: true },
      },
      fitnessMetrics: { weight: 0, height: 0, bodyFat: 0, muscleMass: 0 },
      expSystem: {
        totalExp: 0,
        level: 1,
        expToNextLevel: 100,
        expSources: { workouts: 0, nutrition: 0, social: 0 },
        levelRequirements: { 1: 0, 2: 100, 3: 300 },
      },
      xp: 0,
      subscription: {
        tier: 'free',
        status: 'active',
        startDate: new Date().toISOString(),
        autoRenew: false,
      },
    };
    const token = `${provider}-mock-token`;
    await AsyncStorage.setItem('auth_token', token);
    return { user: mockUser, token };
  }

  async verifyMFA(email: string, code: string): Promise<LoginResponse> {
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (code !== '123456') {
        throw new Error('Invalid MFA code');
      }
      const mockUser: User = {
        id: '1',
        name: 'John Doe',
        email: email,
        profileImage: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
        joinDate: new Date().toISOString(),
        fitnessLevel: 'intermediate',
        goals: ['weight_loss', 'muscle_gain'],
        exp: 1250,
        level: 5,
        expToNextLevel: 250,
        streak: 7,
        streakData: {
          currentStreak: 7,
          longestStreak: 15,
          streakDates: [],
        },
        preferences: {
          units: 'metric',
          notifications: {
            workouts: true,
            nutrition: true,
            social: true,
          },
          privacy: {
            profileVisible: true,
            shareProgress: true,
          },
        },
        fitnessMetrics: {
          weight: 75,
          height: 180,
          bodyFat: 15,
          muscleMass: 65,
        },
        expSystem: {
          totalExp: 1250,
          level: 5,
          expToNextLevel: 250,
          expSources: {
            workouts: 800,
            nutrition: 300,
            social: 150,
          },
          levelRequirements: { 1: 0, 2: 100, 3: 300, 4: 700, 5: 1200, 6: 2000 },
        },
        xp: 1250,
        subscription: {
          tier: 'free',
          status: 'active',
          startDate: new Date().toISOString(),
          autoRenew: false,
        },
      };

      const token = 'mock-jwt-token';
      await AsyncStorage.setItem('auth_token', token);
      
      return {
        user: mockUser,
        token,
      };
    } catch (error) {
      throw new Error('MFA verification failed');
    }
  }

  async logout(): Promise<void> {
    try {
      console.log('[AuthService] Logging out - clearing auth token');
      await AsyncStorage.removeItem('auth_token');
      console.log('[AuthService] Auth token cleared successfully');
    } catch (error) {
      console.error('[AuthService] Failed to clear auth token:', error);
      throw error;
    }
  }

  async getStoredToken(): Promise<string | null> {
    return await AsyncStorage.getItem('auth_token');
  }

  async isAuthenticated(): Promise<boolean> {
    const token = await this.getStoredToken();
    return !!token;
  }
}

export const authService = new AuthService();