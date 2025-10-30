"use client";
import { useEffect, useMemo, useState } from "react";
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { LayoutGrid, CalendarDays, Plus, Pencil, Trash } from 'lucide-react';

type Role = "admin" | "teacher" | "student";

type SessionRow = {
  id: string;
  title: string | null;
  scheduled_at: string; // ISO
  duration_minutes: number;
  status: string;
  course?: { id: string; title: string } | null;
};

type Props = {
  role: Role;
};

export default function SessionsPage({ role }: Props) {
  const calendarRef = useRef<any>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'calendar'>('overview');
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    courseId: "",
    scheduledAt: "",
    duration: 60,
    selectedStudents: [] as string[],
  });
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);
  const [enrolledStudents, setEnrolledStudents] = useState<{id: string, name: string, email: string}[]>([]);
  const canCreate = role === "admin" || role === "teacher";

  // Additional state for editing
  const [editId, setEditId] = useState<string|null>(null);
  const [editForm, setEditForm] = useState<{title:string, scheduledAt:string, duration:number}>({title:"", scheduledAt:"", duration:60});
  const [editLoading, setEditLoading] = useState(false);

  // Track session we are deleting
  const [deleteId, setDeleteId] = useState<string|null>(null);

  const now = useMemo(() => new Date(), [sessions.length]);

  async function loadSessions() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/sessions");
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error || "Failed to load sessions");
      setLoading(false);
      return;
    }
    setSessions(data.sessions || []);
    setLoading(false);
  }

  async function loadCourses() {
    if (!canCreate) return;
    const res = await fetch("/api/admin/courses", { method: "GET" });
    if (res.ok) {
      const payload = await res.json();
      const list = payload?.courses ?? payload ?? [];
      const mapped = Array.isArray(list)
        ? list.map((c: any) => ({ id: c.id, title: c.title }))
        : [];
      setCourses(mapped);
    }
  }

  // Load students for selected course when opening the form OR changing course
  async function loadStudentsForCourse(courseId: string) {
    if (!courseId) return setEnrolledStudents([]);
    const res = await fetch(`/api/admin/courses/${courseId}/students`, { method: "GET" });
    if (res.ok) {
      const payload = await res.json();
      setEnrolledStudents(payload.students || []);
    }
  }

  useEffect(() => {
    loadSessions();
    loadCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Calendar event mapping
  const calendarEvents = sessions.map(s => ({
    id: s.id,
    title: s.title || "Session",
    start: s.scheduled_at,
    end: (() => {
      const d = new Date(s.scheduled_at);
      d.setMinutes(d.getMinutes() + (s.duration_minutes || 60));
      return d.toISOString();
    })(),
    extendedProps: s,
  }));

  // Helper to format JS date to YYYY-MM-DDTHH:MM for HTML input
  function toLocalDatetimeInputValue(date: Date) {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  const handleDateClick = (info: any) => {
    if (!(role === 'admin' || role === 'teacher')) return;
    // info.date is JS Date
    const dtStr = toLocalDatetimeInputValue(info.date instanceof Date ? info.date : new Date(info.dateStr));
    setForm(f => ({ ...f, scheduledAt: dtStr }));
    setCreateOpen(true);
  };

  // For drag-select (range) on week/day views
  const handleSelect = (info: any) => {
    if (!(role === 'admin' || role === 'teacher')) return;
    // info.start is Date
    const dtStr = toLocalDatetimeInputValue(info.start instanceof Date ? info.start : new Date(info.startStr));
    setForm(f => ({ ...f, scheduledAt: dtStr }));
    setCreateOpen(true);
  };

  const handleEventClick = (info: any) => {
    // Optionally start editing; for now, scroll table to it
    if(canEditOrDelete(info.event.extendedProps)) {
      setEditId(info.event.id);
      setEditForm({
        title: info.event.title || "",
        scheduledAt: info.event.startStr.slice(0,16),
        duration: info.event.extendedProps.duration_minutes || 60
      });
    }
  };

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title || undefined,
        courseId: form.courseId,
        scheduledAt: form.scheduledAt,
        durationMinutes: Number(form.duration) || 60,
        selectedStudents: form.selectedStudents || [],
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error || "Failed to create session");
      return;
    }
    setCreateOpen(false);
    setForm({ title: "", courseId: "", scheduledAt: "", duration: 60, selectedStudents: [] });
    setEnrolledStudents([]);
    loadSessions();
  };

  const onJoin = async (id: string) => {
    const res = await fetch("/api/sessions/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: id }),
    });
    const data = await res.json();
    if (res.ok) {
      // Navigate to placeholder room or show success
      if (data?.url) window.location.href = data.url;
    } else {
      alert(data?.error || "Unable to join session");
    }
  };

  function canEditOrDelete(session: SessionRow) {
    // Only admin for now, can be extended for teacher ownership
    // Optionally, check if role === 'teacher' and session.course?.teacher_id === user_teacher_id
    return role === "admin";
  }

  const onDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this session?")) return;
    setDeleteId(id);
    setError(null);
    const res = await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    setDeleteId(null);
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error || "Failed to delete session");
      return;
    }
    loadSessions();
  };

  const onEditStart = (session: SessionRow) => {
    setEditId(session.id);
    setEditForm({ title: session.title || "", scheduledAt: session.scheduled_at.slice(0,16), duration: session.duration_minutes });
  };
  const onEditCancel = () => {
    setEditId(null);
  };
  const onEditSave = async () => {
    setEditLoading(true);
    setError(null);
    const res = await fetch(`/api/sessions/${editId}`, {
      method: "PATCH",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({
        title: editForm.title,
        scheduledAt: editForm.scheduledAt,
        durationMinutes: Number(editForm.duration),
        studentIds: editForm.selectedStudents, // Assuming editForm.selectedStudents is available here
      })
    });
    setEditLoading(false);
    setEditId(null);
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error || "Failed to update session");
      return;
    }
    loadSessions();
  };

  // Error formatting helper for Zod or generic error objects
  function formatError(error: any): string {
    if (!error) return '';
    if (typeof error === 'string') return error;
    if (typeof error === 'object') {
      let out = '';
      if (error.formErrors && Array.isArray(error.formErrors) && error.formErrors.length > 0) {
        out += error.formErrors.join(' ');
      }
      if (error.fieldErrors && typeof error.fieldErrors === 'object') {
        const flat = Object.entries(error.fieldErrors).flatMap(([field, arr]) => arr && arr.length ? `${field}: ${arr.join(' ')}` : []);
        if (flat.length > 0) out += (out ? ' | ' : '') + flat.join(' | ');
      }
      if (!out) out = JSON.stringify(error);
      return out;
    }
    return String(error);
  }

  return (
    <div className="space-y-4">
      {/* Tab bar and New Session button */}
      <div className="flex items-center border-b mb-4">
        <div className="flex gap-0">
          <button
            className={`px-4 py-2 font-medium border-b-2 transition-colors duration-100 flex items-center gap-1 ${activeTab === 'overview' ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-black'}`}
            onClick={() => setActiveTab('overview')}
          >
            <LayoutGrid className="size-4" /> Overview
          </button>
          <button
            className={`px-4 py-2 font-medium border-b-2 transition-colors duration-100 flex items-center gap-1 ${activeTab === 'calendar' ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-black'}`}
            onClick={() => setActiveTab('calendar')}
          >
            <CalendarDays className="size-4" /> Calendar
          </button>
        </div>
        <div className="flex-1" />
        {(role === 'admin' || role === 'teacher') && (
          <button
            onClick={() => setCreateOpen(true)}
            className="ml-auto bg-black text-white rounded px-4 py-2 text-sm shadow hover:bg-gray-900 transition flex items-center gap-1"
          >
            <Plus className="size-4" /> New Session
          </button>
        )}
      </div>

      {activeTab === 'calendar' && (
        <div className="border rounded mb-4">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay'
            }}
            height="auto"
            events={calendarEvents}
            eventClick={handleEventClick}
            dateClick={handleDateClick}
            selectable={role === 'admin' || role === 'teacher'}
            select={handleSelect}
            nowIndicator={true}
          />
        </div>
      )}

      <Dialog.Root open={!!createOpen} onOpenChange={open => { setCreateOpen(open); if(!open) setEnrolledStudents([]); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-w-md w-full -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-lg ring-1 ring-black/10 focus:outline-none">
            <Dialog.Title className="text-lg font-semibold mb-2">Create Session</Dialog.Title>
            <form onSubmit={onCreate} className="grid gap-3">
              <div>
                <label className="block text-sm mb-1">Course</label>
                <select
                  required
                  className="w-full border rounded px-3 py-2"
                  value={form.courseId}
                  onChange={async (e) => {
                    const val = e.target.value;
                    setForm(f => ({ ...f, courseId: val, selectedStudents: [] }));
                    await loadStudentsForCourse(val);
                  }}
                >
                  <option value="">Select course</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>
              {form.courseId && (
                <div>
                  <label className="block text-sm mb-1">Students</label>
                  {enrolledStudents.length > 0 ? (
                    <div className="border rounded p-2 flex flex-col gap-1 max-h-40 overflow-y-auto">
                      <label className="flex items-center gap-2 font-medium">
                        <input
                          type="checkbox"
                          checked={form.selectedStudents.length === enrolledStudents.length}
                          onChange={e =>
                            setForm(f => ({
                              ...f,
                              selectedStudents: e.target.checked
                                ? enrolledStudents.map(s => s.id)
                                : [],
                            }))
                          }
                        />
                        Select All
                      </label>
                      {enrolledStudents.map(s => (
                        <label key={s.id} className="flex items-center gap-2 pl-4">
                          <input
                            type="checkbox"
                            value={s.id}
                            checked={form.selectedStudents.includes(s.id)}
                            onChange={e => {
                              const checked = e.target.checked;
                              setForm(f => ({
                                ...f,
                                selectedStudents: checked
                                  ? [...f.selectedStudents, s.id]
                                  : f.selectedStudents.filter(id => id !== s.id),
                              }));
                            }}
                          />
                          {s.name} <span className="text-xs text-gray-400">({s.email})</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400 italic pl-1">No students enrolled.</div>
                  )}
                </div>
              )}
              <div>
                <label className="block text-sm mb-1">Title</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Start time</label>
                <input
                  type="datetime-local"
                  required
                  className="w-full border rounded px-3 py-2"
                  value={form.scheduledAt}
                  onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Duration (minutes)</label>
                <input
                  type="number"
                  min={1}
                  className="w-full border rounded px-3 py-2"
                  value={form.duration}
                  onChange={(e) => setForm((f) => ({ ...f, duration: Number(e.target.value) }))}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" className="rounded bg-gray-200 text-gray-900 px-4 py-2" onClick={() => setCreateOpen(false)}>Cancel</button>
                <button className="bg-black text-white rounded px-4 py-2" disabled={form.selectedStudents.length === 0} title={form.selectedStudents.length ? '' : 'Select at least one student'}>
                  Create session
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {error && <p className="text-red-600 text-sm">{formatError(error)}</p>}
      {/* Session list -- shown in both tabs as needed */}
      {((activeTab === 'overview') || (activeTab === 'calendar')) && (
        loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="border rounded">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="p-3">Title</th>
                  <th className="p-3">Course</th>
                  <th className="p-3">When</th>
                  <th className="p-3">Duration</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Students</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => {
                  // Edit modal (one at a time)
                  if(editId === s.id) {
                    return (
                      <>
                      <tr key={s.id} className="border-b last:border-b-0 bg-blue-50">
                        <td colSpan={7} className="!p-0">
                          <Dialog.Root open={!!editId} onOpenChange={open => { if(!open) onEditCancel() }}>
                            <Dialog.Portal>
                              <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
                              <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-w-md w-full -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-lg ring-1 ring-black/10 focus:outline-none">
                                <Dialog.Title className="text-lg font-semibold mb-2">Edit Session</Dialog.Title>
                                <form onSubmit={e=>{ e.preventDefault(); onEditSave();}} className="grid gap-3">
                                  <div>
                                    <label className="block text-sm mb-1">Title</label>
                                    <input className="w-full border rounded px-3 py-2" value={editForm.title} onChange={e=>setEditForm(f=>({...f,title:e.target.value}))} />
                                  </div>
                                  <div>
                                    <label className="block text-sm mb-1">Start time</label>
                                    <input type="datetime-local" className="w-full border rounded px-3 py-2" value={editForm.scheduledAt} onChange={e=>setEditForm(f=>({...f,scheduledAt:e.target.value}))}/>
                                  </div>
                                  <div>
                                    <label className="block text-sm mb-1">Duration (minutes)</label>
                                    <input type="number" min={1} className="w-full border rounded px-3 py-2" value={editForm.duration} onChange={e=>setEditForm(f=>({...f,duration:Number(e.target.value)}))}/>
                                  </div>
                                  {/* Add enrolled student selection for edit here if desired */}
                                  <div className="flex gap-2 justify-end">
                                    <button type="button" className="rounded bg-gray-200 text-gray-900 px-4 py-2" onClick={() => onEditCancel()} disabled={editLoading}>Cancel</button>
                                    <button disabled={editLoading} className="bg-green-600 text-white rounded px-4 py-2">{editLoading ? "Saving..." : "Save"}</button>
                                  </div>
                                </form>
                              </Dialog.Content>
                            </Dialog.Portal>
                          </Dialog.Root>
                        </td>
                      </tr>
                      </>
                    );
                  }
                  const startsAt = new Date(s.scheduled_at);
                  const canJoinNow = now >= startsAt;
                  return (
                    <tr key={s.id} className="border-b last:border-b-0">
                      <td className="p-3">{s.title ?? "Session"}</td>
                      <td className="p-3">{s.course?.title ?? "-"}</td>
                      <td className="p-3">{new Date(s.scheduled_at).toLocaleString()}</td>
                      <td className="p-3">{s.duration_minutes} min</td>
                      <td className="p-3 capitalize">{s.status}</td>
                      <td className="p-3">
                        {/* Placeholder: to be populated with assigned students or a count */}
                      </td>
                      <td className="p-3 flex gap-2 items-center">
                        <button
                          onClick={() => onJoin(s.id)}
                          disabled={!canJoinNow}
                          className={`rounded px-3 py-1 text-sm ${canJoinNow ? "bg-black text-white" : "bg-gray-200 text-gray-500 cursor-not-allowed"}`}
                          title={canJoinNow ? "Join session" : "Available at start time"}
                        >
                          Join
                        </button>
                        {canEditOrDelete(s) && (
                          <>
                            <button
                              onClick={() => onEditStart(s)}
                              className="rounded-full bg-gray-100 hover:bg-blue-100 focus-visible:ring-2 focus-visible:ring-blue-300 p-1"
                              disabled={editId === s.id}
                              title="Edit"
                              aria-label="Edit"
                              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 32, width: 32 }}
                            >
                              <Pencil className="size-4 text-blue-600" />
                            </button>
                            <button
                              onClick={() => onDelete(s.id)}
                              className="rounded-full bg-gray-100 hover:bg-red-100 focus-visible:ring-2 focus-visible:ring-red-300 p-1 ml-1"
                              disabled={deleteId === s.id}
                              title="Delete"
                              aria-label="Delete"
                              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 32, width: 32 }}
                            >
                              {deleteId === s.id ? (
                                <span className="size-4 animate-spin border-2 border-gray-400 border-t-transparent rounded-full block" />
                              ) : (
                                <Trash className="size-4 text-red-600" />
                              )}
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!sessions.length && (
                  <tr>
                    <td className="p-3" colSpan={7}>No sessions</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}


