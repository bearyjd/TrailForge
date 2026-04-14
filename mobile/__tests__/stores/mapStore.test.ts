import { useMapStore } from '@/stores/mapStore';

describe('mapStore', () => {
  it('starts with no selected trail', () => {
    const { selectedTrailId } = useMapStore.getState();
    expect(selectedTrailId).toBeNull();
  });

  it('sets and clears selected trail', () => {
    useMapStore.getState().setSelectedTrailId('way_1');
    expect(useMapStore.getState().selectedTrailId).toBe('way_1');
    useMapStore.getState().setSelectedTrailId(null);
    expect(useMapStore.getState().selectedTrailId).toBeNull();
  });

  it('tracks loading state', () => {
    useMapStore.getState().setLoading(true);
    expect(useMapStore.getState().isLoading).toBe(true);
    useMapStore.getState().setLoading(false);
    expect(useMapStore.getState().isLoading).toBe(false);
  });
});
