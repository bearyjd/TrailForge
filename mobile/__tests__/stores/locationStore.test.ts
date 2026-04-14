import { useLocationStore } from '@/stores/locationStore';

beforeEach(() => useLocationStore.setState({ coords: null, isWatching: false }));

test('setCoords updates coords', () => {
  useLocationStore.getState().setCoords({ latitude: 37.77, longitude: -122.42, altitude: 50, accuracy: 5, heading: 180 });
  expect(useLocationStore.getState().coords?.latitude).toBe(37.77);
});

test('setWatching updates isWatching', () => {
  useLocationStore.getState().setWatching(true);
  expect(useLocationStore.getState().isWatching).toBe(true);
});

test('setCoords with null clears coords', () => {
  useLocationStore.getState().setCoords({ latitude: 1, longitude: 2, altitude: null, accuracy: null, heading: null });
  useLocationStore.getState().setCoords(null);
  expect(useLocationStore.getState().coords).toBeNull();
});
