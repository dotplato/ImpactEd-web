"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type CourseDetails = {
  id: string;
  title: string;
  description?: string | null;
  tenure_start?: string | null;
  teacher?: { id: string; name: string | null; email: string | null } | null;
  students: { id: string; name: string; email: string }[];
  outline: { id: string; title: string; subtopics: { id: string; title: string }[] }[];
};

type SessionRow = {
  id: string;
  title: string | null;
  scheduled_at: string;
  duration_minutes: number;
};

type FileRow = {
  id: string;
  file_name: string;
  file_path: string;
  mime?: string | null;
  created_at: string;
};

export default function AdminCourseDetailPage() {
  const params = useParams<{ id: string }>();
  const courseId = params?.id as string;

  const [activeTab, setActiveTab] = useState<"overview" | "schedule" | "files">("overview");

  const [course, setCourse] = useState<CourseDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const [files, setFiles] = useState<FileRow[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Create session form
  const [form, setForm] = useState({
    title: "",
    scheduledAt: "",
    duration: 60,
    selectedStudents: [] as string[],
  });

  const studentOptions = useMemo(() => (course?.students ?? []).map(s => ({ id: s.id, label: `${s.name} (${s.email})` })), [course]);

  async function loadCourse() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/admin/courses/${courseId}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error || "Failed to load course");
      setLoading(false);
      return;
    }
    setCourse(data.course as CourseDetails);
    setLoading(false);
  }

  async function loadSessions() {
    setSessionsLoading(true);
    const res = await fetch(`/api/admin/courses/${courseId}/sessions`);
    const data = await res.json();
    if (res.ok) setSessions(data.sessions || []);
    setSessionsLoading(false);
  }

  async function loadFiles() {
    setFilesLoading(true);
    const res = await fetch(`/api/admin/courses/${courseId}/files`);
    const data = await res.json();
    if (res.ok) setFiles(data.files || []);
    setFilesLoading(false);
  }

  useEffect(() => {
    if (!courseId) return;
    loadCourse();
    loadSessions();
    loadFiles();
  }, [courseId]);

  // Group sessions by week number starting from course.tenure_start
  const weekGroups = useMemo(() => {
    const startStr = course?.tenure_start;
    if (!startStr) return [] as { label: string; start: Date; end: Date; sessions: SessionRow[] }[];
    const startDate = new Date(startStr);
    startDate.setHours(0,0,0,0);
    const sorted = [...sessions].sort((a,b)=>new Date(a.scheduled_at).getTime()-new Date(b.scheduled_at).getTime());
    const groups: Record<number, { start: Date; end: Date; sessions: SessionRow[] }> = {};
    for (const s of sorted) {
      const when = new Date(s.scheduled_at);
      const diffMs = when.getTime() - startDate.getTime();
      const weekIndex = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)); // 0-based
      const group = groups[weekIndex] || (() => {
        const gStart = new Date(startDate.getTime() + weekIndex * 7 * 24 * 60 * 60 * 1000);
        const gEnd = new Date(gStart);
        gEnd.setDate(gStart.getDate() + 6);
        gEnd.setHours(23,59,59,999);
        const g = { start: gStart, end: gEnd, sessions: [] as SessionRow[] };
        groups[weekIndex] = g;
        return g;
      })();
      group.sessions.push(s);
    }
    const ordered = Object.keys(groups).map(k=>Number(k)).sort((a,b)=>a-b).map((k,i)=>{
      const g = groups[k];
      return {
        label: `Week ${i+1}`,
        start: g.start,
        end: g.end,
        sessions: g.sessions,
      };
    });
    return ordered;
  }, [sessions, course?.tenure_start]);

  async function onCreateSession(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch(`/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title || undefined,
        courseId,
        scheduledAt: form.scheduledAt,
        durationMinutes: Number(form.duration) || 60,
        selectedStudents: form.selectedStudents,
      }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data?.error || "Failed to create session"); return; }
    setForm({ title: "", scheduledAt: "", duration: 60, selectedStudents: [] });
    loadSessions();
  }

  async function onUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`/api/admin/courses/${courseId}/files`, { method: "POST", body: formData });
    if (res.ok) {
      await loadFiles();
    }
    setUploading(false);
    (e.target as any).value = "";
  }

  async function onDeleteFile(id: string) {
    if (!confirm("Delete this file?")) return;
    const res = await fetch(`/api/admin/courses/${courseId}/files/${id}`, { method: "DELETE" });
    if (res.ok) loadFiles();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Course</h1>
          <div className="text-sm text-muted-foreground">{course?.title || ""}</div>
        </div>
        <Link className="text-sm underline" href="/admin/courses">Back to courses</Link>
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : course ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 space-y-4">
            <div className="flex gap-2 border-b">
              <button className={`px-3 py-2 text-sm ${activeTab==='overview'?'border-b-2 border-foreground font-medium':''}`} onClick={()=>setActiveTab('overview')}>Overview</button>
              <button className={`px-3 py-2 text-sm ${activeTab==='schedule'?'border-b-2 border-foreground font-medium':''}`} onClick={()=>setActiveTab('schedule')}>Schedule</button>
              <button className={`px-3 py-2 text-sm ${activeTab==='files'?'border-b-2 border-foreground font-medium':''}`} onClick={()=>setActiveTab('files')}>Files</button>
            </div>

            {activeTab === "overview" && (
              <div className="space-y-6">
                <section className="space-y-2">
                  <h2 className="text-base font-semibold">Details</h2>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{course.description || "No description provided."}</p>
                </section>
                <section className="space-y-2">
                  <h2 className="text-base font-semibold">Outline</h2>
                  {sessions.length ? (
                    <div className="space-y-2">
                      {[...sessions]
                        .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
                        .map((s, idx) => (
                          <div key={s.id} className="border rounded p-3 flex items-center justify-between">
                            <div>
                              <div className="font-medium">{s.title || `Session ${idx + 1}`}</div>
                              <div className="text-xs text-muted-foreground">{new Date(s.scheduled_at).toLocaleString()}</div>
                            </div>
                            <div className="text-xs text-muted-foreground">{s.duration_minutes} min</div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">No sessions scheduled yet. Create a schedule to build the outline.</div>
                  )}
                </section>
              </div>
            )}

            {activeTab === "schedule" && (
              <div className="space-y-6">
                <form className="grid gap-3 md:grid-cols-4 items-end" onSubmit={onCreateSession}>
                  <div className="md:col-span-1">
                    <label className="block text-xs mb-1">Title</label>
                    <input className="w-full border rounded px-2 py-1 text-sm" value={form.title} onChange={e=>setForm(f=>({...f, title:e.target.value}))} placeholder="Optional" />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-xs mb-1">When</label>
                    <input type="datetime-local" className="w-full border rounded px-2 py-1 text-sm" value={form.scheduledAt} onChange={e=>setForm(f=>({...f, scheduledAt:e.target.value}))} required />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-xs mb-1">Duration (min)</label>
                    <input type="number" min={1} className="w-full border rounded px-2 py-1 text-sm" value={form.duration} onChange={e=>setForm(f=>({...f, duration:Number(e.target.value)||60}))} />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-xs mb-1">Students</label>
                    <select multiple className="w-full border rounded px-2 py-1 text-sm h-24" value={form.selectedStudents} onChange={e=>{
                      const vals = Array.from(e.target.selectedOptions).map(o=>o.value);
                      setForm(f=>({...f, selectedStudents: vals}));
                    }}>
                      {studentOptions.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-4">
                    <button className="border rounded px-3 py-2 text-sm hover:bg-gray-50">Create session</button>
                  </div>
                </form>

                <div className="space-y-6">
                  {sessionsLoading ? (
                    <div className="text-sm text-muted-foreground">Loading sessions...</div>
                  ) : !course?.tenure_start ? (
                    <div className="text-sm text-muted-foreground">Set the course start date to view weeks.</div>
                  ) : weekGroups.length ? (
                    weekGroups.map(g => (
                      <section key={g.label}>
                        <div className="text-sm font-medium mb-2">{g.label} <span className="text-xs text-muted-foreground">({g.start.toLocaleDateString()} - {g.end.toLocaleDateString()})</span></div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left border-b">
                                <th className="py-2 pr-3">Title</th>
                                <th className="py-2 pr-3">When</th>
                                <th className="py-2 pr-3">Duration</th>
                              </tr>
                            </thead>
                            <tbody>
                              {g.sessions.map(s => (
                                <tr key={s.id} className="border-b last:border-b-0">
                                  <td className="py-2 pr-3">{s.title || "Session"}</td>
                                  <td className="py-2 pr-3">{new Date(s.scheduled_at).toLocaleString()}</td>
                                  <td className="py-2 pr-3">{s.duration_minutes} min</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </section>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground">No sessions yet.</div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "files" && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <input type="file" onChange={onUploadFile} disabled={uploading} />
                  {uploading && <span className="text-xs text-muted-foreground">Uploading...</span>}
                </div>
                {filesLoading ? (
                  <div className="text-sm text-muted-foreground">Loading files...</div>
                ) : files.length ? (
                  <ul className="space-y-2">
                    {files.map(f => (
                      <li key={f.id} className="flex items-center justify-between border rounded px-3 py-2">
                        <div className="text-sm">
                          <div className="font-medium">{f.file_name}</div>
                          <div className="text-xs text-muted-foreground">{new Date(f.created_at).toLocaleString()}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <a className="text-sm underline" href={f.file_path} target="_blank" rel="noreferrer">View</a>
                          <button className="text-sm text-red-600" onClick={()=>onDeleteFile(f.id)}>Delete</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-muted-foreground">No files yet.</div>
                )}
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            <div className="border rounded p-4">
              <div className="text-sm text-muted-foreground mb-2">Course info</div>
              <div className="space-y-2 text-sm">
                <div><span className="text-muted-foreground">Teacher:</span> {course.teacher?.name || "Unassigned"}</div>
                <div><span className="text-muted-foreground">Students:</span> {course.students.length}</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">Not found</div>
      )}
    </div>
  );
}


