# Shinitz mobile apps

The four Shinitz apps, each a standalone Expo (SDK 54) / React Native 0.81 project.

| Folder | App | Android package |
| --- | --- | --- |
| `consumer-app` | Shinitz (customers) | `com.shinitz.consumer` |
| `rider-app` | Shinitz Rider (delivery partners) | `com.shinitz.rider` |
| `restaurant-app` | Shinitz Restaurant (restaurant partners) | `com.shinitz.restaurant` |
| `kirana-app` | Shinitz Kirana | `com.shinitz.kirana` |
| `platform` | Monorepo scaffold (`shared-core`), not the code that ships | |

All apps talk to the Shinitz backend (`https://shinitz-backend.onrender.com`); the
backend is not part of this repository.

## Running an app

```bash
cd rider-app
npm install
cp .env.example .env   # then fill in the values (ask the Shinitz team)
npx expo start
```

## Not in this repository

- `.env` files: each app has a `.env.example` with the variable names.
- `google-services.json` (Firebase Android config).
- Signing keys, service-account keys, and AAB/APK builds.

## iOS

None of the apps has an `ios/` folder yet. Generate it with `npx expo prebuild -p ios`
or build with EAS (`eas build -p ios`). All four `app.json` files currently share the
iOS bundle identifier `com.shinitz.app`. Give each app its own identifier before
registering it in App Store Connect.
