# Running Zown HQ in Expo Go

## Prerequisites
- Node.js 18+
- Expo Go app installed on your iPhone ([App Store](https://apps.apple.com/app/expo-go/id982107779))

## Steps

### 1. Clone and install
```bash
git clone https://github.com/cwright2255/rork-zown-hq-fitness-app-clone.git
cd rork-zown-hq-fitness-app-clone/expo
npm install --legacy-peer-deps
```

### 2. Copy env file
```bash
cp .env.example .env
```
All Firebase and Spotify values are pre-filled — no changes needed.

### 3. Start with tunnel
```bash
npx expo start --tunnel
```
Scan the QR code with **Expo Go** on your iPhone.

### 4. Or start on local network (faster)
```bash
npx expo start
```
Your phone must be on the same Wi-Fi as your computer.

## Features in Expo Go vs Dev Client

| Feature | Expo Go | Dev Client |
|---|---|---|
| All UI + Navigation | ✅ | ✅ |
| Firestore reads/writes | ✅ | ✅ |
| Firebase email/password auth | ✅ | ✅ |
| Spotify OAuth + Web API | ✅ | ✅ |
| AI Coach (Cloud Functions) | ✅ | ✅ |
| Google Sign-In | ❌ Shows friendly message | ✅ |
| Apple Sign-In | ❌ Shows friendly message | ✅ |
| Crashlytics | ❌ Silent no-op | ✅ |
| Push notifications | ❌ | ✅ |

## Build a Dev Client (full native features)
```bash
npm install -g eas-cli
eas login
eas build --platform ios --profile development
```

## ROOK Wearables (Apple Health / Health Connect)
ROOK wearables sync requires a dev client build — it is a no-op in Expo Go.
The `WearablesCard` component will show a message explaining this when running in Expo Go.

To enable full wearables support, build a dev client:
```bash
eas build --platform ios --profile development
```

ROOK Sandbox credentials are pre-configured. Visit [clients.portal.tryrook.io](https://www.clients.portal.tryrook.io/) to generate Production credentials when ready.
