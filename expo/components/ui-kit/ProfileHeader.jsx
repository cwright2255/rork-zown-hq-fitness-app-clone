/**
 * @fileoverview ProfileHeader component for the Fitleus fitness app UI kit.
 *
 * @description
 * Displays a user's profile summary at the top of their profile screen.
 * Includes a circular avatar image, display name, level badge/subtitle,
 * and a horizontal stats row showing workouts completed, current streak,
 * and total points earned.
 *
 * @component ProfileHeader
 *
 * @prop {string}  avatarUri     - URI for the user's avatar image.
 * @prop {string}  name          - User's display name.
 * @prop {string}  subtitle      - Short subtitle shown below the name (e.g. "Elite Athlete").
 * @prop {string}  level         - Level label shown in the badge (e.g. "Level 12").
 * @prop {number}  workouts      - Total workouts completed.
 * @prop {number}  streaks       - Current day streak.
 * @prop {number}  points        - Total points accumulated.
 * @prop {function} onEditPress  - Optional callback when the edit/settings button is tapped.
 *
 * @example
 * // Basic usage:
 * import ProfileHeader from './components/ProfileHeader';
 *
 * <ProfileHeader
 *   avatarUri="https://example.com/avatar.jpg"
 *   name="Jordan Blake"
 *   subtitle="Elite Athlete"
 *   level="Level 12"
 *   workouts={248}
 *   streaks={14}
 *   points={9320}
 *   onEditPress={() => navigation.navigate('EditProfile')}
 * />
 */

import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { tokens } from '../../theme/tokens';

// ---------------------------------------------------------------------------
// Sub-component: StatItem
// ---------------------------------------------------------------------------

/**
 * A single stat column used inside the stats row.
 */
