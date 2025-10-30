import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/db/supabase-server";
import { getCurrentUser } from "@/lib/auth/session";
import { NextRequest } from "next/server";

const CreateSchema = z.object({
  title: z.string().optional(),
  courseId: z.string().uuid(),
  scheduledAt: z.string(), // ISO or datetime-local
  durationMinutes: z.number().int().min(1),
  selectedStudents: z.array(z.string().uuid()).min(1)
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = getSupabaseServerClient();

  try {
    if (user.role === "admin") {
      const { data, error } = await supabase
        .from("course_sessions")
        .select("id, title, scheduled_at, duration_minutes, status, course:courses(id, title), students:session_students(student:students(id, user:users(id, name, email)))")
        .order("scheduled_at", { ascending: false });
      if (error) throw new Error(error.message);
      // Transform students
      const sessions = (data ?? []).map((session: any) => ({
        ...session,
        assignedStudents: (session.students || []).map((row: any) => {
          const s = row.student;
          const u = s?.user || {};
          return { id: s?.id, name: u.name, email: u.email };
        })
      }));
      return NextResponse.json({ sessions });
    }

    if (user.role === "teacher") {
      const { data: teacher, error: tErr } = await supabase
        .from("teachers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (tErr) throw new Error(tErr.message);
      const teacherId = (teacher as any)?.id;
      if (!teacherId) return NextResponse.json({ sessions: [] });
      const { data, error } = await supabase
        .from("course_sessions")
        .select("id, title, scheduled_at, duration_minutes, status, course:courses(id, title), students:session_students(student:students(id, user:users(id, name, email)))")
        .eq("teacher_id", teacherId)
        .order("scheduled_at", { ascending: false });
      if (error) throw new Error(error.message);
      const sessions = (data ?? []).map((session: any) => ({
        ...session,
        assignedStudents: (session.students || []).map((row: any) => {
          const s = row.student;
          const u = s?.user || {};
          return { id: s?.id, name: u.name, email: u.email };
        })
      }));
      return NextResponse.json({ sessions });
    }

    // student: only return sessions assigned via session_students
    const { data: stu, error: sErr } = await supabase
      .from("students")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    const studentId = (stu as any)?.id;
    if (!studentId) return NextResponse.json({ sessions: [] });
    const { data, error } = await supabase
      .from("session_students")
      .select("session:course_sessions(id, title, scheduled_at, duration_minutes, status, course:courses(id, title))")
      .eq("student_id", studentId);
    if (error) throw new Error(error.message);
    const sessions = (data ?? []).map((row: any) => {
      return row.session && { ...row.session };
    }).filter(Boolean);
    return NextResponse.json({ sessions });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role === "student") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = CreateSchema.safeParse({
    ...body,
    durationMinutes: Number(body?.durationMinutes),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { title, courseId, scheduledAt, durationMinutes, selectedStudents } = parsed.data;

  const supabase = getSupabaseServerClient();

  try {
    // If teacher, ensure they own the course
    let teacherId: string | null = null;
    if (user.role === "teacher") {
      const { data: teacher, error: tErr } = await supabase
        .from("teachers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (tErr) throw new Error(tErr.message);
      teacherId = (teacher as any)?.id ?? null;
      if (!teacherId) return NextResponse.json({ error: "Teacher profile not found" }, { status: 400 });
      const { data: course, error: cErr } = await supabase
        .from("courses")
        .select("teacher_id")
        .eq("id", courseId)
        .maybeSingle();
      if (cErr) throw new Error(cErr.message);
      if (!course || course.teacher_id !== teacherId) {
        return NextResponse.json({ error: "Forbidden: not course owner" }, { status: 403 });
      }
    }

    // If admin, try to set teacher_id from course if available
    if (user.role === "admin" && !teacherId) {
      const { data: course } = await supabase
        .from("courses")
        .select("teacher_id")
        .eq("id", courseId)
        .maybeSingle();
      teacherId = (course as any)?.teacher_id ?? null;
    }

    // 1. Insert session
    const { data: created, error: insErr } = await supabase.from("course_sessions").insert({
      title: title || null,
      course_id: courseId,
      teacher_id: teacherId,
      scheduled_at: new Date(scheduledAt).toISOString(),
      duration_minutes: durationMinutes,
      status: "upcoming",
    }).select('id').single();
    if (insErr) throw new Error(insErr.message);
    const sessionId = created.id;
    // 2. Insert session_students
    if (selectedStudents.length) {
      const rels = selectedStudents.map(studentId => ({ session_id: sessionId, student_id: studentId }));
      const { error: relErr } = await supabase.from("session_students").insert(rels);
      if (relErr) throw new Error(relErr.message);
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { sessionId: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { sessionId } = params;
  const body = await req.json();
  const updateSchema = z.object({
    title: z.string().optional(),
    scheduledAt: z.string().optional(),
    durationMinutes: z.number().int().min(1).optional(),
  });
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const supabase = getSupabaseServerClient();
  // Session lookup & permissions
  const { data: session, error } = await supabase.from("course_sessions").select("id, teacher_id").eq("id", sessionId).maybeSingle();
  if (error || !session) return NextResponse.json({ error: "Not found" }, { status: 404 });
  let canUpdate = false;
  if (user.role === "admin") canUpdate = true;
  if (user.role === "teacher") {
    const { data: teacher } = await supabase.from("teachers").select("id").eq("user_id", user.id).maybeSingle();
    if ((teacher as any)?.id && (teacher as any).id === (session as any).teacher_id) canUpdate = true;
  }
  if (!canUpdate) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  // Update fields
  const updateObj: any = {};
  if (parsed.data.title !== undefined) updateObj.title = parsed.data.title;
  if (parsed.data.scheduledAt !== undefined) updateObj.scheduled_at = new Date(parsed.data.scheduledAt).toISOString();
  if (parsed.data.durationMinutes !== undefined) updateObj.duration_minutes = parsed.data.durationMinutes;
  const { error: updErr } = await supabase.from("course_sessions").update(updateObj).eq("id", sessionId);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { sessionId: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { sessionId } = params;

  const supabase = getSupabaseServerClient();
  const { data: session, error } = await supabase.from("course_sessions").select("id, teacher_id").eq("id", sessionId).maybeSingle();
  if (error || !session) return NextResponse.json({ error: "Not found" }, { status: 404 });
  let canDelete = false;
  if (user.role === "admin") canDelete = true;
  if (user.role === "teacher") {
    const { data: teacher } = await supabase.from("teachers").select("id").eq("user_id", user.id).maybeSingle();
    if ((teacher as any)?.id && (teacher as any).id === (session as any).teacher_id) canDelete = true;
  }
  if (!canDelete) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { error: delErr } = await supabase.from("course_sessions").delete().eq("id", sessionId);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}


