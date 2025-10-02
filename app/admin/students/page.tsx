import { getSupabaseServerClient } from "@/lib/db/supabase-server";

async function getStudents() {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("students")
    .select("id, user:users(id, email, name)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export default async function AdminStudentsPage() {
  const students = await getStudents();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Students</h1>
      </div>
      <div className="border rounded">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="p-3">Name</th>
              <th className="p-3">Email</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s: any) => (
              <tr key={s.id} className="border-b last:border-b-0">
                <td className="p-3">{s.user?.name ?? "-"}</td>
                <td className="p-3">{s.user?.email ?? "-"}</td>
              </tr>
            ))}
            {!students.length && (
              <tr><td className="p-3" colSpan={2}>No students</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


