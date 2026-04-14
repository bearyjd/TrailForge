import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

// Mock API client
jest.mock('@/api/trailApi', () => ({
  fetchTrail: jest.fn(),
  exportTrailToGarmin: jest.fn(),
  pollJobStatus: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'way_1' }),
  router: { back: jest.fn() },
}));

jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: jest.fn(),
}));

jest.mock('react-native/Libraries/Share/Share', () => ({
  share: jest.fn().mockResolvedValue({ action: 'sharedAction' }),
}));

import * as api from '@/api/trailApi';
import TrailDetailScreen from '../../app/trail/[id]';
import type { Trail, JobStatus } from '@/types/trail';

const TRAIL: Trail = {
  id: 'way_1', name: 'Oak Loop', difficulty: 'easy',
  distance_m: 2100, elevation_gain_m: null, trail_type: 'hiking',
  description: 'A pleasant loop.', geometry: { type: 'LineString', coordinates: [[8.5, 47.1]] },
};

beforeEach(() => jest.clearAllMocks());

it('renders trail name and difficulty', async () => {
  (api.fetchTrail as jest.Mock).mockResolvedValue(TRAIL);
  render(<TrailDetailScreen />);
  await waitFor(() => expect(screen.getByText('Oak Loop')).toBeTruthy());
  expect(screen.getByText('Easy')).toBeTruthy();
  expect(screen.getByText('2.1 km')).toBeTruthy();
});

it('export button triggers polling and calls Share', async () => {
  (api.fetchTrail as jest.Mock).mockResolvedValue(TRAIL);
  (api.exportTrailToGarmin as jest.Mock).mockResolvedValue({ job_id: 'job1', status: 'queued' });
  (api.pollJobStatus as jest.Mock).mockResolvedValue({
    job_id: 'job1', status: 'completed', filename: 'gmapsupp.img',
  } as JobStatus);

  render(<TrailDetailScreen />);
  await waitFor(() => expect(screen.getByText('Export to Garmin')).toBeTruthy());
  fireEvent.press(screen.getByText('Export to Garmin'));
  await waitFor(() => expect(api.exportTrailToGarmin).toHaveBeenCalledWith('way_1'));
});
