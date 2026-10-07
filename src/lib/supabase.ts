import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-side Supabase client. Returns null until the env vars are filled in,
// so the app keeps working with a dummy / missing database.
let client: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
}

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  client ??= createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  return client;
}
