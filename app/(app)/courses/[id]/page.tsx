"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  FileText, 
  BookOpen, 
  HelpCircle, 
  Users, 
  User, 
  Upload, 
  Trash2,
  Download,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plus,
  Search,
  GripVertical,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Check } from "lucide-react";

type CourseDetails = {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  level?: string | null;
  what_students_will_learn?: string[] | null;
  cover_image?: string | null;
  tenure_start?: string | null;
  tenure_end?: string | null;
  teacher?: { 
    id: string; 
    user?: { 
      id: string; 
      name: string | null; 
      email: string | null;
      image_url?: string | null;
    } | null;
  } | null;
  students: { 
    id: string; 
    name: string; 
    email: string;
    image_url?: string | null;
  }[];
};

type SessionRow = {
  id: string;
  title: string | null;
  scheduled_at: string;
  duration_minutes: number;
  status?: string;
};

type AssignmentRow = {
  id: string;
  title: string;
  description_richjson?: string | null;
  due_at: string;
  total_marks?: number | null;
  min_pass_marks?: number | null;
  created_at: string;
};

type QuizRow = {
  id: string;
  title: string;
  description?: string | null;
  due_at: string;
  total_marks?: number | null;
  attachment_required?: boolean;
  created_at: string;
};

type FileRow = {
  id: string;
  file_name: string;
  file_path: string;
  mime?: string | null;
  created_at: string;
};

