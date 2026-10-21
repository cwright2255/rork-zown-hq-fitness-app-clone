// components/OverlayColumn.jsx
//
// Overlays laid over a camera view, stacked one above the next from the top or the bottom edge. Each overlay used to be pinned to
// the edge by itself, so two that were both pinned there (the progress ring and the diagnostics box at the top; the "tap to
// continue" button and the caption at the bottom) were drawn on top of one another. Here they are ordinary children of one column,
// so they take turns and can not overlap. Touches go through the column to the camera wherever there is no overlay.

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { spacing } from '@/constants/theme';

/** `edge` is 'top' or 'bottom'. Children are stacked from that edge inwards, in the order given. */
export default function OverlayColumn({ edge = 'top', children, testID }) {
  return (
    <View
      testID={testID}
      pointerEvents="box-none"
      style={[styles.column, edge === 'bottom' ? styles.bottom : styles.top]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  column: { position: 'absolute', left: spacing.base, right: spacing.base, gap: spacing.sm },
  top: { top: spacing.base },
  bottom: { bottom: spacing.base },
});
