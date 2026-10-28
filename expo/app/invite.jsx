// app/invite.jsx
//
// Invite your friends. The person has a code of their own (made by the server the first time this opens); sharing it sends a message with the
// App Store link and the code. A friend who joins with it, and types it in here (Have a friend's code?), gets free Pro days, and so does the
// person it came from. Everything that matters is the server's (functions/src/referrals.js): this screen shows what it says and asks it to act.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator, Share } from 'react-native';
import { useRouter } from 'expo-router';
import ScreenHeader from '@/components/ScreenHeader';
import PrimaryButton from '@/components/PrimaryButton';
import { fetchInviteStatus, redeemInviteCode } from '@/services/inviteService';
import { typedCode, codeIsComplete, codeIsFull, inviteMessage, redeemMessage, SERVER_UNREACHABLE } from '@/lib/invite';

const pluralDays = (n) => `${n} ${n === 1 ? 'day' : 'days'}`;

export default function InviteScreen() {
  const router = useRouter();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { ok, text } after Use code
  const latest = useRef(0);

  const load = useCallback(async () => {
    const mine = latest.current + 1;
    latest.current = mine;
    setLoading(true);
    setLoadFailed(false);
    try {
      const next = await fetchInviteStatus();
      if (latest.current !== mine) return;
      if (next && typeof next === 'object') setStatus(next);
      else setLoadFailed(true);
    } catch (e) {
      console.warn('[Invite] could not load the invite code:', e?.message);
      if (latest.current === mine) setLoadFailed(true);
    } finally {
      if (latest.current === mine) setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleShare = async () => {
    try {
      await Share.share({ message: inviteMessage(status) });
    } catch (e) {
      console.warn('[Invite] the share sheet did not open:', e?.message);
    }
  };

  const handleUseCode = async () => {
    if (busy || !codeIsComplete(typed)) return;
    setBusy(true);
    setResult(null);
    try {
      const answer = await redeemInviteCode(typed);
      const ok = !!(answer && answer.ok);
      setResult({ ok, text: redeemMessage(answer, status && status.rules) });
      if (ok) {
        setTyped('');
        load();
      }
    } catch (e) {
      console.warn('[Invite] could not use the code:', e?.message);
      setResult({ ok: false, text: SERVER_UNREACHABLE });
    } finally {
      setBusy(false);
    }
  };

  const rules = status && status.rules;
  const full = codeIsFull(status);

  return (
    <View style={styles.container}>
      <ScreenHeader title="Invite your friends" showBack />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {loading && !status && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#000" />
            <Text style={styles.loadingText}>Getting your invite code...</Text>
          </View>
        )}

        {loadFailed && !status && (
          <View style={styles.noticeBox}>
            <Text style={styles.noticeText}>{"Couldn't load your invite code. Check your connection and try again."}</Text>
            <Pressable style={styles.retry} onPress={load} accessibilityRole="button" accessibilityLabel="Try again">
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        )}

        {!!status && !!status.display && (
          <>
            <Text style={styles.label}>Your invite code</Text>
            <View style={styles.codeBox}>
              <Text style={styles.code} selectable testID="invite-code">{status.display}</Text>
            </View>
            {!!rules && (
              <Text style={styles.help}>
                {`When a friend joins with your code, you both get ${pluralDays(rules.friendDays)} of Pro free. It works for up to ${rules.maxRewardedInvites} friends, and for accounts made in the last ${pluralDays(rules.accountWindowDays)}.`}
              </Text>
            )}
            {full && <Text style={styles.help}>Your code has paid out for all the friends it can. You can still invite people to the app.</Text>}
            <View style={styles.shareRow}>
              <PrimaryButton title="Share invite" onPress={handleShare} />
            </View>

            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{status.joined}</Text>
                <Text style={styles.statLabel}>{status.joined === 1 ? 'Friend joined' : 'Friends joined'}</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{status.daysEarned}</Text>
                <Text style={styles.statLabel}>Pro days earned</Text>
              </View>
            </View>
          </>
        )}

        {!!status && (
          <View style={styles.redeem}>
            <Text style={styles.label}>Have a friend&apos;s code?</Text>
            {status.redeemed ? (
              <Text style={styles.help}>
                {status.friendDaysGiven > 0
                  ? `You joined with a friend's code and got ${pluralDays(status.friendDaysGiven)} of Pro.`
                  : "You joined with a friend's code."}
              </Text>
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  value={typed}
                  onChangeText={(t) => { setTyped(typedCode(t)); setResult(null); }}
                  placeholder="XXXX-XXXX"
                  placeholderTextColor="#999"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  autoComplete="off"
                  maxLength={9}
                  accessibilityLabel="Friend's invite code"
                  testID="invite-code-input"
                />
                <PrimaryButton
                  title="Use code"
                  variant="outline"
                  onPress={handleUseCode}
                  loading={busy}
                  disabled={!codeIsComplete(typed)}
                  style={styles.useButton}
                />
              </>
            )}
            {!!result && (
              <Text style={[styles.resultText, result.ok ? styles.resultOk : styles.resultError]} testID="invite-result">{result.text}</Text>
            )}
          </View>
        )}

        {/* The Home banner used to open the Community, and nothing else does: it stays one tap away from here. */}
        <Pressable
          style={styles.communityRow}
          onPress={() => router.push('/community')}
          accessibilityRole="button"
          accessibilityLabel="Open the Community"
        >
          <View style={styles.communityText}>
            <Text style={styles.communityTitle}>Community</Text>
            <Text style={styles.communitySub}>Posts and groups from other members</Text>
          </View>
          <Text style={styles.communityArrow}>›</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { padding: 20, paddingBottom: 60 },
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', color: '#999', marginBottom: 10 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  loadingText: { fontSize: 14, color: '#666' },
  noticeBox: { padding: 16, borderRadius: 14, backgroundColor: '#F6F6F6' },
  noticeText: { fontSize: 14, color: '#333', lineHeight: 21 },
  retry: { alignSelf: 'flex-start', marginTop: 12, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#000' },
  retryText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  codeBox: { paddingVertical: 22, borderRadius: 16, backgroundColor: '#F0F0F0', alignItems: 'center' },
  code: { fontSize: 34, fontWeight: '800', letterSpacing: 4, color: '#000' },
  help: { fontSize: 13, color: '#666', lineHeight: 19, marginTop: 12 },
  shareRow: { marginTop: 18 },
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  stat: { flex: 1, padding: 16, borderRadius: 14, backgroundColor: '#F6F6F6' },
  statValue: { fontSize: 26, fontWeight: '800', color: '#000' },
  statLabel: { fontSize: 12, color: '#666', marginTop: 2 },
  redeem: { marginTop: 36 },
  input: {
    height: 52, borderRadius: 14, backgroundColor: '#F6F6F6', paddingHorizontal: 16, fontSize: 20, fontWeight: '700', letterSpacing: 3, color: '#000',
  },
  useButton: { marginTop: 12 },
  resultText: { fontSize: 14, lineHeight: 20, marginTop: 14 },
  communityRow: { flexDirection: 'row', alignItems: 'center', marginTop: 36, padding: 16, borderRadius: 14, backgroundColor: '#F6F6F6' },
  communityText: { flex: 1 },
  communityTitle: { fontSize: 15, fontWeight: '700', color: '#000' },
  communitySub: { fontSize: 12, color: '#666', marginTop: 2 },
  communityArrow: { fontSize: 24, color: '#999' },
  resultOk: { color: '#16A34A' },
  resultError: { color: '#DC2626' },
});
