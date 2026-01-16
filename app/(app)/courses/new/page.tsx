"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, X, Upload, ChevronRight, Check, BookOpen, HelpCircle, FileText, Calendar, ChevronDown, ChevronUp, Trash2, GripVertical, Search } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { supabaseClient } from "@/lib/db/supabase-client";

type Teacher = { id: string; user_id: string; user?: { id: string; name: string; email: string } };
type Student = { id: string; name: string; email: string; image_url?: string | null };

export default function NewCoursePage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form Data
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [level, setLevel] = useState("");
  const [description, setDescription] = useState("");
  const [whatStudentsWillLearn, setWhatStudentsWillLearn] = useState<string[]>([""]);
  const [coverImage, setCoverImage] = useState("");
  const [tenureStart, setTenureStart] = useState("");
  const [tenureEnd, setTenureEnd] = useState("");

  // Upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Student Selection State
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [selectionDialogOpen, setSelectionDialogOpen] = useState(false);

  // Curriculum State
  const [sections, setSections] = useState<{
    id: string;
    title: string;
    lessons: {
      id: string;
      title: string;
      type: 'lecture' | 'quiz' | 'assignment';
      scheduledAt?: string;
      // Assignment fields
      description?: string;
      totalMarks?: string;
      minPassMarks?: string;
      // Quiz fields
      attachmentRequired?: boolean;
      questions?: any[];
      // Lecture fields
      duration?: number;
    }[]
  }[]>([
    { id: '1', title: '', lessons: [{ id: '1-1', title: '', type: 'lecture', scheduledAt: '', duration: 60 }] }
  ]);

  // Expanded lesson state for showing/hiding details
  const [expandedLessons, setExpandedLessons] = useState<Set<string>>(new Set());

  // Data from API
  const [teachers, setTeachers] = useState<Teacher[]>([]);

  useEffect(() => {
    fetch("/api/teachers")
      .then(res => res.json())
      .then(data => {
        if (data.teachers) setTeachers(data.teachers);
      })
      .catch(err => console.error("Failed to load teachers", err));
  }, []);

  useEffect(() => {
    // Load students - transform to flat structure like assignments/quizzes pages
    fetch("/api/students")
      .then(res => res.json())
      .then(data => {
        if (data.students) {
          // Transform nested structure to flat structure matching assignments/quizzes pages
          // The API returns: { id, user: { id, name, email, image_url } }
          // We need: { id, name, email, image_url }
          const transformed = data.students
            .filter((s: any) => s.user) // Filter out any students without user data
            .map((s: any) => ({
              id: s.id,
              name: s.user?.name || "",
              email: s.user?.email || "",
              image_url: s.user?.image_url || null,
            }))
            .filter((s: Student) => s.name && s.email); // Filter out invalid entries
          setStudents(transformed);
        }
      })
      .catch(err => {
        console.error("Failed to load students", err);
        setError("Failed to load students. Please try again.");
      });
  }, []);

  const handleAddLearnPoint = () => {
    setWhatStudentsWillLearn([...whatStudentsWillLearn, ""]);
  };

  const handleLearnPointChange = (index: number, value: string) => {
    const newPoints = [...whatStudentsWillLearn];
    newPoints[index] = value;
    setWhatStudentsWillLearn(newPoints);
  };

  const handleRemoveLearnPoint = (index: number) => {
    setWhatStudentsWillLearn(whatStudentsWillLearn.filter((_, i) => i !== index));
  };

  // Curriculum Handlers
  const addSection = () => {
    setSections([...sections, { id: Date.now().toString(), title: '', lessons: [] }]);
  };

  const updateSectionTitle = (id: string, title: string) => {
    setSections(sections.map(s => s.id === id ? { ...s, title } : s));
  };

  const removeSection = (id: string) => {
    setSections(sections.filter(s => s.id !== id));
  };

  const addLesson = (sectionId: string, type: 'lecture' | 'quiz' | 'assignment' = 'lecture') => {
    const newLessonId = Date.now().toString();
    setSections(sections.map(s => {
      if (s.id === sectionId) {
        const baseLesson = {
          id: newLessonId,
          title: '',
          type,
          scheduledAt: ''
        };

        if (type === 'lecture') {
          return { ...s, lessons: [...s.lessons, { ...baseLesson, duration: 60 }] };
        } else if (type === 'assignment') {
          return { ...s, lessons: [...s.lessons, { ...baseLesson, description: '', totalMarks: '', minPassMarks: '' }] };
        } else if (type === 'quiz') {
          return { ...s, lessons: [...s.lessons, { ...baseLesson, description: '', totalMarks: '', attachmentRequired: false, questions: [] }] };
        }
        return { ...s, lessons: [...s.lessons, baseLesson] };
      }
      return s;
    }));
    // Auto-expand new lesson to show fields
    setExpandedLessons(prev => new Set([...Array.from(prev), newLessonId]));
  };

  const updateLessonTitle = (sectionId: string, lessonId: string, title: string) => {
    setSections(sections.map(s => {
      if (s.id === sectionId) {
        return { ...s, lessons: s.lessons.map(l => l.id === lessonId ? { ...l, title } : l) };
      }
      return s;
    }));
  };

  const updateLessonScheduledAt = (sectionId: string, lessonId: string, scheduledAt: string) => {
    setSections(sections.map(s => {
      if (s.id === sectionId) {
        return { ...s, lessons: s.lessons.map(l => l.id === lessonId ? { ...l, scheduledAt } : l) };
      }
      return s;
    }));
  };

  const updateLessonField = (sectionId: string, lessonId: string, field: string, value: any) => {
    setSections(sections.map(s => {
      if (s.id === sectionId) {
        return { ...s, lessons: s.lessons.map(l => l.id === lessonId ? { ...l, [field]: value } : l) };
      }
      return s;
    }));
  };

  const toggleLessonExpanded = (lessonId: string) => {
    setExpandedLessons(prev => {
      const newSet = new Set(prev);
      if (newSet.has(lessonId)) {
        newSet.delete(lessonId);
      } else {
        newSet.add(lessonId);
      }
      return newSet;
    });
  };

  const removeLesson = (sectionId: string, lessonId: string) => {
    setSections(sections.map(s => {
      if (s.id === sectionId) {
        return { ...s, lessons: s.lessons.filter(l => l.id !== lessonId) };
      }
      return s;
    }));
  };

  async function uploadFile(file: File) {
    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      const filePath = `covers/${fileName}`;

      const { error: uploadError } = await supabaseClient.storage
        .from('course-assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabaseClient.storage.from('course-assets').getPublicUrl(filePath);
      setCoverImage(data.publicUrl);
    } catch (error: any) {
      console.error("Upload failed:", error);
      setError(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFile(e.target.files[0]);
    }
  };

  const onSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          category,
          teacherId,
          level,
          description,
          whatStudentsWillLearn: whatStudentsWillLearn.filter(p => p.trim() !== ""),
          coverImage,
          tenureStart: tenureStart || null,
          tenureEnd: tenureEnd || null,
          studentIds: selectedStudents,
          curriculum: sections // Send curriculum data to be processed as sessions
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create course");
      router.push("/courses");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Create New Course</h1>
        <Button variant="ghost" size="icon" asChild>
          <a href="/courses" title="Back to Courses">
            <X className="size-5" />
          </a>
        </Button>
      </div>

      {/* Steps Indicator */}
      <div className="flex items-center gap-4 mb-8 text-sm">
        <div className={`flex items-center gap-2 ${step === 1 ? 'text-primary font-medium' : 'text-gray-500'}`}>
          <div className={`size-6 rounded-full flex items-center justify-center border ${step === 1 ? 'border-primary bg-blue-50' : 'border-gray-300'}`}>1</div>
          Course Landing
        </div>
        <ChevronRight className="size-4 text-gray-300" />
        <div className={`flex items-center gap-2 ${step === 2 ? 'text-primary font-medium' : 'text-gray-500'}`}>
          <div className={`size-6 rounded-full flex items-center justify-center border ${step === 2 ? 'border-primary bg-blue-50' : 'border-gray-300'}`}>2</div>
          Schedule
        </div>
        <ChevronRight className="size-4 text-gray-300" /> <div className={`flex items-center gap-2 ${step === 3 ? 'text-primary font-medium' : 'text-gray-500'}`}>
          <div className={`size-6 rounded-full flex items-center justify-center border ${step === 3 ? 'border-primary bg-blue-50' : 'border-gray-300'}`}>3</div>
          FAQs
        </div>
      </div>

      {step === 1 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Card className="border-none shadow-sm bg-white">
            <CardContent className="p-6 space-y-6">
              {/* Title */}
              <div>
                <Label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">Course Title</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xl">📙</span>
                  <Input
                    className="pl-10 text-lg font-medium border-gray-200 h-12"
                    placeholder="e.g. Master in Product Design"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Category */}
                <div>
                  <Label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">Category</Label>
                  {isCustomCategory ? (
                    <div className="flex gap-2">
                      <Input
                        className="h-11"
                        placeholder="Enter custom category"
                        value={category}
                        onChange={e => setCategory(e.target.value)}
                        autoFocus
                      />
                      <Button variant="ghost" size="icon" onClick={() => { setIsCustomCategory(false); setCategory(""); }} title="Select from list">
                        <X className="size-4" />
                      </Button>
                    </div>
                  ) : (
                    <Select value={category} onValueChange={(val) => {
                      if (val === "custom_option_add_new") {
                        setIsCustomCategory(true);
                        setCategory("");
                      } else {
                        setCategory(val);
                      }
                    }}>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Select Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Product Design">Product Design</SelectItem>
                        <SelectItem value="Development">Development</SelectItem>
                        <SelectItem value="Business">Business</SelectItem>
                        <SelectItem value="Marketing">Marketing</SelectItem>
                        <SelectItem value="custom_option_add_new" className="font-medium text-blue-600">
                          + Add New Category
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Instructor */}
                <div>
                  <Label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">Instructor</Label>
                  <Select value={teacherId || ""} onValueChange={setTeacherId}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select Instructor" />
                    </SelectTrigger>
                    <SelectContent>
                      {teachers.map(t => (
                        <SelectItem key={t.id} value={t.id}>
                          <div className="flex items-center gap-2">
                            <Avatar className="size-5">
                              <AvatarFallback>{t.user?.name?.[0] || 'T'}</AvatarFallback>
                            </Avatar>
                            {t.user?.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Level */}
                <div>
                  <Label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">Level</Label>
                  <Select value={level} onValueChange={setLevel}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="All Level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All Level">All Level</SelectItem>
                      <SelectItem value="Beginner">Beginner</SelectItem>
                      <SelectItem value="Intermediate">Intermediate</SelectItem>
                      <SelectItem value="Expert">Expert</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Description */}
              <div>
                <Label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">Course Description</Label>
                <div className="border rounded-md p-2">
                  {/* Toolbar stub */}
                  <div className="flex gap-2 mb-2 border-b pb-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8"><span className="font-bold">B</span></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><span className="italic">I</span></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><span className="underline">U</span></Button>
                  </div>
                  <Textarea
                    className="border-none shadow-none resize-none min-h-[150px] focus-visible:ring-0 p-0"
                    placeholder="Enter course description..."
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                  />
                </div>
              </div>

              {/* What Students Will Learn */}
              <div>
                <Label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">What Students Will Learn</Label>
                <div className="space-y-3">
                  {whatStudentsWillLearn.map((point, idx) => (
                    <div key={idx} className="flex gap-2">
                      <Input
                        value={point}
                        onChange={e => handleLearnPointChange(idx, e.target.value)}
                        placeholder="e.g. How to create wireframes"
                      />
                      {whatStudentsWillLearn.length > 1 && (
                        <Button variant="ghost" size="icon" onClick={() => handleRemoveLearnPoint(idx)}>
                          <X className="size-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={handleAddLearnPoint} >
                    <Plus className="size-4 mr-2" /> Add New
                  </Button>
                </div>
              </div>

              {/* Cover Image */}
              <div>
                <Label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">Cover Image</Label>
                <div
                  className="border-2 border-dashed rounded-lg p-8 text-center hover:bg-gray-50 transition-colors cursor-pointer relative overflow-hidden"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {coverImage ? (
                    <div className="relative w-full h-48">
                      <img src={coverImage} alt="Cover" className="w-full h-full object-cover rounded-md" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <p className="text-white font-medium">Click to change</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="mx-auto size-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                        {uploading ? <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div> : <Upload className="size-6 text-gray-400" />}
                      </div>
                      <p className="text-sm font-medium">
                        {uploading ? "Uploading..." : <>Drag and drop an image, or <span className="text-primary">Browse</span></>}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Maximum 1400px * 1400px</p>
                    </>
                  )}
                  <input
                    type="file"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                  />
                </div>
              </div>

              {/* Tenure Dates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">Start Date</Label>
                  <Input
                    type="date"
                    className="h-11"
                    value={tenureStart}
                    onChange={e => setTenureStart(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">End Date</Label>
                  <Input
                    type="date"
                    className="h-11"
                    value={tenureEnd}
                    onChange={e => setTenureEnd(e.target.value)}
                    min={tenureStart || undefined}
                  />
                </div>
              </div>

              {/* Enroll Students */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-xs text-gray-500 uppercase tracking-wider block">Enroll Students</Label>
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
                    <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden gap-0">
                      <DialogHeader className="p-6 pb-2">
                        <DialogTitle>Enroll Students</DialogTitle>
                        <DialogDescription>Select students to enroll in this course.</DialogDescription>
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
                              const allSelected = selectedStudents.length === students.length;
                              setSelectedStudents(allSelected ? [] : students.map(s => s.id));
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <Check className={cn("size-4 text-primary transition-opacity", selectedStudents.length === students.length ? "opacity-100" : "opacity-0")} />
                              </div>
                              <span className="font-medium">Select All</span>
                            </div>
                            <Checkbox checked={selectedStudents.length === students.length} className="pointer-events-none" />
                          </div>
                          {students.filter(s =>
                            s.name?.toLowerCase().includes(studentSearch.toLowerCase()) ||
                            s.email?.toLowerCase().includes(studentSearch.toLowerCase())
                          ).map(s => {
                            const isSelected = selectedStudents.includes(s.id);
                            return (
                              <div
                                key={s.id}
                                className={cn("flex items-center justify-between p-3 hover:bg-muted/50 cursor-pointer transition-colors", isSelected && "bg-primary/5")}
                                onClick={() => setSelectedStudents(prev => isSelected ? prev.filter(id => id !== s.id) : [...prev, s.id])}
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
                      <div className="p-4 border-t bg-muted/10 flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">{selectedStudents.length} students selected</div>
                        <Button onClick={() => setSelectionDialogOpen(false)}>Done</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="flex flex-wrap gap-2 min-h-[32px]">
                  {selectedStudents.slice(0, 5).map(id => {
                    const s = students.find(st => st.id === id);
                    return s ? (
                      <div key={id} className="flex items-center gap-1 bg-gray-100 rounded-full px-2 py-1 text-xs">
                        <Avatar className="size-4">
                          <AvatarImage src={s.image_url || undefined} />
                          <AvatarFallback>{s.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span>{s.name}</span>
                        <button
                          type="button"
                          onClick={() => setSelectedStudents(prev => prev.filter(sid => sid !== id))}
                          className="ml-1 hover:text-red-600"
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    ) : null;
                  })}
                  {selectedStudents.length > 5 && <span className="text-xs text-gray-500 self-center">+{selectedStudents.length - 5} more</span>}
                  {selectedStudents.length === 0 && (
                    <span className="text-xs text-muted-foreground italic">No students selected</span>
                  )}
                </div>
              </div>

            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={() => setStep(2)} >
              Next Step <ChevronRight className="ml-2 size-4" />
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="space-y-4">
            {sections.map((section, sIdx) => (
              <Card key={section.id} className="border-none shadow-sm bg-white">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-4">
                    <GripVertical className="text-gray-300 cursor-move" />
                    <Input
                      className="font-medium text-lg border-none shadow-none focus-visible:ring-0 px-0 h-auto placeholder:text-gray-300"
                      placeholder="Type section name"
                      value={section.title}
                      onChange={e => updateSectionTitle(section.id, e.target.value)}
                    />
                    <div className="flex items-center gap-2 ml-auto">
                      <Button variant="ghost" size="icon" onClick={() => removeSection(section.id)}><Trash2 className="size-4 text-gray-400 hover:text-red-500" /></Button>
                    </div>
                  </div>

                  <div className="pl-10 space-y-3">
                    {section.lessons.map((lesson, lIdx) => {
                      const isExpanded = expandedLessons.has(lesson.id);

                      return (
                        <div key={lesson.id} className="group relative">
                          <div className="absolute left-[-24px] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-blue-500"></div>
                          <div className="bg-gray-50 rounded-lg p-3 border border-transparent group-hover:border-gray-200 transition-colors space-y-2">
                            <div className="flex items-center gap-3">
                              <GripVertical className="text-gray-300 cursor-move size-4" />
                              {lesson.type === 'quiz' && <span className="text-xs font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded">Quiz</span>}
                              {lesson.type === 'assignment' && <span className="text-xs font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded">Assignment</span>}
                              {lesson.type === 'lecture' && <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Lecture</span>}
                              <Input
                                className="bg-transparent border-none shadow-none focus-visible:ring-0 h-auto p-0 text-sm flex-1"
                                placeholder={lesson.type === 'lecture' ? "Type lesson name" : `${lesson.type === 'quiz' ? 'Quiz' : 'Assignment'} title`}
                                value={lesson.title}
                                onChange={e => updateLessonTitle(section.id, lesson.id, e.target.value)}
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="opacity-0 group-hover:opacity-100"
                                onClick={() => toggleLessonExpanded(lesson.id)}
                                title={isExpanded ? "Collapse details" : "Expand details"}
                              >
                                {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                              </Button>
                              <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100" onClick={() => removeLesson(section.id, lesson.id)}>
                                <Trash2 className="size-4 text-gray-400 hover:text-red-500" />
                              </Button>
                            </div>
                            <div className="flex items-center gap-2 pl-7">
                              <Calendar className="size-4 text-muted-foreground shrink-0" />
                              <Input
                                type="datetime-local"
                                className="h-8 text-xs bg-white border-gray-200 flex-1 max-w-xs"
                                placeholder="Schedule date & time (optional)"
                                value={lesson.scheduledAt || ''}
                                onChange={e => updateLessonScheduledAt(section.id, lesson.id, e.target.value)}
                              />
                              {lesson.scheduledAt && (
                                <span className="text-xs text-muted-foreground">
                                  {new Date(lesson.scheduledAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                </span>
                              )}
                            </div>

                            {/* Expanded Details */}
                            {isExpanded && (
                              <div className="pl-7 pt-2 space-y-3 border-t border-gray-200">
                                {/* Description - for assignments and quizzes */}
                                {(lesson.type === 'assignment' || lesson.type === 'quiz') && (
                                  <div className="grid gap-2">
                                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                      {lesson.type === 'assignment' ? '*' : ''} Description
                                    </Label>
                                    <Textarea
                                      className="text-sm min-h-[80px] bg-white"
                                      placeholder={lesson.type === 'assignment' ? "Assignment instructions..." : "Quiz instructions..."}
                                      value={lesson.description || ''}
                                      onChange={e => updateLessonField(section.id, lesson.id, 'description', e.target.value)}
                                      required={lesson.type === 'assignment'}
                                    />
                                  </div>
                                )}

                                {/* Duration - for lectures */}
                                {lesson.type === 'lecture' && (
                                  <div className="grid gap-2">
                                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                      Duration (minutes)
                                    </Label>
                                    <Input
                                      type="number"
                                      className="h-8 text-xs bg-white"
                                      placeholder="60"
                                      value={lesson.duration || 60}
                                      onChange={e => updateLessonField(section.id, lesson.id, 'duration', Number(e.target.value) || 60)}
                                      min={1}
                                    />
                                  </div>
                                )}

                                {/* Total Marks & Min Pass Marks - for assignments and quizzes */}
                                {(lesson.type === 'assignment' || lesson.type === 'quiz') && (
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="grid gap-2">
                                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                        {lesson.type === 'assignment' ? '*' : ''} Total Marks
                                      </Label>
                                      <Input
                                        type="number"
                                        className="h-8 text-xs bg-white"
                                        placeholder="Set total marks"
                                        value={lesson.totalMarks || ''}
                                        onChange={e => updateLessonField(section.id, lesson.id, 'totalMarks', e.target.value)}
                                        required={lesson.type === 'assignment'}
                                      />
                                    </div>
                                    {lesson.type === 'assignment' && (
                                      <div className="grid gap-2">
                                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                          * Minimum Pass Marks
                                        </Label>
                                        <Input
                                          type="number"
                                          className="h-8 text-xs bg-white"
                                          placeholder="Set pass marks"
                                          value={lesson.minPassMarks || ''}
                                          onChange={e => updateLessonField(section.id, lesson.id, 'minPassMarks', e.target.value)}
                                          required
                                        />
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Attachment Required - for quizzes */}
                                {lesson.type === 'quiz' && (
                                  <div className="flex items-center space-x-2">
                                    <Checkbox
                                      id={`quiz-attachment-${lesson.id}`}
                                      checked={lesson.attachmentRequired || false}
                                      onCheckedChange={(checked) => updateLessonField(section.id, lesson.id, 'attachmentRequired', checked)}
                                    />
                                    <Label htmlFor={`quiz-attachment-${lesson.id}`} className="text-xs font-medium leading-none cursor-pointer">
                                      Attachment required for students
                                    </Label>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    <div className="flex gap-2 mt-4">
                      <Button size="sm" className="text-xs gap-2" onClick={() => addLesson(section.id, 'lecture')}>
                        <BookOpen className="size-3" /> Add Lecture
                      </Button>
                      <Button variant="outline" size="sm" className="text-xs gap-2" onClick={() => addLesson(section.id, 'quiz')}>
                        <HelpCircle className="size-3" /> Add Quiz
                      </Button>
                      <Button variant="outline" size="sm" className="text-xs gap-2" onClick={() => addLesson(section.id, 'assignment')}>
                        <FileText className="size-3" /> Add Assignment
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            <Button variant="outline" className="w-full py-6 border-dashed gap-2 text-gray-500 hover:text-gray-900" onClick={addSection}>
              <Plus className="size-4" /> Add Section
            </Button>
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
            <Button onClick={() => setStep(3)}>
              Next Step <ChevronRight className="ml-2 size-4" />
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Card>
            <CardContent className="p-12 text-center text-gray-500">
              <p>FAQ builder coming soon.</p>
            </CardContent>
          </Card>

          {error && <div className="text-red-600 text-sm text-center">{error}</div>}

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
            <Button onClick={onSubmit} disabled={loading}>
              {loading ? "Creating..." : "Create Course"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
