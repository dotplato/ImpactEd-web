import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/db/supabase-server";
import { getCurrentUser } from "@/lib/auth/session";

const JoinSchema = z.object({ sessionId: z.string().uuid() });

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const parsed = JoinSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { sessionId } = parsed.data;

  const supabase = getSupabaseServerClient();

  // Load session and related course
  const { data: session, error } = await supabase
    .from("course_sessions")
    .select("id, course_id, teacher_id, scheduled_at, status, course:courses(id, title)")
    .eq("id", sessionId)
    .maybeSingle();
  if (error || !session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Time gate
  if (new Date() < new Date((session as any).scheduled_at)) {
    return NextResponse.json({ error: "Session not started yet" }, { status: 403 });
  }

  // Permission: teacher assigned OR enrolled student
  if (user.role === "admin") {
    // let admin join for monitoring
    return NextResponse.json({ ok: true, url: `/sessions/${sessionId}` });
  }

  if (user.role === "teacher") {
    const { data: teacher } = await supabase
      .from("teachers")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    const teacherId = (teacher as any)?.id;
    if (teacherId && teacherId === (session as any).teacher_id) {
      return NextResponse.json({ ok: true, url: `/sessions/${sessionId}` });
    }
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // student
  const { data: stu } = await supabase
    .from("students")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  const studentId = (stu as any)?.id;
  if (!studentId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { data: enrolled } = await supabase
    .from("course_students")
    .select("id")
    .eq("course_id", (session as any).course_id)
    .eq("student_id", studentId)
    .maybeSingle();
  if (!enrolled) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ ok: true, url: `/sessions/${sessionId}` });
}


