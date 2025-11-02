import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/db/supabase-server";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const courseId = params.id;
  const supabase = getSupabaseServerClient();
  try {
    const { data, error } = await supabase
      .from("course_sessions")
      .select("id, title, scheduled_at, duration_minutes")
      .eq("course_id", courseId)
      .order("scheduled_at", { ascending: true });
    if (error) throw new Error(error.message);
    return NextResponse.json({ sessions: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}


