import { createClient } from "@supabase/supabase-js";

type Database = any;

export function getSupabaseServerClient() {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;
  if (!SUPABASE_URL) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL. Check your .env.local and restart the dev server.");
  }
  if (!/^https?:\/\//.test(SUPABASE_URL)) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must start with http(s):// e.g. https://<project>.supabase.co");
  }
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY. Add it to .env.local (server-only) and restart.");
  }
  return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    global: { headers: { "X-Client-Info": "impacted-platform-2/server" } },
  });
}


