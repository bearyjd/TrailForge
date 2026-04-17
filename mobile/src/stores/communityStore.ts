import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { TrailRating, TrailCondition, ConditionTag } from '@/types/community';

interface CommunityState {
  session: Session | null;
  ratings: Record<string, TrailRating[]>;
  conditions: Record<string, TrailCondition[]>;
  setSession: (s: Session | null) => void;
  fetchCommunityData: (osmTrailId: string) => Promise<void>;
  submitRating: (osmTrailId: string, stars: number, review?: string) => Promise<void>;
  submitCondition: (osmTrailId: string, tag: ConditionTag, note?: string) => Promise<void>;
}

function mapRating(r: Record<string, unknown>): TrailRating {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    osmTrailId: r.osm_trail_id as string,
    stars: r.stars as number,
    review: (r.review as string) ?? undefined,
    createdAt: r.created_at as string,
  };
}

function mapCondition(c: Record<string, unknown>): TrailCondition {
  return {
    id: c.id as string,
    userId: c.user_id as string,
    osmTrailId: c.osm_trail_id as string,
    tag: c.tag as ConditionTag,
    note: (c.note as string) ?? undefined,
    createdAt: c.created_at as string,
  };
}

export const useCommunityStore = create<CommunityState>()((set, get) => ({
  session: null,
  ratings: {},
  conditions: {},

  setSession: (session) => set({ session }),

  fetchCommunityData: async (osmTrailId) => {
    const [{ data: ratings }, { data: conditions }] = await Promise.all([
      supabase
        .from('trail_ratings')
        .select('*')
        .eq('osm_trail_id', osmTrailId)
        .order('created_at', { ascending: false }),
      supabase
        .from('trail_conditions')
        .select('*')
        .eq('osm_trail_id', osmTrailId)
        .order('created_at', { ascending: false }),
    ]);
    set((state) => ({
      ratings: {
        ...state.ratings,
        [osmTrailId]: (ratings ?? []).map(mapRating),
      },
      conditions: {
        ...state.conditions,
        [osmTrailId]: (conditions ?? []).map(mapCondition),
      },
    }));
  },

  submitRating: async (osmTrailId, stars, review) => {
    const { session } = get();
    if (!session) throw new Error('Not signed in');
    const { error } = await supabase
      .from('trail_ratings')
      .upsert(
        { user_id: session.user.id, osm_trail_id: osmTrailId, stars, review: review ?? null },
        { onConflict: 'user_id,osm_trail_id' }
      );
    if (error) throw new Error('Submission failed — try again');
    await get().fetchCommunityData(osmTrailId);
  },

  submitCondition: async (osmTrailId, tag, note) => {
    const { session } = get();
    if (!session) throw new Error('Not signed in');
    const { error } = await supabase
      .from('trail_conditions')
      .insert({ user_id: session.user.id, osm_trail_id: osmTrailId, tag, note: note ?? null });
    if (error) throw new Error('Submission failed — try again');
    await get().fetchCommunityData(osmTrailId);
  },
}));
