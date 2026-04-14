import { useOfflineStore } from '@/stores/offlineStore';
import type { OfflinePack } from '@/types/offline';

const pack: OfflinePack = {
  id: 'trail-123',
  name: 'Test Trail',
  type: 'trail-local',
  trail_id: '123',
  size_bytes: 1_000_000,
  downloaded_at: 0,
  status: 'downloading',
};

beforeEach(() => useOfflineStore.setState({ packs: {}, downloadProgress: {} }));

test('addPack stores the pack', () => {
  useOfflineStore.getState().addPack(pack);
  expect(useOfflineStore.getState().packs['trail-123']).toMatchObject({ status: 'downloading' });
});

test('updatePackStatus transitions to complete', () => {
  useOfflineStore.getState().addPack(pack);
  useOfflineStore.getState().updatePackStatus('trail-123', 'complete');
  expect(useOfflineStore.getState().packs['trail-123'].status).toBe('complete');
  expect(useOfflineStore.getState().packs['trail-123'].downloaded_at).toBeGreaterThan(0);
});

test('updateProgress records fractional progress', () => {
  useOfflineStore.getState().updateProgress('trail-123', 0.42);
  expect(useOfflineStore.getState().downloadProgress['trail-123']).toBe(0.42);
});

test('deletePack removes pack and progress', () => {
  useOfflineStore.getState().addPack(pack);
  useOfflineStore.getState().updateProgress('trail-123', 0.5);
  useOfflineStore.getState().deletePack('trail-123');
  expect(useOfflineStore.getState().packs['trail-123']).toBeUndefined();
  expect(useOfflineStore.getState().downloadProgress['trail-123']).toBeUndefined();
});

test('hasPack returns false when status is not complete', () => {
  useOfflineStore.getState().addPack(pack);
  expect(useOfflineStore.getState().hasPack('trail-123')).toBe(false);
});

test('hasPack returns true after complete', () => {
  useOfflineStore.getState().addPack(pack);
  useOfflineStore.getState().updatePackStatus('trail-123', 'complete');
  expect(useOfflineStore.getState().hasPack('trail-123')).toBe(true);
});
