// components/ModerationSheet.jsx
//
// The menu behind the three-dot button on someone else's post, comment or message: Report it, Block the person, and (for a comment you
// are allowed to remove) Delete it. One component for the Social and Community feeds and the message thread, so they cannot drift apart.
//
// Report asks why (lib/moderation.js REPORT_REASONS), then files a report (services/reportService.js). Block asks to be sure, then
// blocks the person (store/blockStore.js): their posts and comments are hidden and the two of you cannot message each other.
// It is one Modal that changes what it shows, not two Modals in a row, because a phone drops a Modal that opens while another is closing.
//
// `target` is what postTarget / commentTarget / messageTarget in lib/moderation.js give. The sheet is shut when `target` is null.
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { REPORT_KINDS, REPORT_REASONS } from '@/lib/moderation';
import { submitReport } from '@/services/reportService';
import { useBlockStore } from '@/store/blockStore';

export default function ModerationSheet({ target, ...rest }) {
  if (!target) return null;
  // A new body for each thing it is opened on, so it always starts at the menu.
  return <SheetBody key={`${target.kind}:${target.id}`} target={target} {...rest} />;
}

function SheetBody({ target, myUid, onClose, onDeleteComment, onBlocked }) {
  const [step, setStep] = useState('menu'); // 'menu' | 'reasons'
  const [sending, setSending] = useState(false);

  const mine = !!myUid && target.authorId === myUid;
  const name = target.authorName || 'this person';
  const close = () => { if (!sending) onClose(); };

  const sendReport = async (reason) => {
    if (sending) return;
    setSending(true);
    try {
      const result = await submitReport({
        reporterId: myUid,
        kind: target.kind,
        targetId: target.id,
        targetPath: target.path,
        targetAuthorId: target.authorId,
        reason: reason.key,
        text: target.text,
      });
      if (result.status === 'already') Alert.alert('Already reported', "You've already reported this. We have it.");
      else Alert.alert('Report sent', 'Thanks. We review every report and remove anything that breaks the rules.');
      onClose();
    } catch (e) {
      Alert.alert("Couldn't send the report", 'Check your connection and try again. If you reported this before, we already have it.');
    } finally {
      setSending(false);
    }
  };

  const block = async () => {
    const done = await useBlockStore.getState().blockUser({
      myUid, uid: target.authorId, name: target.authorName, avatar: target.authorAvatar,
    });
    if (done) {
      onClose();
      if (onBlocked) onBlocked(target);
    } else {
      Alert.alert("Couldn't block", 'Check your connection and try again.');
    }
  };

  const confirmBlock = () => {
    Alert.alert(
      `Block ${name}?`,
      "You won't see their posts or comments, and neither of you will be able to message the other. You can undo this any time in Settings, under Blocked people.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Block', style: 'destructive', onPress: block },
      ],
    );
  };

  const confirmDelete = () => {
    Alert.alert('Delete comment?', 'This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { onClose(); if (onDeleteComment) onDeleteComment(target); } },
    ]);
  };

  return (
    <Modal visible animationType="fade" transparent onRequestClose={close}>
      <Pressable style={s.overlay} onPress={close}>
        <Pressable style={s.card} onPress={() => {}}>
          {step === 'menu' ? (
            <>
              {!mine && !!REPORT_KINDS[target.kind] && (
                <Row testID="mod-report" icon="flag-outline" label={`Report ${target.kind}`} onPress={() => setStep('reasons')} />
              )}
              {!mine && (
                <Row testID="mod-block" icon="ban-outline" label={`Block ${name}`} onPress={confirmBlock} />
              )}
              {target.canDelete && (
                <Row testID="mod-delete" icon="trash-outline" label="Delete comment" danger onPress={confirmDelete} />
              )}
              <Row testID="mod-cancel" icon="close-outline" label="Cancel" last onPress={close} />
            </>
          ) : (
            <>
              <View style={s.header}>
                <Text style={s.title}>{`Why are you reporting this ${target.kind}?`}</Text>
                {sending && <ActivityIndicator size="small" color="#000" />}
              </View>
              {REPORT_REASONS.map((reason) => (
                <Row key={reason.key} testID={`mod-reason-${reason.key}`} label={reason.label} disabled={sending} onPress={() => sendReport(reason)} />
              ))}
              <Row testID="mod-back" icon="chevron-back" label="Back" last disabled={sending} onPress={() => setStep('menu')} />
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Row({ icon, label, onPress, danger, last, disabled, testID }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      style={[s.row, last && { borderBottomWidth: 0 }, disabled && { opacity: 0.5 }]}
      onPress={onPress}
    >
      {!!icon && <Ionicons name={icon} size={18} color={danger ? '#DC2626' : '#000'} />}
      <Text style={[s.rowText, danger && { color: '#DC2626' }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#FFF', borderRadius: 16, width: 300, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  title: { flex: 1, fontSize: 14, fontWeight: '700', color: '#000' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  rowText: { fontSize: 14, fontWeight: '600', color: '#000' },
});
