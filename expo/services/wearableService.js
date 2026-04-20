import { Platform } from 'react-native';

class WearableService {
  connectedDevices = [];

  async getAvailableDevices() {
    try {
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

      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const device = await this.getDeviceById(deviceId);
      if (device) {
        device.connected = true;
        device.lastSync = new Date().toISOString();
        
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

      await new Promise(resolve => setTimeout(resolve, 1000));

      const mockData = {
        heartRate: Math.floor(Math.random() * 40) + 60,
        steps: Math.floor(Math.random() * 5000) + 5000,
        floorsClimbed: Math.floor(Math.random() * 15) + 5,
        calories: Math.floor(Math.random() * 1000) + 1500,
        sleepHours: Math.floor(Math.random() * 3) + 6,
        activeMinutes: Math.floor(Math.random() * 60) + 30,
        distance: Math.floor(Math.random() * 5) + 3,
        stressLevel: Math.floor(Math.random() * 5) + 1,
        sleepQuality: Math.floor(Math.random() * 5) + 1,
        energyLevel: Math.floor(Math.random() * 5) + 1,
        recoveryScore: Math.floor(Math.random() * 40) + 60,
        hrv: Math.floor(Math.random() * 30) + 20,
        restingHeartRate: Math.floor(Math.random() * 20) + 50,
        bodyBattery: Math.floor(Math.random() * 40) + 60,
        readinessScore: Math.floor(Math.random() * 40) + 60,
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

      const primaryDevice = connectedDevices[0];
      const wearableData = await this.syncData(primaryDevice.id);
      
      if (!wearableData) {
        return null;
      }

      const mood = this.calculateMoodFromMetrics(wearableData);
      const energy = wearableData.energyLevel || this.calculateEnergyFromMetrics(wearableData);
      const stress = wearableData.stressLevel || this.calculateStressFromMetrics(wearableData);
      const sleep = wearableData.sleepQuality || this.calculateSleepFromMetrics(wearableData);
      
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
    let moodScore = 3;
    
    if (data.hrv) {
      if (data.hrv > 40) moodScore += 0.5;
      else if (data.hrv < 25) moodScore -= 0.5;
    }
    
    if (data.recoveryScore) {
      if (data.recoveryScore > 80) moodScore += 0.5;
      else if (data.recoveryScore < 60) moodScore -= 0.5;
    }
    
    if (data.readinessScore) {
      if (data.readinessScore > 80) moodScore += 0.5;
      else if (data.readinessScore < 60) moodScore -= 0.5;
    }
    
    if (data.sleepQuality) {
      if (data.sleepQuality >= 4) moodScore += 0.3;
      else if (data.sleepQuality <= 2) moodScore -= 0.3;
    }
    
    if (data.activeMinutes) {
      if (data.activeMinutes > 60) moodScore += 0.2;
      else if (data.activeMinutes < 20) moodScore -= 0.2;
    }
    
    return Math.max(1, Math.min(5, Math.round(moodScore)));
  }
  
  calculateEnergyFromMetrics(data) {
    if (data.energyLevel) return data.energyLevel;
    
    let energyScore = 3;
    
    if (data.bodyBattery) {
      energyScore = Math.round((data.bodyBattery / 100) * 5);
    } else {
      if (data.sleepHours && data.sleepHours >= 7) energyScore += 0.5;
      if (data.recoveryScore && data.recoveryScore > 75) energyScore += 0.5;
      if (data.restingHeartRate && data.restingHeartRate < 60) energyScore += 0.3;
    }
    
    return Math.max(1, Math.min(5, Math.round(energyScore)));
  }
  
  calculateStressFromMetrics(data) {
    if (data.stressLevel) return data.stressLevel;
    
    let stressScore = 3;
    
    if (data.hrv) {
      if (data.hrv < 25) stressScore += 1;
      else if (data.hrv > 40) stressScore -= 1;
    }
    
    if (data.restingHeartRate) {
      if (data.restingHeartRate > 70) stressScore += 0.5;
      else if (data.restingHeartRate < 55) stressScore -= 0.5;
    }
    
    if (data.recoveryScore && data.recoveryScore < 60) stressScore += 0.5;
    
    return Math.max(1, Math.min(5, Math.round(stressScore)));
  }
  
  calculateSleepFromMetrics(data) {
    if (data.sleepQuality) return data.sleepQuality;
    
    let sleepScore = 3;
    
    if (data.sleepHours) {
      if (data.sleepHours >= 7 && data.sleepHours <= 9) sleepScore += 1;
      else if (data.sleepHours < 6 || data.sleepHours > 10) sleepScore -= 1;
    }
    
    if (data.hrv && data.hrv > 35) sleepScore += 0.5;
    
    return Math.max(1, Math.min(5, Math.round(sleepScore)));
  }
  
  calculateConfidence(data) {
    let dataPoints = 0;
    const totalPoints = 8;
    
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
      return true;
    }

    try {
      return true;
    } catch (error) {
      console.error('Failed to request permissions:', error);
      return false;
    }
  }
}

export const wearableService = new WearableService();
