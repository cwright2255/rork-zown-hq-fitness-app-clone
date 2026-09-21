import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useHomeWidgetsStore } from '@/store/homeWidgetsStore';
import { getFullOrderedLayout, getWidgetDefinition } from '@/lib/homeWidgets';

// Real, new: the actual, missing UI for the existing homeWidgetsStore -
// that store's toggleWidget/reorderWidget/saveLayout were already fully
// built, but nothing in the app ever rendered a way to call them; the
// "Edit Home Screen" menu item only ever set isEditing to true with
// nothing reading it. Local list state while open, for instant toggle/
// reorder feedback without a Firestore write on every single tap - one
// real save happens on close.
export default function WidgetEditorModal({ visible, onClose, uid }) {
  const { layout: storeLayout, saveLayout } = useHomeWidgetsStore();
  const [localLayout, setLocalLayout] = useState([]);

  useEffect(() => {
    if (visible) {
      setLocalLayout(getFullOrderedLayout(storeLayout));
    }
  }, [visible]);

  const toggle = (id) => {
    setLocalLayout((prev) => prev.map((w) => (w.id === id ? { ...w, enabled: !w.enabled } : w)));
  };

  const move = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= localLayout.length) return;
    setLocalLayout((prev) => {
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  };

  const handleClose = () => {
    saveLayout(uid, localLayout);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={s.safe}>
        <View style={s.header}>
          <Text style={s.headerTitle}>Edit Home Screen</Text>
          <Pressable onPress={handleClose} style={s.doneButton}>
            <Text style={s.doneButtonText}>Done</Text>
          </Pressable>
        </View>
        <Text style={s.helperText}>Turn widgets on or off, and use the arrows to reorder them.</Text>
        <ScrollView contentContainerStyle={s.list}>
          {localLayout.map((w, index) => {
            const def = getWidgetDefinition(w.id);
            if (!def) return null;
            return (
              <View key={w.id} style={s.row}>
                <View style={s.rowLeft}>
                  <Ionicons name={def.icon} size={20} color="#000000" style={s.rowIcon} />
                  <Text style={s.rowLabel}>{def.label}</Text>
                </View>
                <View style={s.rowRight}>
                  <Pressable
                    onPress={() => move(index, -1)}
                    disabled={index === 0}
                    style={[s.arrowButton, index === 0 && s.arrowButtonDisabled]}
                  >
                    <Ionicons name="chevron-up" size={18} color={index === 0 ? '#CCCCCC' : '#000000'} />
                  </Pressable>
                  <Pressable
                    onPress={() => move(index, 1)}
                    disabled={index === localLayout.length - 1}
                    style={[s.arrowButton, index === localLayout.length - 1 && s.arrowButtonDisabled]}
                  >
                    <Ionicons name="chevron-down" size={18} color={index === localLayout.length - 1 ? '#CCCCCC' : '#000000'} />
                  </Pressable>
                  <Switch
                    value={w.enabled}
                    onValueChange={() => toggle(w.id)}
                    trackColor={{ false: '#E0E0E0', true: '#000000' }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF', paddingTop: 60 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#000000' },
  doneButton: { paddingVertical: 6, paddingHorizontal: 4 },
  doneButtonText: { fontSize: 16, fontWeight: '700', color: '#000000' },
  helperText: { fontSize: 13, color: '#666666', paddingHorizontal: 20, marginBottom: 16 },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  rowIcon: { marginRight: 12 },
  rowLabel: { fontSize: 15, fontWeight: '600', color: '#000000' },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  arrowButton: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 15,
  },
  arrowButtonDisabled: { opacity: 0.4 },
});
