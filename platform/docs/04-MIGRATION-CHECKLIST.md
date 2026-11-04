# Migration Checklist — finishing the split

The monorepo **foundation** is in place (structure, shared-core, per-app configs
with distinct package names/icons/splash, role-gated entries, reports). The old
app at `D:\shinitz\app\frontend` is **untouched and still shipping** — nothing
here breaks it.

What remains to turn the scaffold into four building APKs:

## A. Import rewrites (the main task)
The copied route files still import from the OLD relative paths
(`../../src/components/Button`, `../../src/contexts/ThemeContext`, …). Rewrite:
- **Shared modules → `@shinitz/shared-core`**
  e.g. `import { useTheme } from '../../src/contexts/ThemeContext'`
     → `import { useTheme } from '@shinitz/shared-core'`
  Applies to: constants/theme, themes, ThemeContext, authStore, settingsStore,
  services/api, services/notifications, i18n, and the shared components
  (Button, Card, Input, Toast, ErrorBoundary, FoodLoader, SkeletonLoader,
  OfflineBanner, StatusBadge, VerificationBadge, OrderCard).
- **App-local modules → relative** (now under each app's `src/`)
  e.g. consumer's `ProductCard`, `cartStore`, `payment` stay `../../src/...`.

Do this per app; `tsc --noEmit` will list every unresolved import to fix.

## B. Per-app dependency install
From `platform/`: `yarn install` (hoists shared deps). Each app already lists its
deps + `@shinitz/shared-core`.

## C. EAS project per app
Each app needs its **own** EAS project + credentials:
```
cd apps/rider && npx eas init        # writes a unique extra.eas.projectId
```
Replace `REPLACE_WITH_PER_APP_EAS_PROJECT_ID` in each `app.json`. Add an
`eas.json` per app (copy the consumer profile: preview = APK, autoIncrement).

## D. Firebase (push) per app
Different package name ⇒ a **separate Firebase app** + its own
`google-services.json` (and the FCM V1 key) per app that uses messaging
(rider/restaurant/kirana for order buzzers; consumer for order updates).
Add `"googleServicesFile": "./google-services.json"` + the firebase plugins back
to that app's `app.json`.

## E. Branding per app
Swap `assets/images/{icon,adaptive-icon,splash,notification-icon}.png` for each
app (rider green, restaurant, kirana variants). app.json already points at them.

## F. Lock auth to role (security follow-up)
In each app's `(auth)` flow, fix the role to the app (rider app → role `delivery`)
and reject mismatched logins (see SECURITY-AUDIT §Recommended #1).

## G. Verify + cut over
1. `cd apps/<app> && npx tsc --noEmit` → 0 errors.
2. `yarn workspace @shinitz/<app> start` → runs in Expo Go / dev client.
3. `yarn build:<app>` → independent APK.
4. Once all four pass, retire `D:\shinitz\app\frontend`.

## Suggested order
rider → restaurant → kirana → admin → consumer (consumer is largest; do it last
once the pattern is proven on the smaller apps).
