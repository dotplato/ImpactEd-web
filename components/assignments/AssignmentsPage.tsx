"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import {
    LayoutGrid,
    Plus,
    Search,
    Check,
    Clock,
    FileText,
    Upload,
    X,
    Loader2,
    Calendar as CalendarIcon,
    AlertCircle,
    Download,
    ExternalLink,
    User,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { supabaseClient } from "@/lib/db/supabase-client";
import { toast } from "sonner";

interface Student {
    id: string;
    name: string;
    email: string;
    image_url?: string | null;
}

interface Assignment {
    id: string;
    title: string;
    description_richjson: any;
    due_at: string | null;
    total_marks: number | null;
    min_pass_marks: number | null;
    created_at: string;
    course: {
        id: string;
        title: string;
    };
    students: {
        student: Student;
    }[];
    attachments: {
        id: string;
        file_path: string;
        file_name: string;
        mime: string | null;
    }[];
}

interface AssignmentsPageProps {
    role: "admin" | "teacher" | "student";
}

export default function AssignmentsPage({ role }: AssignmentsPageProps) {
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [selectionDialogOpen, setSelectionDialogOpen] = useState(false);
    const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);
    const [enrolledStudents, setEnrolledStudents] = useState<Student[]>([]);
    const [courseIdToStudents, setCourseIdToStudents] = useState<Record<string, Student[]>>({});
    const [studentSearch, setStudentSearch] = useState("");
    const [uploading, setUploading] = useState(false);
    const [submitOpen, setSubmitOpen] = useState(false);
    const [viewOpen, setViewOpen] = useState(false);
    const [reviewOpen, setReviewOpen] = useState(false);
    const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
    const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
    const [gradeValue, setGradeValue] = useState("");
    const [submissions, setSubmissions] = useState<Record<string, any>>({});
    const [selectedCourseId, setSelectedCourseId] = useState<string>("all");

    const [form, setForm] = useState({
        title: "",
        description: "",
        courseId: "",
        dueAt: "",
        totalMarks: "",
        minPassMarks: "",
        selectedStudents: [] as string[],
        attachments: [] as { filePath: string; fileName: string; mime?: string }[],
    });

    const { todayAssignments, upcomingAssignments, pastAssignments } = useMemo(() => {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);

        const t: Assignment[] = [];
        const u: Assignment[] = [];
        const p: Assignment[] = [];

        const filtered = selectedCourseId === "all"
            ? assignments
            : assignments.filter(a => a.course?.id === selectedCourseId);

        for (const a of filtered) {
            if (!a.due_at) {
                u.push(a);
                continue;
            }
            const d = new Date(a.due_at);
            if (d >= startOfToday && d <= endOfToday) {
                t.push(a);
            } else if (d > endOfToday) {
                u.push(a);
            } else {
                p.push(a);
            }
        }

        t.sort((a, b) => new Date(a.due_at!).getTime() - new Date(b.due_at!).getTime());
        u.sort((a, b) => new Date(a.due_at!).getTime() - new Date(b.due_at!).getTime());
        p.sort((a, b) => new Date(b.due_at!).getTime() - new Date(a.due_at!).getTime());

        return { todayAssignments: t, upcomingAssignments: u, pastAssignments: p };
    }, [assignments, selectedCourseId]);

    const [submitForm, setSubmitForm] = useState({
        content: "",
        attachments: [] as { filePath: string; fileName: string; mime?: string }[],
    });

    const canCreate = role === "admin" || role === "teacher";

    useEffect(() => {
        loadAssignments();
        preloadCoursesAndStudents();
    }, [role]);

    async function loadAssignments() {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/assignments");
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "Failed to load assignments");
            setAssignments(data.assignments || []);

            // Load submissions for students
            if (role === "student") {
                const subs: Record<string, any> = {};
                (data.assignments || []).forEach((a: any) => {
                    if (a.submissions?.[0]) {
                        subs[a.id] = a.submissions[0];
                    }
                });
                setSubmissions(subs);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    async function preloadCoursesAndStudents() {
        try {
            const res = await fetch("/api/courses");
            if (!res.ok) return;
            const payload = await res.json();
            const list = payload?.courses ?? payload ?? [];
            const mapped = (Array.isArray(list) ? list : []).map((c: any) => ({ id: c.id, title: c.title }));
            setCourses(mapped);

            const studentsEntries: [string, Student[]][] = await Promise.all(
                mapped.map(async (course: any) => {
                    try {
                        const r = await fetch(`/api/courses/${course.id}/students`);
                        if (!r.ok) return [course.id, []] as [string, Student[]];
                        const p = await r.json();
                        return [course.id, (p.students || []) as Student[]] as [string, Student[]];
                    } catch {
                        return [course.id, []] as [string, Student[]];
                    }
                })
            );

            const map: Record<string, Student[]> = {};
            for (const [cid, arr] of studentsEntries) map[cid] = arr;
            setCourseIdToStudents(map);
        } catch (err) {
            console.error("Failed to preload courses/students", err);
        }
    }

    async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const fileExt = file.name.split(".").pop();
            const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `assignments/${fileName}`;

            console.log("Uploading file to assignment-attachments:", filePath);
            const { error: uploadError, data } = await supabaseClient.storage
                .from("assignment-attachments")
                .upload(filePath, file);

            if (uploadError) {
                console.error("Upload error:", uploadError);
                throw uploadError;
            }
            console.log("Upload success:", data);

            setForm(f => ({
                ...f,
                attachments: [...f.attachments, { filePath, fileName: file.name, mime: file.type }]
            }));
            toast.success("File uploaded successfully");
        } catch (err: any) {
            toast.error(err.message || "Failed to upload file");
        } finally {
            setUploading(false);
        }
    }

    async function handleSubmissionUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const fileExt = file.name.split(".").pop();
            const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `submissions/${fileName}`;

            console.log("Uploading file to submission-attachments:", filePath);
            const { error: uploadError, data } = await supabaseClient.storage
                .from("submission-attachments")
                .upload(filePath, file);

            if (uploadError) {
                console.error("Upload error:", uploadError);
                throw uploadError;
            }
            console.log("Upload success:", data);

            setSubmitForm(f => ({
                ...f,
                attachments: [...f.attachments, { filePath, fileName: file.name, mime: file.type }]
            }));
            toast.success("File uploaded successfully");
        } catch (err: any) {
            toast.error(err.message || "Failed to upload file");
        } finally {
            setUploading(false);
        }
    }

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedAssignment) return;

        try {
            const res = await fetch(`/api/assignments/${selectedAssignment.id}/submit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(submitForm),
            });

            if (!res.ok) {
                const d = await res.json();
                throw new Error(d.error || "Failed to submit assignment");
            }

            setSubmitOpen(false);
            setSubmitForm({ content: "", attachments: [] });
            loadAssignments();
            toast.success("Assignment submitted successfully");
        } catch (err: any) {
            toast.error(err.message);
        }
    }

    async function onGrade(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedSubmission || !gradeValue) return;

        const grade = Number(gradeValue);
        if (isNaN(grade)) {
            toast.error("Please enter a valid number for the grade");
            return;
        }

        if (grade > (selectedAssignment?.total_marks || 0)) {
            toast.error(`Grade cannot exceed maximum marks (${selectedAssignment?.total_marks})`);
            return;
        }

        if (grade < 0) {
            toast.error("Grade cannot be negative");
            return;
        }

        try {
            const res = await fetch(`/api/submissions/${selectedSubmission.id}/grade`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ grade: Number(gradeValue) }),
            });

            if (!res.ok) {
                const d = await res.json();
                throw new Error(d.error || "Failed to save grade");
            }

            setReviewOpen(false);
            setGradeValue("");
            loadAssignments();
            toast.success("Grade saved successfully");
        } catch (err: any) {
            toast.error(err.message);
        }
    }

    async function onCreate(e: React.FormEvent) {
        e.preventDefault();
        if (!form.courseId || !form.title) return;

        if (form.dueAt && new Date(form.dueAt) < new Date()) {
            toast.error("Due date cannot be in the past");
            return;
        }

        const totalMarks = Number(form.totalMarks);
        if (form.totalMarks && (isNaN(totalMarks) || totalMarks <= 0)) {
            toast.error("Total marks must be a positive number");
            return;
        }

        try {
            const res = await fetch("/api/assignments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: form.title,
                    description: form.description,
                    courseId: form.courseId,
                    dueAt: form.dueAt,
                    totalMarks: Number(form.totalMarks),
                    minPassMarks: Number(form.minPassMarks),
                    selectedStudents: form.selectedStudents,
                    attachments: form.attachments,
                }),
            });

            if (!res.ok) {
                const d = await res.json();
                throw new Error(d.error || "Failed to create assignment");
            }

            setCreateOpen(false);
            setForm({
                title: "",
                description: "",
                courseId: "",
                dueAt: "",
                totalMarks: "",
                minPassMarks: "",
                selectedStudents: [],
                attachments: [],
            });
            loadAssignments();
            toast.success("Assignment created successfully");
        } catch (err: any) {
            toast.error(err.message);
        }
    }

    function renderAssignmentTable(list: Assignment[], emptyMessage: string) {
        if (list.length === 0) {
            return <p className="text-sm text-muted-foreground text-center py-8 border rounded-lg border-dashed">{emptyMessage}</p>;
        }

        return (
            <Card className="px-2">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Assignment</TableHead>
                            <TableHead>Course</TableHead>
                            <TableHead>Due Date</TableHead>
                            <TableHead>Marks</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {list.map((a) => {
                            const submission = (a as any).submissions?.[0] || submissions[a.id];
                            const isSubmitted = !!submission;

                            return (
                                <TableRow key={a.id}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            <FileText className="size-4 text-primary" />
                                            {a.title}
                                        </div>
                                    </TableCell>
                                    <TableCell>{a.course?.title || "-"}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2 text-xs">
                                            <Clock className="size-3.5 text-muted-foreground" />
                                            {formatDueDate(a.due_at)}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {a.total_marks ? (
                                            <Badge variant="outline" className="font-mono">
                                                {submission?.grade !== undefined && submission?.grade !== null ? submission.grade : "-"} / {a.total_marks}
                                            </Badge>
                                        ) : "-"}
                                    </TableCell>
                                    <TableCell>
                                        {isSubmitted ? (
                                            submission.status === 'graded' ? (
                                                <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Graded</Badge>
                                            ) : (
                                                <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Submitted</Badge>
                                            )
                                        ) : (
                                            <Badge variant="secondary">Pending</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {role === "student" && !isSubmitted && (
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => {
                                                        setSelectedAssignment(a);
                                                        setSubmitOpen(true);
                                                    }}
                                                >
                                                    Submit
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    setSelectedAssignment(a);
                                                    setViewOpen(true);
                                                }}
                                            >
                                                View
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </Card>
        );
    }

    const formatDueDate = (date: string | null) => {
        if (!date) return "No deadline";
        return new Date(date).toLocaleString([], {
            dateStyle: "medium",
            timeStyle: "short",
        });
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Assignments</h1>
                    <p className="text-muted-foreground">Manage and track student assignments.</p>
                </div>

                <div className="flex items-center gap-2">
                    <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                        <SelectTrigger className="w-[200px] h-9">
                            <SelectValue placeholder="Filter by Course" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Courses</SelectItem>
                            {courses.map((c) => (
                                <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {canCreate && (
                        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                            <DialogTrigger asChild>
                                <Button variant="secondary" size="sm" className="gap-1">
                                    <Plus className="size-4" /> Add Assignment
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle>Add Assignment</DialogTitle>
                                    <DialogDescription>
                                        Please add assignment contents below.
                                    </DialogDescription>
                                </DialogHeader>
                                <form onSubmit={onCreate} className="grid gap-6 py-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="title" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                            * Assignment Name
                                        </Label>
                                        <Input
                                            id="title"
                                            value={form.title}
                                            onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                                            placeholder="Introduce about Product Design"
                                            required
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="course" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                            * Course
                                        </Label>
                                        <Select
                                            value={form.courseId}
                                            onValueChange={(val) => {
                                                setForm(f => ({ ...f, courseId: val, selectedStudents: [] }));
                                                setEnrolledStudents(courseIdToStudents[val] || []);
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

                                    <div className="grid gap-2">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                                * Assign To
                                            </Label>
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
                                                            disabled={!form.courseId}
                                                        >
                                                            <Plus className="size-4" />
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden gap-0">
                                                        <DialogHeader className="p-6 pb-2">
                                                            <DialogTitle>Select Students</DialogTitle>
                                                            <DialogDescription>
                                                                Assign this assignment to specific students.
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
                                                                        setForm(f => ({
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
                                                                                    setForm(f => ({
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

                                    <div className="grid gap-2">
                                        <Label htmlFor="description" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                            * Add Description
                                        </Label>
                                        <Textarea
                                            id="description"
                                            value={form.description}
                                            onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                                            placeholder="Assignment instructions..."
                                            className="min-h-[120px]"
                                            required
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="dueAt" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                            Time Duration
                                        </Label>
                                        <Input
                                            id="dueAt"
                                            type="datetime-local"
                                            value={form.dueAt}
                                            onChange={(e) => setForm(f => ({ ...f, dueAt: e.target.value }))}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="totalMarks" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                                * Total Marks
                                            </Label>
                                            <Input
                                                id="totalMarks"
                                                type="number"
                                                value={form.totalMarks}
                                                onChange={(e) => setForm(f => ({ ...f, totalMarks: e.target.value }))}
                                                placeholder="Set total marks"
                                                required
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="minPassMarks" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                                * Minimum Pass Marks
                                            </Label>
                                            <Input
                                                id="minPassMarks"
                                                type="number"
                                                value={form.minPassMarks}
                                                onChange={(e) => setForm(f => ({ ...f, minPassMarks: e.target.value }))}
                                                placeholder="Set pass marks"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                            Attachment File
                                        </Label>
                                        <div className="border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center gap-2 bg-muted/5">
                                            <Upload className="size-8 text-muted-foreground" />
                                            <div className="text-sm text-center">
                                                <span className="font-medium">Drag and drop a image, or </span>
                                                <label className="text-primary cursor-pointer hover:underline">
                                                    Browse
                                                    <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                                                </label>
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                Allowed file types: PNG, JPEG, JPG, GIF, PLAIN, HTML, DOCX, PDF
                                            </p>
                                            {uploading && <Loader2 className="size-4 animate-spin text-primary" />}
                                        </div>
                                        {form.attachments.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {form.attachments.map((att, i) => (
                                                    <Badge key={i} variant="secondary" className="gap-1 pr-1">
                                                        {att.fileName}
                                                        <X
                                                            className="size-3 cursor-pointer hover:text-destructive"
                                                            onClick={() => setForm(f => ({
                                                                ...f,
                                                                attachments: f.attachments.filter((_, idx) => idx !== i)
                                                            }))}
                                                        />
                                                    </Badge>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <DialogFooter>
                                        <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                                        <Button
                                            type="submit"
                                            disabled={
                                                !form.title ||
                                                !form.courseId ||
                                                !form.description ||
                                                !form.totalMarks ||
                                                !form.minPassMarks ||
                                                form.selectedStudents.length === 0
                                            }
                                        >
                                            Save Assignment
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>
                    )}
                </div>
            </div>

            {
                error && (
                    <div className="bg-destructive/10 text-destructive p-4 rounded-lg flex items-center gap-2">
                        <AlertCircle className="size-4" />
                        <p className="text-sm">{error}</p>
                    </div>
                )
            }

            {
                loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="size-8 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="space-y-8">
                        {/* Today */}
                        <section className="space-y-4">
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="rounded-full px-3 py-1 text-[10px] uppercase tracking-wider font-bold">Today</Badge>
                                <div className="h-px flex-1 bg-border" />
                            </div>
                            {renderAssignmentTable(todayAssignments, "No assignments due today.")}
                        </section>

                        {/* Upcoming */}
                        <section className="space-y-4">
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="rounded-full px-3 py-1 text-[10px] uppercase tracking-wider font-bold">Upcoming</Badge>
                                <div className="h-px flex-1 bg-border" />
                            </div>
                            {renderAssignmentTable(upcomingAssignments, "No upcoming assignments.")}
                        </section>

                        {/* Past */}
                        <section className="space-y-4">
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="rounded-full px-3 py-1 text-[10px] uppercase tracking-wider font-bold">Past</Badge>
                                <div className="h-px flex-1 bg-border" />
                            </div>
                            {renderAssignmentTable(pastAssignments, "No past assignments.")}
                        </section>
                    </div>
                )
            }

            {/* Submit Assignment Dialog */}
            <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Submit Assignment</DialogTitle>
                        <DialogDescription>
                            {selectedAssignment?.title}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={onSubmit} className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="submit-content">Your Answer / Comments</Label>
                            <Textarea
                                id="submit-content"
                                value={submitForm.content}
                                onChange={(e) => setSubmitForm(f => ({ ...f, content: e.target.value }))}
                                placeholder="Type your answer or any comments here..."
                                className="min-h-[150px]"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Attachments</Label>
                            <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center gap-2 bg-muted/5">
                                <Upload className="size-6 text-muted-foreground" />
                                <div className="text-xs text-center">
                                    <label className="text-primary cursor-pointer hover:underline">
                                        Click to upload
                                        <input type="file" className="hidden" onChange={handleSubmissionUpload} disabled={uploading} />
                                    </label>
                                </div>
                                {uploading && <Loader2 className="size-4 animate-spin text-primary" />}
                            </div>
                            {submitForm.attachments.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {submitForm.attachments.map((att, i) => (
                                        <Badge key={i} variant="secondary" className="gap-1 pr-1">
                                            {att.fileName}
                                            <X
                                                className="size-3 cursor-pointer hover:text-destructive"
                                                onClick={() => setSubmitForm(f => ({
                                                    ...f,
                                                    attachments: f.attachments.filter((_, idx) => idx !== i)
                                                }))}
                                            />
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setSubmitOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={uploading}>Submit Assignment</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* View Assignment Dialog */}
            <Dialog open={viewOpen} onOpenChange={setViewOpen}>
                <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{selectedAssignment?.title}</DialogTitle>
                        <DialogDescription>
                            Assignment details and instructions.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Course</Label>
                                <p className="text-sm font-medium">{selectedAssignment?.course?.title || "-"}</p>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Due Date</Label>
                                <div className="flex items-center gap-2 text-sm font-medium">
                                    <Clock className="size-3.5 text-muted-foreground" />
                                    {formatDueDate(selectedAssignment?.due_at || null)}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Marks</Label>
                                <p className="text-sm font-medium">
                                    {selectedAssignment?.min_pass_marks || 0} / {selectedAssignment?.total_marks || "-"}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Instructions</Label>
                            <div className="text-sm bg-muted/30 p-4 rounded-lg whitespace-pre-wrap">
                                {selectedAssignment?.description_richjson || "No instructions provided."}
                            </div>
                        </div>

                        {selectedAssignment?.attachments && selectedAssignment.attachments.length > 0 && (
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Attachments</Label>
                                <div className="grid gap-2">
                                    {selectedAssignment.attachments.map((att) => (
                                        <div key={att.id} className="flex items-center justify-between p-2 border rounded-lg bg-background">
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                <FileText className="size-4 text-primary shrink-0" />
                                                <span className="text-xs truncate">{att.file_name}</span>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="size-8"
                                                asChild
                                            >
                                                <a
                                                    href={supabaseClient.storage.from('assignment-attachments').getPublicUrl(att.file_path).data.publicUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    download={att.file_name}
                                                >
                                                    <Download className="size-4" />
                                                </a>
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Teacher View: Submissions List */}
                        {canCreate && (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs text-muted-foreground">Submissions</Label>
                                    <Badge variant="outline" className="text-[10px]">
                                        {(selectedAssignment as any)?.submissions?.length || 0} / {selectedAssignment?.students?.length || 0}
                                    </Badge>
                                </div>
                                <div className="border rounded-lg overflow-hidden">
                                    <Table>
                                        <TableHeader className="bg-muted/50">
                                            <TableRow>
                                                <TableHead className="h-8 text-[10px] uppercase">Student</TableHead>
                                                <TableHead className="h-8 text-[10px] uppercase">Status</TableHead>
                                                <TableHead className="h-8 text-[10px] uppercase">Grade</TableHead>
                                                <TableHead className="h-8 text-[10px] uppercase text-right">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {selectedAssignment?.students?.map((s: any) => {
                                                const sub = (selectedAssignment as any).submissions?.find((sub: any) => sub.student_id === s.student.id);
                                                return (
                                                    <TableRow key={s.student.id}>
                                                        <TableCell className="py-2">
                                                            <div className="flex items-center gap-2">
                                                                <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold">
                                                                    {s.student.user?.name?.[0] || "?"}
                                                                </div>
                                                                <span className="text-xs font-medium">{s.student.user?.name}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="py-2">
                                                            {sub ? (
                                                                sub.status === 'graded' ? (
                                                                    <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 text-[10px] h-5">Graded</Badge>
                                                                ) : (
                                                                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-[10px] h-5">Submitted</Badge>
                                                                )
                                                            ) : (
                                                                <Badge variant="secondary" className="text-[10px] h-5">Pending</Badge>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="py-2">
                                                            {sub?.grade !== undefined && sub?.grade !== null ? (
                                                                <span className="text-sm font-bold text-blue-600">
                                                                    {sub.grade} / {selectedAssignment?.total_marks}
                                                                </span>
                                                            ) : (
                                                                <span className="text-xs text-muted-foreground">-</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="py-2 text-right">
                                                            {sub && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-7 text-[10px]"
                                                                    onClick={() => {
                                                                        setSelectedSubmission(sub);
                                                                        setGradeValue(sub.grade?.toString() || "");
                                                                        setReviewOpen(true);
                                                                    }}
                                                                >
                                                                    Review
                                                                </Button>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}

                        {/* Student View: My Submission */}
                        {role === "student" && (
                            <div className="space-y-3">
                                <Label className="text-xs text-muted-foreground">My Submission</Label>
                                {submissions[selectedAssignment?.id || ""] ? (
                                    <div className="p-4 border rounded-lg bg-green-50/30 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                {submissions[selectedAssignment?.id || ""].status === 'graded' ? (
                                                    <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Graded</Badge>
                                                ) : (
                                                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Submitted</Badge>
                                                )}
                                                {submissions[selectedAssignment?.id || ""].grade !== null && (
                                                    <Badge variant="outline" className="border-blue-200 text-blue-700">
                                                        Score: {submissions[selectedAssignment?.id || ""].grade} / {selectedAssignment?.total_marks}
                                                    </Badge>
                                                )}
                                            </div>
                                            <span className="text-xs text-muted-foreground">
                                                {new Date(submissions[selectedAssignment?.id || ""].submitted_at).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="text-sm whitespace-pre-wrap">
                                            {submissions[selectedAssignment?.id || ""].content_richjson}
                                        </div>
                                        {submissions[selectedAssignment?.id || ""].attachments && submissions[selectedAssignment?.id || ""].attachments.length > 0 && (
                                            <div className="space-y-2 mt-4">
                                                <Label className="text-[10px] text-muted-foreground uppercase">My Attachments</Label>
                                                <div className="grid gap-2">
                                                    {submissions[selectedAssignment?.id || ""].attachments.map((att: any) => (
                                                        <div key={att.id} className="flex items-center justify-between p-2 border rounded-lg bg-background">
                                                            <div className="flex items-center gap-2 overflow-hidden">
                                                                <FileText className="size-4 text-primary shrink-0" />
                                                                <span className="text-xs truncate">{att.file_name}</span>
                                                            </div>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="size-8"
                                                                asChild
                                                            >
                                                                <a
                                                                    href={supabaseClient.storage.from('submission-attachments').getPublicUrl(att.file_path).data.publicUrl}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    download={att.file_name}
                                                                >
                                                                    <Download className="size-4" />
                                                                </a>
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="p-8 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 text-muted-foreground">
                                        <AlertCircle className="size-6" />
                                        <p className="text-xs">You haven't submitted this assignment yet.</p>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="mt-2"
                                            onClick={() => {
                                                setViewOpen(false);
                                                setSubmitOpen(true);
                                            }}
                                        >
                                            Submit Now
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button onClick={() => setViewOpen(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Review Submission Dialog */}
            <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Review Submission</DialogTitle>
                        <DialogDescription>
                            Review student's work and provide a grade.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Student's Answer</Label>
                            <div className="text-sm bg-muted/30 p-4 rounded-lg whitespace-pre-wrap min-h-[100px]">
                                {selectedSubmission?.content_richjson || "No text provided."}
                            </div>
                        </div>

                        {selectedSubmission?.attachments && selectedSubmission.attachments.length > 0 && (
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Submitted Files</Label>
                                <div className="grid gap-2">
                                    {selectedSubmission.attachments.map((att: any) => (
                                        <div key={att.id} className="flex items-center justify-between p-2 border rounded-lg bg-background">
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                <FileText className="size-4 text-primary shrink-0" />
                                                <span className="text-xs truncate">{att.file_name}</span>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="size-8"
                                                asChild
                                            >
                                                <a
                                                    href={supabaseClient.storage.from('submission-attachments').getPublicUrl(att.file_path).data.publicUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    download={att.file_name}
                                                >
                                                    <Download className="size-4" />
                                                </a>
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <form onSubmit={onGrade} className="space-y-4 pt-4 border-t">
                            <div className="grid gap-2">
                                <Label htmlFor="grade">Grade / Marks (Max: {selectedAssignment?.total_marks || "-"})</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="grade"
                                        type="number"
                                        value={gradeValue}
                                        onChange={(e) => setGradeValue(e.target.value)}
                                        placeholder="Enter grade..."
                                        className="max-w-[150px]"
                                    />
                                    <Button type="submit" className="flex-1">Save Grade</Button>
                                </div>
                            </div>
                        </form>
                    </div>
                </DialogContent>
            </Dialog>
        </div >
    );
}
