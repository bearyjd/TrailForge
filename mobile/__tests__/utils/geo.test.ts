import { haversineDistance, computeRouteDistance, computeElevationGain } from '@/utils/geo';

test('haversineDistance returns 0 for same point', () => {
  expect(haversineDistance(40, -74, 40, -74)).toBe(0);
});

test('haversineDistance London to Paris is ~341 km', () => {
  const dist = haversineDistance(51.5074, -0.1278, 48.8566, 2.3522);
  expect(dist).toBeGreaterThan(340_000);
  expect(dist).toBeLessThan(344_000);
});

test('computeRouteDistance sums segment distances', () => {
  const points = [
    { latitude: 0, longitude: 0 },
    { latitude: 0, longitude: 1 },
    { latitude: 0, longitude: 2 },
  ];
  const expected = haversineDistance(0, 0, 0, 1) + haversineDistance(0, 1, 0, 2);
  expect(computeRouteDistance(points)).toBeCloseTo(expected, 0);
});

test('computeRouteDistance returns 0 for single point', () => {
  expect(computeRouteDistance([{ latitude: 0, longitude: 0 }])).toBe(0);
});

test('computeElevationGain sums only positive altitude deltas', () => {
  const points = [
    { altitude: 100 },
    { altitude: 120 }, // +20
    { altitude: 110 }, // -10 (ignored)
    { altitude: 130 }, // +20
  ];
  expect(computeElevationGain(points)).toBe(40);
});

test('computeElevationGain skips null altitudes', () => {
  const points = [
    { altitude: 100 },
    { altitude: null }, // skip
    { altitude: 140 }, // null prev → skip
  ];
  expect(computeElevationGain(points)).toBe(0);
});

test('computeElevationGain returns 0 for empty array', () => {
  expect(computeElevationGain([])).toBe(0);
});
