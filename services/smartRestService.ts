interface HeartRateData {
  bpm: number;
  timestamp: number;
  zone: 'resting' | 'fat-burn' | 'cardio' | 'peak';
}

interface AdaptiveRestConfig {
  targetHeartRate: number;
  restThreshold: number; // Percentage of max HR to rest until
  maxRestTime: number; // Maximum rest time in seconds
  minRestTime: number; // Minimum rest time in seconds
}

class SmartRestService {
  private isMonitoring = false;
  private heartRateData: HeartRateData[] = [];
  private restCallback?: (restTime: number, reason: string) => void;
  private config: AdaptiveRestConfig;
  private userMaxHR: number;

  constructor() {
    // Default config - would be personalized based on user data
    this.userMaxHR = 190; // Would calculate: 220 - age
    this.config = {
      targetHeartRate: this.userMaxHR * 0.85, // 85% max HR
      restThreshold: 0.65, // Rest until 65% max HR
      maxRestTime: 180, // 3 minutes max
      minRestTime: 30   // 30 seconds min
    };
  }

  setUserAge(age: number) {
    this.userMaxHR = 220 - age;
    this.config.targetHeartRate = this.userMaxHR * 0.85;
  }

  startMonitoring(callback: (restTime: number, reason: string) => void) {
    this.isMonitoring = true;
    this.restCallback = callback;
    this.heartRateData = [];
    
    // Start mock heart rate monitoring
    this.startMockHeartRateMonitoring();
  }

  stopMonitoring() {
    this.isMonitoring = false;
    this.restCallback = undefined;
  }

  private startMockHeartRateMonitoring() {
    let currentHR = 70; // Resting HR
    let isExercising = false;
    let exerciseStartTime = 0;

    const monitoringInterval = setInterval(() => {
      if (!this.isMonitoring) {
        clearInterval(monitoringInterval);
        return;
      }

      // Simulate heart rate changes during exercise
      if (!isExercising) {
        // Simulate exercise start
        isExercising = true;
        exerciseStartTime = Date.now();
        currentHR = 120 + Math.random() * 40; // 120-160 during exercise
      } else {
        // Simulate heart rate fluctuation during exercise
        currentHR += (Math.random() - 0.5) * 10;
        currentHR = Math.max(100, Math.min(180, currentHR));
      }

      const heartRateData: HeartRateData = {
        bpm: Math.round(currentHR),
        timestamp: Date.now(),
        zone: this.getHeartRateZone(currentHR)
      };

      this.heartRateData.push(heartRateData);
      
      // Keep only last 30 readings (5 minutes at 10s intervals)
      if (this.heartRateData.length > 30) {
        this.heartRateData.shift();
      }

      // Check if adaptive rest is needed
      if (isExercising && Date.now() - exerciseStartTime > 30000) { // After 30s of exercise
        const restTime = this.calculateAdaptiveRestTime(currentHR);
        if (restTime > 0) {
          const reason = this.getRestReason(currentHR);
          this.restCallback?.(restTime, reason);
          
          // Reset for next exercise
          isExercising = false;
          currentHR = 70 + Math.random() * 20; // Return to resting
        }
      }
    }, 10000); // Check every 10 seconds
  }

  private calculateAdaptiveRestTime(currentHR: number): number {
    const hrPercentage = currentHR / this.userMaxHR;
    
    // If HR is too high, recommend longer rest
    if (hrPercentage > 0.9) {
      return this.config.maxRestTime; // 3 minutes
    } else if (hrPercentage > 0.85) {
      return 120; // 2 minutes
    } else if (hrPercentage > 0.8) {
      return 90; // 1.5 minutes
    } else if (hrPercentage > 0.75) {
      return 60; // 1 minute
    }
    
    return this.config.minRestTime; // Minimum rest
  }

  private getRestReason(currentHR: number): string {
    const hrPercentage = currentHR / this.userMaxHR;
    
    if (hrPercentage > 0.9) {
      return 'Heart rate in peak zone - extended rest recommended';
    } else if (hrPercentage > 0.85) {
      return 'High intensity detected - longer recovery needed';
    } else if (hrPercentage > 0.8) {
      return 'Moderate intensity - standard recovery time';
    }
    
    return 'Optimal recovery for next set';
  }

  private getHeartRateZone(bpm: number): HeartRateData['zone'] {
    const percentage = bpm / this.userMaxHR;
    
    if (percentage < 0.6) return 'resting';
    if (percentage < 0.7) return 'fat-burn';
    if (percentage < 0.85) return 'cardio';
    return 'peak';
  }

  getCurrentHeartRate(): HeartRateData | null {
    return this.heartRateData.length > 0 ? this.heartRateData[this.heartRateData.length - 1] : null;
  }

  getHeartRateHistory(): HeartRateData[] {
    return [...this.heartRateData];
  }

  getAverageHeartRate(minutes: number = 5): number {
    const cutoffTime = Date.now() - (minutes * 60 * 1000);
    const recentData = this.heartRateData.filter(data => data.timestamp > cutoffTime);
    
    if (recentData.length === 0) return 0;
    
    const sum = recentData.reduce((acc, data) => acc + data.bpm, 0);
    return Math.round(sum / recentData.length);
  }

  // Get personalized rest recommendations based on fitness level
  getPersonalizedRestTime(exerciseIntensity: 'low' | 'medium' | 'high', fitnessLevel: 'beginner' | 'intermediate' | 'advanced'): number {
    const baseRest = {
      low: 30,
      medium: 60,
      high: 90
    };

    const fitnessMultiplier = {
      beginner: 1.5,
      intermediate: 1.0,
      advanced: 0.8
    };

    return Math.round(baseRest[exerciseIntensity] * fitnessMultiplier[fitnessLevel]);
  }

  isMonitoringActive(): boolean {
    return this.isMonitoring;
  }
}

export default new SmartRestService();
export type { HeartRateData, AdaptiveRestConfig };