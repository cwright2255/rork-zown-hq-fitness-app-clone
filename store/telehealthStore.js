import { create } from 'zustand';

export const useTelehealthStore = create((set) => ({
  doctors: [
    {
      id: '1',
      name: 'Dr. Sarah Mitchell',
      specialty: 'Sports Medicine',
      image: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=200&h=200&fit=crop&crop=face',
      rating: 4.9,
      reviews: 127,
      price: 150,
      availableSlots: ['9:00 AM', '11:00 AM', '2:00 PM', '4:00 PM'],
    },
    {
      id: '2',
      name: 'Dr. Michael Chen',
      specialty: 'Nutrition & Dietetics',
      image: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=200&h=200&fit=crop&crop=face',
      rating: 4.8,
      reviews: 89,
      price: 120,
      availableSlots: ['10:00 AM', '1:00 PM', '3:00 PM', '5:00 PM'],
    },
    {
      id: '3',
      name: 'Dr. Emily Rodriguez',
      specialty: 'Physical Therapy',
      image: 'https://images.unsplash.com/photo-1594824475317-d3b9b4b8b1b1?w=200&h=200&fit=crop&crop=face',
      rating: 4.7,
      reviews: 156,
      price: 100,
      availableSlots: ['8:00 AM', '12:00 PM', '3:30 PM', '6:00 PM'],
    },
  ],
  appointments: [],
  resources: [
    {
      id: '1',
      title: 'Understanding Macronutrients',
      description: 'Learn about proteins, carbs, and fats for optimal performance',
      image: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=200&h=200&fit=crop',
      duration: '15 min',
      category: 'Nutrition',
      url: 'https://example.com/macronutrients',
    },
    {
      id: '2',
      title: 'Injury Prevention Exercises',
      description: 'Essential stretches and exercises to prevent common injuries',
      image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=200&h=200&fit=crop',
      duration: '20 min',
      category: 'Physical Therapy',
      url: 'https://example.com/injury-prevention',
    },
    {
      id: '3',
      title: 'Sleep and Recovery',
      description: 'How quality sleep impacts your fitness goals',
      image: 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?w=200&h=200&fit=crop',
      duration: '12 min',
      category: 'Wellness',
      url: 'https://example.com/sleep-recovery',
    },
    {
      id: '4',
      title: 'Hydration Guidelines',
      description: 'Proper hydration strategies for athletes and fitness enthusiasts',
      image: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=200&h=200&fit=crop',
      duration: '10 min',
      category: 'Nutrition',
      url: 'https://example.com/hydration',
    },
  ],
  bookAppointment: (doctorId, timeSlot) =>
    set((state) => {
      const doctor = state.doctors.find(d => d.id === doctorId);
      if (!doctor) return state;

      const newAppointment = {
        id: Math.random().toString(36).substr(2, 9),
        doctorId,
        doctorName: doctor.name,
        date: 'Tomorrow',
        time: timeSlot,
        status: 'scheduled',
      };

      return {
        appointments: [...state.appointments, newAppointment],
      };
    }),
  cancelAppointment: (appointmentId) =>
    set((state) => ({
      appointments: state.appointments.filter(apt => apt.id !== appointmentId),
    })),
}));