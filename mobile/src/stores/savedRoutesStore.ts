import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SavedRoute } from '@/types/route';

interface SavedRoutesState {
  routes: Record<string, SavedRoute>;
  saveRoute: (route: SavedRoute) => void;
  deleteRoute: (id: string) => void;
  getRoute: (id: string) => SavedRoute | undefined;
}

export const useSavedRoutesStore = create<SavedRoutesState>()(
  persist(
    (set, get) => ({
      routes: {},
      saveRoute: (route) =>
        set((state) => ({ routes: { ...state.routes, [route.id]: route } })),
      deleteRoute: (id) =>
        set((state) => {
          const { [id]: _, ...rest } = state.routes;
          return { routes: rest };
        }),
      getRoute: (id) => get().routes[id],
    }),
    {
      name: 'trailforge-saved-routes',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
