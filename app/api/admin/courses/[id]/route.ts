import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/db/supabase-server";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const courseId = params.id;
  const supabase = getSupabaseServerClient();

  try {
    // Basic course with teacher
    const { data: course, error: cErr } = await supabase
      .from("courses")
      .select("id, title, description, tenure_start, teacher:teachers!courses_teacher_id_fkey(id, user:users(id, name, email))")
      .eq("id", courseId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Students
    const { data: students, error: sErr } = await supabase
      .from("course_students")
      .select("student:students(id, user:users(id, name, email))")
      .eq("course_id", courseId);
    if (sErr) throw new Error(sErr.message);
    const studentRows = (students ?? []).map((r: any) => ({ id: r.student?.id, name: r.student?.user?.name, email: r.student?.user?.email }));

    // Outline topics and subtopics
    const { data: topics, error: tErr } = await supabase
      .from("course_outline_topics")
      .select("id, title, sort_order")
      .eq("course_id", courseId)
      .order("sort_order", { ascending: true });
    if (tErr) throw new Error(tErr.message);
    const topicIds = (topics ?? []).map((t: any) => t.id);
    let subtopicsByTopic: Record<string, any[]> = {};
    if (topicIds.length) {
      const { data: subs, error: stErr } = await supabase
        .from("course_outline_subtopics")
        .select("id, title, sort_order, topic_id")
        .in("topic_id", topicIds)
        .order("sort_order", { ascending: true });
      if (stErr) throw new Error(stErr.message);
      for (const s of subs ?? []) {
        if (!subtopicsByTopic[s.topic_id]) subtopicsByTopic[s.topic_id] = [];
        subtopicsByTopic[s.topic_id].push({ id: s.id, title: s.title });
      }
    }

    const outline = (topics ?? []).map((t: any) => ({ id: t.id, title: t.title, subtopics: subtopicsByTopic[t.id] || [] }));

    return NextResponse.json({
      course: {
        id: course.id,
        title: course.title,
        description: (course as any).description ?? null,
        tenure_start: (course as any).tenure_start ?? null,
        teacher: course.teacher?.user ? { id: course.teacher.id, name: course.teacher.user.name, email: course.teacher.user.email } : null,
        students: studentRows.filter(s => s.id),
        outline,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}


