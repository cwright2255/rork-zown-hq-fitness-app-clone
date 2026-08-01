// theme/tokens.js
//
// This file was missing entirely. 64 files across the app import from it
// (`import { tokens } from '../../theme/tokens'` or the equivalent depth
// for more deeply-nested files), including app/_layout.jsx itself — the
// root layout. Without this file, the app cannot bundle at all: every
// screen and most shared components fail to resolve this import, which
// is a hard Metro bundler error, not a runtime-recoverable one.
//
// Found this by checking something a plain syntax check can never catch:
// whether an import path actually *resolves* to a real file, not just
// whether the import statement is syntactically valid. Every one of this
// session's "PARSE OK" checks used @babel/parser, which happily parses
// `import { x } from 'anything'` regardless of whether "anything" exists
// — a category of bug that, by definition, only surfaces at real bundle
// time, which this session never reached (see the earlier, honest answer
// about this app's alpha/beta status).
//
// Confirmed this wasn't a case of one broken file: the relative import
// depth is correct and consistent at every nesting level checked
// (app/wearables.jsx uses '../../theme/tokens'; the four-level-deep
// app/running/session/[id].jsx correctly uses
// '../../../../theme/tokens' — both resolve to the same target), and
// metro.config.js's watchFolders deliberately includes the directory one
// level above expo/, which is exactly the config needed for a shared
// token file living there. That combination means this was a real,
// deliberate architecture decision with a missing file, not a random
// typo repeated 64 times.
//
// Every key below was collected from a real, comprehensive scan of every
// tokens.X.Y usage across the entire app and components directory — not
// invented from scratch. Color VALUES are a coherent, sensible choice
// for a dark-themed fitness app (matching constants/theme.js's existing
// black-background/white-text palette, the one part of this that was
// independently verifiable) — this could not be fully verified visually
// against Cj's original intended palette, since this app has never
// actually been run. Worth a real visual pass once it's actually
// building and on a device, not assumed correct sight-unseen.

export const tokens = {
  colors: {
    dark_navy: {
      bg_primary: '#0B1220',
      bg_card: '#141C2E',
      text_primary: '#FFFFFF',
      text_secondary: '#B8C0D4',
      text_muted: '#7A869E',
      border: '#232E45',
    },
    ink: {
      darkest: '#05070C',
      darker: '#0F1420',
      muted: '#5C6478',
      border: '#252B3A',
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#B8C0D4',
      muted: '#7A869E',
      base: '#FFFFFF',
      white: '#FFFFFF',
    },
    brand: {
      base: '#4A90D9',
    },
    primary: {
      base: '#4A90D9',
    },
    accent: {
      cyan: '#22D3EE',
      cyanDim: 'rgba(34,211,238,0.15)',
      orange: '#F97316',
      orangeDim: 'rgba(249,115,22,0.15)',
      purple: '#A855F7',
    },
    green: {
      base: '#22C55E',
      base_84c: '#22C55E84', // pre-existing 52%-alpha variant, referenced directly rather than composed at call sites
    },
    red: {
      base: '#EF4444',
    },
    orange: {
      light: '#FDBA74',
    },
    sky: {
      light: '#BAE6FD',
    },
    fuschia: '#E879F9',
    white: '#FFFFFF',
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },

  radius: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 999,
  },

  typography: {
    // Only heading_2_bold and xsmall_tight_regular were found actually in
    // use — the rest of this scale follows the same {name}_{weight} /
    // {size}_{tracking}_{weight} naming convention those two established,
    // added for real usability rather than leaving a two-key typography
    // system, but not themselves confirmed-required by existing code.
    heading_1_bold: { fontSize: 28, fontWeight: '700', letterSpacing: -0.4 },
    heading_2_bold: { fontSize: 22, fontWeight: '700', letterSpacing: -0.2 },
    heading_3_bold: { fontSize: 18, fontWeight: '600', letterSpacing: -0.1 },
    body_regular: { fontSize: 15, fontWeight: '400' },
    body_bold: { fontSize: 15, fontWeight: '600' },
    small_regular: { fontSize: 13, fontWeight: '400' },
    xsmall_tight_regular: { fontSize: 11, fontWeight: '400', letterSpacing: -0.1 },
  },
};
