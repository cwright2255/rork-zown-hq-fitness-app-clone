import React, { createContext, useContext } from 'react';
import { tokens, ThemeTokens } from './tokens';

const ThemeContext = createContext<ThemeTokens>(tokens);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => (
  <ThemeContext.Provider value={tokens}>{children}</ThemeContext.Provider>
);

export const useTheme = (): ThemeTokens => useContext(ThemeContext);
