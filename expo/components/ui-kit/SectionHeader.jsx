/**
 * @component SectionHeader
 * @description A polished section title row for the Fitleus fitness app UI kit.
 * Displays a section title on the left with an optional 'See All' touchable link
 * right-aligned. Supports an optional subtitle below the main title and a
 * decorative left accent bar.
 *
 * @prop {string}   title          - Main section heading text.
 * @prop {string}   [subtitle]     - Optional secondary description text below the title.
 * @prop {boolean}  [showSeeAll]   - Whether to display the 'See All' link. Default: true.
 * @prop {string}   [seeAllLabel]  - Custom label for the right-hand link. Default: 'See All'.
 * @prop {Function} [onSeeAllPress]- Callback fired when 'See All' is pressed.
 * @prop {boolean}  [accentBar]    - Show a vertical orange accent bar on the left. Default: false.
 * @prop {object}   [style]        - Optional additional style override for the root container.
 *
 * @example
 * // Basic usage
 * <SectionHeader
 *   title="Today's Workouts"
 *   subtitle="3 sessions planned"
 *   showSeeAll
 *   onSeeAllPress={() => navigation.navigate('Workouts')}
 * />
 *
 * // With accent bar, no See All
 * <SectionHeader
 *   title="My Progress"
 *   accentBar
 *   showSeeAll={false}
 * />
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { tokens } from '../../theme/tokens';

const SectionHeader = ({
  title = 'Section Title',
  subtitle = '',
  showSeeAll = true,
  seeAllLabel = 'See All',
  onSeeAllPress = () => {},
  accentBar = false,
  style = {},
}) => {
  return (
    <View style={[styles.container, style]}>
      {/* Left side: optional accent bar + text block */}
      <View style={styles.leftBlock}>
        {accentBar && <View style={styles.accentBar} />}
        <View style={styles.textStack}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {!!subtitle && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>

      {/* Right side: See All link */}
      {showSeeAll && (
        <TouchableOpacity
          onPress={onSeeAllPress}
          activeOpacity={0.7}
          style={styles.seeAllButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.seeAllText}>{seeAllLabel}</Text>
          <View style={styles.seeAllUnderline} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: tokens.colors.ink.darkest,   // #0A0E1A
    paddingHorizontal: tokens.spacing.lg,          // 16
    paddingVertical: tokens.spacing.md,            // 12
    // subtle bottom border to separate from content below
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.ink.darker,   // #141824
    // shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },

  leftBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: tokens.spacing.md,                // 12
  },

  accentBar: {
    width: 4,
    borderRadius: tokens.radius.sm,               // 4
    backgroundColor: tokens.colors.accent.orange, // #FF5722
    alignSelf: 'stretch',
    marginRight: tokens.spacing.sm,               // 8
    minHeight: 22,
  },

  textStack: {
    flex: 1,
    justifyContent: 'center',
  },

  title: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
    color: tokens.colors.text.primary,            // white
    lineHeight: 22,
  },

  subtitle: {
    fontSize: 12,
    fontWeight: '400',
    color: tokens.colors.text.muted,              // muted gray
    marginTop: 2,
    lineHeight: 16,
    letterSpacing: 0.1,
  },

  seeAllButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: tokens.spacing.xs,           // 4
    paddingHorizontal: tokens.spacing.xs,
  },

  seeAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: tokens.colors.accent.cyan,             // #00D4FF
    letterSpacing: 0.2,
  },

  seeAllUnderline: {
    height: 1,
    backgroundColor: tokens.colors.accent.cyan,
    borderRadius: tokens.radius.sm,
    marginTop: 2,
    opacity: 0.6,
  },
});

export default SectionHeader;
