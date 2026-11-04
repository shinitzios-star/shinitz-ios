// ─────────────────────────────────────────────────────────────────────────────
// SHINITZ Rider — unified design system.
//
// One source of truth for spacing, radius, type scale, elevation and icon sizes
// so every screen shares the same rhythm and hierarchy (no per-screen drift).
// Colours come from ThemeContext (brand GREEN #0F3D2E/#2a8c64 + GOLD #D4AF37) —
// this file only owns the non-colour design tokens + brand gradients.
// ─────────────────────────────────────────────────────────────────────────────
import { TextStyle, ViewStyle } from 'react-native';

/** 4pt spacing scale. */
export const space = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32,
} as const;

/** Corner radius scale. */
export const radius = {
  sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, pill: 999,
} as const;

/** Icon sizing scale (keeps icons visually aligned across the app). */
export const icon = {
  xs: 14, sm: 18, md: 22, lg: 26, xl: 30,
} as const;

/** Type scale — presets applied via style={typography.h2} etc. */
export const typography = {
  display: { fontSize: 30, fontWeight: '800', letterSpacing: -0.6, lineHeight: 36 },
  h1: { fontSize: 24, fontWeight: '800', letterSpacing: -0.3, lineHeight: 30 },
  h2: { fontSize: 20, fontWeight: '700', lineHeight: 26 },
  h3: { fontSize: 17, fontWeight: '700', lineHeight: 22 },
  body: { fontSize: 15, fontWeight: '500', lineHeight: 21 },
  bodyStrong: { fontSize: 15, fontWeight: '700', lineHeight: 21 },
  caption: { fontSize: 13, fontWeight: '500', lineHeight: 18 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
} as const satisfies Record<string, TextStyle>;

/** Consistent elevation/shadow at three depths. */
export function elevation(level: 1 | 2 | 3 = 1, color = '#000'): ViewStyle {
  const m = {
    1: { shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
    2: { shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
    3: { shadowOpacity: 0.16, shadowRadius: 26, shadowOffset: { width: 0, height: 12 }, elevation: 10 },
  } as const;
  return { shadowColor: color, ...m[level] };
}

/** Brand gradients — SHINITZ green→gold premium hero (the on-brand take on the
 *  reference copper header) and a gold tier-badge gradient. */
export const gradients = {
  hero: ['#0b3325', '#12503a', '#1c6b4a'] as const,
  heroWarm: ['#123f2e', '#1c6b4a', '#2a8c64'] as const,
  gold: ['#efd27a', '#D4AF37', '#b8952e'] as const,
  goldSoft: ['#fbf3d8', '#f3e2ad'] as const,
};

/** Standard hit slop for small tappable controls (accessibility). */
export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 };
