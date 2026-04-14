import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RoutePoint } from '@/types/route';
import { computeRouteDistance, computeElevationGain } from '@/utils/geo';

interface RecordingState {
  isRecording: boolean;
  currentRoute: RoutePoint[];
  startTime: number | null;
  startRecording: () => void;
  stopRecording: () => void;
  addPoint: (point: RoutePoint) => void;
  clearRoute: () => void;
  getStats: () => { distance_m: number; duration_s: number; elevation_gain_m: number };
}

export const useRecordingStore = create<RecordingState>()(
  persist(
    (set, get) => ({
      isRecording: false,
      currentRoute: [],
      startTime: null,
      startRecording: () =>
        set({ isRecording: true, startTime: Date.now(), currentRoute: [] }),
      stopRecording: () => set({ isRecording: false }),
      addPoint: (point) =>
        set((state) => ({ currentRoute: [...state.currentRoute, point] })),
      clearRoute: () => set({ currentRoute: [], startTime: null }),
      getStats: () => {
        const { currentRoute, startTime } = get();
        return {
          distance_m: computeRouteDistance(currentRoute),
          elevation_gain_m: computeElevationGain(currentRoute),
          duration_s: startTime ? Math.floor((Date.now() - startTime) / 1000) : 0,
        };
      },
    }),
    {
      name: 'trailforge-recording',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
