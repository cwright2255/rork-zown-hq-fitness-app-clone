# Fitleus UI Design Specification

Auto-generated from 10 reference screenshots scraped from the Fitleus Google Drive folder. This document maps each screen's visual structure to the theme tokens in `theme/tokens.ts` and inventories reusable UI patterns for component scaffolding.

## Overview

**Theme:** Dark navy/deep blue background with vibrant orange-red and cyan/teal accent colors. The Fitleus design language uses high-contrast card surfaces on dark backgrounds, rounded corners (12-16dp radius), and a consistent spacing rhythm based on 8dp grid.

**Primary palette (estimated from screenshots):**
- Background: `#0A0E1A` / `#0D1117` (deep navy)
- Card surface: `#141824` / `#1A2030` (lighter navy)
- Primary accent: `#FF4D00` / `#FF5722` (vibrant orange-red)
- Secondary accent: `#00D4FF` / `#00BCD4` (cyan/teal)
- Text primary: `#FFFFFF`
- Text secondary: `#8A8F9E` / `#9BA3B5`
- Success: `#22C55E` / `#10B981`
- Purple accent: `#8B5CF6`

**Typography scale:**
- Hero/display: 28-32sp, bold (700-800)
- Section headers: 18-20sp, semibold (600)
- Card titles: 16sp, semibold (600)
- Body: 14sp, regular (400)
- Captions/labels: 11-12sp, medium (500)

**Spacing rhythm:** 8dp base grid. Common values: 8, 12, 16, 20, 24, 32dp.

**Corner radius:** Cards 12-16dp, buttons 24-28dp (pill), avatars circular.

---

## Screen 1: Load Screen / Welcome / Splash Screen - Initial app entry point before authentication

**Source:** `Screenshot 2026-05-14 092653 load screen and welcome.png`

### Layout
Full-screen single-column layout; Top 55-65% is hero/illustration area; Middle section contains app branding (logo + name + tagline); Bottom 30-35% contains CTA buttons stacked vertically; No header bar; No bottom navigation (this is pre-auth screen); Content centered horizontally

### Colors
Background: deep navy/dark blue #0A0E1A or #0D1117; Accent/primary: vibrant orange-red #FF4D00 or #FF5722; Secondary accent: bright cyan/teal #00D4FF or #00BCD4; Card backgrounds: slightly lighter navy #141824 or #1A2030; Text primary: white #FFFFFF; Text secondary: muted gray #8A8F9E or #9BA3B5; Progress ring colors: orange #FF6B35, cyan #00D4FF, purple #8B5CF6

### Typography
App name 'Fitleus': ~36-40sp, Bold or Extra-Bold weight, white #FFFFFF; Tagline: ~14-16sp, Regular or Light weight, muted gray #9BA3B5; CTA button text: ~16-18sp, SemiBold or Bold, white on filled button; Secondary button text: ~16sp, Medium weight, accent color or white; Possibly a small eyebrow label above app name: ~12sp, letter-spaced, accent color

### Spacing
Horizontal padding: 24dp on each side; Gap between app name and tagline: 8-12dp; Gap between tagline and first button: 32-40dp; Gap between primary and secondary button: 12-16dp; Button height: ~52-56dp; Button border radius: ~28dp (fully rounded pill); Bottom safe area padding: 32-40dp; Logo to app name gap: 12-16dp

### Components
Full-screen splash/welcome illustration occupying top 60-70% of screen; Large bold app name 'Fitleus' as hero text; Tagline/subtitle text below app name; Primary CTA button (Get Started or Sign Up) - rounded pill shape, full-width ~90% screen width, filled orange/accent color; Secondary CTA button (Log In or Sign In) - outlined or ghost style, same pill shape; Possibly a small logo/icon mark above app name; Decorative fitness illustration or abstract geometric shapes in hero area; Bottom safe area padding

### Navigation
No navigation bar present; This is a splash/onboarding entry screen; Flow proceeds to registration or login on button tap; Back navigation not applicable

### Decorative Elements
Hero illustration featuring abstract human silhouette or athlete in motion; Geometric shapes or mesh gradient in background; Glowing orb or radial gradient effect behind illustration in cyan/orange; Possibly floating rings or circular progress elements as decorative motifs echoing fitness theme; Subtle grid or dot pattern overlay on dark background

---

