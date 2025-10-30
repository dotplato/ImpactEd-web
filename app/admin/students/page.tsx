"use client";
import { useEffect, useState } from "react";
import * as Dialog from '@radix-ui/react-dialog';
import { Plus, Pencil, Trash } from 'lucide-react';

const feeStatusList = ['paid','unpaid','pending','waived'];
const genderList = ['Male','Female','Other'];

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string|null>(null);
  // Form state
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    studentId: '',
    feeStatus: '',
    gender: '',
    joinDate: new Date().toISOString().slice(0,10),
    phone: '',
  });
  function resetForm() {
    setForm({ name: '', email: '', password: '', studentId: '', feeStatus: '', gender: '', joinDate: new Date().toISOString().slice(0,10), phone: '' });
  }
  // Edit/delete state
  const [editId, setEditId] = useState<string|null>(null);
  const [editForm, setEditForm] = useState<any>(null);
  const [editError, setEditError] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string|null>(null);
  async function loadStudents() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/students");
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error || 'Failed to fetch');
      setLoading(false);
      return;
    }
    setStudents(data.students ?? []);
    setLoading(false);
  }
  useEffect(() => { loadStudents(); }, []);
  // Helper for errors
  function formatError(error: any): string {
    if (!error) return '';
    if (typeof error === 'string') return error;
    if (error.formErrors && Array.isArray(error.formErrors)) return error.formErrors.join(' ');
    if (error.fieldErrors && typeof error.fieldErrors === 'object') {
      return Object.entries(error.fieldErrors).map(([k,a]:any)=>`${k}: ${(a as string[]).join(', ')}`).join(' | ');
    }
    return JSON.stringify(error);
  }
  // Modal handler
  const onSubmit = async (e:any) => {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/admin/students", {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify(form),
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
    setEditForm({
      id: stu.id,
      name: stu.user?.name || '',
      email: stu.user?.email || '',
      studentId: stu.student_id || '',
      feeStatus: stu.fee_status || '',
      gender: stu.gender || '',
      joinDate: stu.join_date ? stu.join_date.slice(0,10) : new Date().toISOString().slice(0,10),
      phone: stu.phone || '',
    });
    setEditId(stu.id);
    setEditError(null);
  };
  async function onEditSubmit(e: any) {
    e.preventDefault();
    setEditError(null);
    const res = await fetch(`/api/admin/students/${editForm.id}`, {
      method: 'PATCH', headers: {"Content-Type":"application/json"},
      body: JSON.stringify(editForm),
    });
    const data = await res.json();
    if (!res.ok) { setEditError(data?.error||'Unable to save'); return; }
    setEditId(null); setEditForm(null); loadStudents();
  }
  async function onDelete(id:string) {
    if (!confirm('Delete this student?')) return;
    const res = await fetch(`/api/admin/students/${id}`, { method: 'DELETE' });
    if (res.ok) loadStudents();
  }
  // fee status badge color
  function badgeColor(val:string) {
    if(val==='paid') return 'bg-green-100 text-green-800';
    if(val==='unpaid') return 'bg-red-100 text-red-800';
    if(val==='pending') return 'bg-yellow-100 text-yellow-800';
    if(val==='waived') return 'bg-blue-100 text-blue-800';
    return 'bg-gray-100 text-gray-800';
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Students</h1>
        <Dialog.Root open={modalOpen} onOpenChange={v=>{ setModalOpen(v); if(!v) { setError(null); } }}>
          <Dialog.Trigger asChild>
            <button className="flex items-center gap-2 bg-black text-white rounded px-4 py-2 text-sm hover:bg-gray-900"><Plus className="size-4"/>Add New Student</button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/30 z-40" />
            <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-w-lg w-full -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-lg ring-1 ring-black/10">
              <Dialog.Title className="text-lg font-semibold mb-2">Add Student</Dialog.Title>
              <form onSubmit={onSubmit} className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs mb-1">Name</label>
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
                  <div><label className="block text-xs mb-1">Student ID</label>
                    <input required className="w-full border rounded px-2 py-1" value={form.studentId} onChange={e=>setForm(f=>({...f,studentId:e.target.value}))}/></div>
                  <div><label className="block text-xs mb-1">Fee Status</label>
                    <select required className="w-full border rounded px-2 py-1" value={form.feeStatus} onChange={e=>setForm(f=>({...f,feeStatus:e.target.value}))}>
                      <option value=''>Select status</option>
                      {feeStatusList.map(fs=>(<option key={fs} value={fs}>{fs.charAt(0).toUpperCase()+fs.slice(1)}</option>))}
                    </select></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs mb-1">Gender</label>
                    <select required className="w-full border rounded px-2 py-1" value={form.gender} onChange={e=>setForm(f=>({...f,gender:e.target.value}))}>
                      <option value=''>Select gender</option>
                      {genderList.map(fs=>(<option key={fs} value={fs}>{fs}</option>))}
                    </select></div>
                  <div><label className="block text-xs mb-1">Join Date</label>
                    <input required type="date" className="w-full border rounded px-2 py-1" value={form.joinDate} onChange={e=>setForm(f=>({...f,joinDate:e.target.value}))}/></div>
                </div>
                {error && <div className="text-red-600 text-xs">{formatError(error)}</div>}
                <div className="flex gap-2 justify-end mt-2">
                  <button type="button" className="rounded bg-gray-200 text-gray-900 px-4 py-2" onClick={()=>setModalOpen(false)}>Cancel</button>
                  <button className="bg-black text-white rounded px-4 py-2">Add Student</button>
                </div>
              </form>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
        {/* Edit Student Modal */}
        <Dialog.Root open={!!editId} onOpenChange={v=>{ if(!v){ setEditId(null); setEditForm(null); setEditError(null);}}}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/30 z-40" />
            <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-w-lg w-full -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-lg ring-1 ring-black/10">
              <Dialog.Title className="text-lg font-semibold mb-2">Edit Student</Dialog.Title>
              {editForm && <form onSubmit={onEditSubmit} className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs mb-1">Name</label>
                    <input required className="w-full border rounded px-2 py-1" value={editForm.name} onChange={e=>setEditForm(f=>({...f,name:e.target.value}))}/></div>
                  <div><label className="block text-xs mb-1">Email</label>
                    <input required type="email" className="w-full border rounded px-2 py-1" value={editForm.email} onChange={e=>setEditForm(f=>({...f,email:e.target.value}))}/></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs mb-1">Phone</label>
                    <input className="w-full border rounded px-2 py-1" value={editForm.phone} onChange={e=>setEditForm(f=>({...f,phone:e.target.value}))}/></div>
                  <div><label className="block text-xs mb-1">Student ID</label>
                    <input required className="w-full border rounded px-2 py-1" value={editForm.studentId} onChange={e=>setEditForm(f=>({...f,studentId:e.target.value}))}/></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs mb-1">Fee Status</label>
                    <select required className="w-full border rounded px-2 py-1" value={editForm.feeStatus} onChange={e=>setEditForm(f=>({...f,feeStatus:e.target.value}))}>
                      <option value=''>Select status</option>
                      {feeStatusList.map(fs=>(<option key={fs} value={fs}>{fs.charAt(0).toUpperCase()+fs.slice(1)}</option>))}
                    </select></div>
                  <div><label className="block text-xs mb-1">Gender</label>
                    <select required className="w-full border rounded px-2 py-1" value={editForm.gender} onChange={e=>setEditForm(f=>({...f,gender:e.target.value}))}>
                      <option value=''>Select gender</option>
                      {genderList.map(fs=>(<option key={fs} value={fs}>{fs}</option>))}
                    </select></div>
                </div>
                <div><label className="block text-xs mb-1">Join Date</label>
                  <input required type="date" className="w-full border rounded px-2 py-1" value={editForm.joinDate} onChange={e=>setEditForm(f=>({...f,joinDate:e.target.value}))}/></div>
                {editError && <div className="text-red-600 text-xs">{formatError(editError)}</div>}
                <div className="flex gap-2 justify-end mt-2">
                  <button type="button" className="rounded bg-gray-200 text-gray-900 px-4 py-2" onClick={()=>{ setEditId(null); setEditForm(null);}}>Cancel</button>
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
              <th className="p-3">Name</th>
              <th className="p-3">Email</th>
              <th className="p-3">Student ID</th>
              <th className="p-3">Gender</th>
              <th className="p-3">Join Date</th>
              <th className="p-3">Fee Status</th>
              <th className="p-3">Phone</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {students.map((s: any) => (
              <tr key={s.id} className="border-b last:border-b-0">
                <td className="p-3">{s.user?.name ?? "-"}</td>
                <td className="p-3">{s.user?.email ?? "-"}</td>
                <td className="p-3">{s.student_id || '-'}</td>
                <td className="p-3">{s.gender || '-'}</td>
                <td className="p-3">{s.join_date ? s.join_date.slice(0,10) : '-'}</td>
                <td className="p-3"><span className={`inline-block rounded px-2 py-1 text-xs font-semibold ${badgeColor(s.fee_status)}`}>{s.fee_status || '-'}</span></td>
                <td className="p-3">{s.phone || '-'}</td>
                <td className="p-3 flex gap-1 items-center">
                  <button title="Edit" aria-label="Edit" onClick={()=>openEdit(s)} className="rounded-full bg-gray-100 hover:bg-blue-100 focus-visible:ring-2 focus-visible:ring-blue-300 p-1"><Pencil className="size-4 text-blue-600"/></button>
                  <button title="Delete" aria-label="Delete" onClick={()=>onDelete(s.id)} className="rounded-full bg-gray-100 hover:bg-red-100 focus-visible:ring-2 focus-visible:ring-red-300 p-1 ml-1"><Trash className="size-4 text-red-600"/></button>
                </td>
              </tr>
            ))}
            {!students.length && (
              <tr><td className="p-3" colSpan={8}>No students</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


