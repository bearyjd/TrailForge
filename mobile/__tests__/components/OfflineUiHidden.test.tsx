import React from 'react';
import { render, screen } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

import SavedScreen from '../../app/(tabs)/saved';
import { OFFLINE_MAPS_ENABLED } from '@/constants/features';

it('keeps the offline maps flag off until real region tiles exist', () => {
  expect(OFFLINE_MAPS_ENABLED).toBe(false);
});

it('does not render the Manage Downloads entry point', () => {
  render(<SavedScreen />);
  expect(screen.queryByText(/Manage Downloads/)).toBeNull();
});
