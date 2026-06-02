# OVERHAUL_SPEC.md - Multi-Source Design Token Extraction Report

## Overview

This document summarizes the design-token extraction from **three Figma source files**, their merge strategy, and the resulting dual-theme token system for the Fitleus fitness app.

---

## Source Files

| # | File | Key | Named Styles | Extraction Method |
|---|------|-----|-------------|-------------------|
| 1 | Fitleus - Fitness Mobile App UI Kit | `qDQfQ2a21AfgxcqWrBk5Ya` | 95 (51 FILL, 40 TEXT, 4 EFFECT) | styles-map + node-resolution |
| 2 | Free Fitness App UI Kit (Community) | `kdpHT75MhQdS0iF2OPKYZ4` | 61 (25 FILL, 12 TEXT, 0 EFFECT) | styles-map + node-resolution |
| 3 | Gofit - Fitness & Workout App UI Kit | `1ny3185B0kFt9sR4TkZx9P` | 0 (community file) | document-tree walk (25 unique colors) |

---

## Extraction Summary

### Colors

**Fitleus** (primary source - 51 named color styles):
- `Ink/*` (6 shades): neutral dark tones for text/icons
- `Sky/*` (6 shades): neutral light tones for backgrounds/borders
- `Text/*` (6 shades): semantic text colors
- `Brand/*` (5 shades): primary brand blue (`#4564EE`)
- `Blue/*` (5 shades): accent blue (`#2EC0F9`)
- `Red/*` (5 shades): error/danger (`#FF1654`)
- `Green/*` (5 shades): success (`#23C16B`)
- `Yellow/*` (5 shades): warning (`#FFD639`)
- `Primary/*` (1): purple primary (`#6B4EFF`)
- `Fuschia/100`: accent pink (`#EF5DA8`)
- `Vivid Sky Blue/Base`: highlight cyan (`#36D3F5`)
- `3rd Party/Facebook/*`, `3rd Party/Twitter/*`: social brand colors
- `Grayscale/Black`: pure black (`#000000`)

**Free Fitness** (supplementary - 25 color styles):
- `Colors/Black/*`: dark theme base (`#040415`)
- `Colors/White/*`: light/overlay whites
- `Colors/Orange/100%`: vibrant orange (`#F15223`)
- `Colors/Gold/100%`: gold accent (`#FFB432`)
- `Colors/Pink/100%`: soft pink (`#FF7D7D`)
- `Colors/Purple/100%`: deep purple (`#5041AB`)
- `Colors/Cyan/100%`: teal accent (`#69E0C7`)
- `Colors/Navy-blue/100%`: dark navy (`#161626`)
- `Colors/Gray/*`: neutral grays
- `Socials/Facebook`, `Socials/Instagram`: social brand colors
- 8 gradient styles (not mapped to flat tokens)

**Gofit** (accent palette - 25 unique colors by frequency):
- Primary: `#304FFE` (121 uses)
- White: `#FFFFFF` (100 uses)
- Dark neutrals: `#212121`, `#35383F`, `#1F222A`, `#181A20`
- Accent yellow: `#FFD300` (19 uses)
- Accent purple: `#6842FF` (14 uses)

### Typography

**Fitleus** (40 text styles - Rubik font family):

| Scale | Size | Weights | Line Heights |
|-------|------|---------|-------------|
| Heading 1 | 36px | Bold | 36-48px |
| Heading 2 | 28px | Bold | 28-36px |
| Heading 3 | 24px | Bold, Medium | 24-32px |
| Large | 18px | Regular, Medium, Bold | 18-24px |
| Regular | 16px | Regular, Medium, Bold | 16-24px |
| Small | 14px | Regular, Medium, Bold | 14-20px |
| XSmall | 12px | Regular, Medium, Bold | 12-16px |

Naming convention: `{size}_{lineHeight}_{weight}` (e.g., `small_tight_regular`)

