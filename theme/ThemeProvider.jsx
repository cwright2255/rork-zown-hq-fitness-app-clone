import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { darkTheme, getTheme, lightTheme } from './tokens';

const THEME_MODE_KEY = '@fitleus/theme_mode';

const ThemeContext = createContext({
  currentMode: 'light',
  theme: lightTheme,
  toggleTheme: () => {},
  setThemeMode: () => {},
  isDark: false
});

export const ThemeProvider = ({ children }) => {
  const [mode, setMode] = useState('light');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_MODE_KEY)
      .then((savedMode) => {
        if (savedMode === 'dark' || savedMode === 'light') {
          setMode(savedMode);
        }
      })
      .catch(() => {})
      .finally(() => {
        setIsLoaded(true);
      });
  }, []);

  const setThemeMode = useCallback((NewMode) => {
    setMode(newMode);
    AsyncStorage.setItem(THEME_MODE_KEY, newMode).catch(() => {});
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeMode((options) => (options === 'dark' ? 'light' : 'dark'));
  }, [setThemeMode]);

  const theme = useMemo(() => getTheme(mode), [mode]);
  const isDark = mode === 'dark';

  const value = useMemo(() => ({
    currentMode: mode,
    theme,
    toggleTheme,
    setThemeMode,
    isDark
  }), [mode, theme, toggleTheme, setThemeMode, isDark]);

  if (!isLoaded) {
    return null;
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
