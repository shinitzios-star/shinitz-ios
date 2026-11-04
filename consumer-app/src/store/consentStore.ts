import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * First-launch legal consent status, shared.
 *
 * Consent used to live entirely inside ConsentGate, which rendered the consent
 * screen INSTEAD OF the navigator until it was accepted. That meant the root
 * layout had no navigator on its first render — which expo-router requires —
 * and when the Stack mounted late and the first navigation fired, expo-router
 * tore down and rebuilt the ENTIRE root layout (measured: RootLayout UNMOUNT ->
 * MOUNT on every first launch). A rebuilt navigator resets the tabs to Home.
 *
 * The navigator now mounts once and stays mounted; consent is an overlay. The
 * screens that must not run before consent (the redirect into the app, and the
 * signed-in area where Home asks for location) read this store instead.
 *
 * Stored under a VERSIONED key: bumping CONSENT_VERSION re-prompts everyone,
 * which is what you want when the documents materially change. Deliberately NOT
 * cleared on logout — consent is to the documents, not to a session.
 */
export const CONSENT_VERSION = 1;
export const CONSENT_KEY = `legal_consent_v${CONSENT_VERSION}`;

type ConsentStatus = 'unknown' | 'required' | 'accepted';

interface ConsentState {
  /** 'unknown' until storage has been read once. */
  status: ConsentStatus;
  load: () => Promise<void>;
  /** Persist consent. Resolves false if storage failed (the gate stays up). */
  accept: () => Promise<boolean>;
}

export const useConsentStore = create<ConsentState>((set, get) => ({
  status: 'unknown',

  load: async () => {
    if (get().status !== 'unknown') return;
    let accepted = false;
    try {
      accepted = (await AsyncStorage.getItem(CONSENT_KEY)) === 'accepted';
    } catch {
      accepted = false;
    }
    set({ status: accepted ? 'accepted' : 'required' });
  },

  accept: async () => {
    try {
      await AsyncStorage.setItem(CONSENT_KEY, 'accepted');
      await AsyncStorage.setItem(`${CONSENT_KEY}_at`, new Date().toISOString());
      set({ status: 'accepted' });
      return true;
    } catch {
      // Storage failed — stay on the gate rather than letting the user in on a
      // consent we could not record.
      return false;
    }
  },
}));

export async function hasAcceptedLegal(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(CONSENT_KEY)) === 'accepted';
  } catch {
    return false;
  }
}
