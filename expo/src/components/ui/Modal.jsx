import React from 'react';
import {
  Modal as RNModal,
  Pressable,
  StyleSheet,
  View } from
'react-native';
import { Colors, Radius, Spacing } from '../../constants/tokens';

let AnimatedView = null;
let FadeIn = null;
let FadeOut = null;
try {
  const r = require('react-native-reanimated');
  AnimatedView = r.default.View;
  FadeIn = r.FadeIn;
  FadeOut = r.FadeOut;
} catch {
  AnimatedView = null;
}

export function Modal({
  visible,
  onClose,
  children,
  accessibilityLabel,
  contentStyle
}) {
  const Content = AnimatedView ?? View;
  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      accessibilityViewIsModal>
      
      <Pressable
        style={styles.backdrop}
        accessibilityRole="button"
        accessibilityLabel="Close modal"
        onPress={onClose}>
        
        <Pressable onPress={() => undefined} style={styles.centered}>
          <Content
            entering={FadeIn ?? undefined}
            exiting={FadeOut ?? undefined}
            style={[styles.content, contentStyle]}>
            
            <View accessibilityLabel={accessibilityLabel}>{children}</View>
          </Content>
        </Pressable>
      </Pressable>
    </RNModal>);

}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg
  },
  centered: { width: '100%', alignItems: 'center' },
  content: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg,
    padding: Spacing.lg
  }
});

export default Modal;