# Fitleus Light-Theme Migration

## Overview

This PR introduces the **Fitleus light-theme design-token scaffold** for the zown-hq Expo/React Native codebase. The app today uses a hardcoded dark palette (pure-black backgrounds with white/gray foregrounds). This PR does **not** change any component visuals â it only adds:

1. A typed token module (`theme/tokens.ts`) generated from the **Fitleus â Fitness Mobile App UI Kit** Figma file (`KHk1iWcXDRTCqY5mQhMYbE`).
2. A React Context `ThemeProvider` exposing those tokens via a `useTheme()` hook.
3. A legacy hex â token mapping for the audit-discovered colors.
4. This migration plan with a file-by-file checklist.

Component-level color replacements are **intentionally left out of this PR** so reviewers can validate the token shape first.

**Source Figma file:** https://www.figma.com/file/KHk1iWcXDRTCqY5mQhMYbE/

**Audit summary:** 1078 hardcoded color references across 82 files.

## Token reference

### Colors

| Token | Hex |
| --- | --- |
| `colors.3rd_party.facebook.base` | `#0078FF` |
| `colors.3rd_party.facebook.dark` | `#0067DB` |
| `colors.3rd_party.twitter.base` | `#1DA1F2` |
| `colors.3rd_party.twitter.dark` | `#0C90E1` |
| `colors.background.default` | `#FFFFFF` |
| `colors.blue.base` | `#2EC0F9` |
| `colors.blue.darkest` | `#1F83A9` |
| `colors.blue.light` | `#5ECEFA` |
| `colors.blue.lighter` | `#84DAFB` |
| `colors.blue.lightest` | `#D5F2FE` |
| `colors.brand.base` | `#4564EE` |
| `colors.brand.darkest` | `#3053EC` |
| `colors.brand.light` | `#5975F0` |
| `colors.brand.lighter` | `#6E87F2` |
| `colors.brand.lightest` | `#C3CCF4` |
| `colors.brand.primary` | `#3056F5` |
| `colors.fuschia.100` | `#EF5DA8` |
| `colors.grayscale.black` | `#000000` |
| `colors.green.base` | `#23C16B` |
| `colors.green.darkest` | `#198155` |
| `colors.green.light` | `#4CD471` |
| `colors.green.lighter` | `#7DDE86` |
| `colors.green.lightest` | `#ECFCE5` |
| `colors.ink.base` | `#404446` |
| `colors.ink.dark` | `#303437` |
| `colors.ink.darker` | `#202325` |
| `colors.ink.darkest` | `#090A0A` |
| `colors.ink.light` | `#6C7072` |
| `colors.ink.lighter` | `#72777A` |
| `colors.primary.base` | `#6B4EFF` |
| `colors.red.base` | `#FF1654` |
| `colors.red.darkest` | `#AD0F39` |
| `colors.red.light` | `#FF4C7B` |
| `colors.red.lighter` | `#FF769A` |
| `colors.red.lightest` | `#FFD0DD` |
| `colors.sky.base` | `#CDCFD0` |
| `colors.sky.dark` | `#979C9E` |
| `colors.sky.light` | `#E3E5E5` |
| `colors.sky.lighter` | `#F2F4F5` |
| `colors.sky.lightest` | `#F7F9FA` |
| `colors.sky.white` | `#FFFFFF` |
| `colors.surface.default` | `#F5F6F8` |
| `colors.text.base` | `#6D7289` |
| `colors.text.dark` | `#595D78` |
| `colors.text.darker` | `#444967` |
| `colors.text.darkest` | `#2F3556` |
| `colors.text.light` | `#82869A` |
| `colors.text.lighter` | `#979AAA` |
| `colors.vivid_sky_blue.base` | `#36D3F5` |
| `colors.yellow.base` | `#FFD639` |
| `colors.yellow.darkest` | `#AD9227` |
| `colors.yellow.light` | `#FFDF67` |
| `colors.yellow.lighter` | `#FFE78A` |
| `colors.yellow.lightest` | `#FFF7D7` |


### Typography (40 styles)

Imported verbatim from Figma TEXT styles. See `theme/tokens.ts` for the full list. Each entry:

```ts
{ fontFamily: string, fontSize: number, fontWeight: number, lineHeight: number, letterSpacing: number }
```

