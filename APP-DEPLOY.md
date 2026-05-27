# Tectostress — Native App Deployment Guide

This guide covers everything needed to build and deploy the Tectostress app as a
native iOS or Android application using [Capacitor](https://capacitorjs.com/).

---

## Architecture overview

```
src/  (React/TypeScript)
  └─ webpack build ──► dist/  (static web bundle)
                          └─ cap sync ──► ios/   (Xcode project)
                                         android/ (Android Studio project)
```

The web app is built once with webpack, then Capacitor copies the output into
the native project shells. You never edit the native projects directly — only
the `src/` source and the Capacitor config.

---

## 1. Prerequisites

### All platforms

| Tool | Required version | Install |
|------|-----------------|---------|
| Node.js | ≥ 18 | https://nodejs.org |
| npm | ≥ 9 | bundled with Node |

Clone the repo and install dependencies:

```bash
git clone https://github.com/alfredicus/tectostress.git
cd tectostress
npm install
```

---

### iOS (macOS only)

| Tool | Required version | Notes |
|------|-----------------|-------|
| macOS | Ventura 13+ | Required by Xcode 16 |
| Xcode | 16+ | Free on Mac App Store |
| Xcode Command Line Tools | matching Xcode | `xcode-select --install` |
| Apple Developer account | Free or paid | Free = sideload only; Paid = App Store + TestFlight |

After installing Xcode, accept the licence:

```bash
sudo xcodebuild -license accept
```

iOS deployment target: **iOS 15.0+**

---

### Android

| Tool | Required version | Install |
|------|-----------------|-------|
| Android Studio | Ladybug (2024.2) or newer | https://developer.android.com/studio |
| JDK | 17 (bundled with Android Studio) | |
| Android SDK | API 36 (compile), API 24 min | installed via Android Studio SDK Manager |

SDK versions used by this project:

```
minSdkVersion     = 24   (Android 7.0)
compileSdkVersion = 36
targetSdkVersion  = 36
```

---

## 2. Standard build workflow

Every time you modify the source code, follow this two-step process:

### Step 1 — Build the web bundle

```bash
npm run build
```

Output goes to `dist/`. This is the bundle that both native platforms use.

### Step 2 — Sync to native projects

```bash
npx cap sync
```

This copies `dist/` into both `ios/` and `android/` and updates native plugin
configurations. Run this after every `npm run build`.

To sync only one platform:

```bash
npx cap sync ios
npx cap sync android
```

---

## 3. iOS — Build and deploy

### 3a. Open the project in Xcode

```bash
npx cap open ios
```

This opens `ios/App/App.xcodeproj` in Xcode.

### 3b. First-time: resolve Swift packages

In Xcode: **File → Packages → Resolve Package Versions**

This downloads `capacitor-swift-pm`, `ion-ios-camera`, and `ion-ios-geolocation`
from GitHub. Requires an internet connection. Only needed once (or after
`npm install` of new Capacitor plugins).

### 3c. Select a target device

In the toolbar at the top of Xcode, click the device/simulator selector:

- **Simulator** — any iPhone listed under *iOS Simulators*
  (sensors unavailable in simulator; GPS can be simulated via
  **Debug → Simulate Location**)
- **Physical device** — your iPhone, connected via USB or wireless

### 3d. Configure signing (required for physical device)

1. In the Project Navigator, click **App** (the root project)
2. Select the **App** target → **Signing & Capabilities**
3. Check **Automatically manage signing**
4. Set **Team** to your Apple ID (add it under *Xcode → Settings → Accounts* if
   needed)
5. Change the **Bundle Identifier** if the default `com.geosciences.tectostress`
   is already taken on your account

Free accounts can sideload to personal devices (app expires after 7 days).
A paid developer account ($99/year) is required for App Store distribution.

### 3e. Build and run

```bash
# From terminal — builds and launches on the selected simulator
npx cap run ios

# Or press ⌘R inside Xcode
```

### 3f. Archive for App Store / TestFlight (paid account)

1. Set the scheme to **Any iOS Device (arm64)**
2. **Product → Archive**
3. In the Organizer window: **Distribute App → App Store Connect**
4. Follow the upload wizard

---

## 4. Android — Build and deploy

### 4a. Open the project in Android Studio

```bash
npx cap open android
```

This opens the `android/` folder as an Android Studio project.

### 4b. First-time: Gradle sync

Android Studio will automatically trigger a Gradle sync on first open.
If it doesn't, click **File → Sync Project with Gradle Files**.

### 4c. Select a target device

In the toolbar, click the device dropdown:

- **Virtual device (emulator)** — create one via **Device Manager** if none
  exists (recommended: Pixel 8, API 35)
- **Physical device** — connect via USB with USB debugging enabled
  (*Settings → Developer Options → USB Debugging*)

### 4d. Build and run

```bash
# From terminal
npx cap run android

# Or press ▶ (Shift+F10) inside Android Studio
```

### 4e. Generate a signed APK / AAB for distribution

1. **Build → Generate Signed Bundle / APK**
2. Choose **Android App Bundle** (.aab) for Play Store, or **APK** for direct
   install
3. Create or select a keystore file — **keep this file and its passwords safe**;
   you cannot update the app on the Play Store without it
4. Select the **release** build variant
5. Click **Finish**

Output location:
```
android/app/release/app-release.aab   # Play Store
android/app/release/app-release.apk   # Direct install (sideload)
```

To install an APK directly on a connected device:

```bash
adb install android/app/release/app-release.apk
```

---

## 5. Capacitor configuration

The main config file is `capacitor.config.ts` at the project root:

```typescript
{
  appId:   'com.geosciences.tectostress',
  appName: 'Tectostress',
  webDir:  'dist',          // webpack output directory
}
```

To change the app name or bundle ID, edit this file and re-run `npx cap sync`.

---

## 6. Native plugins installed

| Plugin | iOS | Android | Purpose |
|--------|-----|---------|---------|
| `@capacitor/camera` | ✓ | ✓ | Photo capture in Field tab |
| `@capacitor/geolocation` | ✓ | ✓ | GPS position in Field tab |
| `@capacitor/motion` | web API | web API | Sensor orientation (handled by `DeviceOrientationEvent` in the webview — no native plugin needed) |

iOS permissions are declared in `ios/App/App/Info.plist` (location, camera,
motion). Android permissions are in `android/app/src/main/AndroidManifest.xml`
(managed automatically by Capacitor).

---

## 7. Day-to-day development workflow

```bash
# 1. Edit source in src/
# 2. Build
npm run build

# 3. Sync to native
npx cap sync

# 4. Run on device/simulator
npx cap run ios        # or: open Xcode and press ⌘R
npx cap run android    # or: open Android Studio and press ▶

# Live reload during development (web only, no native sensors)
npm start
# → open http://localhost:8080 in browser
```

> **Sensor testing requires a physical device.** The iOS Simulator and Android
> Emulator do not provide accelerometer or magnetometer data, so the Field tab's
> orientation capture will show "Waiting for sensors…" on virtual devices.

---

## 8. Troubleshooting

| Problem | Fix |
|---------|-----|
| *Missing package product 'CapacitorX'* (Xcode) | Run `npx cap sync ios`, then **File → Packages → Resolve Package Versions** in Xcode |
| *Gradle sync failed* (Android Studio) | Check JDK version: must be 17. Set under **File → Project Structure → SDK Location** |
| *No provisioning profile* (iOS) | Set your team in Signing & Capabilities; for free accounts, register your device UDID at developer.apple.com |
| *App crashes on launch* (device) | Check Xcode console for Swift errors; most common cause is a missing permission string in Info.plist |
| Sensors read 0 / not available | Normal in simulators/emulators — test on a real device |
| `npm run build` fails | Run `npm install` first to ensure all packages are present |
