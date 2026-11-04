# Shinitz Platform — Architecture (Folder structure · Dependency map · App separation)

Monorepo (Yarn workspaces + Expo). Four production apps + admin, each building an
**independent APK with its own package name**, sharing ONE controlled package.

## 1. Final folder structure
```
platform/
├─ package.json                 # workspaces: apps/*, packages/*
├─ .gitignore
├─ packages/
│  └─ shared-core/              # @shinitz/shared-core — the ONLY shared code
│     ├─ package.json
│     └─ src/
│        ├─ index.ts            # barrel re-exports
│        ├─ constants/          # theme.ts, themes.ts (design system)
│        ├─ contexts/           # ThemeContext
│        ├─ store/              # authStore, settingsStore (shared state only)
│        ├─ services/           # api.ts (network layer), notifications.ts
│        ├─ i18n/               # en/hi + init
│        ├─ components/         # Button, Card, Input, Toast, ErrorBoundary,
│        │                      #   FoodLoader, SkeletonLoader, OfflineBanner,
│        │                      #   StatusBadge, VerificationBadge, OrderCard
│        ├─ utils/              # format, etc.
│        ├─ hooks/              # shared hooks
│        └─ types/
└─ apps/
   ├─ consumer/    com.shinitz.app          scheme: shinitz
   ├─ rider/       com.shinitz.rider        scheme: shinitzrider
   ├─ restaurant/  com.shinitz.restaurant   scheme: shinitzrestaurant
   ├─ kirana/      com.shinitz.kirana       scheme: shinitzkirana
   └─ admin/       com.shinitz.admin        scheme: shinitzadmin
        ├─ app/            # expo-router routes: index (role-gate) + (auth) + (role)
        ├─ src/            # APP-LOCAL components/stores/services
        ├─ assets/         # app-specific icon/splash (replace per brand)
        ├─ app.json        # distinct name/package/scheme/icon/splash
        ├─ package.json    # own deps + @shinitz/shared-core
        ├─ metro.config.js # monorepo-aware (watches repo root)
        └─ tsconfig.json   # maps @shinitz/shared-core
```

## 2. Dependency map
```
                 ┌─────────────────────────────┐
                 │     @shinitz/shared-core     │  (no app-specific deps)
                 │  api · auth/settings stores  │
                 │  theme · i18n · UI primitives│
                 └──────────────┬──────────────┘
        ┌───────────────┬───────┼────────┬───────────────┐
   consumer          rider   restaurant  kirana         admin
   (own routes,   (own routes, ...)      ...            ...
    cart/fav/      tracking/                              (admin
    address/       incoming-order/                         routes)
    product UI)    collect-payment)
```
- **Apps depend on shared-core. shared-core depends on NO app.** No app imports
  another app (cross-app dependencies removed by construction).
- App-local (NOT shared):
  - **consumer**: ProductCard, ProductDetailModal, LocationPickerModal, OfferAlert,
    UnserviceableScreen, TrackingMap · cart/favorites/history/address/content stores ·
    payment service.
  - **rider**: IncomingOrderAlert, BackgroundAlertSetup, CollectPaymentModal,
    TrackingMap · routing service.
  - **restaurant / kirana**: BusinessHours, IncomingOrderAlert, CollectPaymentModal.
  - **admin**: admin route screens.

## 3. App separation report
| Concern | Before (single app) | After (monorepo) |
|---|---|---|
| Routes | one `app/` with 6 role groups | each app has only `(auth)` + its own `(role)` group |
| Navigation | shared root Stack switching on role | per-app root Stack (auth + one role) |
| Auth flow | one flow, redirect by role | per-app entry **gated to that app's role** |
| State | all stores in one bundle | shared (auth/settings) in core; role stores app-local |
| API services | one `api.ts` for everyone | network layer in core; role API slices used per app |
| Assets / branding | one icon/splash | per-app icon/splash/notification-icon |
| Config | one `app.json` | distinct `app.json` per app (name/package/scheme/version) |
| Build | one APK with everything | independent APK per app, own package name + EAS project |

Result: four independent apps (+ admin) sharing only the controlled `shared-core`.
