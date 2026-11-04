// Shinitz Green/Gold Premium Themes

// ─── Light theme ──────────────────────────────────────────────────────────────
// Unchanged — the brand identity at full brightness.

export const LightTheme = {
  primary: '#0F3D2E',
  primaryDark: '#0a2d20',
  primaryLight: '#1a6b4a',
  accent: '#D4AF37',
  accentDark: '#b8952e',
  accentLight: '#e8cb6a',
  success: '#10b981',
  successDark: '#059669',
  successLight: '#34d399',
  background: '#f8f9fa',
  surface: '#ffffff',
  surfaceLight: '#f0f2f5',
  card: '#ffffff',
  text: '#1a1a2e',
  textSecondary: '#5a6178',
  textMuted: '#9ca3af',
  error: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',
  border: '#e8ecf0',
  borderLight: '#f0f2f5',
  overlay: 'rgba(0, 0, 0, 0.5)',
  tabBar: '#ffffff',
  tabBarBorder: '#e8ecf0',
  statusBar: 'dark' as const,
};

// ─── Dark theme (night-friendly) ──────────────────────────────────────────────
// Design notes:
//  • Backgrounds use warm dark green tints (not pure black) — easier on eyes,
//    on-brand, and OLED-friendly.
//  • Text uses soft off-white (#e8ebe8) — pure #fff causes glare at night.
//  • Brand primary stays GREEN (just brightened for legibility on dark surfaces)
//    so dark mode still feels like Shinitz, not a different app.
//  • Gold accent unchanged — same vibrancy works in both modes.
//  • Contrast ratios meet WCAG AA for body text and large UI elements.

export const DarkTheme = {
  // Primary GREEN — kept as primary; brightened from #0F3D2E so it stays visible on dark
  primary: '#2a8c64',
  primaryDark: '#1f6b4c',
  primaryLight: '#48a382',

  // Gold accent — same hues, gold reads well on both light & dark
  accent: '#D4AF37',
  accentDark: '#b8952e',
  accentLight: '#e8cb6a',

  // Success states
  success: '#34d399',
  successDark: '#10b981',
  successLight: '#6ee7b7',

  // Backgrounds — warm dark green-tinted (NOT pure black) for low eye strain
  background: '#0c1611',
  surface: '#142119',
  surfaceLight: '#1c2c22',
  card: '#162820',

  // Text — soft off-white tones; pure white is harsh at night
  text: '#e8ebe8',
  textSecondary: '#9aa9a0',
  textMuted: '#5e6e64',

  // Status colors — slightly desaturated for dark backgrounds
  error: '#f87171',
  warning: '#fbbf24',
  info: '#60a5fa',

  // Borders — subtle, barely-visible separators
  border: '#243329',
  borderLight: '#2d3f33',
  overlay: 'rgba(0, 0, 0, 0.6)',

  // Tab bar — slightly darker than surface so it visually anchors the screen
  tabBar: '#0f1814',
  tabBarBorder: '#243329',

  statusBar: 'light' as const,
};

export type ThemeColors = typeof LightTheme;
