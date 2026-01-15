"use client";
import { useEffect, useState, useRef, useMemo } from "react";
import { Plus, Pencil, Trash, Loader2, AlertCircle, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SearchInput } from "@/components/ui/search-input";
import { supabaseClient } from "@/lib/db/supabase-client";
import { toast } from "sonner";

type Teacher = {
  id: string;
  phone?: string | null;
  join_date?: string | null;
  qualification?: string | null;
  user?: {
    id: string;
    name: string | null;
    email: string | null;
    image_url?: string | null;
  } | null;
};

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [userRole, setUserRole] = useState<"admin" | "teacher" | "student" | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [imgPreview, setImgPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [editImgPreview, setEditImgPreview] = useState<string | null>(null);
  const editFileRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    joinDate: new Date().toISOString().slice(0, 10),
    phone: "",
    qualification: "",
    avatarFile: null as File | null,
  });

  const [editForm, setEditForm] = useState<{
    id: string;
    name: string;
    email: string;
    phone: string;
    joinDate: string;
    qualification: string;
    profile_pic: string;
    avatarFile: File | null;
  } | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setUserRole(data.user.role);
        }
      })
      .catch(() => { });
  }, []);

  async function loadTeachers() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/teachers");
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Failed to fetch teachers");
        return;
      }
      setTeachers(data.teachers || []);
    } catch (err: any) {
      setError(err.message || "Failed to fetch teachers");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (userRole) {
      loadTeachers();
    }
  }, [userRole]);

  // Filter teachers based on search query
  const filteredTeachers = useMemo(() => {
    if (!searchQuery.trim()) {
      return teachers;
    }
    const query = searchQuery.toLowerCase().trim();
    return teachers.filter((t) => {
      const nameMatch = t.user?.name?.toLowerCase().includes(query);
      const emailMatch = t.user?.email?.toLowerCase().includes(query);
      const phoneMatch = t.phone?.toLowerCase().includes(query);
      const qualificationMatch = t.qualification?.toLowerCase().includes(query);
      return nameMatch || emailMatch || phoneMatch || qualificationMatch;
    });
  }, [teachers, searchQuery]);

  function resetForm() {
    setForm({
      name: "",
      email: "",
      password: "",
      joinDate: new Date().toISOString().slice(0, 10),
      phone: "",
      qualification: "",
      avatarFile: null,
    });
    setImgPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setForm((f) => ({ ...f, avatarFile: file }));
    const reader = new FileReader();
    reader.onload = () => setImgPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (userRole !== "admin") return;
    setError(null);
    let avatarUrl = "";
    if (form.avatarFile) {
      try {
        const ext = form.avatarFile.name.split(".").pop();
        const fileName = `teacher-${Date.now()}.${ext}`;
        const { error: upErr } = await supabaseClient.storage
          .from("avatars")
          .upload(fileName, form.avatarFile, { upsert: false });
        if (upErr) {
          setError("Upload failed.");
          return;
        }
        avatarUrl = supabaseClient.storage.from("avatars").getPublicUrl(fileName).data.publicUrl;
      } catch (err: any) {
        setError("Upload failed: " + err.message);
        return;
      }
    }
    try {
      const apiRes = await fetch("/api/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      if (!apiRes.ok) {
        setError(apiData?.error || "Unable to add teacher");
        return;
      }
      setModalOpen(false);
      resetForm();
      loadTeachers();
      toast.success("Teacher created successfully");
    } catch (err: any) {
      setError(err.message || "Failed to create teacher");
    }
  }

  async function onEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editForm || userRole !== "admin") return;
    setEditError(null);
    let avatarUrl = editForm.profile_pic;
    if (editForm.avatarFile) {
      try {
        const ext = editForm.avatarFile.name.split(".").pop();
        const fileName = `teacher-${editForm.id || Date.now()}.${ext}`;
        const { error: upErr } = await supabaseClient.storage
          .from("avatars")
          .upload(fileName, editForm.avatarFile, { upsert: true });
        if (upErr) {
          setEditError("Upload failed: " + upErr.message);
          return;
        }
        avatarUrl = supabaseClient.storage.from("avatars").getPublicUrl(fileName).data.publicUrl;
      } catch (err: any) {
        setEditError("Upload failed: " + err.message);
        return;
      }
    }
    try {
      const apiRes = await fetch(`/api/teachers/${editForm.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
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
      if (!apiRes.ok) {
        setEditError(apiData?.error || "Unable to update teacher");
        return;
      }
      setEditingTeacher(null);
      setEditForm(null);
      setEditImgPreview(null);
      loadTeachers();
      toast.success("Teacher updated successfully");
    } catch (err: any) {
      setEditError(err.message || "Failed to update teacher");
    }
  }

  function openEdit(teacher: Teacher) {
    if (userRole !== "admin") return;
    setEditingTeacher(teacher);
    setEditForm({
      id: teacher.id,
      name: teacher.user?.name || "",
      email: teacher.user?.email || "",
      phone: teacher.phone || "",
      joinDate: teacher.join_date ? teacher.join_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
      qualification: teacher.qualification || "",
      profile_pic: teacher.user?.image_url || "",
      avatarFile: null,
    });
    setEditImgPreview(teacher.user?.image_url || null);
    setEditError(null);
    if (editFileRef.current) editFileRef.current.value = "";
  }

  function handleEditFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditForm((f: any) => ({ ...f, avatarFile: file }));
    const reader = new FileReader();
    reader.onload = () => setEditImgPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function onDelete(id: string) {
    if (userRole !== "admin") return;
    if (!confirm("Delete this teacher?")) return;
    try {
      const res = await fetch(`/api/teachers/${id}`, { method: "DELETE" });
      if (res.ok) {
        loadTeachers();
        toast.success("Teacher deleted successfully");
      } else {
        const data = await res.json();
        toast.error(data?.error || "Failed to delete teacher");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete teacher");
    }
  }

  const canCreate = userRole === "admin";
  const canEdit = userRole === "admin";
  const canDelete = userRole === "admin";

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Teachers</h1>
          <p className="text-muted-foreground">Manage and view all teachers.</p>
        </div>
        <div className="flex items-center gap-2">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search teachers..."
          />
          {canCreate && (
            <Dialog open={modalOpen} onOpenChange={(v) => {
              setModalOpen(v);
              if (!v) {
                setError(null);
                resetForm();
              }
            }}>
              <DialogTrigger asChild>
                <Button variant="secondary" size="sm" className="gap-1">
                  <Plus className="size-4" /> Add Teacher
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Add Teacher</DialogTitle>
                  <DialogDescription>
                    Create a new teacher account.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={onSubmit} className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Full Name *</Label>
                      <Input
                        id="name"
                        required
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        required
                        value={form.email}
                        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="password">Password *</Label>
                      <Input
                        id="password"
                        type="password"
                        required
                        minLength={8}
                        value={form.password}
                        onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        value={form.phone}
                        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="qualification">Qualification</Label>
                      <Input
                        id="qualification"
                        value={form.qualification}
                        onChange={(e) => setForm((f) => ({ ...f, qualification: e.target.value }))}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="joinDate">Join Date *</Label>
                      <Input
                        id="joinDate"
                        type="date"
                        required
                        value={form.joinDate}
                        onChange={(e) => setForm((f) => ({ ...f, joinDate: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="avatar">Profile Picture (optional)</Label>
                    <Input
                      id="avatar"
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handleFile}
                    />
                    {imgPreview && (
                      <img alt="preview" src={imgPreview} className="mt-1 rounded h-16 w-16 object-cover" />
                    )}
                  </div>
                  {error && (
                    <div className="text-sm text-destructive flex items-center gap-2">
                      <AlertCircle className="size-4" />
                      {error}
                    </div>
                  )}
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">Add Teacher</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Error State */}
      {error && !modalOpen && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="size-5 text-destructive shrink-0" />
            <div className="text-sm text-destructive">{error}</div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredTeachers.length > 0 ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">Avatar</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Qualification</TableHead>
                <TableHead>Join Date</TableHead>
                {canEdit && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTeachers.map((t) => {
                const initials = (t.user?.name || "?")
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();
                return (
                  <TableRow key={t.id}>
                    <TableCell>
                      <Avatar className="size-8">
                        <AvatarImage src={t.user?.image_url || undefined} />
                        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-medium">{t.user?.name ?? "-"}</TableCell>
                    <TableCell>{t.user?.email ?? "-"}</TableCell>
                    <TableCell>{t.phone || "-"}</TableCell>
                    <TableCell>{t.qualification || "-"}</TableCell>
                    <TableCell>
                      {t.join_date ? new Date(t.join_date).toLocaleDateString() : "-"}
                    </TableCell>
                    {canEdit && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            onClick={() => openEdit(t)}
                            title="Edit"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => onDelete(t.id)}
                            title="Delete"
                          >
                            <Trash className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      ) : searchQuery.trim() ? (
        <Card>
          <CardContent className="p-12 text-center">
            <User className="size-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No teachers found</h3>
            <p className="text-sm text-muted-foreground">
              No teachers match your search query "{searchQuery}".
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <User className="size-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No teachers yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {canCreate
                ? "Get started by adding your first teacher."
                : "No teachers have been added yet."}
            </p>
            {canCreate && (
              <Button onClick={() => setModalOpen(true)}>
                <Plus className="size-4 mr-2" />
                Add Your First Teacher
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog
        open={!!editingTeacher}
        onOpenChange={(v) => {
          if (!v) {
            setEditingTeacher(null);
            setEditForm(null);
            setEditImgPreview(null);
            setEditError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Teacher</DialogTitle>
            <DialogDescription>
              Update teacher information.
            </DialogDescription>
          </DialogHeader>
          {editForm && (
            <form onSubmit={onEdit} className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-name">Full Name *</Label>
                  <Input
                    id="edit-name"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm((f: any) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-email">Email *</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    required
                    value={editForm.email}
                    onChange={(e) => setEditForm((f: any) => ({ ...f, email: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-phone">Phone</Label>
                  <Input
                    id="edit-phone"
                    value={editForm.phone}
                    onChange={(e) => setEditForm((f: any) => ({ ...f, phone: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-qualification">Qualification</Label>
                  <Input
                    id="edit-qualification"
                    value={editForm.qualification}
                    onChange={(e) => setEditForm((f: any) => ({ ...f, qualification: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-joinDate">Join Date *</Label>
                <Input
                  id="edit-joinDate"
                  type="date"
                  required
                  value={editForm.joinDate}
                  onChange={(e) => setEditForm((f: any) => ({ ...f, joinDate: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-avatar">Profile Picture</Label>
                <Input
                  id="edit-avatar"
                  type="file"
                  ref={editFileRef}
                  accept="image/*"
                  onChange={handleEditFile}
                />
                {editImgPreview && (
                  <img alt="preview" src={editImgPreview} className="mt-1 rounded h-12 w-12 object-cover" />
                )}
              </div>
              {editError && (
                <div className="text-sm text-destructive flex items-center gap-2">
                  <AlertCircle className="size-4" />
                  {editError}
                </div>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingTeacher(null)}>
                  Cancel
                </Button>
                <Button type="submit">Save</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
