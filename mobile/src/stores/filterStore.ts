import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Difficulty, TrailType } from '@/types/trail';

interface FilterState {
  difficulty: Difficulty | null;
  trailType: TrailType | null;
  maxDistanceKm: number | null;
  setDifficulty: (d: Difficulty | null) => void;
  setTrailType: (t: TrailType | null) => void;
  setMaxDistanceKm: (km: number | null) => void;
  clearFilters: () => void;
}

const INITIAL = { difficulty: null, trailType: null, maxDistanceKm: null };

export const useFilterStore = create<FilterState>()(
  persist(
    (set) => ({
      ...INITIAL,
      setDifficulty: (difficulty) => set({ difficulty }),
      setTrailType: (trailType) => set({ trailType }),
      setMaxDistanceKm: (maxDistanceKm) => set({ maxDistanceKm }),
      clearFilters: () => set(INITIAL),
    }),
    {
      name: 'trailforge-filters',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
