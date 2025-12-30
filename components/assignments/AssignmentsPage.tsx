"use client";

import { useEffect, useState, useRef } from "react";
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
    const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
    const [submissions, setSubmissions] = useState<Record<string, any>>({});

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

    const [submitForm, setSubmitForm] = useState({
        content: "",
        attachments: [] as { filePath: string; fileName: string; mime?: string }[],
    });

    const canCreate = role === "admin" || role === "teacher";

    useEffect(() => {
        loadAssignments();
        if (canCreate) {
            preloadCoursesAndStudents();
        }
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
            const res = await fetch("/api/admin/courses");
            if (!res.ok) return;
            const payload = await res.json();
            const list = payload?.courses ?? payload ?? [];
            const mapped = (Array.isArray(list) ? list : []).map((c: any) => ({ id: c.id, title: c.title }));
            setCourses(mapped);

            const studentsEntries: [string, Student[]][] = await Promise.all(
                mapped.map(async (course: any) => {
                    try {
                        const r = await fetch(`/api/admin/courses/${course.id}/students`);
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

            const { error: uploadError } = await supabaseClient.storage
                .from("assignment-attachments")
                .upload(filePath, file);

            if (uploadError) throw uploadError;

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

            const { error: uploadError } = await supabaseClient.storage
                .from("submission-attachments")
                .upload(filePath, file);

            if (uploadError) throw uploadError;

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

    async function onCreate(e: React.FormEvent) {
        e.preventDefault();
        if (!form.courseId || !form.title) return;

        try {
            const res = await fetch("/api/assignments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...form,
                    totalMarks: form.totalMarks ? Number(form.totalMarks) : undefined,
                    minPassMarks: form.minPassMarks ? Number(form.minPassMarks) : undefined,
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
                                    <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                                    <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={!form.title || !form.courseId || form.selectedStudents.length === 0}>
                                        Save Assignment
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            {error && (
                <div className="bg-destructive/10 text-destructive p-4 rounded-lg flex items-center gap-2">
                    <AlertCircle className="size-4" />
                    <p className="text-sm">{error}</p>
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="size-8 animate-spin text-muted-foreground" />
                </div>
            ) : (
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
                            {assignments.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                                        No assignments found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                assignments.map((a) => {
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
                                                    <Badge variant="outline">
                                                        {submission?.grade ?? (a.min_pass_marks || 0)} / {a.total_marks}
                                                    </Badge>
                                                ) : "-"}
                                            </TableCell>
                                            <TableCell>
                                                {isSubmitted ? (
                                                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Submitted</Badge>
                                                ) : (
                                                    <Badge variant="secondary">Pending</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
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
                                                <Button variant="ghost" size="sm">View</Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </Card>
            )}

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
                            <Button variant="outline" onClick={() => setSubmitOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={uploading}>Submit Assignment</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
