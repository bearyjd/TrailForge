import { create } from 'zustand';

export interface LocationCoords {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  heading: number | null;
}

interface LocationState {
  coords: LocationCoords | null;
  isWatching: boolean;
  setCoords: (coords: LocationCoords | null) => void;
  setWatching: (watching: boolean) => void;
}

export const useLocationStore = create<LocationState>()((set) => ({
  coords: null,
  isWatching: false,
  setCoords: (coords) => set({ coords }),
  setWatching: (isWatching) => set({ isWatching }),
}));
