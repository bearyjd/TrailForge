const store: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(async (k: string, v: string) => { store[k] = v; }),
  getItem: jest.fn(async (k: string) => (k in store ? store[k] : null)),
  removeItem: jest.fn(async (k: string) => { delete store[k]; }),
}));

import { markLoginPending, consumeAuthDeepLink } from '@/lib/authDeepLink';

const GOOD = 'trailforge://#access_token=a&refresh_token=r';

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
});

describe('consumeAuthDeepLink', () => {
  it('rejects tokens when no login attempt is pending', async () => {
    expect(await consumeAuthDeepLink(GOOD)).toBeNull();
  });

  it('accepts tokens for a pending login and consumes the attempt', async () => {
    await markLoginPending();
    expect(await consumeAuthDeepLink(GOOD)).toEqual({ access_token: 'a', refresh_token: 'r' });
    expect(await consumeAuthDeepLink(GOOD)).toBeNull();
  });

  it('rejects an expired login attempt', async () => {
    await markLoginPending(Date.now() - 2 * 60 * 60 * 1000);
    expect(await consumeAuthDeepLink(GOOD)).toBeNull();
  });

  it('rejects URLs with an unexpected scheme or host even when pending', async () => {
    await markLoginPending();
    expect(await consumeAuthDeepLink('https://evil.example/#access_token=a&refresh_token=r')).toBeNull();
    expect(await consumeAuthDeepLink('trailforge://evil#access_token=a&refresh_token=r')).toBeNull();
  });

  it('rejects links missing a token', async () => {
    await markLoginPending();
    expect(await consumeAuthDeepLink('trailforge://#access_token=a')).toBeNull();
  });
});
