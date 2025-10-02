import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/db/supabase-server";

export async function GET() {
  try {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("users").select("count", { count: "exact", head: true });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}


