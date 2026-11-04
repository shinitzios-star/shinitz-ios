/**
 * Localization engine (i18next + react-i18next).
 *
 * Design goals:
 *   • Single source of truth — the app changes language ONLY through
 *     settingsStore.setLanguage, which persists AND calls i18n.changeLanguage.
 *     react-i18next then re-renders every component using useTranslation()/t(),
 *     so a switch is instant across screens, modals, toasts and alerts with no
 *     app restart.
 *   • Graceful fallback — a missing key falls back to English, never to a blank
 *     or a raw key crash (returnNull/returnEmptyString off + fallbackLng).
 *   • RTL-ready — direction is derived from the active language on every switch,
 *     so adding an RTL language (Urdu/Arabic) is a one-line change to
 *     RTL_LANGUAGES; today's languages are all LTR so it's a no-op.
 *   • Sensible first-launch default — before the user has ever chosen, we honour
 *     the device language if we support it, else English.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager } from 'react-native';
import * as Localization from 'expo-localization';
import en from './en.json';
import hi from './hi.json';

export const SUPPORTED_LANGUAGES = ['en', 'hi'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

// Human labels for the language picker (endonyms — shown in their own script).
export const LANGUAGE_LABELS: Record<AppLanguage, string> = {
  en: 'English',
  hi: 'हिंदी',
};

// Languages that render right-to-left. Empty today; adding one here is all that's
// needed for applyDirection() below to flip layout on the next switch.
export const RTL_LANGUAGES = new Set<string>([]);

const resources = {
  en: { translation: en },
  hi: { translation: hi },
} as const;

export function isSupported(lang?: string | null): lang is AppLanguage {
  return !!lang && (SUPPORTED_LANGUAGES as readonly string[]).includes(lang);
}

/** Device language, narrowed to what we support. Used only as the first-launch
 *  default (a saved preference always wins over this). */
export function deviceDefaultLanguage(): AppLanguage {
  try {
    const locales = Localization.getLocales?.();
    const code = locales?.[0]?.languageCode
      ?? (Localization as any).locale?.split('-')[0];
    return isSupported(code) ? code : 'en';
  } catch {
    return 'en';
  }
}

i18n.use(initReactI18next).init({
  resources,
  lng: deviceDefaultLanguage(),
  fallbackLng: 'en',
  supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],
  interpolation: { escapeValue: false },
  // A missing/blank translation should fall through to English, not render "" or
  // the raw key object — keeps the UI safe if a key is ever forgotten.
  returnNull: false,
  returnEmptyString: false,
  compatibilityJSON: 'v4',
});

/** Keep native layout direction in sync with the active language (future RTL). */
export function applyDirection(lang: string) {
  const shouldRTL = RTL_LANGUAGES.has(lang);
  if (I18nManager.isRTL !== shouldRTL) {
    try {
      I18nManager.allowRTL(shouldRTL);
      I18nManager.forceRTL(shouldRTL);
      // A full LTR⇄RTL flip requires an app reload to re-layout native views.
      // With only LTR languages today this branch never runs; when an RTL
      // language is added, trigger a restart prompt here.
    } catch {
      /* no-op on platforms without RTL control */
    }
  }
}

applyDirection(i18n.language);
i18n.on('languageChanged', applyDirection);

export default i18n;
