import { useSavedStore } from '@/stores/savedStore';
import type { Trail } from '@/types/trail';

const TRAIL: Trail = {
  id: 'way_1',
  name: 'Test Trail',
  difficulty: 'easy',
  distance_m: 1000,
  elevation_gain_m: null,
  trail_type: 'hiking',
  description: null,
  geometry: { type: 'LineString', coordinates: [[8.5, 47.1]] },
};

describe('savedStore', () => {
  beforeEach(() => useSavedStore.setState({ savedTrails: {} }));

  it('saves and retrieves a trail', () => {
    useSavedStore.getState().saveTrail(TRAIL);
    const saved = useSavedStore.getState().savedTrails;
    expect(saved['way_1']).toBeDefined();
    expect(saved['way_1'].name).toBe('Test Trail');
  });

  it('removes a saved trail', () => {
    useSavedStore.getState().saveTrail(TRAIL);
    useSavedStore.getState().removeTrail('way_1');
    expect(useSavedStore.getState().savedTrails['way_1']).toBeUndefined();
  });

  it('checks if a trail is saved', () => {
    expect(useSavedStore.getState().isSaved('way_1')).toBe(false);
    useSavedStore.getState().saveTrail(TRAIL);
    expect(useSavedStore.getState().isSaved('way_1')).toBe(true);
  });
});