export default function CourseDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const courseId = params?.id as string;

  // Get initial tab from URL query param
  const initialTab = (searchParams.get("tab") as "overview" | "schedule" | "files") || "overview";
  const [activeTab, setActiveTab] = useState<"overview" | "schedule" | "files">(initialTab);

  // Update tab when URL param changes
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "schedule" || tab === "files" || tab === "overview") {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // Handle tab change and update URL
  function handleTabChange(tab: "overview" | "schedule" | "files") {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "overview") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    router.push(`/courses/${courseId}${params.toString() ? `?${params.toString()}` : ""}`, { scroll: false });
  }

  const [course, setCourse] = useState<CourseDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const [files, setFiles] = useState<FileRow[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [userRole, setUserRole] = useState<"admin" | "teacher" | "student" | null>(null);

  // Create session dialog state
  const [createSessionOpen, setCreateSessionOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    scheduledAt: "",
    duration: 60,
    selectedStudents: [] as string[],
  });

  const [studentSearch, setStudentSearch] = useState("");
  const [selectionDialogOpen, setSelectionDialogOpen] = useState(false);
  const [enrolledStudents, setEnrolledStudents] = useState<Array<{ id: string; name: string; email: string; image_url?: string | null }>>([]);

  useEffect(() => {
    fetch("/api/me")
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          setUserRole(data.user.role);
        }
      })
      .catch(() => {});
  }, []);

  async function loadCourse() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/courses/${courseId}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Failed to load course");
        return;
      }
      
      // Transform students to include image_url
      const transformedCourse = {
        ...data.course,
        students: (data.course.students || []).map((s: any) => ({
          id: s.id,
          name: s.name || "",
          email: s.email || "",
          image_url: s.image_url || null,
        })),
      };
      
      setCourse(transformedCourse);
    } catch (err: any) {
      setError(err.message || "Failed to load course");
    } finally {
      setLoading(false);
    }
  }

  async function loadSessions() {
    setSessionsLoading(true);
    try {
      const res = await fetch(`/api/courses/${courseId}/sessions`);
      const data = await res.json();
      if (res.ok) setSessions(data.sessions || []);
    } catch (err) {
      console.error("Failed to load sessions", err);
    } finally {
      setSessionsLoading(false);
    }
  }

  async function loadAssignments() {
    try {
      const res = await fetch("/api/assignments");
      const data = await res.json();
      if (res.ok && data.assignments) {
        // Filter assignments for this course
        const courseAssignments = data.assignments.filter((a: any) => {
          // Handle both nested course object and direct course_id
          const assignmentCourseId = a.course?.id || a.course_id;
          const matches = String(assignmentCourseId) === String(courseId);
          if (matches) {
            console.log('Assignment match:', { id: a.id, title: a.title, courseId: assignmentCourseId });
          }
          return matches;
        });
        console.log(`Course ${courseId}: Found ${courseAssignments.length} assignments out of ${data.assignments.length} total`);
        setAssignments(courseAssignments);
      }
    } catch (err) {
      console.error("Failed to load assignments", err);
    }
  }

  async function loadQuizzes() {
    try {
      const res = await fetch("/api/quizzes");
      const data = await res.json();
      if (res.ok && data.quizzes) {
        // Filter quizzes for this course
        const courseQuizzes = data.quizzes.filter((q: any) => {
          // Handle both nested course object and direct course_id
          const quizCourseId = q.course?.id || q.course_id;
          const matches = String(quizCourseId) === String(courseId);
          if (matches) {
            console.log('Quiz match:', { id: q.id, title: q.title, courseId: quizCourseId });
          }
          return matches;
        });
        console.log(`Course ${courseId}: Found ${courseQuizzes.length} quizzes out of ${data.quizzes.length} total`);
        setQuizzes(courseQuizzes);
      }
    } catch (err) {
      console.error("Failed to load quizzes", err);
    }
  }

  async function loadFiles() {
    setFilesLoading(true);
    try {
      const res = await fetch(`/api/courses/${courseId}/files`);
      const data = await res.json();
      if (res.ok) setFiles(data.files || []);
    } catch (err) {
      console.error("Failed to load files", err);
    } finally {
      setFilesLoading(false);
    }
  }

  useEffect(() => {
    if (!courseId) return;
    loadCourse();
    loadSessions();
    loadAssignments();
    loadQuizzes();
    loadFiles();
  }, [courseId]);

  // Group curriculum items by date
  const curriculumItems = useMemo(() => {
    const items: Array<{
      id: string;
      type: 'lecture' | 'assignment' | 'quiz';
      title: string;
      scheduledAt: string;
      duration?: number;
      description?: string | null;
      totalMarks?: number | null;
      minPassMarks?: number | null;
      attachmentRequired?: boolean;
    }> = [];

    // Add sessions (lectures) - these are created from curriculum
    if (sessions && Array.isArray(sessions)) {
      sessions.forEach(s => {
        if (s) {
          // Handle both scheduled_at and schedule fields
          const scheduledAt = s.scheduled_at || s.schedule;
          if (scheduledAt) {
            items.push({
              id: s.id,
              type: 'lecture',
              title: s.title || 'Untitled Session',
              scheduledAt: scheduledAt,
              duration: s.duration_minutes,
            });
          } else {
            console.warn('Session without scheduled date:', s);
          }
        }
      });
    }

    // Add assignments - these are created from curriculum
    if (assignments && Array.isArray(assignments)) {
      assignments.forEach(a => {
        if (a && a.due_at) {
          items.push({
            id: a.id,
            type: 'assignment',
            title: a.title,
            scheduledAt: a.due_at,
            description: a.description_richjson,
            totalMarks: a.total_marks,
            minPassMarks: a.min_pass_marks,
          });
        }
      });
    }

    // Add quizzes - these are created from curriculum
    if (quizzes && Array.isArray(quizzes)) {
      quizzes.forEach(q => {
        if (q && q.due_at) {
          items.push({
            id: q.id,
            type: 'quiz',
            title: q.title,
            scheduledAt: q.due_at,
            description: q.description,
            totalMarks: q.total_marks,
            attachmentRequired: q.attachment_required,
          });
        }
      });
    }

    const sorted = items.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
    
    // Debug logging
    console.log('Curriculum Items:', {
      total: sorted.length,
      sessions: sessions?.length || 0,
      assignments: assignments?.length || 0,
      quizzes: quizzes?.length || 0,
      items: sorted.map(i => ({ type: i.type, title: i.title, scheduledAt: i.scheduledAt }))
    });
    
    return sorted;
  }, [sessions, assignments, quizzes]);

  // Group all curriculum items (sessions, assignments, quizzes) by week
  const weekGroupsWithItems = useMemo(() => {
    const startStr = course?.tenure_start;
    console.log('Week grouping check:', {
      hasStartDate: !!startStr,
      startDate: startStr,
      curriculumItemsCount: curriculumItems?.length || 0
    });
    
    if (!startStr || !curriculumItems || curriculumItems.length === 0) {
      console.log('Week grouping skipped - no start date or no items');
      return [] as Array<{
        label: string;
        start: Date;
        end: Date;
        items: Array<{
          id: string;
          type: 'lecture' | 'assignment' | 'quiz';
          title: string;
          scheduledAt: string;
          duration?: number;
          description?: string | null;
          totalMarks?: number | null;
          minPassMarks?: number | null;
          attachmentRequired?: boolean;
        }>;
      }>;
    }
    
    const startDate = new Date(startStr);
    startDate.setHours(0, 0, 0, 0);
    console.log('Start date for week calculation:', startDate.toISOString());
    
    const groups: Record<number, {
      start: Date;
      end: Date;
      items: typeof curriculumItems;
    }> = {};

    for (const item of curriculumItems) {
      if (!item.scheduledAt) {
        console.log('Skipping item without scheduledAt:', item.title);
        continue; // Skip items without scheduled date
      }
      
      const itemDate = new Date(item.scheduledAt);
      if (isNaN(itemDate.getTime())) {
        console.log('Skipping item with invalid date:', item.title, item.scheduledAt);
        continue; // Skip invalid dates
      }
      
      const diffMs = itemDate.getTime() - startDate.getTime();
      const weekIndex = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
      
      console.log('Item week calculation:', {
        title: item.title,
        scheduledAt: item.scheduledAt,
        itemDate: itemDate.toISOString(),
        diffMs,
        weekIndex
      });
      
      if (!groups[weekIndex]) {
        const weekStart = new Date(startDate.getTime() + weekIndex * 7 * 24 * 60 * 60 * 1000);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        
        groups[weekIndex] = {
          start: weekStart,
          end: weekEnd,
          items: [],
        };
      }
      
      groups[weekIndex].items.push(item);
    }

    const ordered = Object.keys(groups)
      .map(k => Number(k))
      .sort((a, b) => a - b)
      .map((k, i) => {
        const g = groups[k];
        return {
          label: `Week ${i + 1}`,
          start: g.start,
          end: g.end,
          items: g.items.sort((a, b) => {
            const dateA = new Date(a.scheduledAt).getTime();
            const dateB = new Date(b.scheduledAt).getTime();
            return dateA - dateB;
          }),
        };
      });
    
    console.log('Week Groups Result:', {
      totalWeeks: ordered.length,
      totalItems: ordered.reduce((sum, w) => sum + w.items.length, 0),
      weeks: ordered.map(w => ({ label: w.label, items: w.items.length, itemTitles: w.items.map(i => i.title) }))
    });
    
    return ordered;
  }, [curriculumItems, course?.tenure_start]);

  async function onCreateSession(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
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
      if (!res.ok) {
        setError(data?.error || "Failed to create session");
        return;
      }
      setForm({ title: "", scheduledAt: "", duration: 60, selectedStudents: [] });
      loadSessions();
    } catch (err: any) {
      setError(err.message || "Failed to create session");
    }
  }

  async function onUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`/api/courses/${courseId}/files`, { method: "POST", body: formData });
      if (res.ok) {
        await loadFiles();
      }
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      setUploading(false);
      (e.target as any).value = "";
    }
  }

  async function onDeleteFile(id: string) {
    if (!confirm("Delete this file?")) return;
    try {
      const res = await fetch(`/api/courses/${courseId}/files/${id}`, { method: "DELETE" });
      if (res.ok) loadFiles();
    } catch (err) {
      console.error("Delete failed", err);
    }
  }

  const canCreateSession = userRole === "admin" || userRole === "teacher";
  const canUploadFiles = userRole === "admin" || userRole === "teacher";
  const canDeleteFiles = userRole === "admin" || userRole === "teacher";

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4">
        <div className="text-center py-12">
          <div className="text-sm text-muted-foreground">Loading course...</div>
        </div>
      </div>
    );
  }

  if (error && !course) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4">
        <div className="text-center py-12">
          <AlertCircle className="size-12 text-destructive mx-auto mb-4" />
          <div className="text-lg font-semibold mb-2">Error</div>
          <div className="text-sm text-muted-foreground">{error}</div>
          <Button variant="outline" className="mt-4" onClick={() => router.push("/courses")}>
            <ArrowLeft className="size-4 mr-2" /> Back to Courses
          </Button>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="max-w-7xl mx-auto py-8 px-4">
        <div className="text-center py-12">
          <div className="text-lg font-semibold mb-2">Course not found</div>
          <Button variant="outline" onClick={() => router.push("/courses")}>
            <ArrowLeft className="size-4 mr-2" /> Back to Courses
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/courses")}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{course.title}</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              {course.category && <Badge variant="outline">{course.category}</Badge>}
              {course.level && <Badge variant="outline">{course.level}</Badge>}
            </div>
          </div>
        </div>
        {canCreateSession && (
          <Dialog open={createSessionOpen} onOpenChange={setCreateSessionOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary" size="sm">
                <Plus className="size-4 mr-2" /> Add Course Session
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create Session</DialogTitle>
                <DialogDescription>
                  Schedule a new learning session for this course.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={onCreateSession} className="grid gap-4 py-4">
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
                                  setForm((f) => ({
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
                                        setForm((f) => ({
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
                                      {isSelected && <Check className="size-4 text-primary" />}
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
                    <Label htmlFor="duration">Duration (minutes)</Label>
                    <Input
                      id="duration"
                      type="number"
                      min={1}
                      value={form.duration}
                      onChange={(e) => setForm((f) => ({ ...f, duration: Number(e.target.value) || 60 }))}
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setCreateSessionOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={form.selectedStudents.length === 0}>
                    Create Session
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="size-5 text-destructive shrink-0" />
          <div className="text-sm text-destructive">{error}</div>
        </div>
      )}

      {/* Cover Image */}
      {course.cover_image && (
        <div className="relative w-full h-64 rounded-lg overflow-hidden border">
          <img 
            src={course.cover_image} 
            alt={course.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Content Area */}
        <div className="lg:col-span-3 space-y-6">
          <Tabs value={activeTab} onValueChange={(v) => handleTabChange(v as "overview" | "schedule" | "files")} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview" className="gap-2">
                <BookOpen className="size-4" />
                <span>Overview</span>
              </TabsTrigger>
              <TabsTrigger value="schedule" className="gap-2">
                <CalendarDays className="size-4" />
                <span>Schedule</span>
              </TabsTrigger>
              {canUploadFiles && (
                <TabsTrigger value="files" className="gap-2">
                  <FileText className="size-4" />
                  <span>Files</span>
                </TabsTrigger>
              )}
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Course Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {course.description || "No description provided."}
                  </div>
                </CardContent>
              </Card>

              {course.what_students_will_learn && course.what_students_will_learn.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>What Students Will Learn</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {course.what_students_will_learn.map((point, idx) => (
                        <li key={idx} className="flex items-start gap-3 text-sm">
                          <CheckCircle2 className="size-4 text-primary mt-0.5 shrink-0" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

            </TabsContent>

            {/* Schedule Tab - Combined Curriculum & Schedule */}
            <TabsContent value="schedule" className="space-y-6 mt-6">
              {sessionsLoading ? (
                <Card>
                  <CardContent className="p-12 text-center text-muted-foreground">
                    Loading schedule...
                  </CardContent>
                </Card>
              ) : !curriculumItems || curriculumItems.length === 0 ? (
                <Card>
                  <CardContent className="p-12 text-center text-muted-foreground">
                    <Calendar className="size-12 mx-auto mb-4 opacity-50" />
                    <p>No schedule items yet.</p>
                    <div className="mt-2 text-xs">
                      Sessions: {sessions.length}, Assignments: {assignments.length}, Quizzes: {quizzes.length}
                    </div>
                  </CardContent>
                </Card>
              ) : course?.tenure_start && weekGroupsWithItems.length > 0 ? (
                // Show week-grouped view if tenure_start is set and we have week groups
                <div className="space-y-6">
                  {weekGroupsWithItems.map(week => (
                    <Card key={week.label}>
                      <CardHeader>
                        <CardTitle className="text-base">
                          {week.label}
                          <span className="text-sm font-normal text-muted-foreground ml-2">
                            ({week.start.toLocaleDateString()} - {week.end.toLocaleDateString()})
                          </span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {week.items.map(item => (
                            <div
                              key={item.id}
                              className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                            >
                              <div className="mt-1">
                                {item.type === 'lecture' && (
                                  <div className="size-10 rounded-full bg-blue-100 flex items-center justify-center">
                                    <BookOpen className="size-5 text-blue-700" />
                                  </div>
                                )}
                                {item.type === 'assignment' && (
                                  <div className="size-10 rounded-full bg-orange-100 flex items-center justify-center">
                                    <FileText className="size-5 text-orange-700" />
                                  </div>
                                )}
                                {item.type === 'quiz' && (
                                  <div className="size-10 rounded-full bg-purple-100 flex items-center justify-center">
                                    <HelpCircle className="size-5 text-purple-700" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 space-y-2">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <div className="flex items-center gap-2 mb-1">
                                      <h3 className="font-semibold">{item.title}</h3>
                                      <Badge variant="outline" className="text-xs">
                                        {item.type === 'lecture' && 'Session'}
                                        {item.type === 'assignment' && 'Assignment'}
                                        {item.type === 'quiz' && 'Quiz'}
                                      </Badge>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                      <div className="flex items-center gap-1">
                                        <Calendar className="size-3" />
                                        {new Date(item.scheduledAt).toLocaleString()}
                                      </div>
                                      {item.duration && (
                                        <div className="flex items-center gap-1">
                                          <Clock className="size-3" />
                                          {item.duration} min
                                        </div>
                                      )}
                                      {item.totalMarks && (
                                        <div className="flex items-center gap-1">
                                          <span>{item.totalMarks} marks</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    asChild
                                  >
                                    <a
                                      href={
                                        item.type === 'lecture'
                                          ? `/sessions`
                                          : item.type === 'assignment'
                                          ? `/assignments`
                                          : `/quizzes`
                                      }
                                    >
                                      View
                                    </a>
                                  </Button>
                                </div>
                                {item.description && (
                                  <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
                                    {item.description}
                                  </div>
                                )}
                                {(item.type === 'assignment' || item.type === 'quiz') && (
                                  <div className="flex items-center gap-4 text-xs">
                                    {item.totalMarks && (
                                      <div>
                                        <span className="text-muted-foreground">Total Marks: </span>
                                        <span className="font-medium">{item.totalMarks}</span>
                                      </div>
                                    )}
                                    {item.minPassMarks && (
                                      <div>
                                        <span className="text-muted-foreground">Pass Marks: </span>
                                        <span className="font-medium">{item.minPassMarks}</span>
                                      </div>
                                    )}
                                    {item.attachmentRequired && (
                                      <Badge variant="secondary" className="text-xs">Attachment Required</Badge>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                // Fallback: Show items in a simple list if week grouping didn't work or no tenure_start
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {course?.tenure_start ? 'All Schedule Items' : 'Schedule Items (Set start date to group by week)'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {curriculumItems.length === 0 ? (
                      <div className="text-center text-muted-foreground py-8">
                        <Calendar className="size-12 mx-auto mb-4 opacity-50" />
                        <p>No schedule items yet.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {curriculumItems.map(item => (
                          <div
                            key={item.id}
                            className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                          >
                            <div className="mt-1">
                              {item.type === 'lecture' && (
                                <div className="size-10 rounded-full bg-blue-100 flex items-center justify-center">
                                  <BookOpen className="size-5 text-blue-700" />
                                </div>
                              )}
                              {item.type === 'assignment' && (
                                <div className="size-10 rounded-full bg-orange-100 flex items-center justify-center">
                                  <FileText className="size-5 text-orange-700" />
                                </div>
                              )}
                              {item.type === 'quiz' && (
                                <div className="size-10 rounded-full bg-purple-100 flex items-center justify-center">
                                  <HelpCircle className="size-5 text-purple-700" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 space-y-2">
                              <div className="flex items-start justify-between">
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-semibold">{item.title}</h3>
                                    <Badge variant="outline" className="text-xs">
                                      {item.type === 'lecture' && 'Session'}
                                      {item.type === 'assignment' && 'Assignment'}
                                      {item.type === 'quiz' && 'Quiz'}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                    <div className="flex items-center gap-1">
                                      <Calendar className="size-3" />
                                      {new Date(item.scheduledAt).toLocaleString()}
                                    </div>
                                    {item.duration && (
                                      <div className="flex items-center gap-1">
                                        <Clock className="size-3" />
                                        {item.duration} min
                                      </div>
                                    )}
                                    {item.totalMarks && (
                                      <div className="flex items-center gap-1">
                                        <span>{item.totalMarks} marks</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  asChild
                                >
                                  <a
                                    href={
                                      item.type === 'lecture'
                                        ? `/sessions`
                                        : item.type === 'assignment'
                                        ? `/assignments`
                                        : `/quizzes`
                                    }
                                  >
                                    View
                                  </a>
                                </Button>
                              </div>
                              {item.description && (
                                <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
                                  {item.description}
                                </div>
                              )}
                              {(item.type === 'assignment' || item.type === 'quiz') && (
                                <div className="flex items-center gap-4 text-xs">
                                  {item.totalMarks && (
                                    <div>
                                      <span className="text-muted-foreground">Total Marks: </span>
                                      <span className="font-medium">{item.totalMarks}</span>
                                    </div>
                                  )}
                                  {item.minPassMarks && (
                                    <div>
                                      <span className="text-muted-foreground">Pass Marks: </span>
                                      <span className="font-medium">{item.minPassMarks}</span>
                                    </div>
                                  )}
                                  {item.attachmentRequired && (
                                    <Badge variant="secondary" className="text-xs">Attachment Required</Badge>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Files Tab */}
            {canUploadFiles && (
              <TabsContent value="files" className="space-y-6 mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Upload Files</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3">
                      <Input
                        type="file"
                        onChange={onUploadFile}
                        disabled={uploading}
                        className="cursor-pointer"
                      />
                      {uploading && (
                        <div className="text-sm text-muted-foreground">Uploading...</div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {filesLoading ? (
                  <Card>
                    <CardContent className="p-12 text-center text-muted-foreground">
                      Loading files...
                    </CardContent>
                  </Card>
                ) : files.length > 0 ? (
                  <div className="space-y-3">
                    {files.map(f => (
                      <Card key={f.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <FileText className="size-5 text-muted-foreground" />
                              <div>
                                <div className="font-medium">{f.file_name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {new Date(f.created_at).toLocaleString()}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button variant="ghost" size="icon" asChild>
                                <a href={f.file_path} target="_blank" rel="noreferrer">
                                  <Download className="size-4" />
                                </a>
                              </Button>
                              {canDeleteFiles && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => onDeleteFile(f.id)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="p-12 text-center text-muted-foreground">
                      <FileText className="size-12 mx-auto mb-4 opacity-50" />
                      <p>No files uploaded yet.</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            )}
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Course Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {course.teacher?.user && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Instructor</Label>
                  <div className="flex items-center gap-3">
                    <Avatar className="size-8">
                      <AvatarImage src={course.teacher.user.image_url || undefined} />
                      <AvatarFallback>{course.teacher.user.name?.[0] || 'T'}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="text-sm font-medium">{course.teacher.user.name || "Unassigned"}</div>
                      <div className="text-xs text-muted-foreground">{course.teacher.user.email}</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Enrolled Students</Label>
                <div className="flex items-center gap-2">
                  <Users className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{course.students.length}</span>
                </div>
                {course.students.length > 0 && (
                  <div className="flex -space-x-2 mt-2">
                    {course.students.slice(0, 5).map(s => (
                      <Avatar key={s.id} className="size-8 border-2 border-background">
                        <AvatarImage src={s.image_url || undefined} />
                        <AvatarFallback>{s.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                    ))}
                    {course.students.length > 5 && (
                      <div className="size-8 rounded-full border-2 border-background bg-muted flex items-center justify-center text-xs font-medium">
                        +{course.students.length - 5}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Sessions</span>
                <span className="text-sm font-medium">{sessions.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Assignments</span>
                <span className="text-sm font-medium">{assignments.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Quizzes</span>
                <span className="text-sm font-medium">{quizzes.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Files</span>
                <span className="text-sm font-medium">{files.length}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