### Spacing (defaults)

```ts
{ xs: 4, sm: 8, md: 12, lg: 16, xl: 24, '2xl': 32, '3xl': 48 }
```

### Radius (defaults)

```ts
{ none: 0, sm: 4, md: 8, lg: 12, xl: 16, full: 9999 }
```

### Shadows (4 entries)

React Native-shaped: `{ shadowColor, shadowOffset, shadowOpacity, shadowRadius, elevation }`. See `theme/tokens.ts`.

## Top hardcoded hex values

| Hex | Occurrences | Suggested token |
| --- | --- | --- |
| `#FFF` | 176 | `colors.background.default` |
| `#2A2A2A` | 119 | `_review_` |
| `#999` | 101 | `_review_` |
| `#FFFFFF` | 96 | `colors.background.default` |
| `#1A1A1A` | 86 | `colors.ink.darker` |
| `#000` | 83 | `colors.grayscale.black` |
| `#999999` | 45 | `_review_` |
| `#1DB954` | 24 | `_review_` |
| `#666` | 22 | `_review_` |
| `#000000` | 22 | `colors.grayscale.black` |
| `#22C55E` | 15 | `_review_` |
| `#666666` | 13 | `_review_` |
| `#333` | 12 | `_review_` |
| `#F59E0B` | 9 | `_review_` |
| `#EF4444` | 9 | `_review_` |
| `#00FF88` | 9 | `_review_` |
| `#F97316` | 8 | `_review_` |
| `#3B82F6` | 7 | `_review_` |
| `#FF6B6B` | 6 | `_review_` |
| `#333333` | 6 | `_review_` |
| `#A855F7` | 5 | `_review_` |
| `#6366F1` | 5 | `_review_` |
| `#4CAF50` | 4 | `_review_` |
| `#8B5CF6` | 4 | `_review_` |
| `#10B981` | 4 | `_review_` |
| `#007AFF` | 4 | `_review_` |
| `#43D9AD` | 4 | `_review_` |
| `#E74C3C` | 3 | `_review_` |
| `#111` | 3 | `colors.ink.darker` |
| `#F5F5F5` | 3 | `_review_` |


## How to use

```tsx
import { ThemeProvider, useTheme } from './theme/ThemeProvider';

// Wrap your app root
export default function App() {
  return (
    <ThemeProvider>
      <RootNavigator />
    </ThemeProvider>
  );
}

// Use anywhere
function MyButton() {
  const { colors, spacing, radius } = useTheme();
  return (
    <View style={{
      backgroundColor: colors.brand.primary,
      padding: spacing.md,
      borderRadius: radius.md,
    }}>
      <Text style={{ color: colors.background.default }}>Click me</Text>
    </View>
  );
}
```

For old hex literals, look them up in `theme/legacy-color-map.ts` â entries marked `TODO_REVIEW` need a reviewer to choose the right Fitleus token.

## File-by-file migration checklist

Generated from STEP 3 audit at base SHA `fd06ef4`. Each item lists the count of color references found by regex. Replace hardcoded hex/rgb values with `useTheme()` token references.

#### Example before/after

```tsx
// Before
<View style={{ backgroundColor: '#000', padding: 16 }} />
<Text style={{ color: '#FFF' }}>Hello</Text>

// After
const { colors, spacing } = useTheme();
<View style={{ backgroundColor: colors.background.default, padding: spacing.lg }} />
<Text style={{ color: colors.text.darkest }}>Hello</Text>
```


### expo/app/+not-found.jsx

- [ ] `expo/app/+not-found.jsx` â 1 color reference

### expo/app/_layout.jsx

- [ ] `expo/app/_layout.jsx` â 5 color references

### expo/app/analytics.jsx

- [ ] `expo/app/analytics.jsx` â 2 color references

### expo/app/auth

- [ ] `expo/app/auth/register.jsx` â 3 color references

### expo/app/badges.jsx

- [ ] `expo/app/badges.jsx` â 10 color references

### expo/app/champion-pass.jsx

- [ ] `expo/app/champion-pass.jsx` â 20 color references

### expo/app/community.jsx

- [ ] `expo/app/community.jsx` â 21 color references

### expo/app/exp-dashboard.jsx

- [ ] `expo/app/exp-dashboard.jsx` â 23 color references

