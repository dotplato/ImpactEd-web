"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Teacher = { id: string; user_id: string };

export default function NewCoursePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [tenureStart, setTenureStart] = useState<string>("");
  const [tenureEnd, setTenureEnd] = useState<string>("");
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/teachers");
      const data = await res.json();
      if (res.ok) setTeachers(data.teachers || []);
    })();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, teacherId, tenureStart, tenureEnd }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data?.error || "Failed to create course");
      return;
    }
    router.push(`/admin/courses/${data.id}`);
  };

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-semibold mb-4">Create course</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="block text-sm mb-1">Title</label>
          <input className="w-full border rounded px-3 py-2" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm mb-1">Description</label>
          <textarea className="w-full border rounded px-3 py-2" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm mb-1">Teacher</label>
          <select className="w-full border rounded px-3 py-2" value={teacherId ?? ""} onChange={(e) => setTeacherId(e.target.value || null)}>
            <option value="">Unassigned</option>
            {teachers.map(t => (
              <option key={t.id} value={t.id}>{t.user_id}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">Tenure start</label>
            <input type="date" className="w-full border rounded px-3 py-2" value={tenureStart} onChange={(e) => setTenureStart(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm mb-1">Tenure end</label>
            <input type="date" className="w-full border rounded px-3 py-2" value={tenureEnd} onChange={(e) => setTenureEnd(e.target.value)} />
          </div>
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button disabled={loading} className="bg-black text-white rounded px-3 py-2 disabled:opacity-50">
          {loading ? "Creating..." : "Create"}
        </button>
      </form>
    </div>
  );
}


