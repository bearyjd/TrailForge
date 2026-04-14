import { useRecordingStore } from '@/stores/recordingStore';
import type { RoutePoint } from '@/types/route';

beforeEach(() =>
  useRecordingStore.setState({ isRecording: false, currentRoute: [], startTime: null })
);

test('startRecording sets isRecording and startTime, clears route', () => {
  useRecordingStore.setState({ currentRoute: [{ latitude: 1, longitude: 1, altitude: null, timestamp: 0 }] });
  useRecordingStore.getState().startRecording();
  const s = useRecordingStore.getState();
  expect(s.isRecording).toBe(true);
  expect(s.startTime).toBeGreaterThan(0);
  expect(s.currentRoute).toHaveLength(0);
});

test('stopRecording sets isRecording false', () => {
  useRecordingStore.getState().startRecording();
  useRecordingStore.getState().stopRecording();
  expect(useRecordingStore.getState().isRecording).toBe(false);
});

test('addPoint appends to currentRoute', () => {
  const point: RoutePoint = { latitude: 37.77, longitude: -122.42, altitude: 50, timestamp: Date.now() };
  useRecordingStore.getState().addPoint(point);
  expect(useRecordingStore.getState().currentRoute).toHaveLength(1);
  expect(useRecordingStore.getState().currentRoute[0].latitude).toBe(37.77);
});

test('getStats returns zero distance for empty route', () => {
  const stats = useRecordingStore.getState().getStats();
  expect(stats.distance_m).toBe(0);
  expect(stats.elevation_gain_m).toBe(0);
});

test('getStats computes elevation gain from route points', () => {
  useRecordingStore.setState({
    isRecording: true,
    startTime: Date.now() - 10000,
    currentRoute: [
      { latitude: 37.77, longitude: -122.42, altitude: 100, timestamp: Date.now() - 10000 },
      { latitude: 37.78, longitude: -122.41, altitude: 150, timestamp: Date.now() },
    ],
  });
  const stats = useRecordingStore.getState().getStats();
  expect(stats.elevation_gain_m).toBe(50);
  expect(stats.duration_s).toBeGreaterThan(0);
});
