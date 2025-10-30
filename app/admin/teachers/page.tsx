"use client";
import { useEffect, useState, useRef } from "react";
import * as Dialog from '@radix-ui/react-dialog';
import { Plus, Pencil, Trash } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function AdminTeachersPage() {
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<any|null>(null);
  const [error, setError] = useState<string|null>(null);
  const [imgPreview, setImgPreview] = useState<string|null>(null);
  const fileInputRef = useRef<HTMLInputElement|null>(null);

  const [form, setForm] = useState({
    name: '', email: '', password: '', joinDate: new Date().toISOString().slice(0,10), phone: '', qualification: '', avatarFile: null as File|null,
  });

  const [editForm, setEditForm] = useState<any|null>(null);
  const [editImgPreview, setEditImgPreview] = useState<string|null>(null);
  const [editError, setEditError] = useState<string|null>(null);
  const editFileRef = useRef<HTMLInputElement|null>(null);
  function resetForm() {
    setForm({ name: '', email: '', password: '', joinDate: new Date().toISOString().slice(0,10), phone: '', qualification: '', avatarFile: null });
    setImgPreview(null); if (fileInputRef.current) fileInputRef.current.value = '';
  }
  async function loadTeachers() {
    setLoading(true); setError(null);
    const res = await fetch("/api/admin/teachers");
    const data = await res.json();
    setTeachers(res.ok ? (data.teachers ?? []) : []);
    setLoading(false);
  }
  useEffect(() => { loadTeachers(); }, []);
  async function handleFile(e: any) {
    const file = e.target.files?.[0];
    if (!file) return;
    setForm(f=>({...f, avatarFile: file}));
    const reader = new FileReader();
    reader.onload = () => setImgPreview(reader.result as string);
    reader.readAsDataURL(file);
  }
  async function onSubmit(e: any) {
    e.preventDefault();
    setError(null);
    let avatarUrl = '';
    if (form.avatarFile) {
      const ext = form.avatarFile.name.split('.').pop();
      const fileName = `teacher-${Date.now()}.${ext}`;
      const { data, error: upErr } = await supabase.storage.from('avatars').upload(fileName, form.avatarFile, { upsert: false });
      if (upErr) { setError('Upload failed.'); return; }
      avatarUrl = supabase.storage.from('avatars').getPublicUrl(fileName).publicUrl;
    }
    const apiRes = await fetch('/api/admin/teachers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        email: form.email,
        password: form.password,
        phone: form.phone,
        joinDate: form.joinDate,
        qualification: form.qualification,
        profile_pic: avatarUrl,
      }),
    });
    const apiData = await apiRes.json();
    if (!apiRes.ok) { setError(apiData?.error||'Unable to add teacher'); return; }
    setModalOpen(false); resetForm(); loadTeachers();
  }

  async function onEdit(e: any) {
    e.preventDefault();
    if (!editForm) return;
    setEditError(null);
    let avatarUrl = editForm.profile_pic;
    if (editForm.avatarFile) {
      const ext = editForm.avatarFile.name.split('.').pop();
      const fileName = `teacher-${editForm.id || Date.now()}.${ext}`;
      const { data, error: upErr } = await supabase.storage.from('avatars').upload(fileName, editForm.avatarFile, { upsert: true });
      if (upErr) { setEditError('Upload failed: ' + upErr.message); return; }
      avatarUrl = supabase.storage.from('avatars').getPublicUrl(fileName).publicUrl;
    }
    const apiRes = await fetch(`/api/admin/teachers/${editForm.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editForm.name,
        email: editForm.email,
        phone: editForm.phone,
        joinDate: editForm.joinDate,
        qualification: editForm.qualification,
        profile_pic: avatarUrl,
      }),
    });
    const apiData = await apiRes.json();
    if (!apiRes.ok) { setEditError(apiData?.error||'Unable to update teacher'); return; }
    setEditingTeacher(null); setEditForm(null); setEditImgPreview(null); loadTeachers();
  }

  function openEdit(teacher: any) {
    setEditingTeacher(teacher);
    setEditForm({
      id: teacher.id,
      name: teacher.user?.name || '',
      email: teacher.user?.email || '',
      phone: teacher.phone || '',
      joinDate: teacher.join_date ? teacher.join_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
      qualification: teacher.qualification || '',
      profile_pic: teacher.profile_pic || '',
      avatarFile: null,
    });
    setEditImgPreview(teacher.profile_pic || null);
    setEditError(null);
    if(editFileRef.current) editFileRef.current.value = '';
  }

  function handleEditFile(e: any) {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditForm((f: any) => ({ ...f, avatarFile: file }));
    const reader = new FileReader();
    reader.onload = () => setEditImgPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function onDelete(id:string) {
    if(!confirm('Delete this teacher?')) return;
    const res = await fetch(`/api/admin/teachers/${id}`, { method:'DELETE' });
    if(res.ok) loadTeachers();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Teachers</h1>
        <Dialog.Root open={modalOpen} onOpenChange={v=>{ setModalOpen(v); if(!v) setError(null); }}>
          <Dialog.Trigger asChild>
            <button className="flex items-center gap-2 bg-black text-white rounded px-4 py-2 text-sm hover:bg-gray-900"><Plus className="size-4"/>Add New Teacher</button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/30 z-40" />
            <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-w-lg w-full -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-lg ring-1 ring-black/10">
              <Dialog.Title className="text-lg font-semibold mb-2">Add Teacher</Dialog.Title>
              <form onSubmit={onSubmit} className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs mb-1">Full Name</label>
                    <input required className="w-full border rounded px-2 py-1" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></div>
                  <div><label className="block text-xs mb-1">Email</label>
                    <input required type="email" className="w-full border rounded px-2 py-1" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}/></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs mb-1">Password</label>
                    <input required minLength={8} type="password" className="w-full border rounded px-2 py-1" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))}/></div>
                  <div><label className="block text-xs mb-1">Phone</label>
                    <input className="w-full border rounded px-2 py-1" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))}/></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs mb-1">Qualification</label>
                    <input className="w-full border rounded px-2 py-1" value={form.qualification} onChange={e=>setForm(f=>({...f,qualification:e.target.value}))}/></div>
                  <div><label className="block text-xs mb-1">Join Date</label>
                    <input required type="date" className="w-full border rounded px-2 py-1" value={form.joinDate} onChange={e=>setForm(f=>({...f,joinDate:e.target.value}))}/></div>
                </div>
                <div>
                  <label className="block text-xs mb-1">Profile Picture (optional)</label>
                  <input type="file" ref={fileInputRef} accept="image/*" onChange={handleFile}/>
                  {imgPreview && <img alt="preview" src={imgPreview} className="mt-1 rounded h-16 w-16 object-cover" />}
                </div>
                {error && <div className="text-red-600 text-xs">{error}</div>}
                <div className="flex gap-2 justify-end mt-2">
                  <button type="button" className="rounded bg-gray-200 text-gray-900 px-4 py-2" onClick={()=>setModalOpen(false)}>Cancel</button>
                  <button className="bg-black text-white rounded px-4 py-2">Add Teacher</button>
                </div>
              </form>
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
              <th className="p-3">Phone</th>
              <th className="p-3">Qualification</th>
              <th className="p-3">Join Date</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {teachers.map((t: any) => (
              <tr key={t.id} className="border-b last:border-b-0">
                <td className="p-3">
                  <Avatar className="size-8">
                    {t.profile_pic ?
                      <AvatarImage src={t.profile_pic} /> :
                      <AvatarFallback>{t.user?.name ? t.user.name.split(" ").map(w=>w[0]).join("") : '?'}</AvatarFallback>
                    }
                  </Avatar>
                </td>
                <td className="p-3">{t.user?.name ?? "-"}</td>
                <td className="p-3">{t.user?.email ?? "-"}</td>
                <td className="p-3">{t.phone || '-'}</td>
                <td className="p-3">{t.qualification || '-'}</td>
                <td className="p-3">{t.join_date || '-'}</td>
                <td className="p-3 flex gap-1 items-center">
                  <button title="Edit" aria-label="Edit" onClick={()=>openEdit(t)} className="rounded-full bg-gray-100 hover:bg-blue-100 focus-visible:ring-2 focus-visible:ring-blue-300 p-1"><Pencil className="size-4 text-blue-600"/></button>
                  <button title="Delete" aria-label="Delete" onClick={()=>onDelete(t.id)} className="rounded-full bg-gray-100 hover:bg-red-100 focus-visible:ring-2 focus-visible:ring-red-300 p-1 ml-1"><Trash className="size-4 text-red-600"/></button>
                </td>
              </tr>
            ))}
            {!teachers.length && (
              <tr><td className="p-3" colSpan={6}>No teachers</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Dialog.Root open={!!editingTeacher} onOpenChange={v=>{ if(!v){ setEditingTeacher(null); setEditForm(null); setEditImgPreview(null); setEditError(null);} }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/30 z-40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-w-lg w-full -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-lg ring-1 ring-black/10">
            <Dialog.Title className="text-lg font-semibold mb-2">Edit Teacher</Dialog.Title>
            {editForm && <form onSubmit={onEdit} className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs mb-1">Full Name</label>
                  <input required className="w-full border rounded px-2 py-1" value={editForm.name} onChange={e=>setEditForm((f:any)=>({...f,name:e.target.value}))}/></div>
                <div><label className="block text-xs mb-1">Email</label>
                  <input required type="email" className="w-full border rounded px-2 py-1" value={editForm.email} onChange={e=>setEditForm((f:any)=>({...f,email:e.target.value}))}/></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs mb-1">Phone</label>
                  <input className="w-full border rounded px-2 py-1" value={editForm.phone} onChange={e=>setEditForm((f:any)=>({...f,phone:e.target.value}))}/></div>
                <div><label className="block text-xs mb-1">Qualification</label>
                  <input className="w-full border rounded px-2 py-1" value={editForm.qualification} onChange={e=>setEditForm((f:any)=>({...f,qualification:e.target.value}))}/></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs mb-1">Join Date</label>
                  <input required type="date" className="w-full border rounded px-2 py-1" value={editForm.joinDate} onChange={e=>setEditForm((f:any)=>({...f,joinDate:e.target.value}))}/></div>
                <div><label className="block text-xs mb-1">Profile Picture</label>
                  <input ref={editFileRef} type="file" accept="image/*" onChange={handleEditFile}/>{editImgPreview && <img alt="preview" src={editImgPreview} className="mt-1 rounded h-12 w-12 object-cover"/>}
                </div>
              </div>
              {editError && <div className="text-red-600 text-xs">{editError}</div>}
              <div className="flex gap-2 justify-end mt-2">
                <button type="button" className="rounded bg-gray-200 text-gray-900 px-4 py-2" onClick={()=>setEditingTeacher(null)}>Cancel</button>
                <button className="bg-black text-white rounded px-4 py-2">Save</button>
              </div>
            </form>}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}


