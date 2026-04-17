# TrailForge Community (Auth + Ratings + Conditions) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add magic-link email auth and trail ratings/conditions to the mobile app using Supabase as a direct backend — no FastAPI changes required.

**Architecture:** The React Native app talks to Supabase directly via `@supabase/supabase-js`. Supabase provides hosted Postgres (trail_ratings + trail_conditions tables), Row Level Security (public reads, owner-only writes), and email magic-link auth. Session tokens are stored in AsyncStorage and auto-refreshed. FastAPI is entirely unchanged.

**Tech Stack:** `@supabase/supabase-js` v2, Zustand 5, `@gorhom/bottom-sheet` (already installed), `expo-linking` (included with Expo SDK 54), `@testing-library/react-native` v13, Jest

---

## Supabase Project Setup (do this first, manually)

Before writing any code:

1. Go to [supabase.com](https://supabase.com) → create a free account → New Project
2. In the SQL Editor, run:

```sql
create table trail_ratings (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users not null,
  osm_trail_id text not null,
  stars        int not null check (stars between 1 and 5),
  review       text,
  created_at   timestamptz default now(),
  unique (user_id, osm_trail_id)
);

create table trail_conditions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users not null,
  osm_trail_id text not null,
  tag          text not null check (tag in ('dry','wet','muddy','icy','snow','closed','overgrown')),
  note         text,
  created_at   timestamptz default now()
);

alter table trail_ratings enable row level security;
alter table trail_conditions enable row level security;

create policy "public read" on trail_ratings for select using (true);
create policy "auth insert" on trail_ratings for insert with check (auth.uid() = user_id);
create policy "owner update" on trail_ratings for update using (auth.uid() = user_id);
create policy "owner delete" on trail_ratings for delete using (auth.uid() = user_id);

create policy "public read" on trail_conditions for select using (true);
create policy "auth insert" on trail_conditions for insert with check (auth.uid() = user_id);
create policy "owner update" on trail_conditions for update using (auth.uid() = user_id);
create policy "owner delete" on trail_conditions for delete using (auth.uid() = user_id);
```

3. Go to Project Settings → API → copy **Project URL** and **anon public key**
4. In Authentication → URL Configuration → set Site URL to `trailforge://` and add `trailforge://` to Redirect URLs

---

## File Map

```
New files:
  mobile/src/types/community.ts                          — ConditionTag, TrailRating, TrailCondition types
  mobile/src/lib/supabase.ts                             — Supabase client singleton
  mobile/src/stores/communityStore.ts                    — Zustand store: session + ratings + conditions
  mobile/src/components/community/ConditionBadge.tsx     — coloured tag pill
  mobile/src/components/community/StarRating.tsx         — 1–5 star tap input
  mobile/src/components/community/SubmitRatingSheet.tsx  — bottom sheet: stars + optional review
  mobile/src/components/community/SubmitConditionSheet.tsx — bottom sheet: condition tag picker
  mobile/src/components/community/CommunityTab.tsx       — avg rating + latest condition + submit buttons
  mobile/app/auth.tsx                                    — email input + magic link send (modal screen)
  mobile/__mocks__/@gorhom/bottom-sheet.js               — jest mock
  mobile/__mocks__/@react-native-async-storage/async-storage.js — jest mock
  mobile/src/__tests__/community/communityStore.test.ts
  mobile/src/__tests__/community/ConditionBadge.test.tsx
  mobile/src/__tests__/community/StarRating.test.tsx
  mobile/src/__tests__/community/CommunityTab.test.tsx

Modified files:
  mobile/package.json      — add @supabase/supabase-js
  mobile/app.json          — add deep link scheme "trailforge"
  mobile/jest.config.js    — add mock mappings for supabase-js + bottom-sheet + async-storage
  mobile/app/_layout.tsx   — register auth screen + add session listener + deep link handler
  mobile/app/trail/[id].tsx — add CommunityTab section at bottom
```

---

## Task 1: Install @supabase/supabase-js + configure jest mocks

**Files:**
- Modify: `mobile/package.json`
- Modify: `mobile/jest.config.js`
- Create: `mobile/__mocks__/@gorhom/bottom-sheet.js`
- Create: `mobile/__mocks__/@react-native-async-storage/async-storage.js`

- [ ] **Step 1: Install the Supabase client**

```bash
cd mobile && npm install @supabase/supabase-js@2
```

Expected: `package.json` now includes `"@supabase/supabase-js": "^2.x.x"`

- [ ] **Step 2: Add jest module mappings**

Open `mobile/jest.config.js`. Replace the `moduleNameMapper` block so it includes three new entries:

```js
module.exports = {
  preset: undefined,
  testEnvironment: 'node',
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': 'babel-jest',
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^react-native$': '<rootDir>/__mocks__/react-native.js',
    '^react-native/Libraries/Alert/Alert$': '<rootDir>/__mocks__/react-native-alert.js',
    '^react-native/Libraries/Share/Share$': '<rootDir>/__mocks__/react-native-share.js',
    '^expo-router$': '<rootDir>/__mocks__/expo-router.js',
    '^expo-location$': '<rootDir>/__mocks__/expo-location.js',
    '^expo-task-manager$': '<rootDir>/__mocks__/expo-task-manager.js',
    '^expo-file-system$': '<rootDir>/__mocks__/expo-file-system.js',
    '^expo-sharing$': '<rootDir>/__mocks__/expo-sharing.js',
    '^@maplibre/maplibre-react-native$': '<rootDir>/__mocks__/@maplibre/maplibre-react-native.js',
    '^@gorhom/bottom-sheet$': '<rootDir>/__mocks__/@gorhom/bottom-sheet.js',
    '^@react-native-async-storage/async-storage$': '<rootDir>/__mocks__/@react-native-async-storage/async-storage.js',
    '^@supabase/supabase-js$': '<rootDir>/__mocks__/@supabase/supabase-js.js',
    '^@testing-library/react-native$': '<rootDir>/node_modules/@testing-library/react-native/build/index.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(zustand|@testing-library/react-native)/)',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};
```

- [ ] **Step 3: Create the @gorhom/bottom-sheet mock**

Create `mobile/__mocks__/@gorhom/bottom-sheet.js`:

```js
const React = require('react');
const { View } = require('react-native');

const BottomSheet = React.forwardRef(function BottomSheet({ children }, _ref) {
  return React.createElement(View, { testID: 'bottom-sheet' }, children);
});

module.exports = BottomSheet;
module.exports.default = BottomSheet;
module.exports.__esModule = true;
```

- [ ] **Step 4: Create the AsyncStorage mock**

Create `mobile/__mocks__/@react-native-async-storage/async-storage.js`:

```js
module.exports = {
  setItem: jest.fn().mockResolvedValue(null),
  getItem: jest.fn().mockResolvedValue(null),
  removeItem: jest.fn().mockResolvedValue(null),
  mergeItem: jest.fn().mockResolvedValue(null),
  clear: jest.fn().mockResolvedValue(null),
  getAllKeys: jest.fn().mockResolvedValue([]),
  multiGet: jest.fn().mockResolvedValue([]),
  multiSet: jest.fn().mockResolvedValue(null),
  multiRemove: jest.fn().mockResolvedValue(null),
};
```

- [ ] **Step 5: Create the @supabase/supabase-js mock**

Create `mobile/__mocks__/@supabase/supabase-js.js`:

```js
const mockFrom = jest.fn(() => ({
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  order: jest.fn().mockResolvedValue({ data: [], error: null }),
  insert: jest.fn().mockResolvedValue({ data: null, error: null }),
  upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
}));

const mockAuth = {
  signInWithOtp: jest.fn().mockResolvedValue({ error: null }),
  signOut: jest.fn().mockResolvedValue({ error: null }),
  getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
  onAuthStateChange: jest.fn(() => ({
    data: { subscription: { unsubscribe: jest.fn() } },
  })),
  setSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
};

const createClient = jest.fn(() => ({ from: mockFrom, auth: mockAuth }));

module.exports = { createClient };
module.exports.__esModule = true;
```

- [ ] **Step 6: Verify jest resolves without errors**

```bash
cd mobile && npx jest --listTests 2>&1 | head -5
```

Expected: command exits without "Cannot find module" errors (no test files yet, that's fine)

- [ ] **Step 7: Commit**

```bash
cd mobile && git add package.json package-lock.json jest.config.js \
  __mocks__/@gorhom/bottom-sheet.js \
  __mocks__/@react-native-async-storage/async-storage.js \
  __mocks__/@supabase/supabase-js.js
git commit -m "chore: install supabase-js and add jest mocks for community feature"
```

---

## Task 2: Configure deep link scheme + environment variables

**Files:**
- Modify: `mobile/app.json`
- Create: `mobile/.env.local` (not committed — instructions only)

- [ ] **Step 1: Add scheme to app.json**

Open `mobile/app.json`. Add `"scheme": "trailforge"` to the `expo` object:

```json
{
  "expo": {
    "name": "mobile",
    "slug": "mobile",
    "version": "1.0.0",
    "scheme": "trailforge",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "newArchEnabled": true,
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "ios": {
      "supportsTablet": true
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "edgeToEdgeEnabled": true,
      "predictiveBackGestureEnabled": false
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "plugins": [
      "expo-router"
    ]
  }
}
```

- [ ] **Step 2: Create .env.local with Supabase credentials**

Create `mobile/.env.local` (this file must NOT be committed — check that `.gitignore` has `.env.local`):

```
EXPO_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

Replace the values with the Project URL and anon key from Supabase Project Settings → API.

- [ ] **Step 3: Ensure .env.local is gitignored**

```bash
grep -q '.env.local' mobile/.gitignore || echo '.env.local' >> mobile/.gitignore
```

- [ ] **Step 4: Commit**

```bash
git add mobile/app.json mobile/.gitignore
git commit -m "chore: add trailforge deep link scheme to app.json"
```

---

## Task 3: Community types + Supabase client

**Files:**
- Create: `mobile/src/types/community.ts`
- Create: `mobile/src/lib/supabase.ts`

- [ ] **Step 1: Create community types**

Create `mobile/src/types/community.ts`:

```ts
export type ConditionTag =
  | 'dry'
  | 'wet'
  | 'muddy'
  | 'icy'
  | 'snow'
  | 'closed'
  | 'overgrown';

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

- [ ] **Step 2: Create the Supabase client singleton**

Create `mobile/src/lib/supabase.ts`:

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

- [ ] **Step 3: Commit**

```bash
git add mobile/src/types/community.ts mobile/src/lib/supabase.ts
git commit -m "feat: add community types and Supabase client"
```

---

## Task 4: Community store (TDD)

**Files:**
- Create: `mobile/src/__tests__/community/communityStore.test.ts`
- Create: `mobile/src/stores/communityStore.ts`

- [ ] **Step 1: Write the failing tests**

Create `mobile/src/__tests__/community/communityStore.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd mobile && npx jest src/__tests__/community/communityStore.test.ts --no-coverage 2>&1 | tail -10
```

Expected: FAIL with "Cannot find module '@/stores/communityStore'"

- [ ] **Step 3: Implement the community store**

Create `mobile/src/stores/communityStore.ts`:

```ts
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
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd mobile && npx jest src/__tests__/community/communityStore.test.ts --no-coverage 2>&1 | tail -5
```

Expected: `Tests: 7 passed, 7 total`

- [ ] **Step 5: Commit**

```bash
git add mobile/src/stores/communityStore.ts mobile/src/__tests__/community/communityStore.test.ts
git commit -m "feat: add community store with session, ratings, and conditions"
```

---

## Task 5: ConditionBadge component (TDD)

**Files:**
- Create: `mobile/src/__tests__/community/ConditionBadge.test.tsx`
- Create: `mobile/src/components/community/ConditionBadge.tsx`

- [ ] **Step 1: Write the failing test**

Create `mobile/src/__tests__/community/ConditionBadge.test.tsx`:

```tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { ConditionBadge } from '@/components/community/ConditionBadge';

describe('ConditionBadge', () => {
  it('renders the tag label', () => {
    const { getByText } = render(<ConditionBadge tag="muddy" />);
    expect(getByText('Muddy')).toBeTruthy();
  });

  it('renders closed in red', () => {
    const { getByText } = render(<ConditionBadge tag="closed" />);
    expect(getByText('Closed')).toBeTruthy();
  });

  it('renders dry in green', () => {
    const { getByText } = render(<ConditionBadge tag="dry" />);
    expect(getByText('Dry')).toBeTruthy();
  });

  it('renders all seven tags without crashing', () => {
    const tags = ['dry', 'wet', 'muddy', 'icy', 'snow', 'closed', 'overgrown'] as const;
    tags.forEach((tag) => {
      const { getByText } = render(<ConditionBadge tag={tag} />);
      expect(getByText(tag.charAt(0).toUpperCase() + tag.slice(1))).toBeTruthy();
    });
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd mobile && npx jest src/__tests__/community/ConditionBadge.test.tsx --no-coverage 2>&1 | tail -5
```

Expected: FAIL with "Cannot find module '@/components/community/ConditionBadge'"

- [ ] **Step 3: Implement ConditionBadge**

Create `mobile/src/components/community/ConditionBadge.tsx`:

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { ConditionTag } from '@/types/community';

const COLORS: Record<ConditionTag, string> = {
  dry: '#2d9a4e',
  wet: '#2979c0',
  muddy: '#795548',
  icy: '#00acc1',
  snow: '#5c6bc0',
  closed: '#d32f2f',
  overgrown: '#689f38',
};

interface Props {
  tag: ConditionTag;
}

export function ConditionBadge({ tag }: Props) {
  const label = tag.charAt(0).toUpperCase() + tag.slice(1);
  return (
    <View style={[styles.badge, { backgroundColor: COLORS[tag] }]}>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  label: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd mobile && npx jest src/__tests__/community/ConditionBadge.test.tsx --no-coverage 2>&1 | tail -5
```

Expected: `Tests: 4 passed, 4 total`

- [ ] **Step 5: Commit**

```bash
git add mobile/src/components/community/ConditionBadge.tsx mobile/src/__tests__/community/ConditionBadge.test.tsx
git commit -m "feat: add ConditionBadge component"
```

---

## Task 6: StarRating component (TDD)

**Files:**
- Create: `mobile/src/__tests__/community/StarRating.test.tsx`
- Create: `mobile/src/components/community/StarRating.tsx`

- [ ] **Step 1: Write the failing test**

Create `mobile/src/__tests__/community/StarRating.test.tsx`:

```tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { StarRating } from '@/components/community/StarRating';

describe('StarRating', () => {
  it('renders 5 star buttons', () => {
    const { getAllByRole } = render(<StarRating value={0} onChange={jest.fn()} />);
    expect(getAllByRole('button')).toHaveLength(5);
  });

  it('calls onChange with the tapped star index', () => {
    const onChange = jest.fn();
    const { getAllByRole } = render(<StarRating value={0} onChange={onChange} />);
    fireEvent.press(getAllByRole('button')[2]);
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('calls onChange with 4 when 4th star tapped', () => {
    const onChange = jest.fn();
    const { getAllByRole } = render(<StarRating value={2} onChange={onChange} />);
    fireEvent.press(getAllByRole('button')[3]);
    expect(onChange).toHaveBeenCalledWith(4);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd mobile && npx jest src/__tests__/community/StarRating.test.tsx --no-coverage 2>&1 | tail -5
```

Expected: FAIL with "Cannot find module '@/components/community/StarRating'"

- [ ] **Step 3: Implement StarRating**

Create `mobile/src/components/community/StarRating.tsx`:

```tsx
import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';

interface Props {
  value: number;
  onChange: (stars: number) => void;
}

export function StarRating({ value, onChange }: Props) {
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((n) => (
        <TouchableOpacity
          key={n}
          accessibilityRole="button"
          onPress={() => onChange(n)}
          style={styles.star}
        >
          <Text style={[styles.starText, n <= value && styles.starFilled]}>★</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  star: { padding: 4 },
  starText: { fontSize: 28, color: '#ccc' },
  starFilled: { color: '#f4a829' },
});
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd mobile && npx jest src/__tests__/community/StarRating.test.tsx --no-coverage 2>&1 | tail -5
```

Expected: `Tests: 3 passed, 3 total`

- [ ] **Step 5: Commit**

```bash
git add mobile/src/components/community/StarRating.tsx mobile/src/__tests__/community/StarRating.test.tsx
git commit -m "feat: add StarRating component"
```

---

## Task 7: AuthScreen + register modal in _layout.tsx

**Files:**
- Create: `mobile/app/auth.tsx`
- Modify: `mobile/app/_layout.tsx`

- [ ] **Step 1: Create AuthScreen**

Create `mobile/app/auth.tsx`:

```tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: 'trailforge://' },
    });
    setLoading(false);
    if (error) {
      Alert.alert('Error', "Couldn't send link — check your email address");
    } else {
      setSent(true);
    }
  };

  if (sent) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.subtitle}>
          We sent a sign-in link to {email.trim()}.{'\n'}Tap it to sign in.
        </Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>Sign in to TrailForge</Text>
      <Text style={styles.subtitle}>Enter your email — we'll send a magic link.</Text>
      <TextInput
        style={styles.input}
        placeholder="you@example.com"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TouchableOpacity
        style={[styles.btn, loading && styles.btnDisabled]}
        onPress={handleSend}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>Send link</Text>
        )}
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  subtitle: { color: '#666', marginBottom: 24, lineHeight: 22 },
  input: {
    borderWidth: 1.5,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  btn: { backgroundColor: '#2979c0', padding: 14, borderRadius: 8, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  backBtn: { marginTop: 24 },
  backText: { color: '#2979c0', fontSize: 15 },
});
```

- [ ] **Step 2: Register auth screen as a modal in _layout.tsx**

Open `mobile/app/_layout.tsx`. Add a `Stack.Screen` for `auth`:

```tsx
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StyleSheet } from 'react-native';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.flex}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="trail/[id]" options={{ title: 'Trail Details' }} />
        <Stack.Screen name="route/[id]" options={{ title: 'Route' }} />
        <Stack.Screen name="offline" options={{ title: 'Offline Maps' }} />
        <Stack.Screen name="auth" options={{ title: 'Sign In', presentation: 'modal' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
```

- [ ] **Step 3: Commit**

```bash
git add mobile/app/auth.tsx mobile/app/_layout.tsx
git commit -m "feat: add AuthScreen modal for magic link sign-in"
```

---

## Task 8: Session listener + deep link handler in _layout.tsx

The session listener keeps the Zustand store in sync with the Supabase auth state. The deep link handler exchanges the magic link token for a session.

**Files:**
- Modify: `mobile/app/_layout.tsx`

- [ ] **Step 1: Add session listener and deep link handler**

Replace the contents of `mobile/app/_layout.tsx`:

```tsx
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StyleSheet } from 'react-native';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import { useCommunityStore } from '@/stores/communityStore';

export default function RootLayout() {
  const setSession = useCommunityStore((s) => s.setSession);

  useEffect(() => {
    // Hydrate session from storage on start
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Keep store in sync whenever auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, [setSession]);

  useEffect(() => {
    // Handle magic link deep link: trailforge://#access_token=...&refresh_token=...
    const handleUrl = (url: string) => {
      const fragment = url.split('#')[1];
      if (!fragment) return;
      const params = Object.fromEntries(new URLSearchParams(fragment));
      if (params.access_token && params.refresh_token) {
        supabase.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        });
      }
    };

    Linking.getInitialURL().then((url) => { if (url) handleUrl(url); });
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);

  return (
    <GestureHandlerRootView style={styles.flex}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="trail/[id]" options={{ title: 'Trail Details' }} />
        <Stack.Screen name="route/[id]" options={{ title: 'Route' }} />
        <Stack.Screen name="offline" options={{ title: 'Offline Maps' }} />
        <Stack.Screen name="auth" options={{ title: 'Sign In', presentation: 'modal' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
```

- [ ] **Step 2: Commit**

```bash
git add mobile/app/_layout.tsx
git commit -m "feat: add Supabase session listener and deep link handler to root layout"
```

---

## Task 9: SubmitRatingSheet

**Files:**
- Create: `mobile/src/components/community/SubmitRatingSheet.tsx`

- [ ] **Step 1: Implement SubmitRatingSheet**

Create `mobile/src/components/community/SubmitRatingSheet.tsx`:

```tsx
import React, { useCallback, useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import { StarRating } from './StarRating';
import { useCommunityStore } from '@/stores/communityStore';

interface Props {
  osmTrailId: string;
  visible: boolean;
  onDismiss: () => void;
}

export function SubmitRatingSheet({ osmTrailId, visible, onDismiss }: Props) {
  const sheetRef = useRef<BottomSheet>(null);
  const submitRating = useCommunityStore((s) => s.submitRating);
  const [stars, setStars] = useState(0);
  const [review, setReview] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) sheetRef.current?.expand();
    else sheetRef.current?.close();
  }, [visible]);

  const handleChange = useCallback(
    (index: number) => { if (index === -1) onDismiss(); },
    [onDismiss]
  );

  const handleSubmit = async () => {
    if (stars === 0) {
      Alert.alert('Pick a rating', 'Please select 1–5 stars before submitting.');
      return;
    }
    setLoading(true);
    try {
      await submitRating(osmTrailId, stars, review.trim() || undefined);
      setStars(0);
      setReview('');
      onDismiss();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Submission failed — try again');
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={['50%']}
      enablePanDownToClose
      onChange={handleChange}
    >
      <View style={styles.content}>
        <Text style={styles.heading}>Rate this trail</Text>
        <StarRating value={stars} onChange={setStars} />
        <TextInput
          style={styles.input}
          placeholder="Add a review (optional)"
          value={review}
          onChangeText={setReview}
          multiline
          numberOfLines={3}
        />
        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Submit</Text>}
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16 },
  heading: { fontSize: 17, fontWeight: '600', marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
    marginBottom: 16,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  btn: { backgroundColor: '#2979c0', padding: 14, borderRadius: 8, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/components/community/SubmitRatingSheet.tsx
git commit -m "feat: add SubmitRatingSheet bottom sheet component"
```

---

## Task 10: SubmitConditionSheet

**Files:**
- Create: `mobile/src/components/community/SubmitConditionSheet.tsx`

- [ ] **Step 1: Implement SubmitConditionSheet**

Create `mobile/src/components/community/SubmitConditionSheet.tsx`:

```tsx
import React, { useCallback, useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import { ConditionBadge } from './ConditionBadge';
import { useCommunityStore } from '@/stores/communityStore';
import type { ConditionTag } from '@/types/community';

const TAGS: ConditionTag[] = ['dry', 'wet', 'muddy', 'icy', 'snow', 'closed', 'overgrown'];

interface Props {
  osmTrailId: string;
  visible: boolean;
  onDismiss: () => void;
}

export function SubmitConditionSheet({ osmTrailId, visible, onDismiss }: Props) {
  const sheetRef = useRef<BottomSheet>(null);
  const submitCondition = useCommunityStore((s) => s.submitCondition);
  const [selected, setSelected] = useState<ConditionTag | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) sheetRef.current?.expand();
    else sheetRef.current?.close();
  }, [visible]);

  const handleChange = useCallback(
    (index: number) => { if (index === -1) onDismiss(); },
    [onDismiss]
  );

  const handleSubmit = async () => {
    if (!selected) {
      Alert.alert('Pick a condition', 'Please select a condition tag before submitting.');
      return;
    }
    setLoading(true);
    try {
      await submitCondition(osmTrailId, selected, note.trim() || undefined);
      setSelected(null);
      setNote('');
      onDismiss();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Submission failed — try again');
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={['55%']}
      enablePanDownToClose
      onChange={handleChange}
    >
      <View style={styles.content}>
        <Text style={styles.heading}>Report trail condition</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tags}>
          {TAGS.map((tag) => (
            <TouchableOpacity
              key={tag}
              onPress={() => setSelected(tag)}
              style={[styles.tagWrap, selected === tag && styles.tagSelected]}
            >
              <ConditionBadge tag={tag} />
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TextInput
          style={styles.input}
          placeholder="Add a note (optional)"
          value={note}
          onChangeText={setNote}
          multiline
          numberOfLines={2}
        />
        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Submit</Text>}
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16 },
  heading: { fontSize: 17, fontWeight: '600', marginBottom: 12 },
  tags: { flexDirection: 'row', marginBottom: 12 },
  tagWrap: { marginRight: 8, opacity: 0.6 },
  tagSelected: { opacity: 1, transform: [{ scale: 1.05 }] },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
    minHeight: 56,
    textAlignVertical: 'top',
  },
  btn: { backgroundColor: '#2979c0', padding: 14, borderRadius: 8, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/components/community/SubmitConditionSheet.tsx
git commit -m "feat: add SubmitConditionSheet bottom sheet component"
```

---

## Task 11: CommunityTab (TDD)

**Files:**
- Create: `mobile/src/__tests__/community/CommunityTab.test.tsx`
- Create: `mobile/src/components/community/CommunityTab.tsx`

- [ ] **Step 1: Write the failing test**

Create `mobile/src/__tests__/community/CommunityTab.test.tsx`:

```tsx
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
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd mobile && npx jest src/__tests__/community/CommunityTab.test.tsx --no-coverage 2>&1 | tail -5
```

Expected: FAIL with "Cannot find module '@/components/community/CommunityTab'"

- [ ] **Step 3: Implement CommunityTab**

Create `mobile/src/components/community/CommunityTab.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useCommunityStore } from '@/stores/communityStore';
import { ConditionBadge } from './ConditionBadge';
import { SubmitRatingSheet } from './SubmitRatingSheet';
import { SubmitConditionSheet } from './SubmitConditionSheet';

interface Props {
  osmTrailId: string;
  onSignInPress: () => void;
}

export function CommunityTab({ osmTrailId, onSignInPress }: Props) {
  const session = useCommunityStore((s) => s.session);
  const ratings = useCommunityStore((s) => s.ratings[osmTrailId] ?? []);
  const conditions = useCommunityStore((s) => s.conditions[osmTrailId] ?? []);
  const fetchCommunityData = useCommunityStore((s) => s.fetchCommunityData);

  const [ratingSheetVisible, setRatingSheetVisible] = useState(false);
  const [conditionSheetVisible, setConditionSheetVisible] = useState(false);

  useEffect(() => {
    fetchCommunityData(osmTrailId);
  }, [osmTrailId, fetchCommunityData]);

  const avgRating =
    ratings.length > 0
      ? (ratings.reduce((sum, r) => sum + r.stars, 0) / ratings.length).toFixed(1)
      : null;

  const latestCondition = conditions.length > 0 ? conditions[0] : null;

  const handleRatePress = () => {
    if (!session) { onSignInPress(); return; }
    setRatingSheetVisible(true);
  };

  const handleConditionPress = () => {
    if (!session) { onSignInPress(); return; }
    setConditionSheetVisible(true);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Community</Text>

      {avgRating ? (
        <View style={styles.row}>
          <Text style={styles.avgRating}>{avgRating} ★</Text>
          <Text style={styles.ratingCount}>{ratings.length} ratings</Text>
        </View>
      ) : (
        <Text style={styles.emptyText}>Be the first to rate this trail</Text>
      )}

      {latestCondition && (
        <View style={styles.conditionRow}>
          <Text style={styles.conditionLabel}>Latest condition: </Text>
          <ConditionBadge tag={latestCondition.tag} />
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleRatePress}>
          <Text style={styles.actionText}>Rate Trail</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.actionBtnSecondary]} onPress={handleConditionPress}>
          <Text style={styles.actionText}>Report Condition</Text>
        </TouchableOpacity>
      </View>

      <SubmitRatingSheet
        osmTrailId={osmTrailId}
        visible={ratingSheetVisible}
        onDismiss={() => setRatingSheetVisible(false)}
      />
      <SubmitConditionSheet
        osmTrailId={osmTrailId}
        visible={conditionSheetVisible}
        onDismiss={() => setConditionSheetVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  heading: { fontSize: 17, fontWeight: '700', marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  avgRating: { fontSize: 22, fontWeight: '700', color: '#f4a829', marginRight: 8 },
  ratingCount: { color: '#888', fontSize: 14 },
  emptyText: { color: '#aaa', marginBottom: 8 },
  conditionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  conditionLabel: { color: '#666', fontSize: 14 },
  actions: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1,
    backgroundColor: '#2979c0',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionBtnSecondary: { backgroundColor: '#5a4fcf' },
  actionText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd mobile && npx jest src/__tests__/community/CommunityTab.test.tsx --no-coverage 2>&1 | tail -5
```

Expected: `Tests: 5 passed, 5 total`

- [ ] **Step 5: Commit**

```bash
git add mobile/src/components/community/CommunityTab.tsx mobile/src/__tests__/community/CommunityTab.test.tsx
git commit -m "feat: add CommunityTab component with ratings and conditions display"
```

---

## Task 12: Wire CommunityTab into TrailDetailScreen

**Files:**
- Modify: `mobile/app/trail/[id].tsx`

- [ ] **Step 1: Add CommunityTab to the trail detail screen**

Open `mobile/app/trail/[id].tsx`. Add the import at the top and render `CommunityTab` at the bottom of the `ScrollView`, replacing the "Share Trail" button placeholder. The full updated file:

```tsx
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Share, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import MapLibreGL from '@maplibre/maplibre-react-native';
import { DifficultyBadge } from '@/components/DifficultyBadge';
import { CommunityTab } from '@/components/community/CommunityTab';
import { useSavedStore } from '@/stores/savedStore';
import { useOfflineStore } from '@/stores/offlineStore';
import { fetchTrail, exportTrailToGarmin, pollJobStatus } from '@/api/trailApi';
import { TILE_STYLE_URL } from '@/constants';
import type { Trail } from '@/types/trail';

type ExportState = 'idle' | 'loading' | 'done' | 'error';

const DEG_PER_500M = 500 / 111_000;

function getTrailBbox(trail: Trail): [number, number, number, number] {
  const coords = trail.geometry?.coordinates ?? [];
  const lats = coords.map(([, lat]: number[]) => lat);
  const lons = coords.map(([lon]: number[]) => lon);
  const minLat = Math.min(...lats) - DEG_PER_500M;
  const maxLat = Math.max(...lats) + DEG_PER_500M;
  const minLon = Math.min(...lons) - DEG_PER_500M;
  const maxLon = Math.max(...lons) + DEG_PER_500M;
  return [minLon, minLat, maxLon, maxLat];
}

export default function TrailDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isSaved, saveTrail, removeTrail } = useSavedStore();

  const [trail, setTrail] = useState<Trail | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [exportState, setExportState] = useState<ExportState>('idle');
  const [exportProgress, setExportProgress] = useState('');

  const { addPack, updatePackStatus, hasPack, packs } = useOfflineStore();
  const packId = `trail-${id}`;
  const pack = packs[packId];
  const isDownloaded = hasPack(packId);
  const isDownloading = pack?.status === 'downloading';

  useEffect(() => {
    fetchTrail(id)
      .then(setTrail)
      .catch(() => setLoadError(true));
  }, [id]);

  const handleExport = useCallback(async () => {
    if (!trail) return;
    setExportState('loading');
    setExportProgress('Starting export…');
    try {
      const { job_id } = await exportTrailToGarmin(trail.id);
      let status = 'queued';
      while (status !== 'completed' && status !== 'failed') {
        await new Promise((r) => setTimeout(r, 3000));
        const jobStatus = await pollJobStatus(job_id);
        status = jobStatus.status;
        if (jobStatus.progress) setExportProgress(jobStatus.progress);
      }
      if (status === 'completed') {
        setExportState('done');
        const downloadUrl = `${process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api'}/download/${job_id}/gmapsupp.img`;
        await Share.share({ url: downloadUrl, message: `TrailForge: ${trail.name} — Garmin map ready` });
      } else {
        setExportState('error');
        Alert.alert('Export failed', 'The Garmin export did not complete. Please try again.');
      }
    } catch {
      setExportState('error');
      Alert.alert('Export failed', 'Could not start the export. Check your connection.');
    }
  }, [trail]);

  const handleDownloadOffline = useCallback(async () => {
    if (!trail || isDownloaded || isDownloading) return;
    addPack({
      id: packId,
      name: trail.name,
      type: 'trail-local',
      trail_id: id,
      size_bytes: 0,
      downloaded_at: 0,
      status: 'downloading',
    });
    try {
      const bounds = getTrailBbox(trail);
      await MapLibreGL.offlineManager.createPack({
        name: packId,
        styleURL: TILE_STYLE_URL,
        bounds: [[bounds[0], bounds[1]], [bounds[2], bounds[3]]],
        minZoom: 12,
        maxZoom: 17,
      }, (_pack: unknown, status: { percentage?: number } | null) => {
        if (status?.percentage === 100) {
          updatePackStatus(packId, 'complete');
        }
      });
    } catch {
      updatePackStatus(packId, 'error');
    }
  }, [trail, packId, isDownloaded, isDownloading, addPack, updatePackStatus, id]);

  if (loadError) {
    return <View style={styles.center}><Text>Trail not found.</Text></View>;
  }
  if (!trail) {
    return <View style={styles.center}><ActivityIndicator /></View>;
  }

  const saved = isSaved(trail.id);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.name}>{trail.name}</Text>
        <DifficultyBadge difficulty={trail.difficulty} />
      </View>

      <View style={styles.stats}>
        <Stat label="Distance" value={`${(trail.distance_m / 1000).toFixed(1)} km`} />
        <Stat label="Elevation" value={trail.elevation_gain_m ? `${trail.elevation_gain_m} m` : '—'} />
        <Stat label="Type" value={trail.trail_type} />
      </View>

      {trail.description ? (
        <Text style={styles.description}>{trail.description}</Text>
      ) : null}

      <TouchableOpacity
        style={[styles.btn, saved ? styles.btnOutline : styles.btnPrimary]}
        onPress={() => saved ? removeTrail(trail.id) : saveTrail(trail)}
      >
        <Text style={[styles.btnText, saved && styles.btnTextOutline]}>
          {saved ? '🔖 Saved' : 'Save Trail'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btn, styles.btnGarmin, exportState === 'loading' && styles.btnDisabled]}
        onPress={handleExport}
        disabled={exportState === 'loading'}
      >
        {exportState === 'loading' ? (
          <View style={styles.exportLoading}>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={[styles.btnText, { marginLeft: 8 }]}>{exportProgress}</Text>
          </View>
        ) : (
          <Text style={styles.btnText}>
            {exportState === 'done' ? '✓ Export complete — share again' : 'Export to Garmin'}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btn, styles.btnOffline, (isDownloaded || isDownloading) && styles.btnDisabled]}
        onPress={handleDownloadOffline}
        disabled={isDownloaded || isDownloading}
      >
        <Text style={styles.btnText}>
          {isDownloaded ? '✓ Downloaded' : isDownloading ? 'Downloading…' : 'Download for offline'}
        </Text>
      </TouchableOpacity>

      <View style={styles.divider} />

      <CommunityTab
        osmTrailId={trail.id}
        onSignInPress={() => router.push('/auth')}
      />
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingBottom: 8 },
  name: { fontSize: 22, fontWeight: '700', flex: 1, marginRight: 8 },
  stats: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee' },
  stat: { flex: 1, alignItems: 'center' },
  statLabel: { fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: 16, fontWeight: '600', marginTop: 4 },
  description: { padding: 16, color: '#444', lineHeight: 22 },
  btn: { marginHorizontal: 16, marginTop: 12, padding: 14, borderRadius: 10, alignItems: 'center' },
  btnPrimary: { backgroundColor: '#2979c0' },
  btnGarmin: { backgroundColor: '#1a6e34' },
  btnOffline: { backgroundColor: '#5a4fcf' },
  btnOutline: { borderWidth: 1.5, borderColor: '#2979c0' },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  btnTextOutline: { color: '#2979c0', fontWeight: '600', fontSize: 15 },
  exportLoading: { flexDirection: 'row', alignItems: 'center' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#eee', marginTop: 16 },
});
```

- [ ] **Step 2: Run all community tests**

```bash
cd mobile && npx jest src/__tests__/community/ --no-coverage 2>&1 | tail -10
```

Expected: `Test Suites: 4 passed, 4 total` and `Tests: 19 passed, 19 total` (7 store + 4 badge + 3 star + 5 tab)

- [ ] **Step 3: Commit**

```bash
git add mobile/app/trail/[id].tsx
git commit -m "feat: integrate CommunityTab into TrailDetailScreen"
```

---

## Self-Review Checklist (run before calling done)

- [ ] All 4 test files pass: `npx jest src/__tests__/community/ --no-coverage`
- [ ] TypeScript compiles: `npx tsc --noEmit` (run from `mobile/`)
- [ ] `app.json` has `"scheme": "trailforge"`
- [ ] `.env.local` exists with real Supabase credentials (not committed)
- [ ] Supabase tables created with correct RLS policies (check in Supabase dashboard → Table Editor → RLS)
- [ ] Auth redirect URL `trailforge://` is in Supabase Auth → URL Configuration → Redirect URLs
