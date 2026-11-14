# AfriFinos Mobile

Expo + React Native application for Android and iOS. The existing Next.js application remains the web client.

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
npm run start
```

Set the public environment values in `.env`:

- `EXPO_PUBLIC_API_URL`: AfriFinos API origin. On a physical device, use your computer's LAN IP or a deployed HTTPS URL rather than `localhost`.
- `EXPO_PUBLIC_SUPABASE_URL`: Supabase project URL.
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Supabase publishable/anon key. Never use a service-role key in a mobile app.

Run `npm run android` or `npm run ios` for the respective target. iOS simulator and device builds require macOS/Xcode or EAS Build; Android local builds require Android Studio/SDK. For iOS simulator and device builds, use macOS/Xcode or EAS Build; Android local builds require Android Studio/SDK.

## Screens

- Sign in / sign up
- Home dashboard and financial health
- Transaction history and transaction creation
- Accounts and account creation
- Financial intelligence, forecast, signals and recurring commitments
- Purchase affordability planner
- Profile and session security

Configure the API's JWT verifier to trust the same Supabase project used by the mobile app: set `JWT_ISSUER` to `https://<project-ref>.supabase.co/auth/v1`, `JWT_AUDIENCE` to `authenticated`, and `JWT_JWKS_URL` to `https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json` when using Supabase asymmetric signing keys. Confirm these values against your Supabase project's JWT settings before deployment. The mobile app sends the Supabase access token as a bearer token.\n\nThe app uses the existing authenticated API endpoints: `/accounts`, `/transactions`, and `/financial/intelligence`. Features without backend endpoints (for example budget editing and savings-goal management) are intentionally not simulated in the UI.

## Monorepo note

The native app is excluded from the root pnpm workspace so its Expo SDK dependency graph can be installed and locked independently with npm. The existing backend/web pnpm workspace and lockfile remain unchanged.


## Native builds with EAS

After configuring an Expo account and running `npx eas-cli login`:

```bash
npx eas-cli build --platform android --profile development
npx eas-cli build --platform android --profile preview
npx eas-cli build --platform ios --profile preview
npx eas-cli build --platform all --profile production
```

The GitHub Actions Android export validates the JavaScript bundle; EAS Build creates installable native artifacts. Store production signing credentials in EAS, not in this repository.
