import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { darkTheme, getTheme, lightTheme } from './tokens';

const STORAGE_KEY = 'zown.theme.mode';

const ThemeContext = createContext(undefined);

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState('dark');

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((storedMode) => {
        if (mounted && (storedMode === 'dark' || storedMode === 'light')) {
          setMode(storedMode);
        }
      })
      .catch(() => {
        // Keep default dark mode if persistence is unavailable.
      });

    return () => {
      mounted = false;
    };
  }, []);

  const setThemeMode = useCallback((nextMode) => {
    setMode(nextMode);
    AsyncStorage.setItem(STORAGE_KEY, nextMode).catch(() => {
      // Theme switching should still work even if persistence fails.
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeMode(mode === 'dark' ? 'light' : 'dark');
  }, [mode, setThemeMode]);

  const value = useMemo(() => ({
    mode,
    theme: getTheme(mode),
    darkTheme,
    lightTheme,
    setThemeMode,
    toggleTheme,
  }), [mode, setThemeMode, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

export default ThemeProvider;
