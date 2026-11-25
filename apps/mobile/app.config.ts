import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * The app is generated from the store blueprint — same factory principle as the web:
 *   STORE=wissenswerk npx expo start       → "Wissenswerk" app, Wissenswerk colours & bundle ids
 *   STORE=mein-shop  eas build -p ios      → a different app from the same code
 * API location: EXPO_PUBLIC_API_URL (default http://localhost:4000; Android emulator: http://10.0.2.2:4000)
 */
const storeId = process.env.STORE ?? 'wissenswerk';
const storeDir = process.env.STORE_DIR ? resolve(process.env.STORE_DIR) : join(__dirname, '..', '..', 'stores', storeId);
const store = JSON.parse(readFileSync(join(storeDir, 'store.json'), 'utf8'));
const colors = store.theme?.colors ?? {};
const icon = join(storeDir, 'assets', 'app-icon.png');
const hasIcon = existsSync(icon);

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: store.name,
  slug: store.id,
  scheme: store.apps?.scheme ?? store.id,
  version: '1.0.0',
  orientation: 'default',
  userInterfaceStyle: 'automatic',
  icon: hasIcon ? icon : undefined,
  ios: {
    bundleIdentifier: store.apps?.ios?.bundleId ?? `com.example.${store.id.replace(/-/g, '')}`,
    supportsTablet: true,
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  android: {
    package: store.apps?.android?.package ?? `com.example.${store.id.replace(/-/g, '')}`,
    adaptiveIcon: { backgroundColor: colors.primary ?? '#1e3a8a', foregroundImage: hasIcon ? icon : undefined },
  },
  web: { bundler: 'metro', output: 'single', favicon: hasIcon ? icon : undefined, name: store.name, themeColor: colors.primary },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-web-browser',
    ['expo-splash-screen', { backgroundColor: colors.primary ?? '#1e3a8a', image: hasIcon ? icon : undefined, imageWidth: 160, resizeMode: 'contain' }],
  ],
  experiments: { typedRoutes: false },
  extra: {
    storeId: store.id,
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000',
    webUrl: process.env.EXPO_PUBLIC_WEB_URL ?? store.url ?? 'http://localhost:3000',
  },
});
