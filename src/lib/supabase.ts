import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Serverklient mot Supabase.
 *
 * Nyckeln är hemlig och får bara läsas här — modulen importeras aldrig från
 * en klientkomponent. Saknas miljövariabler är lagringen helt enkelt inte
 * påslagen, och appen faller tillbaka på lagring i webbläsaren.
 */
export const PROJECTS_TABLE = "projects";

let cached: SupabaseClient | null = null;

export function supabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}

export function getSupabase(): SupabaseClient | null {
  if (!supabaseConfigured()) return null;
  if (cached) return cached;

  cached = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
