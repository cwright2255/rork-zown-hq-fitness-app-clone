import React from 'react';
import { Modal, View, Text, TextInput, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { normalizeIngredients, MAX_KITCHEN_INGREDIENTS } from '@/lib/recipeBrowse';

/**
 * "Cook with what I have": the person types what is in the kitchen (up to five things) and the tab finds recipes that use them.
 * `initial` is the list from last time. onSubmit gets the cleaned list. It is shown for as long as it is rendered, so the screen
 * renders it only when open.
 */
export default function KitchenSheet({ initial = [], onSubmit, onClose }) {
  const insets = useSafeAreaInsets();
  const [list, setList] = React.useState(() => normalizeIngredients(initial));
  const [text, setText] = React.useState('');

  const full = list.length >= MAX_KITCHEN_INGREDIENTS;
  // What is typed but not added yet counts too, so "Find recipes" never throws away the last thing typed.
  const all = normalizeIngredients([...list, ...normalizeIngredients(text)]);
  const overLimit = normalizeIngredients(text).some((t) => !all.includes(t));

  const add = () => {
    setList(all);
    setText('');
  };
  const remove = (name) => setList((cur) => cur.filter((n) => n !== name));

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <Pressable style={styles.dismiss} onPress={onClose} accessibilityLabel="Close" />
        <View testID="kitchen-sheet" style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.title}>Cook with what I have</Text>
          <Text style={styles.sub}>Add up to {MAX_KITCHEN_INGREDIENTS} ingredients. We will find recipes that use them.</Text>

          <View style={styles.inputRow}>
            <TextInput
              testID="kitchen-input"
              style={styles.input}
              placeholder="chicken, rice, spinach"
              placeholderTextColor="#999"
              value={text}
              onChangeText={setText}
              onSubmitEditing={add}
              returnKeyType="done"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!(full && !text)}
            />
            <TouchableOpacity testID="kitchen-add" accessibilityRole="button" style={[styles.addBtn, !text.trim() && styles.addBtnOff]} onPress={add} disabled={!text.trim()}>
              <Text style={styles.addText}>Add</Text>
            </TouchableOpacity>
          </View>
          {overLimit ? <Text testID="kitchen-limit" style={styles.limit}>Only the first {MAX_KITCHEN_INGREDIENTS} are used.</Text> : null}

          <View style={styles.chips}>
            {list.map((name) => (
              <View key={name} testID={`kitchen-chip-${name}`} style={styles.chip}>
                <Text style={styles.chipText}>{name}</Text>
                <TouchableOpacity testID={`kitchen-remove-${name}`} accessibilityRole="button" accessibilityLabel={`Remove ${name}`} hitSlop={8} onPress={() => remove(name)}>
                  <Text style={styles.chipX}>{'×'}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>

          <View style={styles.buttons}>
            <TouchableOpacity testID="kitchen-cancel" accessibilityRole="button" style={[styles.button, styles.cancel]} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="kitchen-find"
              accessibilityRole="button"
              accessibilityState={{ disabled: all.length === 0 }}
              disabled={all.length === 0}
              style={[styles.button, styles.confirm, all.length === 0 && styles.confirmOff]}
              onPress={() => onSubmit(all)}>
              <Text style={styles.confirmText}>Find recipes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  dismiss: { flex: 1 },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  title: { fontSize: 18, fontWeight: '700', color: '#000' },
  sub: { fontSize: 13, color: '#666', marginTop: 4, marginBottom: 14, lineHeight: 18 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, backgroundColor: '#F5F5F5', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#000' },
  addBtn: { backgroundColor: '#000', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13 },
  addBtnOff: { backgroundColor: '#CCC' },
  addText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  limit: { fontSize: 12, color: '#B45309', marginTop: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14, minHeight: 34 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F0F0F0', borderRadius: 999, paddingLeft: 12, paddingRight: 10, paddingVertical: 7 },
  chipText: { fontSize: 13, fontWeight: '600', color: '#222' },
  chipX: { fontSize: 18, lineHeight: 18, color: '#666' },
  buttons: { flexDirection: 'row', gap: 12, marginTop: 22 },
  button: { flex: 1, paddingVertical: 14, borderRadius: 999, alignItems: 'center' },
  cancel: { borderWidth: 1, borderColor: '#000' },
  cancelText: { fontSize: 16, fontWeight: '600', color: '#000' },
  confirm: { backgroundColor: '#000' },
  confirmOff: { backgroundColor: '#CCC' },
  confirmText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});
