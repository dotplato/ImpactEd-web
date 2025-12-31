"use client";

import { useEffect, useState } from "react";
import {
    Plus,
    Search,
    Check,
    Clock,
    HelpCircle,
    Loader2,
    AlertCircle,
    Trash2,
    Paperclip,
    FileIcon,
    XCircle,
    Download,
    Eye,
} from "lucide-react";
import { supabaseClient } from "@/lib/db/supabase-client";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Student {
    id: string;
    name: string;
    email: string;
    image_url?: string | null;
}

interface Question {
    questionText: string;
    questionType: string;
    options: string[];
    correctAnswer: string;
    points: number;
    sortOrder: number;
}

interface Attachment {
    name: string;
    url: string;
    type: string;
}

interface Quiz {
    id: string;
    title: string;
    description: string | null;
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
    questions: any[];
    attachments?: Attachment[];
    attachment_required: boolean;
}

interface QuizzesPageProps {
    role: "admin" | "teacher" | "student";
}

export default function QuizzesPage({ role }: QuizzesPageProps) {
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [selectionDialogOpen, setSelectionDialogOpen] = useState(false);
    const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);
    const [enrolledStudents, setEnrolledStudents] = useState<Student[]>([]);
    const [courseIdToStudents, setCourseIdToStudents] = useState<Record<string, Student[]>>({});
    const [studentSearch, setStudentSearch] = useState("");
    const [selectedCourse, setSelectedCourse] = useState<string>("all");
    const [quizOpen, setQuizOpen] = useState(false);
    const [viewOpen, setViewOpen] = useState(false);
    const [submissionsOpen, setSubmissionsOpen] = useState(false);
    const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
    const selectedQuiz = quizzes.find(q => q.id === selectedQuizId) || null;
    const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
    const [submissions, setSubmissions] = useState<Record<string, any>>({});
    const [submissionAttachments, setSubmissionAttachments] = useState<Attachment[]>([]);
    const [uploading, setUploading] = useState(false);

    const [form, setForm] = useState({
        title: "",
        description: "",
        courseId: "",
        dueAt: "",
        totalMarks: "",
        minPassMarks: "",
        selectedStudents: [] as string[],
        questions: [] as Question[],
        attachments: [] as Attachment[],
        attachmentRequired: false,
    });

    const canCreate = role === "admin" || role === "teacher";

    useEffect(() => {
        loadQuizzes();
        if (canCreate) {
            preloadCoursesAndStudents();
        }
    }, [role]);

    async function loadQuizzes() {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/quizzes");
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "Failed to load quizzes");
            setQuizzes(data.quizzes || []);

            // Load submissions for students
            if (role === "student") {
                const subs: Record<string, any> = {};
                (data.quizzes || []).forEach((q: any) => {
                    if (q.submissions?.[0]) {
                        subs[q.submissions[0].quiz_id] = q.submissions[0];
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

    function addQuestion() {
        setForm(f => ({
            ...f,
            questions: [
                ...f.questions,
                {
                    questionText: "",
                    questionType: "multiple_choice",
                    options: ["", "", "", ""],
                    correctAnswer: "",
                    points: 1,
                    sortOrder: f.questions.length,
                },
            ],
        }));
    }

    function removeQuestion(index: number) {
        setForm(f => ({
            ...f,
            questions: f.questions.filter((_, i) => i !== index),
        }));
    }

    function updateQuestion(index: number, field: keyof Question, value: any) {
        setForm(f => ({
            ...f,
            questions: f.questions.map((q, i) => (i === index ? { ...q, [field]: value } : q)),
        }));
    }

    async function uploadFile(file: File, bucket: string): Promise<Attachment | null> {
        try {
            setUploading(true);
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabaseClient.storage
                .from(bucket)
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data } = supabaseClient.storage.from(bucket).getPublicUrl(filePath);

            return {
                name: file.name,
                url: data.publicUrl,
                type: file.type
            };
        } catch (error: any) {
            toast.error(`Upload failed: ${error.message}`);
            return null;
        } finally {
            setUploading(false);
        }
    }

    async function handleAttachmentUpload(e: React.ChangeEvent<HTMLInputElement>, isSubmission = false) {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        const bucket = isSubmission ? "quiz-submission-attachments" : "quiz-attachments";

        const attachment = await uploadFile(file, bucket);
        if (attachment) {
            if (isSubmission) {
                setSubmissionAttachments(prev => [...prev, attachment]);
            } else {
                setForm(f => ({ ...f, attachments: [...(f.attachments || []), attachment] }));
            }
        }
    }

    function removeAttachment(index: number, isSubmission = false) {
        if (isSubmission) {
            setSubmissionAttachments(prev => prev.filter((_, i) => i !== index));
        } else {
            setForm(f => ({ ...f, attachments: (f.attachments || []).filter((_, i) => i !== index) }));
        }
    }

    async function onCreate(e: React.FormEvent) {
        e.preventDefault();
        if (!form.courseId || !form.title) return;

        try {
            const res = await fetch("/api/quizzes", {
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
                throw new Error(d.error || "Failed to create quiz");
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
                questions: [],
                attachments: [],
                attachmentRequired: false,
            });
            loadQuizzes();
            toast.success("Quiz created successfully");
        } catch (err: any) {
            toast.error(err.message);
        }
    }

    async function handleUpdateScore(submissionId: string, newScore: number) {
        try {
            const res = await fetch(`/api/quizzes/submissions/${submissionId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ score: newScore }),
            });

            if (!res.ok) {
                const d = await res.json();
                throw new Error(d.error || "Failed to update score");
            }

            toast.success("Score updated");
            loadQuizzes();
        } catch (err: any) {
            toast.error(err.message);
        }
    }

    async function onDelete(id: string) {
        if (!confirm("Are you sure you want to delete this quiz?")) return;
        try {
            const res = await fetch(`/api/quizzes?id=${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to delete quiz");
            toast.success("Quiz deleted");
            loadQuizzes();
        } catch (err: any) {
            toast.error(err.message);
        }
    }

    const handleExportCSV = () => {
        if (!selectedQuiz || !(selectedQuiz as any).submissions) return;

        const headers = ["Student Name", "Student Email", "Submitted At", "Score", "Attachments"];
        const rows = (selectedQuiz as any).submissions.map((sub: any) => [
            sub.student?.user?.name || "Unknown",
            sub.student?.user?.email || "",
            new Date(sub.submitted_at).toLocaleString(),
            sub.score,
            (() => {
                const atts = sub.attachments || sub.quiz_submission_attachments || [];
                return atts.map((att: any) => att.file_url).join(" | ");
            })()
        ]);

        const csvContent = [
            headers.join(","),
            ...rows.map((row: any[]) => row.map(cell => `"${cell}"`).join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `${selectedQuiz.title}_submissions.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    async function onSubmitQuiz(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedQuiz) return;

        if (selectedQuiz.attachment_required && submissionAttachments.length === 0) {
            toast.error("Attachment is required for this quiz.");
            return;
        }

        try {
            const res = await fetch(`/api/quizzes/${selectedQuiz.id}/submit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ answers: quizAnswers, attachments: submissionAttachments }),
            });

            if (!res.ok) {
                const d = await res.json();
                throw new Error(d.error || "Failed to submit quiz");
            }

            const result = await res.json();
            setQuizOpen(false);
            setQuizAnswers({});
            setSubmissionAttachments([]);
            loadQuizzes();
            toast.success(`Quiz submitted! Your score: ${result.score}`);
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
                    <h1 className="text-3xl font-bold tracking-tight">Quizzes</h1>
                    <p className="text-muted-foreground">Create and manage student quizzes.</p>
                </div>

                <div className="flex items-center gap-4">
                    <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                        <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Filter by course" />
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
                                    <Plus className="size-4" /> Add Quiz
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle>Add Quiz</DialogTitle>
                                    <DialogDescription>
                                        Create a new quiz for your students.
                                    </DialogDescription>
                                </DialogHeader>
                                <form onSubmit={onCreate} className="grid gap-6 py-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="title" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                            * Quiz Title
                                        </Label>
                                        <Input
                                            id="title"
                                            value={form.title}
                                            onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                                            placeholder="Midterm Quiz"
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
                                                                Assign this quiz to specific students.
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
                                            Description
                                        </Label>
                                        <Textarea
                                            id="description"
                                            value={form.description}
                                            onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                                            placeholder="Quiz instructions..."
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                            Attachments
                                        </Label>
                                        <div className="space-y-2">
                                            {form.attachments?.map((att, i) => (
                                                <div key={i} className="flex items-center justify-between p-2 border rounded-md bg-muted/20">
                                                    <div className="flex items-center gap-2 overflow-hidden">
                                                        <FileIcon className="size-4 text-muted-foreground flex-shrink-0" />
                                                        <span className="text-sm truncate">{att.name}</span>
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="size-6 text-muted-foreground hover:text-destructive"
                                                        onClick={() => removeAttachment(i)}
                                                    >
                                                        <XCircle className="size-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="gap-1 relative"
                                                    disabled={uploading}
                                                >
                                                    {uploading ? (
                                                        <Loader2 className="size-4 animate-spin" />
                                                    ) : (
                                                        <Paperclip className="size-4" />
                                                    )}
                                                    Attach File
                                                    <input
                                                        type="file"
                                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                                        onChange={(e) => handleAttachmentUpload(e)}
                                                        disabled={uploading}
                                                    />
                                                </Button>
                                                <div className="flex items-center space-x-2 ml-4">
                                                    <Checkbox
                                                        id="attachmentRequired"
                                                        checked={form.attachmentRequired}
                                                        onCheckedChange={(checked) => setForm(f => ({ ...f, attachmentRequired: checked as boolean }))}
                                                    />
                                                    <Label htmlFor="attachmentRequired" className="text-sm font-medium leading-none cursor-pointer">
                                                        Required for students
                                                    </Label>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="dueAt" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                                Due Date
                                            </Label>
                                            <Input
                                                id="dueAt"
                                                type="datetime-local"
                                                value={form.dueAt}
                                                onChange={(e) => setForm(f => ({ ...f, dueAt: e.target.value }))}
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="totalMarks" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                                Total Marks
                                            </Label>
                                            <Input
                                                id="totalMarks"
                                                type="number"
                                                value={form.totalMarks}
                                                onChange={(e) => setForm(f => ({ ...f, totalMarks: e.target.value }))}
                                                placeholder="e.g. 100"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                                Questions
                                            </Label>
                                            <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
                                                <Plus className="size-4 mr-1" /> Add Question
                                            </Button>
                                        </div>

                                        {form.questions.map((q, i) => (
                                            <Card key={i} className="p-4 relative">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="absolute top-2 right-2 text-muted-foreground hover:text-destructive"
                                                    onClick={() => removeQuestion(i)}
                                                >
                                                    <Trash2 className="size-4" />
                                                </Button>
                                                <div className="grid gap-4">
                                                    <div className="grid gap-2">
                                                        <Label className="text-xs">Question {i + 1}</Label>
                                                        <Input
                                                            value={q.questionText}
                                                            onChange={(e) => updateQuestion(i, "questionText", e.target.value)}
                                                            placeholder="Enter question text"
                                                        />
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="grid gap-2">
                                                            <Label className="text-xs">Type</Label>
                                                            <Select
                                                                value={q.questionType}
                                                                onValueChange={(val) => updateQuestion(i, "questionType", val)}
                                                            >
                                                                <SelectTrigger>
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                                                                    <SelectItem value="short_answer">Short Answer</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="grid gap-2">
                                                            <Label className="text-xs">Points</Label>
                                                            <Input
                                                                type="number"
                                                                value={q.points}
                                                                onChange={(e) => updateQuestion(i, "points", Number(e.target.value))}
                                                            />
                                                        </div>
                                                    </div>

                                                    {q.questionType === "multiple_choice" && (
                                                        <div className="grid gap-2">
                                                            <Label className="text-xs">Options</Label>
                                                            <div className="grid grid-cols-2 gap-2">
                                                                {q.options.map((opt, optIdx) => (
                                                                    <div key={optIdx} className="flex items-center gap-2">
                                                                        <Input
                                                                            value={opt}
                                                                            onChange={(e) => {
                                                                                const newOpts = [...q.options];
                                                                                newOpts[optIdx] = e.target.value;
                                                                                updateQuestion(i, "options", newOpts);
                                                                            }}
                                                                            placeholder={`Option ${optIdx + 1}`}
                                                                        />
                                                                        <Checkbox
                                                                            checked={q.correctAnswer === opt && opt !== ""}
                                                                            onCheckedChange={() => updateQuestion(i, "correctAnswer", opt)}
                                                                        />
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </Card>
                                        ))}
                                    </div>

                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                                        <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={!form.title || !form.courseId || form.selectedStudents.length === 0}>
                                            Save Quiz
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>
                    )}
                </div>
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
                                <TableHead>Quiz</TableHead>
                                <TableHead>Course</TableHead>
                                <TableHead>Due Date</TableHead>
                                <TableHead>Questions</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {quizzes
                                .filter(q => selectedCourse === "all" || q.course.id === selectedCourse)
                                .length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                                        No quizzes found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                quizzes
                                    .filter(q => selectedCourse === "all" || q.course.id === selectedCourse)
                                    .map((q) => {
                                        const submission = (q as any).submissions?.[0] || submissions[q.id];
                                        const isSubmitted = !!submission;

                                        return (
                                            <TableRow key={q.id}>
                                                <TableCell className="font-medium">
                                                    <div className="flex items-center gap-2">
                                                        <HelpCircle className="size-4 text-primary" />
                                                        {q.title}
                                                    </div>
                                                </TableCell>
                                                <TableCell>{q.course?.title || "-"}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2 text-xs">
                                                        <Clock className="size-3.5 text-muted-foreground" />
                                                        {formatDueDate(q.due_at)}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary">
                                                        {q.questions?.length || 0} Questions
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {isSubmitted ? (
                                                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                                                            Score: {submission.score}
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="secondary">Pending</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {role === "student" ? (
                                                        <div className="flex items-center justify-end gap-2">
                                                            <Button
                                                                size="sm"
                                                                variant={isSubmitted ? "outline" : "default"}
                                                                disabled={isSubmitted}
                                                                onClick={() => {
                                                                    setSelectedQuizId(q.id);
                                                                    setQuizOpen(true);
                                                                }}
                                                            >
                                                                {isSubmitted ? "Submitted" : "Take Quiz"}
                                                            </Button>
                                                            {isSubmitted && (
                                                                <Dialog>
                                                                    <DialogTrigger asChild>
                                                                        <Button size="icon" variant="ghost" className="h-8 w-8">
                                                                            <Eye className="h-4 w-4" />
                                                                        </Button>
                                                                    </DialogTrigger>
                                                                    <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                                                                        <DialogHeader>
                                                                            <DialogTitle>Your Submission: {q.title}</DialogTitle>
                                                                            <DialogDescription>
                                                                                Submitted on {new Date(submission.submitted_at).toLocaleString()}
                                                                            </DialogDescription>
                                                                        </DialogHeader>
                                                                        <div className="space-y-6 py-4">
                                                                            <div className="space-y-4">
                                                                                <h3 className="font-semibold text-sm border-b pb-2">Answers</h3>
                                                                                {q.questions?.map((question: any, idx: number) => {
                                                                                    const answerText = submission.answers?.[question.id];
                                                                                    return (
                                                                                        <div key={question.id} className="border p-4 rounded-md space-y-2">
                                                                                            <p className="font-medium text-sm">{idx + 1}. {question.question_text}</p>
                                                                                            <div className="bg-muted/30 p-2 rounded text-sm">
                                                                                                <span className="font-semibold">Your Answer: </span>
                                                                                                {answerText ? (
                                                                                                    <span>{answerText}</span>
                                                                                                ) : (
                                                                                                    <span className="text-muted-foreground italic">No answer</span>
                                                                                                )}
                                                                                            </div>
                                                                                            <div className="text-xs text-muted-foreground">
                                                                                                <span className="font-semibold">Correct Answer: </span>
                                                                                                {question.correct_answer || "N/A"}
                                                                                            </div>
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>

                                                                            <div className="space-y-4">
                                                                                <h3 className="font-semibold text-sm border-b pb-2">Attachments</h3>
                                                                                <div className="flex flex-col gap-2">
                                                                                    {(() => {
                                                                                        const atts = submission.attachments || submission.quiz_submission_attachments || [];
                                                                                        return atts.length > 0 ? (
                                                                                            atts.map((att: any, attIdx: number) => (
                                                                                                <a
                                                                                                    key={attIdx}
                                                                                                    href={att.file_url}
                                                                                                    target="_blank"
                                                                                                    rel="noopener noreferrer"
                                                                                                    className="text-sm text-blue-600 hover:underline flex items-center gap-2 p-2 border rounded-md hover:bg-muted/20"
                                                                                                >
                                                                                                    <FileIcon className="size-4" />
                                                                                                    {att.file_name}
                                                                                                </a>
                                                                                            ))
                                                                                        ) : (
                                                                                            <span className="text-muted-foreground text-sm italic">No attachments</span>
                                                                                        );
                                                                                    })()}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </DialogContent>
                                                                </Dialog>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center justify-end gap-2">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => {
                                                                    setSelectedQuizId(q.id);
                                                                    setSubmissionsOpen(true);
                                                                }}
                                                            >
                                                                Submissions
                                                            </Button>
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                                onClick={() => onDelete(q.id)}
                                                            >
                                                                <Trash2 className="h-4 w-4" />

                                                            </Button>
                                                        </div>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                            )}
                        </TableBody>
                    </Table>
                </Card>
            )
            }

            {/* Take Quiz Dialog */}
            <Dialog open={quizOpen} onOpenChange={setQuizOpen}>
                <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{selectedQuiz?.title}</DialogTitle>
                        <DialogDescription>
                            {selectedQuiz?.description || "Please answer all questions below."}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={onSubmitQuiz} className="grid gap-6 py-4">
                        {selectedQuiz?.questions?.map((q: any, i: number) => (
                            <div key={q.id} className="space-y-3">
                                <div className="flex items-start gap-2">
                                    <span className="font-bold text-sm">{i + 1}.</span>
                                    <p className="text-sm font-medium">{q.question_text}</p>
                                </div>

                                {q.question_type === "multiple_choice" ? (
                                    <div className="grid grid-cols-1 gap-2 pl-6">
                                        {q.options?.map((opt: string, optIdx: number) => (
                                            <div key={optIdx} className="flex items-center gap-2">
                                                <Checkbox
                                                    id={`q-${q.id}-opt-${optIdx}`}
                                                    checked={quizAnswers[q.id] === opt}
                                                    onCheckedChange={() => setQuizAnswers(prev => ({ ...prev, [q.id]: opt }))}
                                                />
                                                <Label htmlFor={`q-${q.id}-opt-${optIdx}`} className="text-sm font-normal cursor-pointer">
                                                    {opt}
                                                </Label>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="pl-6">
                                        <Textarea
                                            placeholder="Type your answer here..."
                                            value={quizAnswers[q.id] || ""}
                                            onChange={(e) => setQuizAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                                        />
                                    </div>
                                )}
                            </div>
                        ))}

                        <div className="space-y-3 pt-4 border-t">
                            <Label className="text-sm font-bold">
                                Attachments {selectedQuiz?.attachment_required ? "(Required)" : "(Optional)"}
                            </Label>
                            <div className="space-y-2">
                                {submissionAttachments.map((att, i) => (
                                    <div key={i} className="flex items-center justify-between p-2 border rounded-md bg-muted/20">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <FileIcon className="size-4 text-muted-foreground flex-shrink-0" />
                                            <span className="text-sm truncate">{att.name}</span>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="size-6 text-muted-foreground hover:text-destructive"
                                            onClick={() => removeAttachment(i, true)}
                                        >
                                            <XCircle className="size-4" />
                                        </Button>
                                    </div>
                                ))}
                                <div className="flex items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="gap-1 relative"
                                        disabled={uploading}
                                    >
                                        {uploading ? (
                                            <Loader2 className="size-4 animate-spin" />
                                        ) : (
                                            <Paperclip className="size-4" />
                                        )}
                                        Attach File
                                        <input
                                            type="file"
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                            onChange={(e) => handleAttachmentUpload(e, true)}
                                            disabled={uploading}
                                        />
                                    </Button>
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => {
                                setQuizOpen(false);
                                setSubmissionAttachments([]);
                            }}>Cancel</Button>
                            <Button type="submit" disabled={uploading}>
                                {uploading ? "Uploading..." : "Submit Quiz"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* View Quiz Dialog */}
            <Dialog open={viewOpen} onOpenChange={setViewOpen}>
                <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{selectedQuiz?.title}</DialogTitle>
                        <DialogDescription>
                            Quiz details and status.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Course</Label>
                                <p className="text-sm font-medium">{selectedQuiz?.course?.title || "-"}</p>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Due Date</Label>
                                <div className="flex items-center gap-2 text-sm font-medium">
                                    <Clock className="size-3.5 text-muted-foreground" />
                                    {formatDueDate(selectedQuiz?.due_at || null)}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Questions</Label>
                                <p className="text-sm font-medium">
                                    {selectedQuiz?.questions?.length || 0} Questions
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Description</Label>
                            <div className="text-sm bg-muted/30 p-4 rounded-lg whitespace-pre-wrap">
                                {selectedQuiz?.description || "No description provided."}
                            </div>
                        </div>

                        {/* Teacher View: Submissions List */}
                        {canCreate && (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs text-muted-foreground">Submissions</Label>
                                    <Badge variant="outline" className="text-[10px]">
                                        {(selectedQuiz as any)?.submissions?.length || 0} / {selectedQuiz?.students?.length || 0}
                                    </Badge>
                                </div>
                                <div className="border rounded-lg overflow-hidden">
                                    <Table>
                                        <TableHeader className="bg-muted/50">
                                            <TableRow>
                                                <TableHead className="h-8 text-[10px] uppercase">Student</TableHead>
                                                <TableHead className="h-8 text-[10px] uppercase">Status</TableHead>
                                                <TableHead className="h-8 text-[10px] uppercase text-right">Score</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {selectedQuiz?.students?.map((s: any) => {
                                                const sub = (selectedQuiz as any).submissions?.find((sub: any) => sub.student_id === s.student.id);
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
                                                                <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-[10px] h-5">Completed</Badge>
                                                            ) : (
                                                                <Badge variant="secondary" className="text-[10px] h-5">Pending</Badge>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="py-2 text-right text-xs">
                                                            {sub?.score ?? "-"}
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
                                <Label className="text-xs text-muted-foreground">My Result</Label>
                                {submissions[selectedQuiz?.id || ""] ? (
                                    <div className="p-4 border rounded-lg bg-green-50/30 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Completed</Badge>
                                            <span className="text-xs text-muted-foreground">
                                                {new Date(submissions[selectedQuiz?.id || ""].submitted_at).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-background rounded-lg border">
                                            <span className="text-sm font-medium">Your Score</span>
                                            <span className="text-lg font-bold text-primary">
                                                {submissions[selectedQuiz?.id || ""].score}
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-8 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 text-muted-foreground">
                                        <HelpCircle className="size-6" />
                                        <p className="text-xs">You haven't taken this quiz yet.</p>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="mt-2"
                                            onClick={() => {
                                                setViewOpen(false);
                                                setQuizOpen(true);
                                            }}
                                        >
                                            Take Quiz Now
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

            <Dialog open={submissionsOpen} onOpenChange={setSubmissionsOpen}>
                <DialogContent className="sm:max-w-7xl w-full max-h-[80vh] overflow-y-auto">
                    <DialogHeader className="flex flex-row items-center justify-between">
                        <DialogTitle>Submissions: {selectedQuiz?.title || ""}</DialogTitle>
                        <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2">
                            <Download className="size-4" />
                            Export CSV
                        </Button>
                    </DialogHeader>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Student</TableHead>
                                <TableHead>Submitted At</TableHead>
                                <TableHead>Score</TableHead>
                                <TableHead>Attachments</TableHead>
                                <TableHead>Answers</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {(selectedQuiz as any)?.submissions?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                                        No submissions yet.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                (selectedQuiz as any)?.submissions?.map((sub: any) => (
                                    <TableRow key={sub.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <Avatar>
                                                    <AvatarImage src={sub.student?.user?.image_url} />
                                                    <AvatarFallback>{sub.student?.user?.name?.[0] || "?"}</AvatarFallback>
                                                </Avatar>
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{sub.student?.user?.name || "Unknown"}</span>
                                                    <span className="text-xs text-muted-foreground">{sub.student?.user?.email}</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>{new Date(sub.submitted_at).toLocaleString()}</TableCell>
                                        <TableCell>{sub.score}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1">
                                                {(() => {
                                                    const atts = sub.attachments || sub.quiz_submission_attachments || [];
                                                    return atts.length > 0 ? (
                                                        atts.map((att: any, i: number) => (
                                                            <a
                                                                key={i}
                                                                href={att.file_url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                                            >
                                                                <FileIcon className="size-3" />
                                                                {att.file_name}
                                                            </a>
                                                        ))
                                                    ) : (
                                                        <span className="text-muted-foreground text-xs">No attachments</span>
                                                    );
                                                })()}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button variant="outline" size="sm">View Answers</Button>
                                                </DialogTrigger>
                                                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                                                    <DialogHeader>
                                                        <DialogTitle>Answers: {sub.student?.user?.name}</DialogTitle>
                                                    </DialogHeader>
                                                    <div className="space-y-4">
                                                        {selectedQuiz?.questions?.map((q: any, i: number) => {
                                                            const answerText = sub.answers?.[q.id];
                                                            return (
                                                                <div key={q.id} className="border p-4 rounded-md">
                                                                    <p className="font-medium mb-2">{i + 1}. {q.question_text}</p>
                                                                    <div className="bg-muted/30 p-2 rounded text-sm">
                                                                        <span className="font-semibold">Student Answer: </span>
                                                                        {answerText ? (
                                                                            <span>{answerText}</span>
                                                                        ) : (
                                                                            <span className="text-muted-foreground italic">No answer</span>
                                                                        )}
                                                                    </div>
                                                                    <div className="mt-2 text-xs text-muted-foreground">
                                                                        <span className="font-semibold">Correct Answer: </span>
                                                                        {q.correct_answer || "N/A"}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </DialogContent>
                                            </Dialog>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    type="number"
                                                    className="w-20"
                                                    defaultValue={sub.score}
                                                    onBlur={(e) => handleUpdateScore(sub.id, Number(e.target.value))}
                                                />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </DialogContent>
            </Dialog>
        </div >
    );
}
