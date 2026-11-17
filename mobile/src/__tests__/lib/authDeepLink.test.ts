const store: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(async (k: string, v: string) => { store[k] = v; }),
  getItem: jest.fn(async (k: string) => (k in store ? store[k] : null)),
  removeItem: jest.fn(async (k: string) => { delete store[k]; }),
}));

import { markLoginPending, consumeAuthDeepLink } from '@/lib/authDeepLink';

const jwt = (email: string) =>
  `h.${Buffer.from(JSON.stringify({ email })).toString('base64url')}.s`;
const link = (email: string) => `trailforge://#access_token=${jwt(email)}&refresh_token=r`;
const EMAIL = 'me@example.com';
const GOOD = link(EMAIL);

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
});

describe('consumeAuthDeepLink', () => {
  it('rejects tokens when no login attempt is pending', async () => {
    expect(await consumeAuthDeepLink(GOOD)).toBeNull();
  });

  it('accepts tokens for a pending login and consumes the attempt', async () => {
    await markLoginPending(EMAIL);
    expect(await consumeAuthDeepLink(GOOD)).toEqual({ access_token: jwt(EMAIL), refresh_token: 'r' });
    expect(await consumeAuthDeepLink(GOOD)).toBeNull();
  });

  it('rejects an expired login attempt', async () => {
    await markLoginPending(EMAIL, Date.now() - 20 * 60 * 1000);
    expect(await consumeAuthDeepLink(GOOD)).toBeNull();
  });

  it('rejects URLs with an unexpected scheme or host even when pending', async () => {
    await markLoginPending(EMAIL);
    expect(await consumeAuthDeepLink('https://evil.example/#access_token=a&refresh_token=r')).toBeNull();
    expect(await consumeAuthDeepLink('trailforge://evil#access_token=a&refresh_token=r')).toBeNull();
  });

  it('rejects links missing a token', async () => {
    await markLoginPending(EMAIL);
    expect(await consumeAuthDeepLink('trailforge://#access_token=a')).toBeNull();
  });

  it('rejects a token issued for a different account than the one that requested the link', async () => {
    await markLoginPending(EMAIL);
    expect(await consumeAuthDeepLink(link('attacker@example.com'))).toBeNull();
    expect(await consumeAuthDeepLink(GOOD)).not.toBeNull();
  });

  it('matches the email case-insensitively and rejects non-JWT tokens', async () => {
    await markLoginPending('Me@Example.com');
    expect(await consumeAuthDeepLink('trailforge://#access_token=a&refresh_token=r')).toBeNull();
    expect(await consumeAuthDeepLink(GOOD)).not.toBeNull();
  });
});
