import { generateGpx } from '@/utils/gpx';
import type { SavedRoute } from '@/types/route';

const route: SavedRoute = {
  id: 'r1',
  name: 'Morning Hike',
  points: [
    { latitude: 37.7749, longitude: -122.4194, altitude: 50, timestamp: 1000000000000 },
    { latitude: 37.7759, longitude: -122.4184, altitude: 60, timestamp: 1000000005000 },
  ],
  distance_m: 150,
  duration_s: 5,
  elevation_gain_m: 10,
  created_at: 1000000000000,
};

test('generateGpx produces valid GPX 1.1 XML declaration', () => {
  const gpx = generateGpx(route);
  expect(gpx).toContain('<?xml version="1.0" encoding="UTF-8"?>');
  expect(gpx).toContain('<gpx version="1.1"');
  expect(gpx).toContain('xmlns="http://www.topografix.com/GPX/1/1"');
});

test('generateGpx includes route name in metadata and trk', () => {
  const gpx = generateGpx(route);
  expect(gpx.match(/<name>Morning Hike<\/name>/g)?.length).toBe(2);
});

test('generateGpx includes all track points', () => {
  const gpx = generateGpx(route);
  expect(gpx).toContain('lat="37.7749" lon="-122.4194"');
  expect(gpx).toContain('lat="37.7759" lon="-122.4184"');
});

test('generateGpx includes elevation for non-null altitudes', () => {
  const gpx = generateGpx(route);
  expect(gpx).toContain('<ele>50.0</ele>');
  expect(gpx).toContain('<ele>60.0</ele>');
});

test('generateGpx timestamps are ISO 8601', () => {
  const gpx = generateGpx(route);
  expect(gpx).toMatch(/<time>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z<\/time>/);
});

test('generateGpx escapes XML special chars in route name', () => {
  const r: SavedRoute = { ...route, name: 'Tom & Jerry <Trail>' };
  const gpx = generateGpx(r);
  expect(gpx).toContain('Tom &amp; Jerry &lt;Trail&gt;');
  expect(gpx).not.toContain('Tom & Jerry');
});

test('generateGpx omits ele element when altitude is null', () => {
  const r: SavedRoute = {
    ...route,
    points: [{ latitude: 37.7749, longitude: -122.4194, altitude: null, timestamp: 1000000000000 }],
  };
  const gpx = generateGpx(r);
  expect(gpx).not.toContain('<ele>');
});
