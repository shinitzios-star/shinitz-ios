/**
 * @shinitz/shared-core — the single controlled sharing point across all apps.
 *
 * Re-exports the genuinely-shared layer. App code imports from
 * `@shinitz/shared-core` (or deep-imports a submodule when needed). Anything
 * role-specific (consumer cart, rider tracking, restaurant menu…) lives in that
 * app's own `src/`, NOT here.
 */

// ── Constants / design system ────────────────────────────────────────────────
export * from './constants/theme';
export * from './constants/themes';

// ── Theme context ─────────────────────────────────────────────────────────────
export * from './contexts/ThemeContext';

// ── Shared state (auth + settings only) ──────────────────────────────────────
export * from './store/authStore';
export * from './store/settingsStore';

// ── Network layer / API utilities ─────────────────────────────────────────────
export * from './services/api';
export { default as api } from './services/api';

// ── i18n ──────────────────────────────────────────────────────────────────────
export { default as i18n } from './i18n';

// ── Reusable UI primitives ────────────────────────────────────────────────────
export * from './components/Button';
export * from './components/Card';
export * from './components/Input';
export * from './components/Toast';
export * from './components/ErrorBoundary';
export * from './components/FoodLoader';
export * from './components/SkeletonLoader';
export * from './components/OfflineBanner';
export * from './components/StatusBadge';
export * from './components/VerificationBadge';
export * from './components/OrderCard';
