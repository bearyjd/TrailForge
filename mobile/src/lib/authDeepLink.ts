import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_KEY = 'auth.pendingLogin';
const MAX_AGE_MS = 15 * 60 * 1000;
const REDIRECT_PREFIX = 'trailforge://#';

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

/** Record that this device just requested a magic link for `email`. */
export async function markLoginPending(email: string, now: number = Date.now()): Promise<void> {
  await AsyncStorage.setItem(
    PENDING_KEY,
    JSON.stringify({ email: email.trim().toLowerCase(), at: now }),
  );
}

/** Reads the email claim from a JWT without verifying it; setSession verifies server-side. */
function jwtEmail(token: string): string | null {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const email = JSON.parse(atob(payload)).email;
    return typeof email === 'string' ? email.toLowerCase() : null;
  } catch {
    return null;
  }
}

/**
 * Returns session tokens from a magic-link deep link, but only if the URL has
 * the expected shape and this device has a recent pending login attempt.
 * A successful call consumes the attempt so the link cannot be replayed.
 */
export async function consumeAuthDeepLink(url: string): Promise<AuthTokens | null> {
  if (!url.startsWith(REDIRECT_PREFIX)) return null;
  const params = new URLSearchParams(url.slice(REDIRECT_PREFIX.length));
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) return null;

  const raw = await AsyncStorage.getItem(PENDING_KEY);
  let pending: { email?: unknown; at?: unknown } | null = null;
  try {
    pending = raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
  const startedAt = Number(pending?.at);
  if (!Number.isFinite(startedAt) || Date.now() - startedAt > MAX_AGE_MS) return null;
  if (typeof pending?.email !== 'string' || jwtEmail(access_token) !== pending.email) return null;

  await AsyncStorage.removeItem(PENDING_KEY);
  return { access_token, refresh_token };
}
