import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/db/supabase-server";
import { getCurrentUser } from "@/lib/auth/session";
import { createDailyMeetingToken } from "@/lib/integrations/daily";

const JoinSchema = z.object({ sessionId: z.string().uuid() });

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => null);
    const parsed = JoinSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const { sessionId } = parsed.data;

    const supabase = getSupabaseServerClient();

    // Load session and related course
    const { data: session, error } = await supabase
      .from("course_sessions")
      .select("id, course_id, teacher_id, scheduled_at, status, daily_room_url, daily_room_id, course:courses(id, title)")
      .eq("id", sessionId)
      .maybeSingle();
    if (error || !session) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Time gate - session must have started
    if (new Date() < new Date((session as any).scheduled_at)) {
      return NextResponse.json({ error: "Session not started yet" }, { status: 403 });
    }

    // Check if Daily.co room URL exists
    const dailyRoomUrl = (session as any).daily_room_url;
    const dailyRoomName = (session as any).daily_room_id;
    if (!dailyRoomUrl || !dailyRoomName) {
      return NextResponse.json({ error: "Session room not available" }, { status: 404 });
    }

    const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 4; // 4 hours
    async function issueUrl(isOwner: boolean) {
      const token = await createDailyMeetingToken({
        room_name: dailyRoomName,
        user_name: user.name || user.email || undefined,
        is_owner: isOwner,
        exp,
      });
      const sep = dailyRoomUrl.includes("?") ? "&" : "?";
      return `${dailyRoomUrl}${sep}t=${encodeURIComponent(token)}`;
    }

    // Permission: teacher assigned OR enrolled student OR admin
    if (user.role === "admin") {
      return NextResponse.json({ ok: true, url: await issueUrl(true) });
    }

    if (user.role === "teacher") {
      const { data: teacher } = await supabase
        .from("teachers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      const teacherId = (teacher as any)?.id;
      if (teacherId && teacherId === (session as any).teacher_id) {
        return NextResponse.json({ ok: true, url: await issueUrl(true) });
      }
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // student - check if assigned to this session
    const { data: stu } = await supabase
      .from("students")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    const studentId = (stu as any)?.id;
    if (!studentId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data: assigned } = await supabase
      .from("session_students")
      .select("id")
      .eq("session_id", sessionId)
      .eq("student_id", studentId)
      .maybeSingle();
    if (!assigned) {
      return NextResponse.json({ error: "You are not assigned to this session" }, { status: 403 });
    }

    return NextResponse.json({ ok: true, url: await issueUrl(false) });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}


