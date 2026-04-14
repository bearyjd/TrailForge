const LocationAccuracy = { BestForNavigation: 6, High: 5, Balanced: 3, Low: 1, Lowest: 0 };

module.exports = {
  LocationAccuracy,
  Accuracy: LocationAccuracy,
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestBackgroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  startLocationUpdatesAsync: jest.fn().mockResolvedValue(undefined),
  stopLocationUpdatesAsync: jest.fn().mockResolvedValue(undefined),
  getCurrentPositionAsync: jest.fn().mockResolvedValue({
    coords: { latitude: 37.77, longitude: -122.42, altitude: 50, accuracy: 5, heading: 0 },
    timestamp: Date.now(),
  }),
};
