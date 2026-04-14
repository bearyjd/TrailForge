import { create } from 'zustand';
import type { BBox } from '@/types/trail';

interface MapState {
  bbox: BBox | null;
  selectedTrailId: string | null;
  isLoading: boolean;
  setBbox: (bbox: BBox | null) => void;
  setSelectedTrailId: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useMapStore = create<MapState>()((set) => ({
  bbox: null,
  selectedTrailId: null,
  isLoading: false,
  setBbox: (bbox) => set({ bbox }),
  setSelectedTrailId: (id) => set({ selectedTrailId: id }),
  setLoading: (isLoading) => set({ isLoading }),
}));
