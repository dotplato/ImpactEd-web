import { getCurrentUser } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/db/supabase-server";
import { CourseCard } from "@/components/cards/CourseCard";

async function getCoursesForRole(role: "admin" | "teacher" | "student", userId: string) {
  const supabase = getSupabaseServerClient();
  if (role === "admin") {
    const { data } = await supabase
      .from("courses")
      .select("id, title, teacher:teachers(id, user:users(name))")
      .order("created_at", { ascending: false });
    return data ?? [];
  }
  if (role === "teacher") {
    const { data } = await supabase
      .from("teachers")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    const teacherId = (data as any)?.id;
    if (!teacherId) return [];
    const res = await supabase
      .from("courses")
      .select("id, title, teacher:teachers(id, user:users(name))")
      .eq("teacher_id", teacherId)
      .order("created_at", { ascending: false });
    return res.data ?? [];
  }
  // student
  const studentRes = await supabase
    .from("students")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  const studentId = (studentRes.data as any)?.id;
  if (!studentId) return [];
  const { data } = await supabase
    .from("course_students")
    .select("course:courses(id, title, teacher:teachers(id, user:users(name)))")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((r: any) => r.course);
}

export default async function CoursesPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const courses = await getCoursesForRole(user.role, user.id);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Courses</h1>
      {courses.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((c: any) => (
            <CourseCard key={c.id} id={c.id} title={c.title} teacherName={c.teacher?.[0]?.user?.name ?? null} />
          ))}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">No courses</div>
      )}
    </div>
  );
}


