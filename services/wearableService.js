import { Platform } from 'react-native';

class WearableService {
  connectedDevices = [];

  async getAvailableDevices() {
    try {
      // Mock available devices - in real app, this would scan for nearby devices
      const devices = [
        {
          id: 'fitbit_1',
          name: 'Fitbit Charge 5',
          type: 'fitbit',
          connected: false,
        },
        {
          id: 'apple_watch_1',
          name: 'Apple Watch Series 8',
          type: 'apple_watch',
          connected: false,
        },
        {
          id: 'garmin_1',
          name: 'Garmin Forerunner 945',
          type: 'garmin',
          connected: false,
        },
        {
          id: 'oura_1',
          name: 'Oura Ring Gen3',
          type: 'oura',
          connected: false,
        },
      ];

      return devices;
    } catch (error) {
      console.error('Failed to get available devices:', error);
      return [];
    }
  }

  async connectDevice(deviceId) {
    try {
      if (!deviceId) {
        return false;
      }

      // Simulate connection process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const device = await this.getDeviceById(deviceId);
      if (device) {
        device.connected = true;
        device.lastSync = new Date().toISOString();
        
        // Check if device is already connected
        const existingIndex = this.connectedDevices.findIndex(d => d.id === deviceId);
        if (existingIndex >= 0) {
          this.connectedDevices[existingIndex] = device;
        } else {
          this.connectedDevices.push(device);
        }
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to connect device:', error);
      return false;
    }
  }

  async disconnectDevice(deviceId) {
    try {
      if (!deviceId) {
        return false;
      }

      this.connectedDevices = this.connectedDevices.filter(d => d.id !== deviceId);
      return true;
    } catch (error) {
      console.error('Failed to disconnect device:', error);
      return false;
    }
  }

  async syncData(deviceId) {
    try {
      if (!deviceId) {
        return null;
      }

      const device = this.connectedDevices.find(d => d.id === deviceId);
      if (!device) return null;

      // Simulate data sync
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mock data based on device type with mood-related metrics
      const mockData = {
        heartRate: Math.floor(Math.random() * 40) + 60, // 60-100 bpm
        steps: Math.floor(Math.random() * 5000) + 5000, // 5000-10000 steps
        floorsClimbed: Math.floor(Math.random() * 15) + 5, // 5-20 stories
        calories: Math.floor(Math.random() * 1000) + 1500, // 1500-2500 calories
        sleepHours: Math.floor(Math.random() * 3) + 6, // 6-9 hours
        activeMinutes: Math.floor(Math.random() * 60) + 30, // 30-90 minutes
        distance: Math.floor(Math.random() * 5) + 3, // 3-8 km
        // Mood-related metrics
        stressLevel: Math.floor(Math.random() * 5) + 1, // 1-5 scale
        sleepQuality: Math.floor(Math.random() * 5) + 1, // 1-5 scale
        energyLevel: Math.floor(Math.random() * 5) + 1, // 1-5 scale
        recoveryScore: Math.floor(Math.random() * 40) + 60, // 60-100 scale
        hrv: Math.floor(Math.random() * 30) + 20, // 20-50 ms
        restingHeartRate: Math.floor(Math.random() * 20) + 50, // 50-70 bpm
        bodyBattery: Math.floor(Math.random() * 40) + 60, // 60-100
        readinessScore: Math.floor(Math.random() * 40) + 60, // 60-100
      };

      device.lastSync = new Date().toISOString();
      return mockData;
    } catch (error) {
      console.error('Failed to sync data:', error);
      return null;
    }
  }

  async getDeviceById(deviceId) {
    try {
      if (!deviceId) {
        return null;
      }

      const devices = await this.getAvailableDevices();
      return devices.find(d => d.id === deviceId) || null;
    } catch (error) {
      console.error('Failed to get device by ID:', error);
      return null;
    }
  }

  getConnectedDevices() {
    return [...this.connectedDevices];
  }

  async getMoodDataFromWearables() {
    try {
      const connectedDevices = this.getConnectedDevices();
      if (connectedDevices.length === 0) {
        return null;
      }

      // Use the first connected device for mood data
      const primaryDevice = connectedDevices[0];
      const wearableData = await this.syncData(primaryDevice.id);
      
      if (!wearableData) {
        return null;
      }

      // Convert wearable metrics to mood scores (1-5 scale)
      const mood = this.calculateMoodFromMetrics(wearableData);
      const energy = wearableData.energyLevel || this.calculateEnergyFromMetrics(wearableData);
      const stress = wearableData.stressLevel || this.calculateStressFromMetrics(wearableData);
      const sleep = wearableData.sleepQuality || this.calculateSleepFromMetrics(wearableData);
      
      // Calculate confidence based on data availability
      const confidence = this.calculateConfidence(wearableData);
      
      return {
        mood,
        energy,
        stress,
        sleep,
        confidence,
        dataSource: primaryDevice.name
      };
    } catch (error) {
      console.error('Failed to get mood data from wearables:', error);
      return null;
    }
  }

  calculateMoodFromMetrics(data) {
    // Combine multiple metrics to estimate mood
    let moodScore = 3; // Start with neutral
    
    // HRV indicates stress/recovery - higher HRV = better mood
    if (data.hrv) {
      if (data.hrv > 40) moodScore += 0.5;
      else if (data.hrv < 25) moodScore -= 0.5;
    }
    
    // Recovery/readiness scores
    if (data.recoveryScore) {
      if (data.recoveryScore > 80) moodScore += 0.5;
      else if (data.recoveryScore < 60) moodScore -= 0.5;
    }
    
    if (data.readinessScore) {
      if (data.readinessScore > 80) moodScore += 0.5;
      else if (data.readinessScore < 60) moodScore -= 0.5;
    }
    
    // Sleep quality affects mood
    if (data.sleepQuality) {
      if (data.sleepQuality >= 4) moodScore += 0.3;
      else if (data.sleepQuality <= 2) moodScore -= 0.3;
    }
    
    // Activity level affects mood
    if (data.activeMinutes) {
      if (data.activeMinutes > 60) moodScore += 0.2;
      else if (data.activeMinutes < 20) moodScore -= 0.2;
    }
    
    return Math.max(1, Math.min(5, Math.round(moodScore)));
  }
  
  calculateEnergyFromMetrics(data) {
    if (data.energyLevel) return data.energyLevel;
    
    let energyScore = 3;
    
    // Body battery or similar energy metrics
    if (data.bodyBattery) {
      energyScore = Math.round((data.bodyBattery / 100) * 5);
    } else {
      // Calculate from other metrics
      if (data.sleepHours && data.sleepHours >= 7) energyScore += 0.5;
      if (data.recoveryScore && data.recoveryScore > 75) energyScore += 0.5;
      if (data.restingHeartRate && data.restingHeartRate < 60) energyScore += 0.3;
    }
    
    return Math.max(1, Math.min(5, Math.round(energyScore)));
  }
  
  calculateStressFromMetrics(data) {
    if (data.stressLevel) return data.stressLevel;
    
    let stressScore = 3;
    
    // HRV - lower HRV indicates higher stress
    if (data.hrv) {
      if (data.hrv < 25) stressScore += 1;
      else if (data.hrv > 40) stressScore -= 1;
    }
    
    // Resting heart rate - higher RHR can indicate stress
    if (data.restingHeartRate) {
      if (data.restingHeartRate > 70) stressScore += 0.5;
      else if (data.restingHeartRate < 55) stressScore -= 0.5;
    }
    
    // Recovery scores - lower recovery = higher stress
    if (data.recoveryScore && data.recoveryScore < 60) stressScore += 0.5;
    
    return Math.max(1, Math.min(5, Math.round(stressScore)));
  }
  
  calculateSleepFromMetrics(data) {
    if (data.sleepQuality) return data.sleepQuality;
    
    let sleepScore = 3;
    
    // Sleep duration
    if (data.sleepHours) {
      if (data.sleepHours >= 7 && data.sleepHours <= 9) sleepScore += 1;
      else if (data.sleepHours < 6 || data.sleepHours > 10) sleepScore -= 1;
    }
    
    // HRV during sleep indicates sleep quality
    if (data.hrv && data.hrv > 35) sleepScore += 0.5;
    
    return Math.max(1, Math.min(5, Math.round(sleepScore)));
  }
  
  calculateConfidence(data) {
    // Calculate confidence based on available data points
    let dataPoints = 0;
    let totalPoints = 8;
    
    if (data.hrv) dataPoints++;
    if (data.recoveryScore) dataPoints++;
    if (data.readinessScore) dataPoints++;
    if (data.sleepQuality || data.sleepHours) dataPoints++;
    if (data.energyLevel || data.bodyBattery) dataPoints++;
    if (data.stressLevel) dataPoints++;
    if (data.restingHeartRate) dataPoints++;
    if (data.activeMinutes) dataPoints++;
    
    return Math.round((dataPoints / totalPoints) * 100);
  }

  async requestPermissions() {
    if (Platform.OS === 'web') {
      return true; // Web doesn't need health permissions
    }

    try {
      // In a real app, you would request health permissions here
      // For iOS: HealthKit permissions
      // For Android: Google Fit permissions
      return true;
    } catch (error) {
      console.error('Failed to request permissions:', error);
      return false;
    }
  }
}

export const wearableService = new WearableService();