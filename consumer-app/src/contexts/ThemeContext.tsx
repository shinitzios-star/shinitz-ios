import React, { createContext, useContext, useMemo } from 'react';
import { DarkTheme, LightTheme } from '../constants/themes';
import { useSettingsStore } from '../store/settingsStore';
import type { ThemeColors } from '../constants/themes';

interface ThemeContextValue {
  colors: ThemeColors;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: DarkTheme as unknown as ThemeColors,
  isDark: true,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const effectiveTheme = useSettingsStore((s) => s.effectiveTheme);

  const value = useMemo<ThemeContextValue>(() => ({
    // Double-cast widens statusBar literal "light"|"dark" so both themes satisfy ThemeColors
    colors: (effectiveTheme === 'dark' ? DarkTheme : LightTheme) as unknown as ThemeColors,
    isDark: effectiveTheme === 'dark',
  }), [effectiveTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
