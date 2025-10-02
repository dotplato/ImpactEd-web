import { getSupabaseServerClient } from "@/lib/db/supabase-server";

async function getSessions() {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("course_sessions")
    .select("id, title, scheduled_at, duration_minutes, status, course:courses(title), teacher:teachers(id)")
    .order("scheduled_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export default async function AdminSessionsPage() {
  const sessions = await getSessions();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Sessions</h1>
      </div>
      <div className="border rounded">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="p-3">Title</th>
              <th className="p-3">Course</th>
              <th className="p-3">When</th>
              <th className="p-3">Duration</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s: any) => (
              <tr key={s.id} className="border-b last:border-b-0">
                <td className="p-3">{s.title ?? "Session"}</td>
                <td className="p-3">{s.course?.title ?? "-"}</td>
                <td className="p-3">{new Date(s.scheduled_at).toLocaleString()}</td>
                <td className="p-3">{s.duration_minutes} min</td>
                <td className="p-3 capitalize">{s.status}</td>
              </tr>
            ))}
            {!sessions.length && (
              <tr><td className="p-3" colSpan={5}>No sessions</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


