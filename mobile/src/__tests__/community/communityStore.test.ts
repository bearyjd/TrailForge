import { useCommunityStore } from '@/stores/communityStore';
import { supabase } from '@/lib/supabase';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

function makeMockQuery(data: unknown[], error: unknown = null) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue({ data, error }),
    insert: jest.fn().mockResolvedValue({ data: null, error }),
    upsert: jest.fn().mockResolvedValue({ data: null, error }),
  };
  return chain;
}

beforeEach(() => {
  useCommunityStore.setState({
    session: null,
    ratings: {},
    conditions: {},
  });
  jest.clearAllMocks();
});

describe('setSession', () => {
  it('stores the session', () => {
    const session = { user: { id: 'u1' } } as never;
    useCommunityStore.getState().setSession(session);
    expect(useCommunityStore.getState().session).toBe(session);
  });

  it('clears the session when called with null', () => {
    useCommunityStore.setState({ session: { user: { id: 'u1' } } as never });
    useCommunityStore.getState().setSession(null);
    expect(useCommunityStore.getState().session).toBeNull();
  });
});

describe('fetchCommunityData', () => {
  it('stores fetched ratings keyed by osmTrailId', async () => {
    const ratingRow = {
      id: 'r1',
      user_id: 'u1',
      osm_trail_id: 'trail-42',
      stars: 4,
      review: 'Great',
      created_at: '2026-01-01T00:00:00Z',
    };
    const ratingsQuery = makeMockQuery([ratingRow]);
    const conditionsQuery = makeMockQuery([]);
    (mockSupabase.from as jest.Mock)
      .mockReturnValueOnce(ratingsQuery)
      .mockReturnValueOnce(conditionsQuery);

    await useCommunityStore.getState().fetchCommunityData('trail-42');

    const ratings = useCommunityStore.getState().ratings['trail-42'];
    expect(ratings).toHaveLength(1);
    expect(ratings[0]).toEqual({
      id: 'r1',
      userId: 'u1',
      osmTrailId: 'trail-42',
      stars: 4,
      review: 'Great',
      createdAt: '2026-01-01T00:00:00Z',
    });
  });

  it('stores fetched conditions keyed by osmTrailId', async () => {
    const condRow = {
      id: 'c1',
      user_id: 'u1',
      osm_trail_id: 'trail-42',
      tag: 'muddy',
      note: 'Very slippery',
      created_at: '2026-01-02T00:00:00Z',
    };
    const ratingsQuery = makeMockQuery([]);
    const conditionsQuery = makeMockQuery([condRow]);
    (mockSupabase.from as jest.Mock)
      .mockReturnValueOnce(ratingsQuery)
      .mockReturnValueOnce(conditionsQuery);

    await useCommunityStore.getState().fetchCommunityData('trail-42');

    const conditions = useCommunityStore.getState().conditions['trail-42'];
    expect(conditions).toHaveLength(1);
    expect(conditions[0]).toEqual({
      id: 'c1',
      userId: 'u1',
      osmTrailId: 'trail-42',
      tag: 'muddy',
      note: 'Very slippery',
      createdAt: '2026-01-02T00:00:00Z',
    });
  });
});

describe('submitRating', () => {
  it('throws if not signed in', async () => {
    await expect(
      useCommunityStore.getState().submitRating('trail-42', 4)
    ).rejects.toThrow('Not signed in');
  });

  it('upserts rating and refreshes data when signed in', async () => {
    useCommunityStore.setState({ session: { user: { id: 'u1' } } as never });
    const upsertQuery = makeMockQuery([]);
    const refreshRatings = makeMockQuery([]);
    const refreshConditions = makeMockQuery([]);
    (mockSupabase.from as jest.Mock)
      .mockReturnValueOnce(upsertQuery)
      .mockReturnValueOnce(refreshRatings)
      .mockReturnValueOnce(refreshConditions);

    await useCommunityStore.getState().submitRating('trail-42', 5, 'Amazing');

    expect(upsertQuery.upsert).toHaveBeenCalledWith(
      { user_id: 'u1', osm_trail_id: 'trail-42', stars: 5, review: 'Amazing' },
      { onConflict: 'user_id,osm_trail_id' }
    );
  });
});

describe('submitCondition', () => {
  it('throws if not signed in', async () => {
    await expect(
      useCommunityStore.getState().submitCondition('trail-42', 'dry')
    ).rejects.toThrow('Not signed in');
  });

  it('inserts condition and refreshes data when signed in', async () => {
    useCommunityStore.setState({ session: { user: { id: 'u1' } } as never });
    const insertQuery = makeMockQuery([]);
    const refreshRatings = makeMockQuery([]);
    const refreshConditions = makeMockQuery([]);
    (mockSupabase.from as jest.Mock)
      .mockReturnValueOnce(insertQuery)
      .mockReturnValueOnce(refreshRatings)
      .mockReturnValueOnce(refreshConditions);

    await useCommunityStore.getState().submitCondition('trail-42', 'wet', 'After rain');

    expect(insertQuery.insert).toHaveBeenCalledWith({
      user_id: 'u1',
      osm_trail_id: 'trail-42',
      tag: 'wet',
      note: 'After rain',
    });
  });
});
