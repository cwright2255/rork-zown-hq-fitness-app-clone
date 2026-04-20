import { useState, useEffect, useCallback } from 'react';
import Constants from 'expo-constants';
import { initRook, syncTodayData, ROOK_CONFIG } from '../services/wearables';

const IS_EXPO_GO = Constants.appOwnership === 'expo';

export const useWearables = (userId) => {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [todaySteps, setTodaySteps] = useState(null);
  const [todayHeartRate, setTodayHeartRate] = useState(null);
  const [todaySleep, setTodaySleep] = useState(null);
  const [todayCalories, setTodayCalories] = useState(null);

  useEffect(() => {
    if (IS_EXPO_GO) {
      setIsReady(false);
      return;
    }
    initRook();
    setIsReady(true);
  }, []);

  const requestPermissions = useCallback(async () => {
    if (IS_EXPO_GO) return false;
    setIsLoading(true);
    try {
      setHasPermissions(true);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const syncData = useCallback(async () => {
    if (IS_EXPO_GO || !isReady) return;
    setIsLoading(true);
    setError(null);
    try {
      await syncTodayData();
    } catch (e) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, [isReady]);

  return {
    isReady,
    isLoading,
    error,
    hasPermissions,
    todaySteps,
    todayHeartRate,
    todaySleep,
    todayCalories,
    requestPermissions,
    syncData,
    isExpoGo: IS_EXPO_GO,
  };
};