## Screen 2: Sign Up & Log In Screen (Authentication Screen)

**Source:** `Screenshot 2026-05-14 092920 sign up and log in.png`

### Layout
Single-column full-screen layout; Top 20-25% header area with logo and branding; Middle 50-55% body with form fields and primary CTA; Bottom 20-25% with social login options, toggle link, and legal text; No bottom navigation bar on auth screen; Floating gradient background elements

### Colors
Background: deep dark navy/black #0A0E1A or #0D1117; Accent gradient: purple-to-pink #7C3AED to #EC4899 or similar vibrant purple #8B5CF6; Button fill: gradient purple-pink; Text primary: white #FFFFFF; Text secondary: muted gray #9CA3AF or #6B7280; Input field background: dark gray #1C2333 or #1E2640; Input border: subtle #2D3748; Social button background: dark #1C2333

### Typography
App name/logo text: 28-32sp bold or extra-bold, white; Tagline: 14-16sp regular, muted gray; Input placeholder: 14sp regular, gray #6B7280; Button label: 16sp semibold, white; Toggle link text: 14sp, accent purple/pink; Caption/legal text: 12sp, muted gray #9CA3AF

### Spacing
Screen horizontal padding: 24dp; Logo top margin: 48-60dp; Input fields: height ~52-56dp, vertical gap between fields ~16dp; Button height: ~52-56dp, margin-top from last field ~24dp; Gap between social buttons: ~12dp; Section divider margin: ~20dp vertical

### Components
Logo/brand mark at top center; App name 'Fitleus' text; Tagline or subtitle text; Email input field with icon; Password input field with eye toggle icon; 'Sign Up' or 'Create Account' primary CTA button with gradient fill; 'Log In' or secondary action button or text link; Social login buttons (Google, Apple, Facebook) possibly; Toggle between Sign Up and Log In tabs or switch; Terms and conditions text link; 'Forgot password?' text link; Divider line with 'OR' label between form and social login

### Navigation
Authentication/onboarding screen - no persistent bottom nav; Screen-level navigation via Sign Up / Log In toggle; Back arrow possibly top-left if reached from onboarding

### Decorative Elements
Abstract background decorative shapes or gradient blobs in purple/pink tones; Possibly fitness-related iconography or silhouette in background; Subtle geometric patterns or mesh gradient overlay; Logo may incorporate a dumbbell, flame, or motion icon

---

## Screen 3: Home / Dashboard Screen

**Source:** `Screenshot 2026-05-14 093038.png`

### Layout
Full-screen vertical scroll layout; Header: ~72dp tall with avatar left, notification right; Greeting section: ~60dp; Stats ring card: ~160dp tall, centered, full-width minus 32dp margins; Horizontal activity scroll row: ~140dp tall cards; Weekly chart section: ~180dp tall card; Macro nutrition row: 3 equal-width cards in horizontal row; Bottom nav bar: ~60dp tall fixed; Total estimated content height: ~900dp scrollable

### Colors
Background: #F5F7FA (light grayish white); Card backgrounds: #FFFFFF; Accent/primary: #7C5CBF (purple); Secondary accent: #F4A261 (orange); Text primary: #1A1A2E (near black); Text secondary: #8A94A6 (gray); Progress ring colors: purple #7C5CBF, orange #F4A261, green #4CAF82; Bottom nav active: #7C5CBF; Bottom nav inactive: #B0B8C9; Input background: #EEF0F5

### Typography
Greeting heading ('Good Morning'): ~22sp bold, #1A1A2E; Username: ~22sp semi-bold, purple #7C5CBF; Section titles: ~16sp semi-bold, #1A1A2E; Stats numbers (steps, calories): ~28sp bold, #1A1A2E; Card labels: ~12sp regular, #8A94A6; Macro values: ~18sp bold; Chart axis labels: ~10sp regular, #8A94A6; Bottom nav labels: ~10sp regular, inactive gray / active purple

### Spacing
Horizontal screen padding: 16dp; Card inner padding: 16dp; Gap between cards: 12dp; Gap between nav icons: equal distribution ~20dp; Top status bar margin: 24dp; Ring chart internal spacing: 8dp between rings; Section title margin-bottom: 8dp; Card border radius: 16dp; FAB elevation margin above nav bar: ~12dp

