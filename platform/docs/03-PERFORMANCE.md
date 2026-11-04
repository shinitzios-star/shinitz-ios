# Performance Optimization Report

## What the split buys (requirement #8)
- **Smaller installs.** Each app ships only its own role's screens + the deps it
  actually uses, instead of all four roles in one binary. The consumer app no
  longer carries rider tracking / restaurant menu / kirana / admin code, etc.
- **Lazy routes by default.** expo-router is file-based; each route is a separate
  chunk loaded on navigation — no change needed, and now there are ~5× fewer
  routes per app to traverse.
- **No dead cross-role code.** Role screens that were never reached in a given
  role are simply absent from that app.

## Per-app dependency trimming (do this during cutover)
Each app currently inherits the full dependency list (so it builds immediately).
Trim what a given app doesn't use:
| Dependency | consumer | rider | restaurant | kirana | admin |
|---|---|---|---|---|---|
| react-native-razorpay (checkout) | ✅ | – | – | – | – |
| react-native-webview (maps/live) | ✅ | ✅ | – | – | ✅ |
| react-native-qrcode-svg | – | ✅ (COD QR) | ✅ | ✅ | – |
| expo-image-picker | ✅ | ✅ (docs) | ✅ | ✅ | – |
| recharts-equivalent / svg | ✅ | – | – | – | ✅ |
| expo-audio (order buzzer) | – | ✅ | ✅ | ✅ | – |

Removing unused deps shrinks each APK and its JS bundle.

## Code-level cleanups (carry over during import rewrite)
- Remove unused imports flagged by `expo lint` / `tsc` in each app after the move.
- Dead code: role-specific helpers that only one app uses move into that app;
  anything referenced by nobody gets deleted.
- Shared UI lives once in `shared-core` (no duplication across apps).
- Keep `expo-image` (already used) with `memory-disk` cache + `recyclingKey`
  for lists (already applied in consumer).

## Measurement plan
After each app builds, compare APK size vs the current all-in-one build (≈ the
23 MB archive). Expect a meaningful drop for rider/restaurant/kirana (no
checkout/charts/consumer assets).
