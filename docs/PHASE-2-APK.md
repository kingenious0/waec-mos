# Phase 2 — Android APK and iPhone/PWA

## What ships

- **Android (`org.waec.mos.field`)** — a signed Capacitor APK that loads the deployed web app and adds the native capabilities a browser cannot provide.
- **iPhone / other phones** — the same web app as an installable PWA. iPhone stays on the web path by decision; no iOS native build.

The APK is a thin native wrapper, not a second copy of the system. All authentication, data, arrival tiers, dwell rules, SOS handling and HQ flags stay on the server and in the shared TypeScript rules. Native code only streams GPS fixes and reports device signals.

## Build

```bash
npm install --legacy-peer-deps
npm run apk:release        # signed APK
# or
npm run apk:debug          # debug APK for field trial
```

Output:

- `android/app/build/outputs/apk/release/app-release.apk`
- `android/app/build/outputs/apk/debug/app-debug.apk`

A convenience copy of the signed build is placed at `artifacts/waec-field-v1.0.0.apk` (gitignored).

Requirements: JDK 21, Android SDK platform 36 + build-tools 36, and `ANDROID_HOME`/`local.properties`. Release signing reads `android/keystore.properties`, which is deliberately gitignored; supply your own managed keystore for Play distribution.

## Native capabilities

| Feature | Android APK | Web / iPhone PWA |
|---|---|---|
| Location while app is open | Yes | Yes |
| Location while app is backgrounded | Yes — foreground service with a persistent, visible notification | No — page must stay open |
| Mock-location flag per GPS fix | Yes (`Location.isFromMockProvider()`) | No |
| Device-integrity signals | Yes — developer options, ADB, root indicators, emulator, test keys | No |
| Arrival / departure decisions | Shared TypeScript rules | Shared TypeScript rules |

The foreground service streams raw fixes to the web app through a `FieldLocation` Capacitor plugin. The existing arrival engine decides solid vs weak arrival, dwell time, departure and HQ exceptions. Nothing is duplicated in Java.

Permissions are limited to what is used: coarse/fine location, foreground service + location foreground service, and notifications (Android 13+). There is no `ACCESS_BACKGROUND_LOCATION` request — the visible foreground service is what keeps tracking alive.

### Location permission fix

An earlier build could show **Location access required** without ever showing Android's permission dialog. Two mistakes caused it:

1. `FieldLocationPlugin` was registered **after** `super.onCreate()`. Capacitor creates the bridge and injects `window.Capacitor.Plugins` inside `super.onCreate()`, so the plugin was invisible to JavaScript and the first native call rejected before any permission request.
2. The field screen treated an empty/failed `getLastKnown()` cache read (normal on a fresh install) as a denial and skipped starting tracking.

The plugin is now registered before `super.onCreate()`. The screen performs a real permission preflight through Capacitor's Geolocation plugin, distinguishes **permission denied** from **phone Location switched off**, and can open the correct settings screen. Retry now rebuilds the whole watcher so the position listener is restored too.

Honesty rules:

- The field screen says plainly whether it is in **background-capable APK** mode or **web foreground-only** mode.
- Mock/integrity results are shown as advice, never as proof of attendance. Real Play Integrity would need a Google Cloud project and server-side token verification; that is not implemented here.
- Phone fixes and server receipt times remain separate, so a delayed upload is still labelled honestly.
- Loud SOS alarm still requires an explicit user gesture; native tracking does not unlock sound.

## iPhone / PWA

`app/manifest.ts` plus `app/layout.tsx` provide the installable web app metadata and Apple home-screen title. Location remains foreground-only and the field screen states this. Add to Home Screen from Safari gives a full-screen app with the same login and duty flow.

## Verification performed

- `npx tsc --noEmit` — clean
- `npm test` — 56 tests passing (includes native warning/mode rules)
- `npm run build` — passing
- `npx cap sync android` — passing
- `gradlew assembleDebug` and `assembleRelease` — `BUILD SUCCESSFUL`
- `apksigner verify` — signed, v2 scheme, 1 signer
- Packaged manifest inspected — service, location permissions and foreground-service type present
- Packaged config inspected — production server URL present