### Components
Top header bar with avatar/profile icon and notification bell icon; Greeting text block ('Good Morning' + username); Summary stats card with circular progress rings (3 rings for calories, steps, water); Horizontal scrollable activity cards (workout type cards with icons); Weekly progress bar chart (7 bars for Mon-Sun); Nutrition macro cards (3 cards: protein, carbs, fat) with mini circular indicators; Bottom navigation bar with 5 icons (Home, Workout, Add/Plus FAB, Nutrition, Profile); Floating Action Button (plus icon, purple, elevated); Search or filter chip row; Step count large display text; Hydration progress indicator

### Navigation
Bottom navigation bar with 5 tabs: Home (active, purple highlight), Workout, center FAB (floating plus button elevated above bar), Nutrition, Profile; Tab icons with labels below; Active tab indicated by purple icon color and possible underline or filled indicator

### Decorative Elements
Subtle card drop shadows (elevation ~4dp); Rounded corners on all cards (~16dp radius); Gradient overlay on workout activity cards (purple-to-transparent gradient); Small wave or curve decoration on header section; Icon illustrations on workout cards (running figure, dumbbell, yoga pose); Dot indicators below horizontal scroll cards; Light grid or subtle pattern on stats card background

---

## Screen 4: Home Dashboard / Today Overview Screen

**Source:** `Screenshot 2026-05-14 093153.png`

### Layout
Full-screen vertical scroll layout; Fixed header at top (~64dp height) with greeting and avatar; Body content in vertical stack with horizontal scroll sections; Large circular progress ring card (~180dp diameter) centered or left-aligned in hero card; Metric summary row with 2x2 or 1x4 grid of stat cards; Weekly chart card (~200dp height); Workout suggestion horizontal scroll list; Fixed bottom navigation bar (~56dp height); Content padding ~16-20dp horizontal

### Colors
Background: #F5F7FA (light gray-white); Card backgrounds: #FFFFFF (white); Primary accent: #7B61FF (purple/violet); Secondary accent: #FF6B6B (coral/red); Tertiary accent: #4CD97B (green); Text primary: #1A1A2E (near black); Text secondary: #8A94A6 (medium gray); Bottom nav active: #7B61FF (purple); Bottom nav inactive: #B0B8C9 (light gray); Progress ring track: #EEF0F5; Chart bars: #7B61FF and #E8E8F0

