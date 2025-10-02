import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/db/supabase-server";

export async function GET() {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("teachers")
    .select("id, user_id")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ teachers: data ?? [] });
}