### expo/app/health-assessment.jsx

- [ ] `expo/app/health-assessment.jsx` â 12 color references

### expo/app/hq.jsx

- [ ] `expo/app/hq.jsx` â 3 color references

### expo/app/leaderboard.jsx

- [ ] `expo/app/leaderboard.jsx` â 24 color references

### expo/app/messaging.jsx

- [ ] `expo/app/messaging.jsx` â 25 color references

### expo/app/mood-tracking.jsx

- [ ] `expo/app/mood-tracking.jsx` â 18 color references

### expo/app/notifications.jsx

- [ ] `expo/app/notifications.jsx` â 14 color references

### expo/app/nutrition

- [ ] `expo/app/nutrition/barcode-scan.jsx` â 19 color references
- [ ] `expo/app/nutrition/food/[id].jsx` â 29 color references
- [ ] `expo/app/nutrition/scan.jsx` â 5 color references
- [ ] `expo/app/nutrition/search.jsx` â 17 color references

### expo/app/nutrition.jsx

- [ ] `expo/app/nutrition.jsx` â 28 color references

### expo/app/onboarding.jsx

- [ ] `expo/app/onboarding.jsx` â 1 color reference

### expo/app/order-tracking.jsx

- [ ] `expo/app/order-tracking.jsx` â 25 color references

### expo/app/profile

- [ ] `expo/app/profile/body-scan.jsx` â 2 color references
- [ ] `expo/app/profile/progress.jsx` â 1 color reference
- [ ] `expo/app/profile/settings.js` â 1 color reference

### expo/app/profile.jsx

- [ ] `expo/app/profile.jsx` â 96 color references

### expo/app/recipe

- [ ] `expo/app/recipe/[id].jsx` â 22 color references

### expo/app/recipes.jsx

- [ ] `expo/app/recipes.jsx` â 18 color references

### expo/app/rook-connect.jsx

- [ ] `expo/app/rook-connect.jsx` â 6 color references

### expo/app/running

- [ ] `expo/app/running/program/[id].jsx` â 17 color references
- [ ] `expo/app/running/session/[id].jsx` â 4 color references

### expo/app/shop

- [ ] `expo/app/shop/cart.jsx` â 21 color references
- [ ] `expo/app/shop/category/[category].jsx` â 3 color references
- [ ] `expo/app/shop/collection/[id].jsx` â 7 color references
- [ ] `expo/app/shop/product/[id].jsx` â 21 color references

### expo/app/shop.jsx

- [ ] `expo/app/shop.jsx` â 14 color references

### expo/app/spotify-callback.jsx

- [ ] `expo/app/spotify-callback.jsx` â 1 color reference

### expo/app/spotify-integration.jsx

- [ ] `expo/app/spotify-integration.jsx` â 13 color references

### expo/app/spotify-test.jsx

- [ ] `expo/app/spotify-test.jsx` â 12 color references

### expo/app/start.js

- [ ] `expo/app/start.js` â 2 color references

### expo/app/support.jsx

- [ ] `expo/app/support.jsx` â 8 color references

### expo/app/telehealth.jsx

- [ ] `expo/app/telehealth.jsx` â 20 color references

### expo/app/wearables.jsx

- [ ] `expo/app/wearables.jsx` â 12 color references

### expo/app/wellbeing.jsx

- [ ] `expo/app/wellbeing.jsx` â 14 color references

### expo/app/workout

- [ ] `expo/app/workout/[id].jsx` â 10 color references
- [ ] `expo/app/workout/active.jsx` â 158 color references
- [ ] `expo/app/workout/create.jsx` â 2 color references

### expo/app/workouts.jsx

- [ ] `expo/app/workouts.jsx` â 1 color reference

### expo/backend/hono.js

- [ ] `expo/backend/hono.js` â 5 color references

### expo/backend/trpc

- [ ] `expo/backend/trpc/routes/admin/router.js` â 2 color references

### expo/components/BadgeItem.jsx

- [ ] `expo/components/BadgeItem.jsx` â 5 color references

### expo/components/Button.js

- [ ] `expo/components/Button.js` â 1 color reference

### expo/components/Button.jsx

- [ ] `expo/components/Button.jsx` â 1 color reference

### expo/components/ChampionPassTier.jsx

