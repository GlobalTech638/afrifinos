# AfriFinos Mobile

Expo + React Native application for Android, iOS and web.

## Requirements

- Node.js 22.13+
- npm
- A configured Supabase project and a running AfriFinos API

## Setup

```bash
cd apps/mobile
cp .env.example .env
npm install
npx expo install --fix
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar
npx expo install react-native-web react-dom
npm run start
```

Set the public environment values in `.env`:

- `EXPO_PUBLIC_API_URL`: AfriFinos API origin. On a physical device, use your computer's LAN IP or a deployed HTTPS URL rather than `localhost`.
- `EXPO_PUBLIC_SUPABASE_URL`: Supabase project URL.
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Supabase publishable/anon key. Never use a service-role key in a mobile app.

Run `npm run android`, `npm run ios`, or `npm run web` for the respective target.

## Screens

- Sign in / sign up
- Home dashboard and financial health
- Transaction history and transaction creation
- Accounts and account creation
- Financial intelligence, forecast, signals and recurring commitments
- Profile and session security

The app uses the existing authenticated API endpoints: `/accounts`, `/transactions`, and `/financial/intelligence`. Features without backend endpoints (for example budget editing and savings-goal management) are intentionally not simulated in the UI.

## Monorepo note

The native app is excluded from the root pnpm workspace so its Expo SDK dependency graph can be installed and locked independently with npm. The existing backend/web pnpm workspace and lockfile remain unchanged.
