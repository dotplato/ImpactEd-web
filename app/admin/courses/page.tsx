import { getSupabaseServerClient } from "@/lib/db/supabase-server";
import Link from "next/link";
import { CourseCard } from "@/components/cards/CourseCard";

async function getCourses() {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("courses")
    .select("id, title, tenure_start, tenure_end, teacher:teachers(id, user:users(name))")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export default async function AdminCoursesPage() {
  const courses = await getCourses();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Courses</h1>
        <Link className="border rounded px-3 py-2" href="/admin/courses/new">Create course</Link>
      </div>
      {courses.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((c: any) => (
            <CourseCard key={c.id} id={c.id} title={c.title} teacherName={c.teacher?.[0]?.user?.name ?? null} />
          ))}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">No courses yet</div>
      )}
    </div>
  );
}


