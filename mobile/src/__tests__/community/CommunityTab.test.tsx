import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CommunityTab } from '@/components/community/CommunityTab';
import { useCommunityStore } from '@/stores/communityStore';

jest.mock('@/stores/communityStore', () => ({
  useCommunityStore: jest.fn(),
}));

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const mockStore = useCommunityStore as jest.MockedFunction<typeof useCommunityStore>;

const baseStore = {
  session: null,
  ratings: {},
  conditions: {},
  setSession: jest.fn(),
  fetchCommunityData: jest.fn().mockResolvedValue(undefined),
  submitRating: jest.fn(),
  submitCondition: jest.fn(),
};

describe('CommunityTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStore.mockImplementation((selector: (s: typeof baseStore) => unknown) =>
      selector(baseStore)
    );
  });

  it('shows empty state when no ratings', () => {
    const { getByText } = render(<CommunityTab osmTrailId="trail-42" onSignInPress={jest.fn()} />);
    expect(getByText('Be the first to rate this trail')).toBeTruthy();
  });

  it('shows average rating when ratings exist', () => {
    const store = {
      ...baseStore,
      ratings: {
        'trail-42': [
          { id: 'r1', userId: 'u1', osmTrailId: 'trail-42', stars: 4, createdAt: '2026-01-01T00:00:00Z' },
          { id: 'r2', userId: 'u2', osmTrailId: 'trail-42', stars: 2, createdAt: '2026-01-02T00:00:00Z' },
        ],
      },
      conditions: {},
    };
    mockStore.mockImplementation((selector: (s: typeof store) => unknown) => selector(store));

    const { getByText } = render(<CommunityTab osmTrailId="trail-42" onSignInPress={jest.fn()} />);
    expect(getByText('3.0 ★')).toBeTruthy();
    expect(getByText('2 ratings')).toBeTruthy();
  });

  it('shows the most recent condition badge', () => {
    const store = {
      ...baseStore,
      ratings: {},
      conditions: {
        'trail-42': [
          { id: 'c1', userId: 'u1', osmTrailId: 'trail-42', tag: 'muddy' as const, createdAt: '2026-01-02T00:00:00Z' },
          { id: 'c2', userId: 'u2', osmTrailId: 'trail-42', tag: 'dry' as const, createdAt: '2026-01-01T00:00:00Z' },
        ],
      },
    };
    mockStore.mockImplementation((selector: (s: typeof store) => unknown) => selector(store));

    const { getByText } = render(<CommunityTab osmTrailId="trail-42" onSignInPress={jest.fn()} />);
    expect(getByText('Muddy')).toBeTruthy();
  });

  it('calls onSignInPress when not signed in and submit is tapped', () => {
    const onSignInPress = jest.fn();
    const { getByText } = render(<CommunityTab osmTrailId="trail-42" onSignInPress={onSignInPress} />);
    fireEvent.press(getByText('Rate Trail'));
    expect(onSignInPress).toHaveBeenCalled();
  });

  it('fetches community data on mount', () => {
    render(<CommunityTab osmTrailId="trail-42" onSignInPress={jest.fn()} />);
    expect(baseStore.fetchCommunityData).toHaveBeenCalledWith('trail-42');
  });

  it('opens rating sheet when authenticated and Rate Trail is tapped', () => {
    const store = { ...baseStore, session: { user: { id: 'u1' } } as never };
    mockStore.mockImplementation((selector: (s: typeof store) => unknown) => selector(store));

    const { getByText, queryByTestId } = render(
      <CommunityTab osmTrailId="trail-42" onSignInPress={jest.fn()} />
    );
    fireEvent.press(getByText('Rate Trail'));
    // SubmitRatingSheet mock renders a View with testID="bottom-sheet" when visible
    expect(queryByTestId('bottom-sheet')).toBeTruthy();
  });
});
