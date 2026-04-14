import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { OfflinePack } from '@/types/offline';

interface OfflineState {
  packs: Record<string, OfflinePack>;
  downloadProgress: Record<string, number>;
  addPack: (pack: OfflinePack) => void;
  updatePackStatus: (id: string, status: OfflinePack['status'], localPath?: string) => void;
  updateProgress: (id: string, progress: number) => void;
  deletePack: (id: string) => void;
  hasPack: (id: string) => boolean;
}

export const useOfflineStore = create<OfflineState>()(
  persist(
    (set, get) => ({
      packs: {},
      downloadProgress: {},
      addPack: (pack) =>
        set((state) => ({ packs: { ...state.packs, [pack.id]: pack } })),
      updatePackStatus: (id, status, localPath) =>
        set((state) => ({
          packs: {
            ...state.packs,
            [id]: {
              ...state.packs[id],
              status,
              ...(localPath ? { local_path: localPath } : {}),
              ...(status === 'complete' ? { downloaded_at: Date.now() } : {}),
            },
          },
        })),
      updateProgress: (id, progress) =>
        set((state) => ({ downloadProgress: { ...state.downloadProgress, [id]: progress } })),
      deletePack: (id) =>
        set((state) => {
          const { [id]: _p, ...packs } = state.packs;
          const { [id]: _d, ...downloadProgress } = state.downloadProgress;
          return { packs, downloadProgress };
        }),
      hasPack: (id) => get().packs[id]?.status === 'complete',
    }),
    {
      name: 'trailforge-offline',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ packs: state.packs }),
    }
  )
);
