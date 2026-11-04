# Security Audit Report

## Cross-app access control (requirement #7)
Each app is a **separate installable** with its own Android package name and its
own private storage sandbox — a rider's session token physically cannot be read
by the restaurant app (different `com.shinitz.*` package = different data dir).

On top of that, every app's entry (`app/index.tsx`) is **role-gated**:
```
const APP_ROLE = 'delivery';            // restaurant app = 'restaurant', etc.
if (!isAuthenticated) → /(auth)/login
if (user.role !== APP_ROLE) → /(auth)/login    // wrong role is bounced out
else → role home
```
So:
- Consumer users cannot reach Rider screens ✅ (separate app + role gate)
- Riders cannot reach Restaurant screens ✅
- Restaurants cannot reach Consumer screens ✅
- Kirana partners cannot reach Restaurant screens ✅

## Server-side enforcement (defense in depth)
The role gate above is client convenience; **the backend remains the source of
truth**. Every role-specific endpoint already checks `user["role"]` (e.g. admin
routes `if user.role != "admin": 403`; rider wallet `if role != "delivery"`).
The JWT carries the role, so even a tampered client can't call another role's
API. Keep this — never rely on the client gate alone.

## Recommended hardening (follow-ups)
1. **Lock the auth flow to the app's role.** Each app's `(auth)/register` should
   pass its fixed role (rider app registers riders only) instead of a role picker,
   and `login` should reject a session whose role ≠ APP_ROLE before storing it.
2. **Scope push tokens per app** so a notification meant for a rider never lands
   in the consumer app (distinct Firebase app per package name already enforces this).
3. **Per-app deep-link schemes** (`shinitzrider://` …) prevent one app from
   handling another's links.
4. Continue using `expo-secure-store` for the token in every app (already shared
   via core).

## Status
- ✅ Separate packages + storage sandboxes
- ✅ Client role-gate per app
- ✅ Backend role checks already in place
- ⬜ Auth-flow role lock (follow-up #1 above)
