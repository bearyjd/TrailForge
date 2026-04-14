import { useSavedRoutesStore } from '@/stores/savedRoutesStore';
import type { SavedRoute } from '@/types/route';

const route: SavedRoute = {
  id: 'r1',
  name: 'Test Route',
  points: [],
  distance_m: 1000,
  duration_s: 300,
  elevation_gain_m: 50,
  created_at: Date.now(),
};

beforeEach(() => useSavedRoutesStore.setState({ routes: {} }));

test('saveRoute stores the route', () => {
  useSavedRoutesStore.getState().saveRoute(route);
  expect(useSavedRoutesStore.getState().routes['r1']).toEqual(route);
});

test('deleteRoute removes the route', () => {
  useSavedRoutesStore.getState().saveRoute(route);
  useSavedRoutesStore.getState().deleteRoute('r1');
  expect(useSavedRoutesStore.getState().routes['r1']).toBeUndefined();
});

test('getRoute returns the route by id', () => {
  useSavedRoutesStore.getState().saveRoute(route);
  expect(useSavedRoutesStore.getState().getRoute('r1')).toEqual(route);
});

test('getRoute returns undefined for missing id', () => {
  expect(useSavedRoutesStore.getState().getRoute('nope')).toBeUndefined();
});