const StatItem = ({ value, label, accentColor }) => (
  <View style={styles.statItem}>
    <Text style={[styles.statValue, accentColor ? { color: accentColor } : null]}>
      {typeof value === 'number' ? value.toLocaleString() : value}
    </Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

// ---------------------------------------------------------------------------
// Sub-component: StatDivider
// ---------------------------------------------------------------------------

const StatDivider = () => <View style={styles.statDivider} />;

// ---------------------------------------------------------------------------
// Main Component: ProfileHeader
// ---------------------------------------------------------------------------

const ProfileHeader = ({
  avatarUri = 'https://i.pravatar.cc/300?img=11',
  name = 'Jordan Blake',
  subtitle = 'Elite Athlete',
  level = 'Level 12',
  workouts = 248,
  streaks = 14,
  points = 9320,
  onEditPress = null,
}) => {
  return (
    <View style={styles.wrapper}>
      {/* Ã¢ÂÂÃ¢ÂÂ Card container Ã¢ÂÂÃ¢ÂÂ */}
      <View style={styles.card}>

        {/* Ã¢ÂÂÃ¢ÂÂ Top row: avatar + identity + edit button Ã¢ÂÂÃ¢ÂÂ */}
        <View style={styles.topRow}>

          {/* Avatar with accent ring */}
          <View style={styles.avatarRingOuter}>
            <View style={styles.avatarRingInner}>
              <Image
                source={{ uri: avatarUri }}
                style={styles.avatar}
                resizeMode="cover"
              />
            </View>
          </View>

          {/* Name, subtitle, level badge */}
          <View style={styles.identityBlock}>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
            <View style={styles.levelBadge}>
              <View style={styles.levelDot} />
              <Text style={styles.levelText}>{level}</Text>
            </View>
          </View>

          {/* Edit / settings button */}
          {onEditPress ? (
            <TouchableOpacity
              style={styles.editButton}
              onPress={onEditPress}
              activeOpacity={0.75}
              accessibilityLabel="Edit profile"
              accessibilityRole="button"
            >
              <EditIcon />
            </TouchableOpacity>
          ) : (
            <View style={styles.editButtonPlaceholder} />
          )}
        </View>

        {/* Ã¢ÂÂÃ¢ÂÂ Divider Ã¢ÂÂÃ¢ÂÂ */}
        <View style={styles.horizontalDivider} />

        {/* Ã¢ÂÂÃ¢ÂÂ Stats row Ã¢ÂÂÃ¢ÂÂ */}
        <View style={styles.statsRow}>
          <StatItem
            value={workouts}
            label="Workouts"
            accentColor={tokens.colors.accent.orange}
          />
          <StatDivider />
          <StatItem
            value={`${streaks}Ã°ÂÂÂ¥`}
            label="Day Streak"
            accentColor={tokens.colors.accent.orange}
          />
          <StatDivider />
          <StatItem
            value={points}
            label="Points"
            accentColor={tokens.colors.accent.cyan}
          />
        </View>
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Inline SVG-like Edit Icon (pure RN, no external libs)
// ---------------------------------------------------------------------------

const EditIcon = () => (
  <View style={styles.editIconContainer}>
    {/* Pencil body */}
    <View style={styles.pencilBody} />
    {/* Pencil tip */}
    <View style={styles.pencilTip} />
  </View>
);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const AVATAR_SIZE = 72;
const RING_BORDER = 2.5;
const GAP_BETWEEN_RING_AND_AVATAR = 2;
const RING_OUTER_SIZE =
  AVATAR_SIZE + (RING_BORDER + GAP_BETWEEN_RING_AND_AVATAR) * 2;

const styles = StyleSheet.create({
  // Ã¢ÂÂÃ¢ÂÂ Wrapper Ã¢ÂÂÃ¢ÂÂ
  wrapper: {
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.lg,
    paddingBottom: tokens.spacing.sm,
    backgroundColor: tokens.colors.ink.darkest,
  },

  // Ã¢ÂÂÃ¢ÂÂ Card Ã¢ÂÂÃ¢ÂÂ
  card: {
    backgroundColor: tokens.colors.ink.darker,
    borderRadius: tokens.radius.xl,
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.xl,
    paddingBottom: tokens.spacing.lg,
    // Shadow (iOS)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    // Shadow (Android)
    elevation: 12,
  },

  // Ã¢ÂÂÃ¢ÂÂ Top row Ã¢ÂÂÃ¢ÂÂ
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Ã¢ÂÂÃ¢ÂÂ Avatar Ã¢ÂÂÃ¢ÂÂ
  avatarRingOuter: {
    width: RING_OUTER_SIZE,
    height: RING_OUTER_SIZE,
    borderRadius: RING_OUTER_SIZE / 2,
    padding: RING_BORDER,
    // Gradient-like double ring using backgroundColor + border trick
    backgroundColor: tokens.colors.accent.orange,
    // Subtle glow
    shadowColor: tokens.colors.accent.orange,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
  },
  avatarRingInner: {
    flex: 1,
    borderRadius: (RING_OUTER_SIZE - RING_BORDER * 2) / 2,
    padding: GAP_BETWEEN_RING_AND_AVATAR,
    backgroundColor: tokens.colors.ink.darker,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },

  // Ã¢ÂÂÃ¢ÂÂ Identity block Ã¢ÂÂÃ¢ÂÂ
  identityBlock: {
    flex: 1,
    marginLeft: tokens.spacing.md,
    justifyContent: 'center',
  },
  name: {
    color: tokens.colors.text.white,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: tokens.spacing.xs / 2,
  },
  subtitle: {
    color: tokens.colors.text.muted,
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 0.2,
    marginBottom: tokens.spacing.sm,
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0, 212, 255, 0.12)',
    borderRadius: tokens.radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.30)',
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 3,
  },
  levelDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: tokens.colors.accent.cyan,
    marginRight: tokens.spacing.xs,
    // Glow
    shadowColor: tokens.colors.accent.cyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
    elevation: 2,
  },
  levelText: {
    color: tokens.colors.accent.cyan,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
  },

  // Ã¢ÂÂÃ¢ÂÂ Edit button Ã¢ÂÂÃ¢ÂÂ
  editButton: {
    width: 36,
    height: 36,
    borderRadius: tokens.radius.md,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  editButtonPlaceholder: {
    width: 36,
  },

  // Pencil icon (purely decorative RN shapes)
  editIconContainer: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pencilBody: {
    width: 10,
    height: 2,
    backgroundColor: tokens.colors.text.muted,
    borderRadius: 1,
    transform: [{ rotate: '-45deg' }, { translateY: -1 }],
  },
  pencilTip: {
    width: 0,
    height: 0,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderTopWidth: 5,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: tokens.colors.text.muted,
    transform: [{ rotate: '-45deg' }, { translateX: 1 }, { translateY: 3 }],
  },

  // Ã¢ÂÂÃ¢ÂÂ Horizontal divider Ã¢ÂÂÃ¢ÂÂ
  horizontalDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginVertical: tokens.spacing.lg,
    marginHorizontal: -tokens.spacing.sm,
  },

  // Ã¢ÂÂÃ¢ÂÂ Stats row Ã¢ÂÂÃ¢ÂÂ
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: tokens.colors.text.white,
    letterSpacing: 0.2,
    marginBottom: 3,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: tokens.colors.text.muted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
});

export default ProfileHeader;
