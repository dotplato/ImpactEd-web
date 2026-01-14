"use client";
import { useEffect, useState } from "react";
import * as Dialog from '@radix-ui/react-dialog';
import { Plus, Pencil, Trash } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { createClient } from '@supabase/supabase-js';
import { useRef } from "react";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

const feeStatusList = ['paid', 'unpaid', 'pending', 'waived'];
const genderList = ['Male', 'Female', 'Other'];

export default function StudentsPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<"admin" | "teacher" | "student" | null>(null);
  // Form state
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    studentId: '',
    feeStatus: '',
    gender: '',
    joinDate: new Date().toISOString().slice(0, 10),
    phone: '',
    avatarFile: null as File | null,
  });
  const [imgPreview, setImgPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [editImgPreview, setEditImgPreview] = useState<string | null>(null);
  const editFileRef = useRef<HTMLInputElement | null>(null);
  function resetForm() {
    setForm({ name: '', email: '', password: '', studentId: '', feeStatus: '', gender: '', joinDate: new Date().toISOString().slice(0, 10), phone: '', avatarFile: null });
    setImgPreview(null); if (fileInputRef.current) fileInputRef.current.value = '';
  }
  // Edit/delete state
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>(null);
  const [editError, setEditError] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me")
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          setUserRole(data.user.role);
        }
      })
      .catch(() => { });
  }, []);

  async function loadStudents() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/students");
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error || 'Failed to fetch');
      setLoading(false);
      return;
    }
    setStudents(data.students ?? []);
    setLoading(false);
  }
  useEffect(() => {
    if (userRole) {
      loadStudents();
    }
  }, [userRole]);
  // Helper for errors
  function formatError(error: any): string {
    if (!error) return '';
    if (typeof error === 'string') return error;
    if (error.formErrors && Array.isArray(error.formErrors)) return error.formErrors.join(' ');
    if (error.fieldErrors && typeof error.fieldErrors === 'object') {
      return Object.entries(error.fieldErrors).map(([k, a]: any) => `${k}: ${(a as string[]).join(', ')}`).join(' | ');
    }
    return JSON.stringify(error);
  }
  async function handleFile(e: any) {
    const file = e.target.files?.[0];
    if (!file) return;
    setForm((f: any) => ({ ...f, avatarFile: file }));
    const reader = new FileReader();
    reader.onload = () => setImgPreview(reader.result as string);
    reader.readAsDataURL(file);
  }
  // Modal handler
  const onSubmit = async (e: any) => {
    e.preventDefault();
    if (userRole !== "admin") return;
    setError(null);
    let avatarUrl = '';
    if (form.avatarFile) {
      const ext = form.avatarFile.name.split('.').pop();
      const fileName = `student-${Date.now()}.${ext}`;
      const { data, error: upErr } = await supabase.storage.from('avatars').upload(fileName, form.avatarFile, { upsert: false });
      if (upErr) { setError('Upload failed.'); return; }
      avatarUrl = supabase.storage.from('avatars').getPublicUrl(fileName).data.publicUrl;
    }
    const res = await fetch("/api/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, image_url: avatarUrl }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error || 'Failed to create student');
      return;
    }
    setModalOpen(false); resetForm(); loadStudents();
  };
  // update/edit logic
  const openEdit = (stu: any) => {
    if (userRole !== "admin") return;
    setEditForm({
      id: stu.id,
      name: stu.user?.name || '',
      email: stu.user?.email || '',
      studentId: stu.student_id || '',
      feeStatus: stu.fee_status || '',
      gender: stu.gender || '',
      joinDate: stu.join_date ? stu.join_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
      phone: stu.phone || '',
      image_url: stu.user?.image_url || '',
      avatarFile: null,
    });
    setEditImgPreview(stu.user?.image_url || null);
    setEditId(stu.id);
    setEditError(null);
    if (editFileRef.current) editFileRef.current.value = '';
  };
  function handleEditFile(e: any) {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditForm((f: any) => ({ ...f, avatarFile: file }));
    const reader = new FileReader();
    reader.onload = () => setEditImgPreview(reader.result as string);
    reader.readAsDataURL(file);
  }
  async function onEditSubmit(e: any) {
    e.preventDefault();
    if (userRole !== "admin") return;
    setEditError(null);
    let avatarUrl = editForm.image_url;
    if (editForm.avatarFile) {
      const ext = editForm.avatarFile.name.split('.').pop();
      const fileName = `student-${editForm.id || Date.now()}.${ext}`;
      const { data, error: upErr } = await supabase.storage.from('avatars').upload(fileName, editForm.avatarFile, { upsert: true });
      if (upErr) { setEditError('Upload failed: ' + upErr.message); return; }
      avatarUrl = supabase.storage.from('avatars').getPublicUrl(fileName).data.publicUrl;
    }
    const res = await fetch(`/api/students/${editForm.id}`, {
      method: 'PATCH', headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...editForm, image_url: avatarUrl }),
    });
    const data = await res.json();
    if (!res.ok) { setEditError(data?.error || 'Unable to save'); return; }
    setEditId(null); setEditForm(null); loadStudents();
  }
  async function onDelete(id: string) {
    if (userRole !== "admin") return;
    if (!confirm('Delete this student?')) return;
    const res = await fetch(`/api/students/${id}`, { method: 'DELETE' });
    if (res.ok) loadStudents();
  }
  // fee status badge color
  function badgeColor(val: string) {
    if (val === 'paid') return 'bg-green-100 text-green-800';
    if (val === 'unpaid') return 'bg-red-100 text-red-800';
    if (val === 'pending') return 'bg-yellow-100 text-yellow-800';
    if (val === 'waived') return 'bg-blue-100 text-blue-800';
    return 'bg-gray-100 text-gray-800';
  }

  const canCreate = userRole === "admin";
  const canEdit = userRole === "admin";
  const canDelete = userRole === "admin";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {canCreate && (
          <Dialog.Root open={modalOpen} onOpenChange={v => { setModalOpen(v); if (!v) { setError(null); } }}>
            <Dialog.Trigger asChild>
              <button className="flex items-center gap-2 bg-black text-white rounded px-4 py-2 text-sm hover:bg-gray-900"><Plus className="size-4" />Add New Student</button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 bg-black/30 z-40" />
              <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-w-lg w-full -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-lg ring-1 ring-black/10">
                <Dialog.Title className="text-lg font-semibold mb-2">Add Student</Dialog.Title>
                <form onSubmit={onSubmit} className="grid gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-xs mb-1">Name</label>
                      <input required className="w-full border rounded px-2 py-1" value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} /></div>
                    <div><label className="block text-xs mb-1">Email</label>
                      <input required type="email" className="w-full border rounded px-2 py-1" value={form.email} onChange={e => setForm((f: any) => ({ ...f, email: e.target.value }))} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-xs mb-1">Password</label>
                      <input required minLength={8} type="password" className="w-full border rounded px-2 py-1" value={form.password} onChange={e => setForm((f: any) => ({ ...f, password: e.target.value }))} /></div>
                    <div><label className="block text-xs mb-1">Phone</label>
                      <input className="w-full border rounded px-2 py-1" value={form.phone} onChange={e => setForm((f: any) => ({ ...f, phone: e.target.value }))} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-xs mb-1">Student ID</label>
                      <input required className="w-full border rounded px-2 py-1" value={form.studentId} onChange={e => setForm((f: any) => ({ ...f, studentId: e.target.value }))} /></div>
                    <div><label className="block text-xs mb-1">Fee Status</label>
                      <select required className="w-full border rounded px-2 py-1" value={form.feeStatus} onChange={e => setForm((f: any) => ({ ...f, feeStatus: e.target.value }))}>
                        <option value=''>Select status</option>
                        {feeStatusList.map(fs => (<option key={fs} value={fs}>{fs.charAt(0).toUpperCase() + fs.slice(1)}</option>))}
                      </select></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-xs mb-1">Gender</label>
                      <select required className="w-full border rounded px-2 py-1" value={form.gender} onChange={e => setForm((f: any) => ({ ...f, gender: e.target.value }))}>
                        <option value=''>Select gender</option>
                        {genderList.map(fs => (<option key={fs} value={fs}>{fs}</option>))}
                      </select></div>
                    <div><label className="block text-xs mb-1">Join Date</label>
                      <input required type="date" className="w-full border rounded px-2 py-1" value={form.joinDate} onChange={e => setForm((f: any) => ({ ...f, joinDate: e.target.value }))} /></div>
                  </div>
                  <div>
                    <label className="block text-xs mb-1">Profile Picture (optional)</label>
                    <input type="file" ref={fileInputRef} accept="image/*" onChange={handleFile} />
                    {imgPreview && <img alt="preview" src={imgPreview} className="mt-1 rounded h-16 w-16 object-cover" />}
                  </div>
                  {error && <div className="text-red-600 text-xs">{formatError(error)}</div>}
                  <div className="flex gap-2 justify-end mt-2">
                    <button type="button" className="rounded bg-gray-200 text-gray-900 px-4 py-2" onClick={() => setModalOpen(false)}>Cancel</button>
                    <button className="bg-black text-white rounded px-4 py-2">Add Student</button>
                  </div>
                </form>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        )}
        {/* Edit Student Modal */}
        <Dialog.Root open={!!editId} onOpenChange={v => { if (!v) { setEditId(null); setEditForm(null); setEditError(null); } }}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/30 z-40" />
            <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-w-lg w-full -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-lg ring-1 ring-black/10">
              <Dialog.Title className="text-lg font-semibold mb-2">Edit Student</Dialog.Title>
              {editForm && <form onSubmit={onEditSubmit} className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs mb-1">Name</label>
                    <input required className="w-full border rounded px-2 py-1" value={editForm.name} onChange={e => setEditForm((f: any) => ({ ...f, name: e.target.value }))} /></div>
                  <div><label className="block text-xs mb-1">Email</label>
                    <input required type="email" className="w-full border rounded px-2 py-1" value={editForm.email} onChange={e => setEditForm((f: any) => ({ ...f, email: e.target.value }))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs mb-1">Phone</label>
                    <input className="w-full border rounded px-2 py-1" value={editForm.phone} onChange={e => setEditForm((f: any) => ({ ...f, phone: e.target.value }))} /></div>
                  <div><label className="block text-xs mb-1">Student ID</label>
                    <input required className="w-full border rounded px-2 py-1" value={editForm.studentId} onChange={e => setEditForm((f: any) => ({ ...f, studentId: e.target.value }))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs mb-1">Fee Status</label>
                    <select required className="w-full border rounded px-2 py-1" value={editForm.feeStatus} onChange={e => setEditForm((f: any) => ({ ...f, feeStatus: e.target.value }))}>
                      <option value=''>Select status</option>
                      {feeStatusList.map(fs => (<option key={fs} value={fs}>{fs.charAt(0).toUpperCase() + fs.slice(1)}</option>))}
                    </select></div>
                  <div><label className="block text-xs mb-1">Gender</label>
                    <select required className="w-full border rounded px-2 py-1" value={editForm.gender} onChange={e => setEditForm((f: any) => ({ ...f, gender: e.target.value }))}>
                      <option value=''>Select gender</option>
                      {genderList.map(fs => (<option key={fs} value={fs}>{fs}</option>))}
                    </select></div>
                </div>
                <div><label className="block text-xs mb-1">Join Date</label>
                  <input required type="date" className="w-full border rounded px-2 py-1" value={editForm.joinDate} onChange={e => setEditForm((f: any) => ({ ...f, joinDate: e.target.value }))} /></div>
                <div><label className="block text-xs mb-1">Profile Picture</label>
                  <input ref={editFileRef} type="file" accept="image/*" onChange={handleEditFile} />{editImgPreview && <img alt="preview" src={editImgPreview} className="mt-1 rounded h-12 w-12 object-cover" />}
                </div>
                {editError && <div className="text-red-600 text-xs">{formatError(editError)}</div>}
                <div className="flex gap-2 justify-end mt-2">
                  <button type="button" className="rounded bg-gray-200 text-gray-900 px-4 py-2" onClick={() => { setEditId(null); setEditForm(null); }}>Cancel</button>
                  <button className="bg-black text-white rounded px-4 py-2">Save</button>
                </div>
              </form>}
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
      <div className="border rounded">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="p-3">Avatar</th>
              <th className="p-3">Name</th>
              <th className="p-3">Email</th>
              <th className="p-3">Student ID</th>
              <th className="p-3">Gender</th>
              <th className="p-3">Join Date</th>
              <th className="p-3">Fee Status</th>
              <th className="p-3">Phone</th>
              {canEdit && <th className="p-3"></th>}
            </tr>
          </thead>
          <tbody>
            {students.map((s: any) => (
              <tr key={s.id} className="border-b last:border-b-0">
                <td className="p-3">
                  <Avatar className="size-8">
                    {s.user?.image_url ?
                      <AvatarImage src={s.user.image_url} /> :
                      <AvatarFallback>{s.user?.name ? s.user.name.split(" ").map((w: string) => w[0]).join("") : '?'}</AvatarFallback>
                    }
                  </Avatar>
                </td>
                <td className="p-3">{s.user?.name ?? "-"}</td>
                <td className="p-3">{s.user?.email ?? "-"}</td>
                <td className="p-3">{s.student_id || '-'}</td>
                <td className="p-3">{s.gender || '-'}</td>
                <td className="p-3">{s.join_date ? s.join_date.slice(0, 10) : '-'}</td>
                <td className="p-3"><span className={`inline-block rounded px-2 py-1 text-xs font-semibold ${badgeColor(s.fee_status)}`}>{s.fee_status || '-'}</span></td>
                <td className="p-3">{s.phone || '-'}</td>
                {canEdit && (
                  <td className="p-3 flex gap-1 items-center">
                    <button title="Edit" aria-label="Edit" onClick={() => openEdit(s)} className="rounded-full bg-gray-100 hover:bg-blue-100 focus-visible:ring-2 focus-visible:ring-blue-300 p-1"><Pencil className="size-4 text-blue-600" /></button>
                    <button title="Delete" aria-label="Delete" onClick={() => onDelete(s.id)} className="rounded-full bg-gray-100 hover:bg-red-100 focus-visible:ring-2 focus-visible:ring-red-300 p-1 ml-1"><Trash className="size-4 text-red-600" /></button>
                  </td>
                )}
              </tr>
            ))}
            {!students.length && (
              <tr><td className="p-3" colSpan={canEdit ? 8 : 7}>No students</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