- [ ] `expo/components/ChampionPassTier.jsx` â 1 color reference

### expo/components/EventCreationModal.jsx

- [ ] `expo/components/EventCreationModal.jsx` â 1 color reference

### expo/components/ExpActivityList.jsx

- [ ] `expo/components/ExpActivityList.jsx` â 1 color reference

### expo/components/ExpBreakdownChart.jsx

- [ ] `expo/components/ExpBreakdownChart.jsx` â 5 color references

### expo/components/GoalSettingModal.jsx

- [ ] `expo/components/GoalSettingModal.jsx` â 1 color reference

### expo/components/HamburgerMenu.js

- [ ] `expo/components/HamburgerMenu.js` â 3 color references

### expo/components/MetricCard.jsx

- [ ] `expo/components/MetricCard.jsx` â 12 color references

### expo/components/NutritionSummary.jsx

- [ ] `expo/components/NutritionSummary.jsx` â 9 color references

### expo/components/PrimaryButton.jsx

- [ ] `expo/components/PrimaryButton.jsx` â 5 color references

### expo/components/ProductCard.jsx

- [ ] `expo/components/ProductCard.jsx` â 7 color references

### expo/components/RecipeImportModal.jsx

- [ ] `expo/components/RecipeImportModal.jsx` â 1 color reference

### expo/components/RunningMap.jsx

- [ ] `expo/components/RunningMap.jsx` â 62 color references

### expo/components/RunningProgramCard.jsx

- [ ] `expo/components/RunningProgramCard.jsx` â 2 color references

### expo/components/ScheduleModal.jsx

- [ ] `expo/components/ScheduleModal.jsx` â 1 color reference

### expo/components/ScreenErrorBoundary.jsx

- [ ] `expo/components/ScreenErrorBoundary.jsx` â 5 color references

### expo/components/SpotifyEmbedPlayer.jsx

- [ ] `expo/components/SpotifyEmbedPlayer.jsx` â 12 color references

### expo/components/SpotifyMusicPlayer.jsx

- [ ] `expo/components/SpotifyMusicPlayer.jsx` â 19 color references

### expo/components/StreakCalendar.jsx

- [ ] `expo/components/StreakCalendar.jsx` â 4 color references

### expo/components/TimerModal.jsx

- [ ] `expo/components/TimerModal.jsx` â 1 color reference

### expo/components/WorkoutCard.jsx

- [ ] `expo/components/WorkoutCard.jsx` â 1 color reference

### expo/constants/colors.js

- [ ] `expo/constants/colors.js` â 38 color references

### expo/constants/theme.js

- [ ] `expo/constants/theme.js` â 44 color references

### expo/services/muscleVisualizerService.js

- [ ] `expo/services/muscleVisualizerService.js` â 1 color reference

### expo/src/components

- [ ] `expo/src/components/WearablesCard.jsx` â 2 color references
- [ ] `expo/src/components/ui/BottomSheet.jsx` â 1 color reference
- [ ] `expo/src/components/ui/Card.jsx` â 1 color reference
- [ ] `expo/src/components/ui/Modal.jsx` â 1 color reference

### expo/src/constants

- [ ] `expo/src/constants/tokens.js` â 14 color references

### expo/store/analyticsStore.js

- [ ] `expo/store/analyticsStore.js` â 4 color references

### expo/tailwind.config.js

- [ ] `expo/tailwind.config.js` â 14 color references


## Open questions for reviewers

- The Figma file has a `Brand/Darkest` (`#3053EC`) and we also added the requested `brand.primary` (`#3056F5`). Pick one as the canonical primary and remove the other.
- `Primary/Base` (`#6B4EFF`) overlaps semantically with `Brand/*`. Confirm whether this is a separate accent or should be merged.
- Spacing & radius scales are placeholders (no Figma styles named `spacing/*` or `radius/*`). Confirm or replace with values from your design lead.
- 75+ unique hex codes appeared in the audit. Many will need manual mapping â reviewers should walk `theme/legacy-color-map.ts` and resolve each `TODO_REVIEW`.
- Figma local-variables endpoint returned **403 Forbidden** (`file_variables:read` scope unavailable on this PAT). If the file uses Figma Variables, run extraction again with an Enterprise-scoped token.

---

_Generated automatically by the Twin Fitleus migration agent._
