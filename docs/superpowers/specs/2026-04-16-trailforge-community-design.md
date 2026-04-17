# TrailForge Community — Design Spec

**Sub-project:** 3a — Community (Auth + Ratings + Conditions)
**Date:** 2026-04-16
**Depends on:** Sub-project 1 (Trail Discovery Core)

---

## Goal

Let TrailForge users sign in via magic link and submit trail ratings (1–5 stars) and condition reports (dry / wet / muddy / icy / snow / closed / overgrown) directly from the trail detail screen. All community data is stored in Supabase Postgres and read by anyone without auth. The mobile app talks to Supabase directly — no new backend server required.

---

## Architecture

```
Mobile App
├── @supabase/supabase-js (direct)   ← auth, ratings, conditions
└── FastAPI (existing, unchanged)    ← Garmin maps, trail search

Supabase (managed, supabase.com free tier)
├── Auth — magic link email
├── Postgres
│   ├── trail_ratings
│   └── trail_conditions
└── Row Level Security (RLS)
    ├── SELECT: public (no auth required)
    └── INSERT/UPDATE/DELETE: authenticated owner only
```

External data sources (e.g. Trailforks): deferred to a future sub-project. All ratings and conditions in v1 come from user submissions.

---

## Data Model

```sql
-- Anyone can read; authenticated users can insert/update/delete their own rows

create table trail_ratings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users not null,
  osm_trail_id text not null,             -- OSM way/relation ID from trail search
  stars       int not null check (stars between 1 and 5),
  review      text,                        -- optional free text
  created_at  timestamptz default now(),
  unique (user_id, osm_trail_id)           -- one rating per user per trail
);

create table trail_conditions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users not null,
  osm_trail_id text not null,
  tag          text not null check (tag in (
                 'dry','wet','muddy','icy','snow','closed','overgrown'
               )),
  note         text,                       -- optional free text
  created_at   timestamptz default now()
);
```

**RLS policies (both tables):**

```sql
-- Public read
create policy "public read" on trail_ratings for select using (true);
create policy "public read" on trail_conditions for select using (true);

-- Authenticated insert
create policy "auth insert" on trail_ratings for insert
  with check (auth.uid() = user_id);
create policy "auth insert" on trail_conditions for insert
  with check (auth.uid() = user_id);

-- Owner update/delete
create policy "owner update" on trail_ratings for update
  using (auth.uid() = user_id);
create policy "owner delete" on trail_ratings for delete
  using (auth.uid() = user_id);
create policy "owner update" on trail_conditions for update
  using (auth.uid() = user_id);
create policy "owner delete" on trail_conditions for delete
  using (auth.uid() = user_id);
```

---

## Auth Flow

1. User taps "Sign in" on any community action → `AuthScreen` opens
2. User enters email → app calls `supabase.auth.signInWithOtp({ email })`
3. Supabase sends magic link email
4. User taps link → deep link opens app → Supabase exchanges token for session
5. Session stored in AsyncStorage via `AsyncStorageAdapter`
6. Session persists across app restarts; refreshed automatically by Supabase client

**Deep link scheme:** `trailforge://auth/callback` (registered in `app.json`)

---

## Mobile Screens & Components

### New screens

| Screen | Path | Purpose |
|--------|------|---------|
| `AuthScreen` | `mobile/src/screens/AuthScreen.tsx` | Email input + magic link send |
| `AuthCallbackScreen` | `mobile/src/screens/AuthCallbackScreen.tsx` | Handles deep link token exchange |

### Modified screens

| Screen | Change |
|--------|--------|
| `TrailDetailScreen` | Add Community tab: avg rating, recent conditions, submit buttons |

### New components

| Component | Path | Purpose |
|-----------|------|---------|
| `CommunityTab` | `mobile/src/components/community/CommunityTab.tsx` | Aggregated ratings + conditions display |
| `StarRating` | `mobile/src/components/community/StarRating.tsx` | 1–5 star tap input |
| `ConditionBadge` | `mobile/src/components/community/ConditionBadge.tsx` | Colour-coded condition tag pill |
| `SubmitRatingSheet` | `mobile/src/components/community/SubmitRatingSheet.tsx` | Bottom sheet: stars + optional review |
| `SubmitConditionSheet` | `mobile/src/components/community/SubmitConditionSheet.tsx` | Bottom sheet: tag picker + optional note |

### New store

`mobile/src/stores/communityStore.ts` (Zustand 5)

```ts
interface CommunityStore {
  // auth
  session: Session | null;
  setSession: (s: Session | null) => void;

  // trail data (keyed by osm_trail_id)
  ratings: Record<string, TrailRating[]>;
  conditions: Record<string, TrailCondition[]>;

  // actions
  fetchCommunityData: (osmTrailId: string) => Promise<void>;
  submitRating: (osmTrailId: string, stars: number, review?: string) => Promise<void>;
  submitCondition: (osmTrailId: string, tag: ConditionTag, note?: string) => Promise<void>;
}
```

### New types

`mobile/src/types/community.ts`

```ts
export type ConditionTag =
  | 'dry' | 'wet' | 'muddy' | 'icy' | 'snow' | 'closed' | 'overgrown';

export interface TrailRating {
  id: string;
  userId: string;
  osmTrailId: string;
  stars: number;
  review?: string;
  createdAt: string;
}

export interface TrailCondition {
  id: string;
  userId: string;
  osmTrailId: string;
  tag: ConditionTag;
  note?: string;
  createdAt: string;
}
```

---

## Supabase Client Setup

`mobile/src/lib/supabase.ts`

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
```

Environment variables (`.env.local`, not committed):
```
EXPO_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

The anon key is safe to ship in the mobile app — RLS enforces all access rules server-side.

---

## Community Tab — Display Logic

**Average rating:** computed client-side from fetched `trail_ratings` rows.

**Most recent condition:** the latest `trail_conditions` row by `created_at`.

**Empty state:** "Be the first to rate this trail" with a submit button — no empty list shown.

**Auth gate:** tapping submit when signed out opens `AuthScreen` modally; on successful sign-in, the sheet reopens automatically.

---

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| Magic link send fails | Toast: "Couldn't send link — check your email address" |
| Session expired | Supabase client auto-refreshes; if refresh fails, clear session + show sign-in prompt |
| Submit fails (network) | Toast: "Submission failed — try again" |
| Duplicate rating | Upsert via `onConflict: 'user_id,osm_trail_id'` — silently overwrites previous rating |
| RLS rejection | Should not occur in normal flow; log to console in dev |

---

## Testing

**Unit tests** (`mobile/src/__tests__/community/`):
- `communityStore.test.ts` — fetchCommunityData, submitRating, submitCondition (mock Supabase client)
- `StarRating.test.tsx` — renders correct stars, fires onSelect callback
- `ConditionBadge.test.tsx` — renders correct label and colour per tag
- `CommunityTab.test.tsx` — empty state, populated state, auth gate trigger

**Integration tests:**
- Supabase RLS: unauthenticated SELECT succeeds, unauthenticated INSERT fails, authenticated INSERT succeeds for own rows, authenticated INSERT fails for another user's row

**E2E (Playwright / Expo):**
- Sign in flow: enter email → magic link → session persists
- Submit rating: sign in → open trail → submit 4-star rating → rating appears in list
- Submit condition: sign in → open trail → submit "muddy" → badge appears

---

## Out of Scope (future sub-projects)

- Photos on condition reports
- Shared routes
- Moderation / report abuse
- Trailforks data integration
- Push notifications for trail condition updates
- Social follows / activity feed
