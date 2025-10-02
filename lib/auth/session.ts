import { cookies } from "next/headers";
import { getSupabaseServerClient } from "@/lib/db/supabase-server";

const SESSION_COOKIE = "ba_session"; // Better Auth session cookie name placeholder

export type AppUser = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: "admin" | "teacher" | "student";
};

export async function getCurrentSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return token;
}

export async function getCurrentUser(): Promise<AppUser | null> {
  const token = await getCurrentSession();
  if (!token) return null;
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("sessions")
    .select("user_id, users:users(id, email, name, phone, role)")
    .eq("session_token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error || !data?.users) return null;
  const u = data.users as any;
  return { id: u.id, email: u.email, name: u.name, phone: u.phone, role: u.role };
}


