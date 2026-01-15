"use client";
import { useEffect, useState, useRef, useMemo } from "react";
import { Plus, Pencil, Trash, Loader2, AlertCircle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SearchInput } from "@/components/ui/search-input";
import { supabaseClient } from "@/lib/db/supabase-client";
import { toast } from "sonner";

const feeStatusList = ["paid", "unpaid", "pending", "waived"];
const genderList = ["Male", "Female", "Other"];

type Student = {
  id: string;
  student_id?: string | null;
  fee_status?: string | null;
  gender?: string | null;
  join_date?: string | null;
  phone?: string | null;
  user?: {
    id: string;
    name: string | null;
    email: string | null;
    image_url?: string | null;
  } | null;
};

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
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
    studentId: "",
    feeStatus: "",
    gender: "",
    joinDate: new Date().toISOString().slice(0, 10),
    phone: "",
    avatarFile: null as File | null,
  });

  const [editForm, setEditForm] = useState<{
    id: string;
    name: string;
    email: string;
    studentId: string;
    feeStatus: string;
    gender: string;
    joinDate: string;
    phone: string;
    image_url: string;
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

  async function loadStudents() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/students");
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Failed to fetch students");
        return;
      }
      setStudents(data.students || []);
    } catch (err: any) {
      setError(err.message || "Failed to fetch students");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (userRole) {
      loadStudents();
    }
  }, [userRole]);

  // Filter students based on search query
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) {
      return students;
    }
    const query = searchQuery.toLowerCase().trim();
    return students.filter((s) => {
      const nameMatch = s.user?.name?.toLowerCase().includes(query);
      const emailMatch = s.user?.email?.toLowerCase().includes(query);
      const studentIdMatch = s.student_id?.toLowerCase().includes(query);
      const phoneMatch = s.phone?.toLowerCase().includes(query);
      return nameMatch || emailMatch || studentIdMatch || phoneMatch;
    });
  }, [students, searchQuery]);

  function resetForm() {
    setForm({
      name: "",
      email: "",
      password: "",
      studentId: "",
      feeStatus: "",
      gender: "",
      joinDate: new Date().toISOString().slice(0, 10),
      phone: "",
      avatarFile: null,
    });
    setImgPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function formatError(error: any): string {
    if (!error) return "";
    if (typeof error === "string") return error;
    if (error.formErrors && Array.isArray(error.formErrors)) return error.formErrors.join(" ");
    if (error.fieldErrors && typeof error.fieldErrors === "object") {
      return Object.entries(error.fieldErrors)
        .map(([k, a]: any) => `${k}: ${(a as string[]).join(", ")}`)
        .join(" | ");
    }
    return JSON.stringify(error);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setForm((f) => ({ ...f, avatarFile: file }));
    const reader = new FileReader();
    reader.onload = () => setImgPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userRole !== "admin") return;
    setError(null);
    let avatarUrl = "";
    if (form.avatarFile) {
      try {
        const ext = form.avatarFile.name.split(".").pop();
        const fileName = `student-${Date.now()}.${ext}`;
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
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, image_url: avatarUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(formatError(data?.error) || "Failed to create student");
        return;
      }
      setModalOpen(false);
      resetForm();
      loadStudents();
      toast.success("Student created successfully");
    } catch (err: any) {
      setError(err.message || "Failed to create student");
    }
  };

  const openEdit = (stu: Student) => {
    if (userRole !== "admin") return;
    setEditForm({
      id: stu.id,
      name: stu.user?.name || "",
      email: stu.user?.email || "",
      studentId: stu.student_id || "",
      feeStatus: stu.fee_status || "",
      gender: stu.gender || "",
      joinDate: stu.join_date ? stu.join_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
      phone: stu.phone || "",
      image_url: stu.user?.image_url || "",
      avatarFile: null,
    });
    setEditImgPreview(stu.user?.image_url || null);
    setEditId(stu.id);
    setEditError(null);
    if (editFileRef.current) editFileRef.current.value = "";
  };

  function handleEditFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditForm((f: any) => ({ ...f, avatarFile: file }));
    const reader = new FileReader();
    reader.onload = () => setEditImgPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function onEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (userRole !== "admin") return;
    setEditError(null);
    let avatarUrl = editForm?.image_url || "";
    if (editForm?.avatarFile) {
      try {
        const ext = editForm.avatarFile.name.split(".").pop();
        const fileName = `student-${editForm.id || Date.now()}.${ext}`;
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
      const res = await fetch(`/api/students/${editForm?.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editForm, image_url: avatarUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEditError(formatError(data?.error) || "Unable to save");
        return;
      }
      setEditId(null);
      setEditForm(null);
      loadStudents();
      toast.success("Student updated successfully");
    } catch (err: any) {
      setEditError(err.message || "Failed to update student");
    }
  }

  async function onDelete(id: string) {
    if (userRole !== "admin") return;
    if (!confirm("Delete this student?")) return;
    try {
      const res = await fetch(`/api/students/${id}`, { method: "DELETE" });
      if (res.ok) {
        loadStudents();
        toast.success("Student deleted successfully");
      } else {
        const data = await res.json();
        toast.error(data?.error || "Failed to delete student");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete student");
    }
  }

  function badgeColor(val: string | null | undefined) {
    if (!val) return "bg-gray-100 text-gray-800";
    if (val === "paid") return "bg-green-100 text-green-800";
    if (val === "unpaid") return "bg-red-100 text-red-800";
    if (val === "pending") return "bg-yellow-100 text-yellow-800";
    if (val === "waived") return "bg-blue-100 text-blue-800";
    return "bg-gray-100 text-gray-800";
  }

  const canCreate = userRole === "admin";
  const canEdit = userRole === "admin";
  const canDelete = userRole === "admin";

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Students</h1>
          <p className="text-muted-foreground">Manage and view all students.</p>
        </div>
        <div className="flex items-center gap-2">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search students..."
          />
          {canCreate && (
            <Dialog
              open={modalOpen}
              onOpenChange={(v) => {
                setModalOpen(v);
                if (!v) {
                  setError(null);
                  resetForm();
                }
              }}
            >
              <DialogTrigger asChild>
                <Button variant="secondary" size="sm" className="gap-1">
                  <Plus className="size-4" /> Add Student
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add Student</DialogTitle>
                  <DialogDescription>
                    Create a new student account.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={onSubmit} className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Name *</Label>
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
                      <Label htmlFor="studentId">Student ID *</Label>
                      <Input
                        id="studentId"
                        required
                        value={form.studentId}
                        onChange={(e) => setForm((f) => ({ ...f, studentId: e.target.value }))}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="feeStatus">Fee Status *</Label>
                      <Select
                        value={form.feeStatus}
                        onValueChange={(v) => setForm((f) => ({ ...f, feeStatus: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          {feeStatusList.map((fs) => (
                            <SelectItem key={fs} value={fs}>
                              {fs.charAt(0).toUpperCase() + fs.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="gender">Gender *</Label>
                      <Select
                        value={form.gender}
                        onValueChange={(v) => setForm((f) => ({ ...f, gender: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          {genderList.map((g) => (
                            <SelectItem key={g} value={g}>
                              {g}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                      {formatError(error)}
                    </div>
                  )}
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">Add Student</Button>
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
      ) : filteredStudents.length > 0 ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">Avatar</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Student ID</TableHead>
                <TableHead>Gender</TableHead>
                <TableHead>Join Date</TableHead>
                <TableHead>Fee Status</TableHead>
                <TableHead>Phone</TableHead>
                {canEdit && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.map((s) => {
                const initials = (s.user?.name || "?")
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();
                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Avatar className="size-8">
                        <AvatarImage src={s.user?.image_url || undefined} />
                        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-medium">{s.user?.name ?? "-"}</TableCell>
                    <TableCell>{s.user?.email ?? "-"}</TableCell>
                    <TableCell>{s.student_id || "-"}</TableCell>
                    <TableCell>{s.gender || "-"}</TableCell>
                    <TableCell>
                      {s.join_date ? new Date(s.join_date).toLocaleDateString() : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge className={badgeColor(s.fee_status)}>
                        {s.fee_status || "-"}
                      </Badge>
                    </TableCell>
                    <TableCell>{s.phone || "-"}</TableCell>
                    {canEdit && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            onClick={() => openEdit(s)}
                            title="Edit"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => onDelete(s.id)}
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
            <Users className="size-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No students found</h3>
            <p className="text-sm text-muted-foreground">
              No students match your search query "{searchQuery}".
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="size-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No students yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {canCreate
                ? "Get started by adding your first student."
                : "No students have been added yet."}
            </p>
            {canCreate && (
              <Button onClick={() => setModalOpen(true)}>
                <Plus className="size-4 mr-2" />
                Add Your First Student
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog
        open={!!editId}
        onOpenChange={(v) => {
          if (!v) {
            setEditId(null);
            setEditForm(null);
            setEditError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
            <DialogDescription>
              Update student information.
            </DialogDescription>
          </DialogHeader>
          {editForm && (
            <form onSubmit={onEditSubmit} className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-name">Name *</Label>
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
                  <Label htmlFor="edit-studentId">Student ID *</Label>
                  <Input
                    id="edit-studentId"
                    required
                    value={editForm.studentId}
                    onChange={(e) => setEditForm((f: any) => ({ ...f, studentId: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-feeStatus">Fee Status *</Label>
                  <Select
                    value={editForm.feeStatus}
                    onValueChange={(v) => setEditForm((f: any) => ({ ...f, feeStatus: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {feeStatusList.map((fs) => (
                        <SelectItem key={fs} value={fs}>
                          {fs.charAt(0).toUpperCase() + fs.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-gender">Gender *</Label>
                  <Select
                    value={editForm.gender}
                    onValueChange={(v) => setEditForm((f: any) => ({ ...f, gender: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      {genderList.map((g) => (
                        <SelectItem key={g} value={g}>
                          {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  {formatError(editError)}
                </div>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditId(null)}>
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
