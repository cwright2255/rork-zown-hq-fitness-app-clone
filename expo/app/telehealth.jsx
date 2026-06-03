import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Video, Calendar, Star } from 'lucide-react-native';
import ScreenHeader from '@/components/ScreenHeader';
import PrimaryButton from '@/components/PrimaryButton';
import { useTelehealthStore } from '@/store/telehealthStore';
import { tokens } from '../../theme/tokens';

export { ScreenErrorBoundary as ErrorBoundary } from '@/components/ScreenErrorBoundary';

export default function TelehealthScreen() {
  const store = useTelehealthStore();
  const doctors = store?.doctors || [];
  const appointments = store?.appointments || [];
  const [tab, setTab] = useState('providers');

  const handleBook = (doctor) => {
    try {
      if (store?.bookAppointment) {
        store.bookAppointment(doctor.id, { date: new Date().toISOString() });
      }
      Alert.alert('Booked', `Appointment with ${doctor.name} requested.`);
    } catch (e) {
      Alert.alert('Error', 'Unable to book.');
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Telehealth" showBack />
      <ScrollView contentContainerStyle={{ padding: tokens.spacing.md, paddingBottom: 40 }}>
        <View style={styles.tabRow}>
          {['providers', 'appointments'].map(t => {
            const active = tab === t;
            return (
              <TouchableOpacity
                key={t}
                onPress={() => setTab(t)}
                style={[styles.tab, active && styles.tabActive]}>
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {t === 'providers' ? 'Providers' : 'Appointments'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {tab === 'providers' ? (
          doctors.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.empty}>No providers available.</Text>
            </View>
          ) : (
            doctors.map(d => (
              <View key={d.id} style={styles.card}>
                <View style={styles.cardRow}>
                  <View style={styles.avatar}>
                    <Video size={20} color={tokens.colors.dark_navy.bg_primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{d.name}</Text>
                    <Text style={styles.specialty}>{d.specialty || 'General Practice'}</Text>
                    {d.rating ? (
                      <View style={styles.ratingRow}>
                        <Star size={12} color="#F59E0B" fill="#F59E0B" />
                        <Text style={styles.ratingText}>{d.rating}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <View style={{ marginTop: 12 }}>
                  <PrimaryButton
                    title="Book Consultation"
                    variant="outline"
                    onPress={() => handleBook(d)}
                  />
                </View>
              </View>
            ))
          )
        ) : (
          appointments.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.empty}>No appointments yet.</Text>
            </View>
          ) : (
            appointments.map(a => (
              <View key={a.id} style={styles.card}>
                <View style={styles.cardRow}>
                  <Calendar size={18} color={tokens.colors.dark_navy.bg_primary} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.name}>{a.doctorName || 'Appointment'}</Text>
                    <Text style={styles.specialty}>
                      {a.date ? new Date(a.date).toLocaleString() : 'Pending'}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.colors.dark_navy.text_primary },
  tabRow: { flexDirection: 'row', gap: tokens.spacing.sm, marginBottom: tokens.spacing.md },
  tab: {
    backgroundColor: tokens.colors.dark_navy.text_primary, borderWidth: 1, borderColor: tokens.colors.dark_navy.border,
    paddingHorizontal: tokens.spacing.md, paddingVertical: tokens.spacing.sm, borderRadius: 999,
  },
  tabActive: { backgroundColor: tokens.colors.dark_navy.bg_primary, borderColor: tokens.colors.dark_navy.bg_primary },
  tabText: { color: tokens.colors.dark_navy.text_muted, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: tokens.colors.dark_navy.text_primary },
  card: {
    backgroundColor: tokens.colors.dark_navy.text_primary, borderWidth: 1, borderColor: tokens.colors.dark_navy.border,
    borderRadius: tokens.radius.lg, padding: tokens.spacing.md, marginBottom: 10,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.md },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: tokens.colors.dark_navy.bg_card,
    alignItems: 'center', justifyContent: 'center',
  },
  name: { color: tokens.colors.dark_navy.bg_primary, fontSize: 15, fontWeight: '600' },
  specialty: { color: tokens.colors.dark_navy.text_muted, fontSize: 12, marginTop: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  ratingText: { color: '#F59E0B', fontSize: 12, fontWeight: '600' },
  emptyCard: {
    backgroundColor: tokens.colors.dark_navy.text_primary, borderWidth: 1, borderColor: tokens.colors.dark_navy.border,
    borderRadius: tokens.radius.lg, padding: tokens.spacing.lg, alignItems: 'center',
  },
  empty: { color: tokens.colors.dark_navy.text_muted, fontSize: 14 },
});
