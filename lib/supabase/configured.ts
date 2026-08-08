/**
 * True when the Supabase env vars are present. Server-side only. Pages check
 * this before querying so an unprovisioned deployment renders a setup notice
 * instead of crashing with an opaque error digest.
 */
export function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
