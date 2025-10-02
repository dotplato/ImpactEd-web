import { getSupabaseServerClient } from "@/lib/db/supabase-server";
import Link from "next/link";

async function getCourses() {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("courses")
    .select("id, title, teacher:teachers!courses_teacher_id_fkey(user_id), tenure_start, tenure_end")
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
      <div className="border rounded">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="p-3">Title</th>
              <th className="p-3">Teacher</th>
              <th className="p-3">Tenure</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((c: any) => (
              <tr key={c.id} className="border-b last:border-b-0">
                <td className="p-3"><Link className="hover:underline" href={`/admin/courses/${c.id}`}>{c.title}</Link></td>
                <td className="p-3">{c.teacher ? c.teacher.user_id : "-"}</td>
                <td className="p-3">{c.tenure_start || "-"} — {c.tenure_end || "-"}</td>
              </tr>
            ))}
            {!courses.length && (
              <tr><td className="p-3" colSpan={3}>No courses yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


