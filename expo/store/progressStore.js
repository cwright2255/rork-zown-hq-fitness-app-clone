import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useProgressStore = create(
  persist(
    (set, get) => ({
      entries: [],
      isLoading: false,
      
      addEntry: (entry) => {
        set(state => ({
          entries: [...state.entries, entry]
        }));
      },
      
      updateEntry: (id, updatedEntry) => {
        const { entries } = get();
        const entryIndex = entries.findIndex(e => e.id === id);
        
        if (entryIndex >= 0) {
          const updatedEntries = [...entries];
          updatedEntries[entryIndex] = {
            ...updatedEntries[entryIndex],
            ...updatedEntry
          };
          
          set({ entries: updatedEntries });
        }
      },
      
      deleteEntry: (id) => {
        set(state => ({
          entries: state.entries.filter(entry => entry.id !== id)
        }));
      },
      
      getLatestEntry: () => {
        const { entries } = get();
        if (entries.length === 0) return undefined;
        
        // Sort by date (newest first) and return the first one
        return [...entries].sort((a, b) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        )[0];
      },
      
      getEntriesByDateRange: (startDate, endDate) => {
        const { entries } = get();
        const start = new Date(startDate).getTime();
        const end = new Date(endDate).getTime();
        
        return entries.filter(entry => {
          const entryDate = new Date(entry.date).getTime();
          return entryDate >= start && entryDate <= end;
        });
      },

      getLatestBodyScan: () => {
        const { entries } = get();
        if (entries.length === 0) return undefined;
        
        // Find entries with body scans, sort by date (newest first) and return the first one
        const entriesWithScans = entries.filter(entry => entry.bodyScan);
        if (entriesWithScans.length === 0) {
          // Create a default body scan if none exists
          return {
            id: 'default-scan',
            date: new Date().toISOString(),
            measurements: {
              chest: 95,
              waist: 80,
              hips: 100,
              arms: 32,
              thighs: 55,
            },
            modelUrl: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8Zml0bmVzcyUyMHBlcnNvbnxlbnwwfHwwfHx8MA%3D%3D&auto=format&fit=crop&w=800&q=60',
            thumbnailUrl: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8Zml0bmVzcyUyMHBlcnNvbnxlbnwwfHwwfHx8MA%3D%3D&auto=format&fit=crop&w=800&q=60',
          };
        }
        
        return entriesWithScans.sort((a, b) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        )[0].bodyScan;
      },
    }),
    {
      name: 'zown-progress-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);