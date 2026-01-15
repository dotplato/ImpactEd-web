"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { CourseCard } from "@/components/course/CourseCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, BookOpen, Loader2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/search-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type UserRole = "admin" | "teacher" | "student" | null;

type Course = {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  level?: string | null;
  cover_image?: string | null;
  teacher?: {
    id: string;
    user?: {
      id: string;
      name: string | null;
      email: string | null;
      image_url?: string | null;
    } | null;
  } | null;
  students?: Array<{ id: string }> | null;
  studentCount?: number;
};

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editCourse, setEditCourse] = useState<Course | null>(null);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    // Get current user role
    fetch("/api/me")
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          setUserRole(data.user.role);
        }
      })
      .catch(() => setUserRole(null));
  }, []);

  async function loadCourses() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/courses");
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Failed to fetch courses');
        return;
      }

      // Transform courses to handle teacher data structure and student count
      const transformedCourses = (data.courses || []).map((c: any) => {
        // Handle teacher data - it can be an object with user nested inside
        let teacherUser = null;
        if (c.teacher?.user) {
          teacherUser = c.teacher.user;
        }

        // Get student count from course_students relationship
        let studentCount = 0;
        if (Array.isArray(c.students)) {
          studentCount = c.students.length;
        } else if (c.students && typeof c.students === 'object' && c.students.length !== undefined) {
          studentCount = c.students.length;
        }

        return {
          ...c,
          teacher: c.teacher ? {
            id: c.teacher.id,
            user: teacherUser,
          } : null,
          studentCount,
        };
      });

      setCourses(transformedCourses);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch courses');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (userRole) {
      loadCourses();
    }
  }, [userRole]);

  async function handleDelete(id: string) {
    if (!confirm('Delete this course?')) return;
    try {
      const res = await fetch(`/api/courses/${id}`, { method: 'DELETE' });
      if (res.ok) {
        loadCourses();
      } else {
        const data = await res.json();
        alert(data?.error || 'Failed to delete course');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete course');
    }
  }

  const canCreate = userRole === "admin" || userRole === "teacher";
  const canEdit = userRole === "admin";
  const canDelete = userRole === "admin";

  // Filter courses based on search query
  const filteredCourses = useMemo(() => {
    if (!searchQuery.trim()) {
      return courses;
    }

    const query = searchQuery.toLowerCase().trim();
    return courses.filter((course) => {
      const titleMatch = course.title?.toLowerCase().includes(query);
      const categoryMatch = course.category?.toLowerCase().includes(query);
      const levelMatch = course.level?.toLowerCase().includes(query);
      const teacherNameMatch = course.teacher?.user?.name?.toLowerCase().includes(query);
      const teacherEmailMatch = course.teacher?.user?.email?.toLowerCase().includes(query);
      const descriptionMatch = course.description?.toLowerCase().includes(query);

      return (
        titleMatch ||
        categoryMatch ||
        levelMatch ||
        teacherNameMatch ||
        teacherEmailMatch ||
        descriptionMatch
      );
    });
  }, [courses, searchQuery]);

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Courses</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage and view all your courses
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search courses..."
          />
          {canCreate && (
            <Button variant="secondary" asChild>
              <Link href="/courses/new">
                <Plus className="size-4 mr-2" />
                Create Course
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Error State */}
      {error && (
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
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading courses...</span>
        </div>
      ) : filteredCourses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((c) => {
            const teacherUser = c.teacher?.user;
            return (
              <CourseCard
                key={c.id}
                id={c.id}
                title={c.title}
                coverImage={c.cover_image}
                category={c.category}
                level={c.level}
                teacherName={teacherUser?.name ?? null}
                teacherAvatarUrl={teacherUser?.image_url ?? null}
                teacherEmail={teacherUser?.email ?? null}
                studentCount={c.studentCount}
                onEdit={canEdit ? () => setEditCourse(c) : undefined}
                onDelete={canDelete ? () => handleDelete(c.id) : undefined}
              />
            );
          })}
        </div>
      ) : searchQuery.trim() ? (
        <Card>
          <CardContent className="p-12 text-center">
            <BookOpen className="size-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No courses found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              No courses match your search query "{searchQuery}".
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <BookOpen className="size-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No courses yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {canCreate
                ? "Get started by creating your first course."
                : "No courses have been created yet."}
            </p>
            {canCreate && (
              <Button asChild>
                <Link href="/courses/new">
                  <Plus className="size-4 mr-2" />
                  Create Your First Course
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Edit Modal */}
      <Dialog open={!!editCourse} onOpenChange={(open) => !open && setEditCourse(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Course</DialogTitle>
            <DialogDescription>
              Edit course feature coming soon.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end mt-4">
            <Button variant="outline" onClick={() => setEditCourse(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
