"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRef } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import * as Popover from '@radix-ui/react-popover';
import { Checkbox } from '@/components/ui/input';

type Teacher = { id: string; user_id: string; users?: {id:string;name:string;email:string} };
type Student = { id: string; user_id: string; user?: { id:string; name: string; email: string; gender:string } };

export default function NewCoursePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [teacherSearch, setTeacherSearch] = useState('');
  const [teacherPopoverOpen, setTeacherPopoverOpen] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const studentFilterRef = useRef<HTMLInputElement|null>(null);
  const [showStudentFilter, setShowStudentFilter] = useState(false);
  const [tenureStart, setTenureStart] = useState<string>("");
  const [tenureEnd, setTenureEnd] = useState<string>("");
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<"admin" | "teacher" | "student" | null>(null);

  useEffect(() => {
    fetch("/api/me")
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          setUserRole(data.user.role);
          if (data.user.role !== "admin") {
            router.push("/courses");
          }
        }
      })
      .catch(() => router.push("/courses"));
  }, [router]);

  useEffect(() => {
    if (userRole !== "admin") return;
    (async () => {
      const res = await fetch("/api/admin/teachers");
      const data = await res.json();
      if (res.ok) setTeachers(data.teachers || []);
    })();
    (async () => {
      const res = await fetch("/api/admin/students");
      const data = await res.json();
      if (res.ok) setStudents(data.students || []);
    })();
  }, [userRole]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, teacherId, tenureStart, tenureEnd, studentIds: selectedStudents }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data?.error || "Failed to create course");
      return;
    }
    router.push(`/courses/${data.id}`);
  };

  if (userRole !== "admin") {
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  }

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
          <Popover.Root open={teacherPopoverOpen} onOpenChange={setTeacherPopoverOpen}>
            <Popover.Trigger asChild>
              <button type="button" className={`flex items-center w-full px-3 py-2 border rounded justify-between ${teacherId ? '' : 'text-gray-400'}`}>
                {teacherId ? (
                  <>
                    <div className="flex items-center gap-2">
                      <Avatar className="size-6">
                        <AvatarFallback>
                          {teachers.find(t=>t.id===teacherId)?.users?.name?.split(' ').map(w=>w[0]).join('') || '?' }
                        </AvatarFallback>
                      </Avatar>
                      <span>{teachers.find(t=>t.id===teacherId)?.users?.name ?? 'Unassigned'}</span>
                      <span className="pl-1 text-gray-400">{teachers.find(t=>t.id===teacherId)?.users?.email ?? ''}</span>
                    </div>
                  </>
                ) : <span>Select a teacher...</span>}
                <svg className="size-4 ml-auto" viewBox="0 0 20 20" fill="none">
                  <path d="M 6 8 L 10 12 L 14 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </Popover.Trigger>
            <Popover.Content className="border rounded bg-white shadow-lg w-80 max-h-80 overflow-y-auto z-50">
              <div className="p-2 sticky top-0 bg-white z-10">
                <input
                  className="w-full border rounded px-2 py-1 mb-2 text-sm"
                  type="text"
                  placeholder="Search teachers..."
                  value={teacherSearch}
                  onChange={e=>setTeacherSearch(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <div className={`${!teachers.length?'text-xs text-gray-400 italic p-2':''}`}>{!teachers.length && 'No teachers found'}</div>
                {teachers.filter(t=>{
                  const search = teacherSearch.toLowerCase();
                  const u = t.users||{}; return search==='' || u.name?.toLowerCase().includes(search) || u.email?.toLowerCase().includes(search);
                }).map(t=>(
                  <button type="button" key={t.id} className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-gray-100 ${teacherId===t.id?'bg-blue-100':''}`} onClick={()=>{ setTeacherId(t.id); setTeacherPopoverOpen(false); }}>
                    <Avatar className="size-6"><AvatarFallback>{t.users?.name ? t.users.name.split(' ').map(w=>w[0]).join('') : '-'}</AvatarFallback></Avatar>
                    <span>{t.users?.name ?? '(No name)'}</span>
                    <span className="pl-1 text-gray-400">{t.users?.email ?? ''}</span>
                  </button>
                ))}
              </div>
            </Popover.Content>
          </Popover.Root>
        </div>

        <div>
          <label className="block text-sm mb-1">Enroll Students</label>
          <div className="border rounded p-2 max-h-52 overflow-y-auto bg-gray-50">
            <div className="mb-2 flex items-center gap-2">
              <input type="checkbox"
                checked={selectedStudents.length === students.length && students.length > 0}
                onChange={e=>setSelectedStudents(e.target.checked ? students.map(s=>s.id) : [])} />
              <span className="font-medium">Select All</span>
              <button type="button" className="ml-auto text-xs underline text-blue-500" onClick={()=>setShowStudentFilter(f=>!f)}>{showStudentFilter?'Hide':'Search'}</button>
            </div>
            {showStudentFilter && (
              <input ref={studentFilterRef} type="text" className="mb-2 w-full border rounded px-2 py-1 text-sm" placeholder="Filter students…" onChange={e=>{
                const val = e.target.value.toLowerCase();
                setStudents(students=>students.map(s=>({...s, hide: !(s.user?.name?.toLowerCase().includes(val)||s.user?.email?.toLowerCase().includes(val)) })));
              }} />
            )}
            {students.length === 0 && <div className="text-xs text-gray-400 italic">No students found</div>}
            {students.filter(s=>!s.hide).map(s => (
              <label key={s.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-100 cursor-pointer text-sm">
                <input type="checkbox" checked={selectedStudents.includes(s.id)}
                  onChange={e=>{
                    const checked = e.target.checked;
                    setSelectedStudents(ids => checked ? [...ids,s.id] : ids.filter(id => id!==s.id));
                  }}
                />
                <Avatar className="size-6"><AvatarFallback>{s.user?.name ? s.user.name.split(" ").map(w=>w[0]).join("") : '-'}</AvatarFallback></Avatar>
                <span>{s.user?.name ?? '-'}</span>
                <span className="pl-1 text-gray-400">{s.user?.email||''}</span>
                <span className="pl-2 text-xs uppercase text-gray-600">{s.user?.gender||''}</span>
              </label>
            ))}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Selected: {selectedStudents.length}</div>
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