**Free Fitness** (12 text styles):
- Headlines: Circular Std Bold, 12-36px
- Paragraphs: Circular Std Regular, 12-18px
- Additional: Roboto Bold/Regular, 16-28px

### Effects (Shadows)

**Fitleus** (4 effect styles):

| Name | Type | Color | Offset | Radius | Spread |
|------|------|-------|--------|--------|--------|
| Shadow/Large | DROP_SHADOW | #2326321A | (0, 12) | 40 | 0 |
| Shadow/Large (2nd) | DROP_SHADOW | #2326320D | (0, 4) | 12 | 0 |
| Shadow/Small | DROP_SHADOW | #23263214 | (0, 2) | 4 | 0 |
| Shadow/Small (2nd) | DROP_SHADOW | #23263214 | (0, 1) | 2 | 0 |

---

## Merge Strategy

1. **Fitleus is the primary source** - all 51 color tokens, 40 typography tokens, and 4 shadow tokens are included directly.
2. **Free Fitness adds supplementary colors** - Orange, Gold, Pink, Cyan, Navy, Gray, and Social brand colors are merged into the palette where they don't conflict with Fitleus names.
3. **Free Fitness typography** is prefixed with `ff_` to avoid conflicts with Fitleus type scale (different font families: Circular Std / Roboto vs Rubik).
4. **Gofit accent colors** are namespaced under `gofit.*` for the dark-theme palette elements already used in the codebase (PR #9 dark-navy migration).
5. **Dark theme** is derived by inverting semantic scales (background, surface, text, ink, sky, grayscale) while preserving brand/accent hues.
6. **Backward compatibility**: `export const colors = lightColors` ensures existing imports continue to work.

---

## Generated Files

| File | Description | Size |
|------|------------|------|
| `theme/tokens.ts` | Updated TypeScript module with `lightColors`, `darkColors`, `typography`, `shadows`, `spacing`, `radius`, `themes`, `tokens` exports | ~14KB |
| `figma-tokens/gofit_tokens.json` | Raw Gofit color palette (25 colors with frequency) | ~2KB |
| `figma-tokens/fitleus_tokens.json` | Structured Fitleus tokens (51 colors, 40 typography, 4 effects) | ~10KB |
| `figma-tokens/free_fitness_tokens.json` | Structured Free Fitness tokens (25 colors, 12 typography) | ~3KB |
| `figma-tokens/merged_summary.json` | Combined summary of all three sources | ~15KB |

---

## Theme Architecture

```
theme/tokens.ts
  export const lightColors = { ... } as const;
  export const darkColors  = { ... } as const;
  export const colors      = lightColors;          // backward compat
  export const typography  = { ... } as const;
  export const shadows     = { ... } as const;
  export const spacing     = { ... } as const;
  export const radius      = { ... } as const;
  export type ThemeColors  = typeof lightColors;
  export type ThemeName    = 'light' | 'dark';
  export const themes      = { light: lightColors, dark: darkColors };
  export const tokens      = { colors, darkColors, typography, ... };
```

### ThemeProvider Integration

The existing `theme/ThemeProvider.tsx` can be updated to consume `themes` and `ThemeName`:

```tsx
import { themes, ThemeName, ThemeColors } from './tokens';

const ThemeContext = createContext<{
  theme: ThemeName;
  colors: ThemeColors;
  setTheme: (t: ThemeName) => void;
}>({ theme: 'light', colors: themes.light, setTheme: () => {} });
```

---

## Next Steps

1. **Update ThemeProvider** to use `themes[themeName]` instead of hardcoded `colors`.
2. **Run codemod** to replace remaining hardcoded hex values with tokens from the new groups (orange, gold, pink, cyan, navy, socials).
3. **Map FreeFitness gradient styles** to React Native `LinearGradient` configurations if gradient components are needed.
4. **Verify dark theme** contrast ratios meet WCAG 2.1 AA (4.5:1 for text, 3:1 for UI elements).
5. **Remove legacy-color-map** references once all screens consume tokens via ThemeProvider.
