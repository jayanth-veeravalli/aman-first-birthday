// Tiny client for the two Supabase RPC functions (no SDK needed).
// '/' (local dev) means same origin, proxied by Vite to the local Supabase API.
const URL_BASE = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, '');
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export type RsvpResponse = 'yes' | 'maybe' | 'no';

export type Rsvp = {
  name: string;
  response: RsvpResponse;
  adults: number;
  children: number;
  created_at: string;
  updated_at: string;
};

export class ApiError extends Error {
  readonly code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${URL_BASE}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: ANON_KEY,
        // Legacy anon keys are JWTs and go in Authorization too; new sb_publishable_ keys must not.
        ...(ANON_KEY.startsWith('eyJ') ? { Authorization: `Bearer ${ANON_KEY}` } : {}),
      },
      body: JSON.stringify(args),
    });
  } catch {
    throw new ApiError('Could not reach the server. Check your connection and try again.');
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(data?.message ?? 'Something went wrong.', data?.code);
  return data as T;
}

export const submitRsvp = (name: string, response: RsvpResponse, adults: number, children: number) =>
  rpc<void>('submit_rsvp', { p_name: name, p_response: response, p_adults: adults, p_children: children });

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "2 adults and 1 child", "1 adult", "3 children" */
export function describeParty(adults: number, children: number): string {
  const parts = [];
  if (adults) parts.push(plural(adults, 'adult', 'adults'));
  if (children) parts.push(plural(children, 'child', 'children'));
  return parts.join(' and ');
}

export const getRsvps = (passcode: string) => rpc<Rsvp[]>('get_rsvps', { p_passcode: passcode });

export const storage = {
  get(store: Storage, key: string): string | null {
    try {
      return store.getItem(key);
    } catch {
      return null;
    }
  },
  set(store: Storage, key: string, value: string | null): void {
    try {
      if (value === null) store.removeItem(key);
      else store.setItem(key, value);
    } catch {
      /* storage unavailable — fine */
    }
  },
};
