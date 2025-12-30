import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/db/supabase-server";
import { getCurrentUser } from "@/lib/auth/session";
import { NextRequest } from "next/server";

const CreateCourseSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().default(""),
  teacherId: z.string().uuid().nullable().optional(),
  tenureStart: z.string().optional(),
  tenureEnd: z.string().optional(),
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = CreateCourseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { title, description, teacherId, tenureStart, tenureEnd } = parsed.data;
  const studentIds = Array.isArray(body.studentIds) ? body.studentIds : [];
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("courses")
    .insert({
      title,
      description,
      teacher_id: teacherId ?? null,
      tenure_start: tenureStart || null,
      tenure_end: tenureEnd || null,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  // Add course_students if studentIds present
  if (studentIds.length > 0) {
    const links = studentIds.map((student_id: string) => ({ course_id: data.id, student_id }));
    const { error: csErr } = await supabase.from("course_students").insert(links);
    if (csErr) return NextResponse.json({ error: csErr.message }, { status: 400 });
  }

  // Initialize group conversation
  const { error: convErr } = await supabase
    .from("conversations")
    .insert({
      type: "group",
      course_id: data.id
    });

  if (convErr) {
    console.error("Error initializing group conversation:", convErr);
    // We don't fail the whole request if just the chat fails, but it's good to log
  }

  return NextResponse.json({ id: data.id });
}

// /api/admin/courses (list all courses)
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = getSupabaseServerClient();
  // Admin: all courses; Teacher: only their courses; Student: only enrolled courses
  if (user.role === "admin") {
    const { data, error } = await supabase
      .from("courses")
      .select("id, title, teacher:teachers(id, user:users(name, email))")
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ courses: data ?? [] });
  }
  if (user.role === "teacher") {
    // teacher: only their courses
    const { data: teacher } = await supabase
      .from("teachers")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    const teacherId = (teacher as any)?.id;
    if (!teacherId) return NextResponse.json({ courses: [] });
    const { data, error } = await supabase
      .from("courses")
      .select("id, title, teacher:teachers(id, user:users(name, email))")
      .eq("teacher_id", teacherId)
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ courses: data ?? [] });
  }
  // student: only enrolled courses
  const { data: student } = await supabase
    .from("students")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  const studentId = (student as any)?.id;
  if (!studentId) return NextResponse.json({ courses: [] });
  const { data: enrollments, error: eErr } = await supabase
    .from("course_students")
    .select("course:courses(id, title, teacher:teachers(id, user:users(name, email)))")
    .eq("student_id", studentId);
  if (eErr) return NextResponse.json({ error: eErr.message }, { status: 400 });
  const courses = (enrollments ?? []).map((e: any) => e.course).filter(Boolean);
  return NextResponse.json({ courses });
}


