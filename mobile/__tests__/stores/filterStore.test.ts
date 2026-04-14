import { useFilterStore } from '@/stores/filterStore';

describe('filterStore', () => {
  beforeEach(() => useFilterStore.setState({ difficulty: null, trailType: null, maxDistanceKm: null }));

  it('defaults to no active filters', () => {
    const { difficulty, trailType, maxDistanceKm } = useFilterStore.getState();
    expect(difficulty).toBeNull();
    expect(trailType).toBeNull();
    expect(maxDistanceKm).toBeNull();
  });

  it('sets difficulty filter', () => {
    useFilterStore.getState().setDifficulty('moderate');
    expect(useFilterStore.getState().difficulty).toBe('moderate');
  });

  it('clears all filters', () => {
    useFilterStore.getState().setDifficulty('hard');
    useFilterStore.getState().clearFilters();
    expect(useFilterStore.getState().difficulty).toBeNull();
  });
});
