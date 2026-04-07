import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Video, Calendar, Clock, Star, Phone } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useTelehealthStore } from '@/store/telehealthStore';

export default function TelehealthScreen() {
  const [activeTab, setActiveTab] = useState<'consultations' | 'resources'>('consultations');
  
  const { doctors, appointments, resources, bookAppointment } = useTelehealthStore() as {
    doctors: any[];
    appointments: any[];
    resources: any[];
    bookAppointment: (doctorId: string, timeSlot: string) => void;
  };

  const handleBookAppointment = (doctorId: string, timeSlot: string) => {
    Alert.alert(
      'Book Appointment',
      `Would you like to book an appointment for ${timeSlot}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Book',
          onPress: () => {
            bookAppointment(doctorId, timeSlot);
            Alert.alert('Success', 'Appointment booked successfully!');
          },
        },
      ]
    );
  };

  const renderConsultations = () => (
    <ScrollView style={styles.content}>
      <Text style={styles.sectionTitle}>Available Doctors</Text>
      
      {doctors.map((doctor: any) => (
        <View key={doctor.id} style={styles.doctorCard}>
          <Image source={{ uri: doctor.image }} style={styles.doctorImage} />
          
          <View style={styles.doctorInfo}>
            <Text style={styles.doctorName}>{doctor.name}</Text>
            <Text style={styles.doctorSpecialty}>{doctor.specialty}</Text>
            
            <View style={styles.doctorRating}>
              <Star size={14} color="#FFD700" fill="#FFD700" />
              <Text style={styles.ratingText}>{doctor.rating}</Text>
              <Text style={styles.reviewCount}>({doctor.reviews} reviews)</Text>
            </View>
            
            <Text style={styles.doctorPrice}>${doctor.price}/session</Text>
          </View>
          
          <View style={styles.doctorActions}>
            <TouchableOpacity
              style={styles.bookButton}
              onPress={() => handleBookAppointment(doctor.id, 'Next Available')}
            >
              <Calendar size={16} color="white" />
              <Text style={styles.bookButtonText}>Book</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      <Text style={styles.sectionTitle}>Upcoming Appointments</Text>
      
      {appointments.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No upcoming appointments</Text>
        </View>
      ) : (
        appointments.map((appointment: any) => (
          <View key={appointment.id} style={styles.appointmentCard}>
            <View style={styles.appointmentInfo}>
              <Text style={styles.appointmentDoctor}>{appointment.doctorName}</Text>
              <Text style={styles.appointmentDate}>{appointment.date}</Text>
              <Text style={styles.appointmentTime}>{appointment.time}</Text>
            </View>
            
            <TouchableOpacity style={styles.joinButton}>
              <Video size={16} color="white" />
              <Text style={styles.joinButtonText}>Join Call</Text>
            </TouchableOpacity>
          </View>
        ))
      )}
    </ScrollView>
  );

  const renderResources = () => (
    <ScrollView style={styles.content}>
      {resources.map((resource: any) => (
        <TouchableOpacity key={resource.id} style={styles.resourceCard}>
          <Image source={{ uri: resource.image }} style={styles.resourceImage} />
          
          <View style={styles.resourceInfo}>
            <Text style={styles.resourceTitle}>{resource.title}</Text>
            <Text style={styles.resourceDescription}>{resource.description}</Text>
            
            <View style={styles.resourceMeta}>
              <Clock size={12} color={Colors.text.secondary} />
              <Text style={styles.resourceDuration}>{resource.duration}</Text>
              <Text style={styles.resourceCategory}>{resource.category}</Text>
            </View>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Telehealth', headerShown: false }} />
      
      <View style={styles.header}>
        <Text style={styles.title}>Telehealth</Text>
      </View>

      <View style={styles.tabContainer}>
        {(['consultations', 'resources'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'consultations' && renderConsultations()}
      {activeTab === 'resources' && renderResources()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 4,
  },
  activeTab: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  activeTabText: {
    color: 'white',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 16,
    marginTop: 8,
  },
  doctorCard: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
  },
  doctorImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 16,
  },
  doctorInfo: {
    flex: 1,
  },
  doctorName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  doctorSpecialty: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 8,
  },
  doctorRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  reviewCount: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  doctorPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
  doctorActions: {
    justifyContent: 'center',
  },
  bookButton: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bookButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyState: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: Colors.text.secondary,
  },
  appointmentCard: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  appointmentInfo: {
    flex: 1,
  },
  appointmentDoctor: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  appointmentDate: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 2,
  },
  appointmentTime: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  joinButton: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  joinButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  resourceCard: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
  },
  resourceImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 16,
  },
  resourceInfo: {
    flex: 1,
  },
  resourceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  resourceDescription: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 8,
    lineHeight: 20,
  },
  resourceMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resourceDuration: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  resourceCategory: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '500',
  },
});