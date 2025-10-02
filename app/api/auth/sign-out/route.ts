import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseServerClient } from "@/lib/db/supabase-server";

const SESSION_COOKIE = "ba_session";

export async function POST(req: Request) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const supabase = getSupabaseServerClient();
    await supabase.from("sessions").delete().eq("session_token", token);
  }
  store.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", secure: true, maxAge: 0 });
  return NextResponse.json({ ok: true });
}