### Typography
Greeting heading: 22-24sp, Bold (#1A1A2E); Date/subtitle: 13-14sp, Regular (#8A94A6); Section titles: 16-18sp, SemiBold (#1A1A2E); Metric values (steps/cal): 20-24sp, Bold (accent colors); Metric labels: 11-12sp, Regular (#8A94A6); Card titles: 14-15sp, Medium (#1A1A2E); Progress percentage: 28-32sp, Bold (#7B61FF); Chart axis labels: 10-11sp, Regular (#8A94A6); Font family: likely Poppins or Inter

### Spacing
Horizontal screen padding: 16-20dp; Card internal padding: 16dp; Gap between cards: 12-16dp; Header top padding: 16dp; Bottom nav height: 56-60dp; Progress ring card height: ~200dp; Stat card height: ~80dp; Section title margin bottom: 8dp; Card corner radius: 16dp; Icon size in nav: 24dp

### Components
Header bar with greeting text and user avatar/profile icon (top right); Date or subtitle label below greeting; Summary stats row with 3-4 metric cards (steps, calories, heart rate, distance); Circular progress ring (large, center or top of body) showing daily goal completion percentage; Horizontal scrollable activity cards; Weekly bar chart showing activity data across 7 days; Workout category cards with icons (running, cycling, yoga, etc.); Bottom navigation bar with 5 tabs (Home, Workout, Stats/Activity, Nutrition, Profile); FAB or quick-add button possibly present; Pill-shaped tags or badges on cards; Small icon glyphs for each metric (flame, footsteps, heart, clock)

### Navigation
Bottom tab navigation bar with 5 items: Home (active, highlighted in purple #7B61FF), Workout/Exercise, Activity/Stats, Nutrition/Diet, Profile/Account; Active tab indicated by filled icon and purple color; Inactive tabs in gray; No visible drawer or top tabs

### Decorative Elements
Soft drop shadows on cards (elevation ~4dp); Rounded corners on all cards (~16dp radius); Gradient overlay on progress ring (purple to blue ~#7B61FF to #5B8CFF); Subtle wave or curved divider between header and body content; Icon illustrations on workout cards; Background pattern or subtle texture possibly on header area; Colored dot indicators on chart; Small medal or streak badge decorative element

---

## Screen 5: Home / Dashboard Screen

**Source:** `Screenshot 2026-05-14 093442.png`

### Layout
Vertical scroll layout; Fixed top header (~56-64dp height) with user greeting on left and avatar on right; Body is scrollable feed of metric cards; 2-column grid for quick stats at top; Full-width cards below for detailed metrics; Fixed bottom navigation bar (~56dp height); Overall horizontal padding ~16dp

### Colors
Background: #F5F7FA (light gray-white); Card backgrounds: #FFFFFF (white); Primary accent: #6C63FF (purple/violet); Secondary accent: #FF6584 (coral/pink); Text primary: #1A1A2E (near black); Text secondary: #8A8A9A (medium gray); Bottom nav active: #6C63FF; Bottom nav inactive: #C4C4D4; Green accent: #4CAF82; Orange accent: #FF9F43

### Typography
Greeting heading: ~22sp, bold/700 weight; User name: ~22sp, bold, accent color; Section titles: ~16sp, semibold/600; Card metric values: ~24-28sp, bold/700; Card labels/captions: ~12sp, regular/400, gray; Bottom nav labels: ~10sp, regular; Body text: ~14sp, regular/400

### Spacing
Horizontal screen padding: 16dp; Card internal padding: 16dp; Gap between cards in grid: 12dp; Gap between full-width cards: 12dp; Header top padding: 16dp; Bottom nav height: 56dp; Icon-to-text spacing: 4dp; Section title margin-bottom: 8dp

### Components
Top header bar with greeting text and profile avatar (circular, ~40dp); Summary stats cards (2-column grid, rounded corners ~12dp radius); Circular progress ring (donut chart) for calories/activity; Step count card with bar chart visualization; Heart rate card with line graph sparkline; Water intake card with progress bar; Sleep tracking card with arc/bar indicator; Weekly activity bar chart; CTA buttons (rounded pill shape); Icon badges on each card (24dp icons)

### Navigation
Bottom tab navigation bar with 5 items: Home (active, highlighted in purple), Workout, Progress/Stats, Nutrition, Profile; Tab icons ~24dp with labels below in ~10sp; Active tab indicator is filled icon with accent color

### Decorative Elements
Subtle gradient overlays on stat cards; Drop shadows on cards (elevation ~4dp); Rounded pill/badge shapes behind icons; Background decorative circles or blobs in header area; Small dot indicators; Thin divider lines between sections

---

## Screen 6: Home Dashboard / Today Overview Screen

**Source:** `Screenshot 2026-05-14 093617.png`

### Layout
Full screen mobile layout ~390x844dp; Top header bar (~60-70dp height) with greeting text left, profile avatar and notification icon right; Main body scrollable with hero section featuring circular activity rings centered (~200dp diameter area); Below rings: horizontal scrollable stat cards (~120x80dp each); Mid section: Today's workout or recommended workout card (full width ~340dp, height ~120-140dp); Lower body: weekly activity chart or step progress; Bottom navigation bar fixed (~60-65dp height) with 5 tabs

### Colors
Background: deep navy/dark blue #0D1B2A or #0A1628; Card backgrounds: slightly lighter navy #112240 or #0F1E35; Accent/primary: vibrant teal-green #00E5A0 or #00D68F; Secondary accent: purple/violet #7B5EA7 or #8A6FBF; Text primary: white #FFFFFF; Text secondary: muted gray-blue #8A9BB0 or #7A8FA6; Progress rings: teal #00E5A0, orange #FF6B35, purple #9B6BFF; Card borders: subtle #1E3A5F

### Typography
Greeting heading (e.g. 'Good Morning, [Name]'): 22-24sp bold/semibold, white; Sub-greeting or date: 13-14sp regular, muted gray-blue; Ring center number (main metric): 28-36sp bold, white or accent teal; Ring label: 11-12sp medium, secondary gray; Stat card number: 20-24sp bold, white; Stat card label: 12sp regular, muted; Section title (e.g. 'Today's Workout'): 16-18sp semibold, white; Workout card title: 14-16sp medium, white; Caption/small text: 10-11sp regular, gray; Bottom nav labels: 10sp, active teal, inactive gray

### Spacing
Screen horizontal padding: 16-20dp; Card internal padding: 16dp; Gap between stat cards: 12dp; Gap between sections: 20-24dp; Bottom nav height: 60dp with 8dp icon padding; Ring chart area top margin: 24dp; Card border radius: 16-20dp; Header vertical padding: 12-16dp; Icon size in nav: 24dp

### Components
Bottom navigation bar with 4-5 icons (home, workout, stats, profile); Circular progress rings (3 concentric or separate rings for calories, steps, active minutes); Summary stat cards (2-3 horizontal cards showing daily metrics); Workout suggestion card with thumbnail and title; Step counter widget; Calorie burn display; Heart rate or BPM card; Weekly bar chart or activity graph; Avatar/profile icon top right; Greeting text header; Notification bell icon; Floating action button possibly; Progress percentage labels inside rings

### Navigation
Fixed bottom navigation bar with 5 icons: Home (active, highlighted in teal), Workout/Exercise, Statistics/Charts, Social or Challenges, Profile; Active state shown with teal accent color or filled icon; Top bar is not a nav bar but a contextual header; Possible floating action button for quick-start workout

### Decorative Elements
Gradient overlays on cards from dark navy to transparent; Glow effects behind progress rings (teal/green ambient glow); Rounded corners on all cards (radius ~16-20dp); Subtle grid or dot pattern on background; Icon illustrations inside workout cards; Gradient text or highlighted numbers in accent color; Soft shadow beneath cards; Curved or wave divider between sections

---

## Screen 7: Home / Dashboard Screen

**Source:** `Screenshot 2026-05-14 093759.png`

### Layout
Vertical scroll layout; Fixed header at top (~60dp height) with greeting left and avatar+bell right; Hero section with circular progress ring card (~200dp tall); Stats row (3 equal-width cards in horizontal flex, ~100dp tall); Weekly bar chart card (~180dp tall); Horizontal scrollable workout cards section (~160dp tall cards); Fixed bottom navigation bar (~60dp height); Overall horizontal padding ~16-20dp

### Colors
Background: #F5F5F5 (light gray); Card backgrounds: #FFFFFF (white); Primary accent: #FF6B35 or #F97316 (orange); Secondary accent: #6C63FF (purple/violet); Text primary: #1A1A2E (dark navy); Text secondary: #9E9E9E (gray); Bottom nav active: #FF6B35; Progress rings: gradient orange-to-red ~#FF6B35 to #FF3B30; Green accent for positive stats: #4CAF50

### Typography
Greeting heading: 22-24sp, Bold, dark navy; Subheading/section titles: 16-18sp, SemiBold; Stat numbers (steps/calories): 24-28sp, Bold, primary color; Stat labels: 11-12sp, Regular, gray; Workout card titles: 14-16sp, SemiBold, white (on image); Body text: 13-14sp, Regular; Caption/metadata: 11sp, Light gray; Font family: likely Poppins or Nunito (rounded sans-serif)

### Spacing
Screen horizontal padding: 16dp; Card internal padding: 16dp; Gap between cards: 12-16dp; Header vertical padding: 12dp top, 8dp bottom; Stat card gap: 8-10dp; Section title margin-bottom: 8dp; Bottom nav height: 60dp; Card border radius: 12-16dp; Avatar size: 40dp

### Components
Top header bar with greeting text and profile avatar (circular, ~40dp); Summary stats card with large ring/donut chart (progress circle ~120dp diameter); Weekly activity bar chart with 7 bars (Mon-Sun); Calorie/steps/distance stat row with 3 metric cards; Workout suggestion cards (horizontal scroll, rounded corners ~12dp radius); Bottom navigation bar with 5 icons (Home, Activity, Add/Plus FAB, Nutrition, Profile); Floating Action Button (circular, ~56dp, orange); Notification bell icon in header; Step counter progress arc; Heart rate mini card; Sleep tracking card

### Navigation
Bottom tab navigation with 5 items: Home (active), Activity/Stats, Central FAB (add workout), Nutrition, Profile; Active tab highlighted in orange; Tab icons ~24dp; Center FAB elevated above nav bar

### Decorative Elements
Gradient overlays on workout cards (dark overlay on background images); Subtle drop shadows on cards (elevation ~4dp); Rounded pill-shaped labels on workout cards; Background image thumbnails on workout suggestion cards; Small icon illustrations inside stat cards; Curved/wave divider between header and body section; Dotted or dashed progress indicators

---

## Screen 8: Home / Dashboard Screen

**Source:** `Screenshot 2026-05-14 093937.png`

### Layout
Full-screen vertical scroll layout; Fixed header at top (~64dp height) with greeting and avatar; Horizontal date picker strip below header (~48dp); Body content in scrollable vertical list of cards with 2-column grid for some metric cards; Cards have ~16dp margin horizontally and ~12dp vertical gap; Bottom navigation bar fixed at bottom (~60dp height) with center FAB cutout

### Colors
Background: #F5F7FA (light gray-white); Card backgrounds: #FFFFFF (white); Primary accent: #6C63FF (purple/violet); Secondary accent: #FF6B6B (coral/red); Text primary: #1A1A2E (near black); Text secondary: #8A8A9A (medium gray); Progress ring colors: #6C63FF (purple), #FF6B6B (coral), #43E97B (green); Bottom nav active: #6C63FF; Bottom nav inactive: #B0B0C0

### Typography
Greeting heading: ~22sp bold (#1A1A2E); Date/day labels: ~13sp medium (#8A8A9A); Card title labels: ~13sp semi-bold (#8A8A9A uppercase); Stat values (calories, steps): ~28-32sp bold (#1A1A2E); Sub-labels/captions: ~11sp regular (#B0B0C0); Section headers: ~16sp semi-bold (#1A1A2E); Button text: ~14sp semi-bold (#FFFFFF)

### Spacing
Screen horizontal padding: 16dp; Card corner radius: 16dp; Card-to-card vertical gap: 12dp; Header padding top: 16dp; Header height: ~64dp; Date strip height: ~48dp; Bottom nav height: ~60dp; FAB diameter: ~56dp; Card internal padding: 16dp; Icon size: 24dp; Stat value font margin-bottom: 4dp

### Components
Top header bar with greeting text and user avatar/profile icon; Date/day selector horizontal scroll strip; Summary stats card with calorie ring/donut chart; Activity progress rings (3 rings: calories, steps, exercise minutes); Step count card with bar chart visualization; Water intake tracker with fill indicator; Workout card with thumbnail and play button; Heart rate card with line graph sparkline; Bottom navigation bar with 5 tabs (Home, Workout, Stats, Nutrition, Profile); Floating action button (FAB) in center of bottom nav; Circular progress indicators; Icon badges on stat cards

### Navigation
Bottom navigation bar with 5 items: Home (active), Workout, Activity/Stats, Nutrition, Profile; Center tab replaced by floating circular FAB button (~56dp diameter) for quick-add or start workout action; Top right avatar for profile access

### Decorative Elements
Subtle card drop shadows (elevation ~4dp); Rounded card corners (~16dp radius); Gradient overlays on workout thumbnail card (dark overlay for readability); Small icon illustrations on each stat card; Soft pastel tinted backgrounds on individual metric cards; Decorative wave or curve on header section; Small dot/line decorative dividers

---

## Screen 9: Home Dashboard / Activity Overview Screen

**Source:** `Screenshot 2026-05-14 094256.png`

### Layout
Vertical scroll layout; Fixed top header (~64dp tall) with greeting left, avatar right; Horizontal scroll row of summary cards below header (~120dp tall cards, ~16dp padding); Full-width weekly bar chart card (~200dp tall); Two-column grid row with smaller stat cards (heart rate, water ~150dp each); Bottom fixed navigation bar (~60dp tall); Content padding: 16dp horizontal, 12dp vertical gaps between sections

### Colors
Background: #F5F7FA (light gray-white); Card backgrounds: #FFFFFF (white); Primary accent: #6C63FF (purple/violet); Secondary accent: #FF6584 (pink-red); Success/green accent: #43D19E (mint green); Text primary: #1A1A2E (dark navy); Text secondary: #8A94A6 (medium gray); Bottom nav active: #6C63FF; Bottom nav inactive: #B0B8C9; Chart bar colors: #6C63FF (purple), #43D19E (green), #FF6584 (pink)

### Typography
Greeting heading: 22sp, bold (#1A1A2E); Sub-greeting/date: 13sp, regular (#8A94A6); Stat value numbers: 28sp, bold (#1A1A2E); Stat labels: 11sp, medium (#8A94A6); Card section titles: 15sp, semibold (#1A1A2E); Chart axis labels: 10sp, regular (#B0B8C9); Bottom nav labels: 10sp, medium; Progress percentage: 18sp, bold

### Spacing
Horizontal screen padding: 16dp; Card border radius: 16dp; Gap between cards in grid: 12dp; Gap between sections: 20dp; Card internal padding: 16dp; Bottom nav height: 60dp; Header height: 64dp; Icon size in cards: 24dp; Avatar diameter: 40dp; FAB diameter: 56dp; Bar chart bar width: ~20dp, gap: ~8dp

### Components
Top header bar with greeting text and profile avatar (circular, ~40dp); Horizontal scrollable summary stat cards (3-4 cards with icons, values, labels); Weekly activity bar chart with 7 bars labeled Mon-Sun; Circular progress ring (donut chart) for calories or goal tracking; Step count large display number with subtitle; Water intake tracker with wave/fill animation card; Heart rate card with line graph sparkline; Bottom navigation bar with 5 icons (Home, Workout, Stats, Nutrition, Profile); Floating action button (circular, ~56dp, purple); Icon badges on stat cards; Progress bar indicators inside cards; Small trophy/achievement icon badge

### Navigation
Bottom tab navigation with 5 tabs: Home (active/highlighted), Workout, Statistics, Nutrition, Profile; Active tab indicated by filled icon and accent color #6C63FF; Possible top-right profile avatar tap for profile screen; Floating action button may trigger quick-log or start workout overlay

### Decorative Elements
Gradient background blobs or soft radial gradients on header area (~purple to blue); Rounded card corners (~16dp radius); Subtle drop shadows on cards (elevation ~4dp); Wave SVG pattern on water intake card; Dashed circular progress track on ring chart; Icon inside progress ring (flame or footsteps); Small dot indicators on chart; Thin divider lines between nav items; Gradient fill on bar chart tops

---

## Screen 10: Home Dashboard / Overview Screen

**Source:** `Screenshot 2026-05-14 095001.png`

### Layout
Vertical scroll layout; Fixed top header (~56dp height); Horizontal date strip below header (~48dp); Hero card full-width (~180dp height); Two-column card row (~120dp each); Full-width chart card (~160dp); Workout suggestion card full-width (~100dp); Fixed bottom navigation bar (~60dp height); Content horizontal padding ~16dp; Cards spaced ~12dp apart vertically

### Colors
Background: #F5F7FA (light gray-white); Card backgrounds: #FFFFFF (white); Primary accent: #7B61FF (purple/violet); Secondary accent: #FF6B6B (coral/red); Tertiary accent: #4CD97B (green); Text primary: #1A1A2E (near black); Text secondary: #8A8FA3 (gray); Bottom nav active: #7B61FF; Bottom nav inactive: #C4C8D4; Progress ring track: #EEF0F5

### Typography
Greeting heading: 22sp bold, #1A1A2E; Sub-greeting/date: 13sp regular, #8A8FA3; Stat value (large): 28sp bold, #1A1A2E; Stat label: 12sp medium, #8A8FA3; Card section title: 16sp semibold, #1A1A2E; Progress % inside ring: 24sp bold, #7B61FF; Chart axis labels: 10sp regular, #8A8FA3; Bottom nav labels: 10sp medium; Workout card title: 14sp semibold

### Spacing
Screen horizontal padding: 16dp; Card internal padding: 16dp; Gap between cards: 12dp; Header vertical padding: 12dp top, 8dp bottom; Date strip item width: ~48dp with 8dp gap; Bottom nav height: 60dp with 10dp icon-to-label gap; Two-column card gap: 12dp; Section title margin-bottom: 8dp; Ring stroke width: ~10dp

### Components
1) Top header bar with greeting text and user avatar/profile icon (top-right); 2) Date/day selector horizontal scroll strip; 3) Large hero stats card with circular progress ring (calories/activity); 4) Two medium stat cards side-by-side (steps card and water intake card); 5) Weekly activity bar chart card; 6) Workout suggestion card with thumbnail image and play/start button; 7) Bottom navigation bar with 5 icons (Home, Activity, Add/Plus FAB, Nutrition, Profile); 8) Floating Action Button (FAB) centered in bottom nav - elevated circular purple button with plus icon; 9) Notification bell icon in header; 10) Progress percentage text inside ring; 11) Small icon badges on stat cards

