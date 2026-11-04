import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance, type ColorSchemeName } from 'react-native';

export type ThemeMode = 'dark' | 'light' | 'system';
export type Language = 'en' | 'hi';

interface SettingsState {
  themeMode: ThemeMode;
  language: Language;
  vegMode: boolean;
  effectiveTheme: 'dark' | 'light';
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setLanguage: (lang: Language) => Promise<void>;
  setVegMode: (on: boolean) => Promise<void>;
  loadSettings: () => Promise<void>;
}

function resolveEffectiveTheme(mode: ThemeMode): 'dark' | 'light' {
  if (mode === 'system') {
    return Appearance.getColorScheme() === 'light' ? 'light' : 'dark';
  }
  return mode;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  themeMode: 'light',
  language: 'en',
  vegMode: false,
  effectiveTheme: 'light',

  setThemeMode: async (mode) => {
    await AsyncStorage.setItem('theme_mode', mode);
    set({ themeMode: mode, effectiveTheme: resolveEffectiveTheme(mode) });
  },

  setLanguage: async (lang) => {
    await AsyncStorage.setItem('language', lang);
    set({ language: lang });
  },

  setVegMode: async (on) => {
    await AsyncStorage.setItem('veg_mode', on ? '1' : '0');
    set({ vegMode: on });
  },

  loadSettings: async () => {
    try {
      const [savedTheme, savedLang, savedVeg] = await Promise.all([
        AsyncStorage.getItem('theme_mode'),
        AsyncStorage.getItem('language'),
        AsyncStorage.getItem('veg_mode'),
      ]);
      const mode = (savedTheme as ThemeMode) || 'light';
      const lang = (savedLang as Language) || 'en';
      set({
        themeMode: mode,
        language: lang,
        vegMode: savedVeg === '1',
        effectiveTheme: resolveEffectiveTheme(mode),
      });
    } catch (error) {
      if (__DEV__) console.warn('Error loading settings:', error);
    }
  },
}));

// When the user's themeMode is 'system', recompute effectiveTheme whenever the
// OS color scheme changes. Without this listener, toggling Android's dark mode
// would only take effect on app restart.
Appearance.addChangeListener(({ colorScheme }: { colorScheme: ColorSchemeName }) => {
  const { themeMode } = useSettingsStore.getState();
  if (themeMode === 'system') {
    useSettingsStore.setState({
      effectiveTheme: colorScheme === 'light' ? 'light' : 'dark',
    });
  }
});
