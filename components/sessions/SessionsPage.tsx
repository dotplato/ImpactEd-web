"use client";
import { useEffect, useMemo, useState } from "react";
import { LayoutGrid, CalendarDays, Plus, Pencil, Trash, LogIn, Clock, Loader2, Search, Check } from 'lucide-react';
import { CalendarView } from "@/components/ui/calendar-view";
import { cn } from "@/lib/utils";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { SearchInput } from "@/components/ui/search-input";

type Role = "admin" | "teacher" | "student";

type SessionRow = {
  id: string;
  title: string | null;
  scheduled_at: string; // ISO
  duration_minutes: number;
  status: string;
  course?: { id: string; title: string } | null;
};

type Student = {
  id: string;
  name: string;
  email: string;
  image_url?: string | null;
};

type Props = {
  role: Role;
};

export default function SessionsPage({ role }: Props) {
  const [activeTab, setActiveTab] = useState<string>('overview');
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
  const [enrolledStudents, setEnrolledStudents] = useState<Student[]>([]);
  const [courseIdToStudents, setCourseIdToStudents] = useState<Record<string, Student[]>>({});
  const [studentSearch, setStudentSearch] = useState("");
  const [selectionDialogOpen, setSelectionDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const canCreate = role === "admin" || role === "teacher";

  // Additional state for editing
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ title: string, scheduledAt: string, duration: number }>({ title: "", scheduledAt: "", duration: 60 });
  const [editLoading, setEditLoading] = useState(false);

  // Track session we are deleting
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const now = useMemo(() => new Date(), [sessions.length]);

  // Compute session groups for Overview tab
  // Filter sessions based on search query
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) {
      return sessions;
    }
    const query = searchQuery.toLowerCase().trim();
    return sessions.filter(s => {
      const titleMatch = s.title?.toLowerCase().includes(query);
      const courseMatch = s.course?.title?.toLowerCase().includes(query);
      return titleMatch || courseMatch;
    });
  }, [sessions, searchQuery]);

  const { todaySessions, upcomingSessions, pastSessions } = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const t: SessionRow[] = [];
    const u: SessionRow[] = [];
    const p: SessionRow[] = [];

    for (const s of filteredSessions) {
      const d = new Date(s.scheduled_at);
      if (d >= startOfToday && d <= endOfToday) {
        t.push(s);
      } else if (d > endOfToday) {
        u.push(s);
      } else {
        p.push(s);
      }
    }

    t.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
    u.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
    p.sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());

    return { todaySessions: t, upcomingSessions: u, pastSessions: p };
  }, [filteredSessions]);

  function formatTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function getDisplayedStatus(session: SessionRow) {
    if (String(session.status).toLowerCase() === 'cancelled') return 'Cancelled';
    const start = new Date(session.scheduled_at);
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + (session.duration_minutes || 60));
    if (now < start) return 'Upcoming';
    if (now > end) return 'Completed';
    return 'Ongoing';
  }

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

  async function preloadCoursesAndStudents() {
    if (!canCreate) return;
    const res = await fetch("/api/courses", { method: "GET" });
    if (!res.ok) return;
    const payload = await res.json();
    const list = payload?.courses ?? payload ?? [];
    const mapped: { id: string; title: string }[] = Array.isArray(list)
      ? list.map((c: any) => ({ id: c.id, title: c.title }))
      : [];
    setCourses(mapped);

    // Preload students for each course in parallel
    const studentsEntries: [string, { id: string, name: string, email: string }[]][] = await Promise.all(
      mapped.map(async (course) => {
        try {
          const r = await fetch(`/api/courses/${course.id}/students`, { method: "GET" });
          if (!r.ok) return [course.id, []] as [string, { id: string, name: string, email: string }[]];
          const p = await r.json();
          return [course.id, (p.students || []) as { id: string, name: string, email: string }[]] as [string, { id: string, name: string, email: string }[]];
        } catch {
          return [course.id, []] as [string, { id: string, name: string, email: string }[]];
        }
      })
    );

    const map: Record<string, { id: string, name: string, email: string }[]> = {};
    for (const [cid, arr] of studentsEntries) map[cid] = arr;
    setCourseIdToStudents(map);
  }

  // Load students for selected course when opening the form OR changing course
  async function loadStudentsForCourse(courseId: string) {
    if (!courseId) return setEnrolledStudents([]);
    // Use preloaded map if available
    const preloaded = courseIdToStudents[courseId];
    if (preloaded) {
      setEnrolledStudents(preloaded);
      return;
    }
    // Fallback fetch if not present (should rarely happen)
    try {
      const res = await fetch(`/api/courses/${courseId}/students`, { method: "GET" });
      if (res.ok) {
        const payload = await res.json();
        const list = payload.students || [];
        setEnrolledStudents(list);
        setCourseIdToStudents((m: Record<string, { id: string, name: string, email: string }[]>) => ({ ...m, [courseId]: list }));
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadSessions();
    preloadCoursesAndStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Calendar event mapping
  const calendarEvents = filteredSessions.map(s => {
    const start = new Date(s.scheduled_at);
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + (s.duration_minutes || 60));

    return {
      id: s.id,
      title: s.title || "Session",
      start,
      end,
      status: getDisplayedStatus(s).toLowerCase() as "upcoming" | "ongoing" | "completed" | "cancelled",
      course: s.course?.title,
    };
  });

  // Helper to format JS date to YYYY-MM-DDTHH:MM for HTML input
  function toLocalDatetimeInputValue(date: Date) {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  const handleDateClick = (date: Date) => {
    if (!(role === 'admin' || role === 'teacher')) return;
    const dtStr = toLocalDatetimeInputValue(date);
    setForm((f: typeof form) => ({ ...f, scheduledAt: dtStr }));
    setCreateOpen(true);
  };

  const handleEventClick = (event: any) => {
    // Find the session from the event ID
    const session = sessions.find(s => s.id === event.id);
    if (session && canEditOrDelete(session)) {
      setEditId(session.id);
      setEditForm({
        title: session.title || "",
        scheduledAt: session.scheduled_at.slice(0, 16),
        duration: session.duration_minutes || 60
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
    setEditForm({ title: session.title || "", scheduledAt: session.scheduled_at.slice(0, 16), duration: session.duration_minutes });
  };
  const onEditCancel = () => {
    setEditId(null);
  };
  const onEditSave = async () => {
    setEditLoading(true);
    setError(null);
    const res = await fetch(`/api/sessions/${editId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editForm.title,
        scheduledAt: editForm.scheduledAt,
        durationMinutes: Number(editForm.duration),
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
        const entries = Object.entries(error.fieldErrors as Record<string, unknown>);
        const flat = entries.flatMap(([field, arr]) => Array.isArray(arr) && arr.length ? `${field}: ${(arr as string[]).join(' ')}` : []);
        if (flat.length > 0) out += (out ? ' | ' : '') + flat.join(' | ');
      }
      if (!out) out = JSON.stringify(error);
      return out;
    }
    return String(error);
  }

  function renderStatusBadge(status: string) {
    const normalized = status.toLowerCase();
    if (normalized === 'cancelled') {
      return <Badge variant="destructive">Cancelled</Badge>
    }
    if (normalized === 'completed') {
      return <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100">Completed</Badge>
    }
    if (normalized === 'upcoming') {
      return <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-100">Upcoming</Badge>
    }
    return <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100">Ongoing</Badge>
  }

  function renderActions(s: SessionRow, canJoin: boolean) {
    return (
      <div className="flex items-center gap-2">
        <Button
          onClick={() => onJoin(s.id)}
          disabled={!canJoin}
          size="sm"
          variant={canJoin ? "default" : "outline"}
          className="gap-1"
          title={canJoin ? 'Join session' : 'Available at start time'}
        >
          <LogIn className="size-4" />
          Join
        </Button>
        {canEditOrDelete(s) && (
          <>
            <Button
              onClick={() => onEditStart(s)}
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              disabled={editId === s.id}
              title="Edit"
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              onClick={() => onDelete(s.id)}
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
              disabled={deleteId === s.id}
              title="Delete"
            >
              {deleteId === s.id ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash className="size-4" />
              )}
            </Button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="overview" className="gap-2">
              <LayoutGrid className="size-4" /> Overview
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-2">
              <CalendarDays className="size-4" /> Calendar
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search sessions..."
            />
            {(role === 'admin' || role === 'teacher') && (
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button variant="secondary" size="sm" className="gap-1">
                    <Plus className="size-4" /> New Session
                  </Button>
                </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Create Session</DialogTitle>
                  <DialogDescription>
                    Schedule a new learning session for your students.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={onCreate} className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="course">Course</Label>
                    <Select
                      value={form.courseId}
                      onValueChange={async (val: string) => {
                        setForm(f => ({ ...f, courseId: val, selectedStudents: [] }));
                        const pre = courseIdToStudents[val] || [];
                        setEnrolledStudents(pre);
                        if (!courseIdToStudents[val]) {
                          await loadStudentsForCourse(val);
                        }
                      }}
                    >
                      <SelectTrigger id="course">
                        <SelectValue placeholder="Select course" />
                      </SelectTrigger>
                      <SelectContent>
                        {courses.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {form.courseId && (
                    <div className="grid gap-2">
                      <div className="flex items-center justify-between">
                        <Label>Students</Label>
                        <div className="flex items-center gap-2">
                          <div className="flex -space-x-2 overflow-hidden">
                            {form.selectedStudents.slice(0, 5).map(id => {
                              const student = enrolledStudents.find(s => s.id === id);
                              if (!student) return null;
                              return (
                                <Avatar key={id} className="size-7 border-2 border-background">
                                  <AvatarImage src={student.image_url || undefined} />
                                  <AvatarFallback className="text-[10px]">{student.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                              );
                            })}
                            {form.selectedStudents.length > 5 && (
                              <div className="flex size-7 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-medium">
                                +{form.selectedStudents.length - 5}
                              </div>
                            )}
                          </div>
                          <Dialog open={selectionDialogOpen} onOpenChange={setSelectionDialogOpen}>
                            <DialogTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="size-8 rounded-full border-primary text-primary hover:bg-primary/10"
                              >
                                <Plus className="size-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden gap-0">
                              <DialogHeader className="p-6 pb-2">
                                <DialogTitle>Select Students</DialogTitle>
                                <DialogDescription>
                                  Invite students to this session. This will create a group session.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="p-4 pt-2 border-b">
                                <div className="relative">
                                  <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
                                  <Input
                                    placeholder="Search students..."
                                    className="pl-8 h-9 bg-background"
                                    value={studentSearch}
                                    onChange={(e) => setStudentSearch(e.target.value)}
                                  />
                                </div>
                              </div>
                              <div className="h-80 overflow-y-auto">
                                <div className="divide-y">
                                  <div
                                    className="flex items-center justify-between p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                                    onClick={() => {
                                      const allSelected = form.selectedStudents.length === enrolledStudents.length;
                                      setForm((f: typeof form) => ({
                                        ...f,
                                        selectedStudents: allSelected ? [] : enrolledStudents.map(s => s.id),
                                      }));
                                    }}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center">
                                        <Check className={cn("size-4 text-primary transition-opacity", form.selectedStudents.length === enrolledStudents.length ? "opacity-100" : "opacity-0")} />
                                      </div>
                                      <span className="font-medium">Select All</span>
                                    </div>
                                    <Checkbox
                                      checked={form.selectedStudents.length === enrolledStudents.length}
                                      className="pointer-events-none"
                                    />
                                  </div>
                                  {enrolledStudents
                                    .filter(s =>
                                      s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
                                      s.email.toLowerCase().includes(studentSearch.toLowerCase())
                                    )
                                    .map(s => {
                                      const isSelected = form.selectedStudents.includes(s.id);
                                      return (
                                        <div
                                          key={s.id}
                                          className={cn(
                                            "flex items-center justify-between p-3 hover:bg-muted/50 cursor-pointer transition-colors",
                                            isSelected && "bg-primary/5"
                                          )}
                                          onClick={() => {
                                            setForm((f: typeof form) => ({
                                              ...f,
                                              selectedStudents: isSelected
                                                ? f.selectedStudents.filter(id => id !== s.id)
                                                : [...f.selectedStudents, s.id],
                                            }));
                                          }}
                                        >
                                          <div className="flex items-center gap-3">
                                            <Avatar className="size-8">
                                              <AvatarImage src={s.image_url || undefined} />
                                              <AvatarFallback>{s.name.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col">
                                              <span className="text-sm font-medium">{s.name}</span>
                                              <span className="text-xs text-muted-foreground">{s.email}</span>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            {isSelected && <Check className="size-4 text-primary" />}
                                          </div>
                                        </div>
                                      );
                                    })}
                                </div>
                              </div>
                              <div className="p-4 border-t bg-muted/10 flex items-center justify-between gap-4">
                                <div className="flex -space-x-2 overflow-hidden no-scrollbar">
                                  {form.selectedStudents.map(id => {
                                    const student = enrolledStudents.find(s => s.id === id);
                                    if (!student) return null;
                                    return (
                                      <Avatar key={id} className="size-8 border-2 border-background">
                                        <AvatarImage src={student.image_url || undefined} />
                                        <AvatarFallback className="text-xs">{student.name.charAt(0)}</AvatarFallback>
                                      </Avatar>
                                    );
                                  })}
                                </div>
                                <Button
                                  type="button"
                                  className="bg-purple-700 hover:bg-purple-800 text-white px-8"
                                  onClick={() => setSelectionDialogOpen(false)}
                                >
                                  Continue
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid gap-2">
                    <Label htmlFor="title">Title (Optional)</Label>
                    <Input
                      id="title"
                      value={form.title}
                      onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                      placeholder="Session title"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="start">Start Time</Label>
                      <Input
                        id="start"
                        type="datetime-local"
                        required
                        value={form.scheduledAt}
                        onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="duration">Duration (min)</Label>
                      <Input
                        id="duration"
                        type="number"
                        min={1}
                        value={form.duration}
                        onChange={(e) => setForm((f) => ({ ...f, duration: Number(e.target.value) }))}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={form.selectedStudents.length === 0}>
                      Create Session
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            )}
          </div>
        </div>

        <TabsContent value="calendar" className="mt-6">
          <CalendarView
            events={calendarEvents}
            onDateClick={handleDateClick}
            onEventClick={handleEventClick}
          />
        </TabsContent>

        <TabsContent value="overview" className="mt-6 space-y-8">
          {error && (
            <Badge variant="destructive" className="w-full justify-center py-2 text-sm">
              {formatError(error)}
            </Badge>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Today */}
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="rounded-full px-3 py-1 text-[10px] uppercase tracking-wider font-bold">Today</Badge>
                  <div className="h-px flex-1 bg-border" />
                </div>
                {todaySessions.length ? (
                  <Card className="px-2">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[120px]">Time</TableHead>
                          <TableHead>Session</TableHead>
                          <TableHead className="hidden md:table-cell">Duration</TableHead>
                          <TableHead className="text-right">Status</TableHead>
                          <TableHead className="w-[100px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {todaySessions.map((s) => {
                          const startsAt = new Date(s.scheduled_at);
                          const canJoinNow = now >= startsAt;
                          const status = getDisplayedStatus(s);
                          return (
                            <TableRow key={s.id}>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  <Clock className="size-3.5 text-muted-foreground" />
                                  {formatTime(s.scheduled_at)}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="font-semibold">{s.title || 'Session'}</div>
                                <div className="text-xs text-muted-foreground">{s.course?.title || '-'}</div>
                              </TableCell>
                              <TableCell className="hidden md:table-cell text-muted-foreground">
                                {s.duration_minutes} min
                              </TableCell>
                              <TableCell className="text-right">
                                {renderStatusBadge(status)}
                              </TableCell>
                              <TableCell>
                                {renderActions(s, canJoinNow)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </Card>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8 border rounded-lg border-dashed">No sessions scheduled for today.</p>
                )}
              </section>

              {/* Upcoming */}
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="rounded-full px-3 py-1 text-[10px] uppercase tracking-wider font-bold">Upcoming</Badge>
                  <div className="h-px flex-1 bg-border" />
                </div>
                {upcomingSessions.length ? (
                  <Card className="px-2">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[120px]">Time</TableHead>
                          <TableHead>Session</TableHead>
                          <TableHead className="hidden md:table-cell">Date</TableHead>
                          <TableHead className="hidden md:table-cell">Duration</TableHead>
                          <TableHead className="text-right">Status</TableHead>
                          <TableHead className="w-[100px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {upcomingSessions.map((s) => (
                          <TableRow key={s.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <Clock className="size-3.5 text-muted-foreground" />
                                {formatTime(s.scheduled_at)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="font-semibold">{s.title || 'Session'}</div>
                              <div className="text-xs text-muted-foreground">{s.course?.title || '-'}</div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-muted-foreground">
                              {new Date(s.scheduled_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-muted-foreground">
                              {s.duration_minutes} min
                            </TableCell>
                            <TableCell className="text-right">
                              {renderStatusBadge(getDisplayedStatus(s))}
                            </TableCell>
                            <TableCell>
                              {renderActions(s, false)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Card>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8 border rounded-lg border-dashed">No upcoming sessions.</p>
                )}
              </section>

              {/* Past */}
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="rounded-full px-3 py-1 text-[10px] uppercase tracking-wider font-bold">Past</Badge>
                  <div className="h-px flex-1 bg-border" />
                </div>
                {pastSessions.length ? (
                  <Card className="px-2">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[120px]">Time</TableHead>
                          <TableHead>Session</TableHead>
                          <TableHead className="hidden md:table-cell">Date</TableHead>
                          <TableHead className="hidden md:table-cell">Duration</TableHead>
                          <TableHead className="text-right">Status</TableHead>
                          <TableHead className="w-[100px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pastSessions.map((s) => (
                          <TableRow key={s.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <Clock className="size-3.5 text-muted-foreground" />
                                {formatTime(s.scheduled_at)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="font-semibold">{s.title || 'Session'}</div>
                              <div className="text-xs text-muted-foreground">{s.course?.title || '-'}</div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-muted-foreground">
                              {new Date(s.scheduled_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-muted-foreground">
                              {s.duration_minutes} min
                            </TableCell>
                            <TableCell className="text-right">
                              {renderStatusBadge(getDisplayedStatus(s))}
                            </TableCell>
                            <TableCell>
                              {renderActions(s, false)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Card>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8 border rounded-lg border-dashed">No past sessions.</p>
                )}
              </section>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={!!editId} onOpenChange={(open) => !open && setEditId(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Session</DialogTitle>
            <DialogDescription>
              Update the session details.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={editForm.title}
                onChange={(e) => setEditForm((f: typeof editForm) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-start">Start Time</Label>
                <Input
                  id="edit-start"
                  type="datetime-local"
                  value={editForm.scheduledAt}
                  onChange={(e) => setEditForm((f: typeof editForm) => ({ ...f, scheduledAt: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-duration">Duration (min)</Label>
                <Input
                  id="edit-duration"
                  type="number"
                  min={1}
                  value={editForm.duration}
                  onChange={(e) => setEditForm((f: typeof editForm) => ({ ...f, duration: Number(e.target.value) }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onEditCancel}>Cancel</Button>
            <Button onClick={onEditSave} disabled={editLoading}>
              {editLoading ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