### Navigation
Bottom tab navigation with 5 tabs: Home (active, highlighted in purple), Activity/Stats, Central FAB (add workout), Nutrition, Profile; Tab icons with labels below; Active state uses purple fill icon; FAB is elevated above nav bar with shadow

### Decorative Elements
Subtle gradient overlay on hero card (purple to violet); Rounded corners on all cards (radius ~16dp); Soft drop shadows on cards (elevation ~4dp); Small emoji or icon illustrations on stat cards; Gradient progress arc on circular ring (purple to coral); Dot indicator below date selector for selected day; Thin divider lines between nav items

---

## Component Inventory

Deduplicated list of reusable UI patterns observed across all screenshots:

| Component | Description | Seen In |
| --- | --- | --- |
| `StatCard` | Numeric stat with label, icon, optional trend indicator, progress ring | Dashboard, Activity |
| `WorkoutCard` | Workout summary with icon, title, duration, calories, progress bar | Dashboard, Workouts |
| `ProgressRing` | Circular progress indicator (SVG) with center label | Dashboard, Stats |
| `SectionHeader` | Section title with optional 'See All' link, right-aligned | Dashboard, Activity |
| `BottomTabBar` | Custom 5-tab bottom nav: Home, Workouts, +, Nutrition, Profile | All main screens |
| `ProfileHeader` | Avatar circle, user name, stats row (followers, following, level) | Profile |
| `NutritionCard` | Macro summary (protein, carbs, fat) with circular progress rings | Dashboard, Nutrition |
| `ActionButton` | Primary CTA pill button, full-width, orange-red gradient fill | Auth, Dashboard, Workouts |
| `ActivityListItem` | Row with icon, activity name, time, calories, mini chart | Dashboard, Activity |
| `MiniChart` | Small line/bar sparkline inside a card or list item | Dashboard, Stats |
| `AvatarCircle` | Circular user photo with optional online indicator and border | Profile, Social |
| `CardContainer` | Dark rounded card with padding, used as surface for grouped content | All screens |
| `GradientBackground` | Dark gradient background behind header areas | Splash, Auth, Dashboard |
| `InputField` | Rounded text input with label, icon prefix, dark surface fill | Auth screens |
| `ToggleSwitch` | iOS-style toggle with accent color active state | Settings |
| `BadgeChip` | Small colored pill showing level, tag, or status | Profile, Workouts |

