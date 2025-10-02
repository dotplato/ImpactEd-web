import { getSupabaseServerClient } from "@/lib/db/supabase-server";

async function getTeachers() {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("teachers")
    .select("id, user:users(id, email, name)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export default async function AdminTeachersPage() {
  const teachers = await getTeachers();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Teachers</h1>
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
            {teachers.map((t: any) => (
              <tr key={t.id} className="border-b last:border-b-0">
                <td className="p-3">{t.user?.name ?? "-"}</td>
                <td className="p-3">{t.user?.email ?? "-"}</td>
              </tr>
            ))}
            {!teachers.length && (
              <tr><td className="p-3" colSpan={2}>No teachers</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


