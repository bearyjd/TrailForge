import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Trail } from '@/types/trail';

interface SavedState {
  savedTrails: Record<string, Trail>;
  saveTrail: (trail: Trail) => void;
  removeTrail: (id: string) => void;
  isSaved: (id: string) => boolean;
}

export const useSavedStore = create<SavedState>()(
  persist(
    (set, get) => ({
      savedTrails: {},
      saveTrail: (trail) =>
        set((state) => ({ savedTrails: { ...state.savedTrails, [trail.id]: trail } })),
      removeTrail: (id) =>
        set((state) => {
          const { [id]: _, ...rest } = state.savedTrails;
          return { savedTrails: rest };
        }),
      isSaved: (id) => id in get().savedTrails,
    }),
    {
      name: 'trailforge-saved',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