## Token Mapping

Mapping between observed visual elements and existing `theme/tokens.ts` tokens:

| Visual Element | Estimated Hex | Closest Token | Gap? |
| --- | --- | --- | --- |
| Dark background | `#0A0E1A` | `colors.ink.darkest` | Close but not exact â consider adding `colors.background.dark` |
| Card surface | `#141824` | `colors.ink.darker` | Close match |
| Orange CTA | `#FF5722` | `colors.red.base_f97` | Partial â missing a dedicated `colors.accent.primary` for orange |
| Cyan accent | `#00D4FF` | `colors.blue.base` (if exists) | May need `colors.accent.cyan` |
| White text | `#FFFFFF` | `colors.background.default` | Exact match |
| Muted text | `#8A8F9E` | `colors.sky.dark` | Close |
| Success green | `#22C55E` | `colors.green.base` | Mapped in round 2 |
| Purple accent | `#8B5CF6` | `colors.primary.base` | Check existing primary |

### Gaps Identified

The Fitleus reference uses a **dark theme** while the current tokens are oriented toward a light theme. Key gaps:
- `colors.background.dark` â deep navy background (`#0A0E1A`)
- `colors.surface.dark` â card surface on dark background (`#141824`)
- `colors.accent.orange` â primary CTA color (`#FF5722`)
- `colors.accent.cyan` â secondary accent (`#00D4FF`)
- Dark-mode text scale: `colors.text.onDark.primary` (`#FFF`), `.secondary` (`#8A8F9E`)

These could be added as a `dark` variant in tokens.ts to support theme switching via `ThemeProvider`.

---

*Generated by the Twin Fitleus design-spec agent from 10 reference screenshots.*