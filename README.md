# Zown HQ Fitness App

Cross-platform React Native (Expo) fitness app with Firebase backend, Spotify integration, and OpenAI-powered AI Coach.

## Tech Stack

- **App**: React Native + Expo 54 (expo-router)
- **Language**: TypeScript
- **State**: Zustand
- **Backend**: Firebase (Auth, Firestore, Storage, Cloud Functions, Remote Config, Analytics, FCM)
- **Music**: Spotify Web API (OAuth 2.0 with PKCE)
- **AI**: OpenAI GPT-4o via Firebase Cloud Functions
- **Styling**: Design-token system + NativeWind preset
- **Animations**: react-native-reanimated v3
- **Testing**: Jest + React Native Testing Library

## Prerequisites

- Node 20+
- `bun` (preferred) or `npm`
- Expo CLI: `npm i -g expo-cli` (optional; use `npx expo` below)
- EAS CLI: `npm i -g eas-cli` (for builds)
- Firebase CLI: `npm i -g firebase-tools`

## Install

```bash
cd expo
bun install                        # or: npm install --legacy-peer-deps
cp .env.example .env               # fill in the blanks
```

## Environment Variables

| Variable | Scope | Description |
| --- | --- | --- |
| `EXPO_PUBLIC_FIREBASE_API_KEY` | client | Firebase Web API key from the Firebase Console |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | client | Defaults to `zown-3c512.firebaseapp.com` |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | client | Defaults to `zown-3c512` |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` | client | Defaults to `zown-3c512.firebasestorage.app` |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | client | Defaults to `431690627943` |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | client | From Firebase Console → Project Settings |
| `EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID` | client | From Firebase Console (optional) |
| `EXPO_PUBLIC_SPOTIFY_CLIENT_ID` | client | Already set to `cb884c0e045d4683bd3f0b38cb0e151e` |
| `EXPO_PUBLIC_SPOTIFY_REDIRECT_URI` | client | Production: `zownhq://spotify-callback` |
| `OPENAI_API_KEY` | **server-only** | Set via `firebase functions:secrets:set OPENAI_API_KEY` |
| `SPOTIFY_CLIENT_SECRET` | **server-only** | Set via `firebase functions:secrets:set SPOTIFY_CLIENT_SECRET` |

## Firebase Setup

The Firebase project `zown-3c512` already exists. The native config files (`expo/GoogleService-Info.plist` and `expo/google-services.json`) are **already included in the repo** — you do not need to download or place them manually.

1. Copy `.env.example` → `.env` in `expo/`. The real `EXPO_PUBLIC_FIREBASE_API_KEY` and `EXPO_PUBLIC_FIREBASE_APP_ID` are already pre-filled in `.env.example`; just copy the file and you're ready.
2. Enable sign-in methods in the Firebase Console → Authentication:
   - Email/Password
   - Google
   - Apple
3. Deploy Firestore rules + indexes:
   ```bash
   cd expo
   firebase deploy --only firestore:rules,firestore:indexes,storage
   ```
4. Set Cloud Function secrets and deploy:
   ```bash
   firebase functions:secrets:set OPENAI_API_KEY
   firebase functions:secrets:set SPOTIFY_CLIENT_SECRET
   cd functions && npm install && cd ..
   firebase deploy --only functions
   ```

## Spotify Setup

Client ID `cb884c0e045d4683bd3f0b38cb0e151e` is already registered. Add these redirect URIs in the Spotify Developer Dashboard:

- `zownhq://spotify-callback` (production / dev client)
- `https://auth.expo.io/@carlton.v.wright.jr/zown` (Expo Go proxy)

## Run

```bash
cd expo
npx expo start               # dev server (Expo Go compatible where possible)
npx expo start --ios         # iOS simulator
npx expo start --android     # Android emulator
```

## Build (EAS)

```bash
cd expo
eas build --platform ios --profile staging
eas build --platform android --profile staging
eas build --platform all --profile production
```

## Test

```bash
cd expo
npx jest
```

## Project Layout

```
expo/
├── app/                       # expo-router screens (existing)
├── src/
│   ├── components/ui/         # Button, Card, Input, Modal, BottomSheet, Avatar, ProgressBar, SkeletonLoader, ErrorState
│   ├── config/firebase.ts     # Firebase initialization
│   ├── constants/tokens.ts    # Design tokens (Colors, Spacing, Typography, Radius)
│   ├── constants/theme.ts     # Combined theme object
│   ├── hooks/                 # useAuth, useWorkouts, useGoals, useUserProfile, useAICoach, useSpotify
│   ├── navigation/linking.ts  # Deep-link config (zownhq://)
│   ├── services/
│   │   ├── auth.ts            # Firebase Auth (email, Google, Apple)
│   │   ├── spotify.ts         # Spotify OAuth PKCE + Web API
│   │   ├── analytics.ts       # Firebase Analytics (no-op in Expo Go)
│   │   ├── remoteConfig.ts    # Feature flags
│   │   └── notifications.ts   # FCM push token registration
│   ├── stores/                # Zustand stores
│   └── types/firestore.ts     # Firestore TS interfaces
├── functions/                 # Firebase Cloud Functions
│   └── src/index.ts           # generateWorkoutPlan, getProgressSummary, getNutritionRecommendations, refreshSpotifyToken, sendWorkoutReminder, onWorkoutComplete
├── __tests__/                 # Jest tests
├── firestore.rules
├── firestore.indexes.json
├── storage.rules
├── firebase.json
├── eas.json
├── tailwind.config.js
└── .env.example
```

## Deep Links

The app scheme is `zownhq`. Supported deep links:

- `zownhq://workout/:workoutId` — open a specific workout
- `zownhq://ai-coach/:recommendationId` — open an AI Coach recommendation
- `zownhq://profile` — open the profile screen
- `zownhq://spotify-callback` — Spotify OAuth redirect
