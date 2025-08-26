import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Bluetooth, Smartphone, Watch, Heart, Activity } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { wearableService, WearableDevice, WearableData } from '@/services/wearableService';

export default function WearablesScreen() {
  const [availableDevices, setAvailableDevices] = useState<WearableDevice[]>([]);
  const [connectedDevices, setConnectedDevices] = useState<WearableDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState<string | null>(null);
  const [latestData, setLatestData] = useState<WearableData | null>(null);

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    try {
      setIsScanning(true);
      const devices = await wearableService.getAvailableDevices();
      const connected = wearableService.getConnectedDevices();
      
      setAvailableDevices(devices || []);
      setConnectedDevices(connected || []);
    } catch (error) {
      console.error('Failed to load devices:', error);
      setAvailableDevices([]);
      setConnectedDevices([]);
    } finally {
      setIsScanning(false);
    }
  };

  const handleConnect = async (deviceId: string) => {
    if (!deviceId) return;
    
    setIsConnecting(deviceId);
    
    try {
      const hasPermissions = await wearableService.requestPermissions();
      if (!hasPermissions) {
        Alert.alert('Permissions Required', 'Please grant health data permissions to continue.');
        return;
      }

      const success = await wearableService.connectDevice(deviceId);
      
      if (success) {
        Alert.alert('Success', 'Device connected successfully!');
        await loadDevices();
      } else {
        Alert.alert('Error', 'Failed to connect device. Please try again.');
      }
    } catch (error) {
      console.error('Connection error:', error);
      Alert.alert('Error', 'Failed to connect device. Please try again.');
    } finally {
      setIsConnecting(null);
    }
  };

  const handleDisconnect = async (deviceId: string) => {
    if (!deviceId) return;

    try {
      const success = await wearableService.disconnectDevice(deviceId);
      
      if (success) {
        Alert.alert('Success', 'Device disconnected.');
        await loadDevices();
      } else {
        Alert.alert('Error', 'Failed to disconnect device.');
      }
    } catch (error) {
      console.error('Disconnection error:', error);
      Alert.alert('Error', 'Failed to disconnect device.');
    }
  };

  const handleSync = async (deviceId: string) => {
    if (!deviceId) return;

    try {
      const data = await wearableService.syncData(deviceId);
      
      if (data) {
        setLatestData(data);
        Alert.alert('Success', 'Data synced successfully!');
        await loadDevices();
      } else {
        Alert.alert('Error', 'Failed to sync data.');
      }
    } catch (error) {
      console.error('Sync error:', error);
      Alert.alert('Error', 'Failed to sync data.');
    }
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'apple_watch':
        return <Watch size={24} color={Colors.primary} />;
      case 'fitbit':
      case 'garmin':
        return <Activity size={24} color={Colors.primary} />;
      case 'oura':
        return <Heart size={24} color={Colors.primary} />;
      default:
        return <Smartphone size={24} color={Colors.primary} />;
    }
  };

  const getAvailableDevicesFiltered = () => {
    if (!Array.isArray(availableDevices) || !Array.isArray(connectedDevices)) {
      return [];
    }
    
    return availableDevices.filter(device => {
      if (!device || !device.id) return false;
      return !connectedDevices.some(cd => cd && cd.id === device.id);
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Wearable Devices', headerShown: false }} />
      
      <View style={styles.header}>
        <Text style={styles.title}>Wearable Devices</Text>
        <TouchableOpacity
          style={styles.scanButton}
          onPress={loadDevices}
          disabled={isScanning}
        >
          {isScanning ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Bluetooth size={20} color="white" />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {connectedDevices.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Connected Devices</Text>
            {connectedDevices.map((device) => {
              if (!device || !device.id) return null;
              
              return (
                <View key={device.id} style={styles.deviceCard}>
                  <View style={styles.deviceInfo}>
                    {getDeviceIcon(device.type)}
                    <View style={styles.deviceDetails}>
                      <Text style={styles.deviceName}>{device.name || 'Unknown Device'}</Text>
                      <Text style={styles.deviceStatus}>
                        Connected • Last sync: {device.lastSync ? 'Just now' : 'Never'}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.deviceActions}>
                    <TouchableOpacity
                      style={styles.syncButton}
                      onPress={() => handleSync(device.id)}
                    >
                      <Text style={styles.syncButtonText}>Sync</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={styles.disconnectButton}
                      onPress={() => handleDisconnect(device.id)}
                    >
                      <Text style={styles.disconnectButtonText}>Disconnect</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {latestData && (
          <>
            <Text style={styles.sectionTitle}>Latest Data</Text>
            <View style={styles.dataCard}>
              <View style={styles.dataGrid}>
                {latestData.heartRate && (
                  <View style={styles.dataItem}>
                    <Heart size={20} color={Colors.primary} />
                    <Text style={styles.dataValue}>{latestData.heartRate}</Text>
                    <Text style={styles.dataLabel}>BPM</Text>
                  </View>
                )}
                
                {latestData.steps && (
                  <View style={styles.dataItem}>
                    <Activity size={20} color={Colors.primary} />
                    <Text style={styles.dataValue}>{latestData.steps.toLocaleString()}</Text>
                    <Text style={styles.dataLabel}>Steps</Text>
                  </View>
                )}
                
                {latestData.calories && (
                  <View style={styles.dataItem}>
                    <Text style={styles.dataIcon}>🔥</Text>
                    <Text style={styles.dataValue}>{latestData.calories}</Text>
                    <Text style={styles.dataLabel}>Calories</Text>
                  </View>
                )}
                
                {latestData.sleepHours && (
                  <View style={styles.dataItem}>
                    <Text style={styles.dataIcon}>😴</Text>
                    <Text style={styles.dataValue}>{latestData.sleepHours}h</Text>
                    <Text style={styles.dataLabel}>Sleep</Text>
                  </View>
                )}
              </View>
            </View>
          </>
        )}

        <Text style={styles.sectionTitle}>Available Devices</Text>
        
        {getAvailableDevicesFiltered().map((device) => {
          if (!device || !device.id) return null;
          
          return (
            <View key={device.id} style={styles.deviceCard}>
              <View style={styles.deviceInfo}>
                {getDeviceIcon(device.type)}
                <View style={styles.deviceDetails}>
                  <Text style={styles.deviceName}>{device.name || 'Unknown Device'}</Text>
                  <Text style={styles.deviceStatus}>Available to connect</Text>
                </View>
              </View>
              
              <TouchableOpacity
                style={[styles.connectButton, isConnecting === device.id && styles.connectingButton]}
                onPress={() => handleConnect(device.id)}
                disabled={isConnecting === device.id}
              >
                {isConnecting === device.id ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.connectButtonText}>Connect</Text>
                )}
              </TouchableOpacity>
            </View>
          );
        })}

        {getAvailableDevicesFiltered().length === 0 && !isScanning && (
          <View style={styles.emptyState}>
            <Bluetooth size={48} color={Colors.text.secondary} />
            <Text style={styles.emptyStateTitle}>No Devices Found</Text>
            <Text style={styles.emptyStateText}>
              Make sure your wearable device is nearby and in pairing mode.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold' as const,
    color: Colors.text.primary,
  },
  scanButton: {
    backgroundColor: Colors.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text.primary,
    marginBottom: 16,
    marginTop: 8,
  },
  deviceCard: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  deviceDetails: {
    marginLeft: 12,
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text.primary,
    marginBottom: 4,
  },
  deviceStatus: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  deviceActions: {
    flexDirection: 'row',
    gap: 8,
  },
  connectButton: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  connectingButton: {
    opacity: 0.6,
  },
  connectButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500' as const,
  },
  syncButton: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  syncButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500' as const,
  },
  disconnectButton: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.text.secondary,
  },
  disconnectButtonText: {
    color: Colors.text.secondary,
    fontSize: 12,
    fontWeight: '500' as const,
  },
  dataCard: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  dataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  dataItem: {
    alignItems: 'center',
    minWidth: '45%',
  },
  dataIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  dataValue: {
    fontSize: 24,
    fontWeight: 'bold' as const,
    color: Colors.text.primary,
    marginTop: 4,
  },
  dataLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});