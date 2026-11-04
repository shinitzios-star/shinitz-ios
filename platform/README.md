# Shinitz Platform (monorepo)

Independent Consumer, Rider, Restaurant, Kirana (+ Admin) apps sharing one
controlled `@shinitz/shared-core` package. Each app builds its own APK with its
own package name.

```
apps/{consumer,rider,restaurant,kirana,admin}   # 5 independent Expo apps
packages/shared-core                            # the ONLY shared code
```

## Run an app (after `yarn install`)
```
yarn consumer        # or rider / restaurant / kirana / admin
yarn build:rider     # independent APK
```

## Docs
- [01 — Architecture](docs/01-ARCHITECTURE.md) (folder structure · dependency map · separation)
- [02 — Security audit](docs/02-SECURITY-AUDIT.md)
- [03 — Performance](docs/03-PERFORMANCE.md)
- [04 — Migration checklist](docs/04-MIGRATION-CHECKLIST.md) ← **remaining work to make each app build**

> Status: foundation + shared-core + per-app scaffolds (distinct package names,
> icons, splash, role-gated entries) are in place. The legacy single app at
> `D:\shinitz\app\frontend` is untouched and still ships. Completing each app
> (import rewrites → `@shinitz/shared-core`, per-app deps/EAS/Firebase, branding,
> independent build) follows the migration checklist.
