# Testing the website, iOS and Android apps on your laptops

Your hardware: Lenovo i5-7300U / 16 GB (moving to Linux), an older NVIDIA laptop (Linux Mint), a
storage laptop. **No Mac.** That decides what is possible.

## What is normally used

| Tool | What it is | Runs on | Cost | Fits your hardware? |
|---|---|---|---|---|
| **Expo Go** (app on your phone) | Runs the app's JavaScript on a real iPhone or Android phone, reloads instantly when code changes | any laptop + your phone | free | **Yes: the main way to test** |
| **Android Emulator** (Android Studio) | Virtual Android phone on the laptop | Linux, Windows, Mac | free | Works, but slow on a 2-core CPU; needs KVM on Linux |
| **iOS Simulator** (Xcode) | Virtual iPhone | **macOS only** | free | No (no Mac) |
| **EAS Build** (Expo cloud) | Builds real `.apk`/`.aab` (Android) and `.ipa` (iOS) in the cloud, no Mac needed | browser/CLI | free tier with monthly build quota | **Yes: for installable builds and stores** |
| **Web preview** | The same app in a browser (`expo start --web`) | any | free | Yes: fastest check, but not a real phone |
| Apple Developer / Google Play accounts | Needed to publish to stores (and for iOS installs outside Expo Go) | – | USD 99/yr / USD 25 once | Only when releasing |

**Recommended for you:** develop on the Lenovo, test on your own phone with Expo Go, use the web
preview for quick checks, and use EAS Build when you want an installable app or a store release.

## 1. Website (any laptop)
```bash
cd apps/zainlabs/web
npm install
npm run dev            # open http://localhost:3000
```

## 2. App on your phone with Expo Go (iPhone or Android)
1. Install **Expo Go** from the App Store / Google Play.
2. Laptop and phone on the same Wi-Fi.
3. Find the laptop's IP: `hostname -I` (Linux) → e.g. `192.168.1.20`.
4. Start the website (step 1) so the app can sync content and send contact requests.
5. Start the app:
   ```bash
   cd apps/zainlabs/mobile
   npm install
   echo "EXPO_PUBLIC_API_URL=http://192.168.1.20:3000" > .env   # your IP
   npx expo start
   ```
6. Scan the QR code: Android with Expo Go, iPhone with the Camera app.
   If the network blocks it, use `npx expo start --tunnel`.

Note: Expo Go supports the newest Expo SDK. If the store version of Expo Go is older than the SDK in
`package.json` (58), it will say so; then use a development build (step 4).

## 3. Android emulator (optional)
Install Android Studio → Device Manager → create a Pixel device → start it, then press `a` in the
`npx expo start` terminal. On Linux enable KVM (`sudo apt install qemu-kvm`, add your user to the `kvm`
group). Expect it to be slow on the i5-7300U; a real phone is faster.

## 4. Installable builds without a Mac (EAS)
```bash
npm i -g eas-cli
cd apps/zainlabs/mobile
eas login                       # free Expo account
eas build:configure
eas build --platform android --profile preview   # .apk you can install directly
eas build --platform ios --profile preview       # needs an Apple Developer account
```
Store release: `eas submit --platform android|ios`.

## 5. Everything at once (what agents run)
```bash
scripts/verify.sh      # Python tests, Mahn-Agent tests, website build, app typecheck + web export
```

## Mahn-Agent (backend product)
```bash
cd apps/mahn-agent && make install && make demo        # http://localhost:8000
docker compose up --build                               # + Postgres + Mailpit on :8025
```
