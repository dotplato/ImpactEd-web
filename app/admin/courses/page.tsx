"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import * as Dialog from '@radix-ui/react-dialog';
import { CourseCard } from "@/components/cards/CourseCard";

export default function AdminCoursesPage() {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editCourse, setEditCourse] = useState<any | null>(null);

  async function loadCourses() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/courses");
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error || 'Failed to fetch courses');
      setLoading(false);
      return;
    }
    setCourses(data.courses || []);
    setLoading(false);
  }

  useEffect(() => {
    loadCourses();
  }, []);

  async function handleDelete(id: string) {
    if (!confirm('Delete this course?')) return;
    const res = await fetch(`/api/admin/courses/${id}`, { method: 'DELETE' });
    if (res.ok) {
      loadCourses();
    } else {
      const data = await res.json();
      alert(data?.error || 'Failed to delete course');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Courses</h1>
        <Link className="border rounded px-3 py-2 hover:bg-gray-50" href="/admin/courses/new">+ Create course</Link>
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading courses...</div>
      ) : courses.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((c: any) => {
            let tUser = null;
            if (c.teacher && Array.isArray(c.teacher) && c.teacher.length && c.teacher[0]?.user) {
              tUser = c.teacher[0].user;
            } else if (c.teacher?.user) {
              tUser = c.teacher.user;
            }
            return (
              <CourseCard
                key={c.id}
                id={c.id}
                title={c.title}
                teacherName={tUser?.name ?? null}
                teacherEmail={tUser?.email ?? null}
                onEdit={() => setEditCourse(c)}
                onDelete={() => handleDelete(c.id)}
              />
            );
          })}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">No courses yet</div>
      )}

      {/* Edit Modal (stub) */}
      <Dialog.Root open={!!editCourse} onOpenChange={(open) => !open && setEditCourse(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/30 z-40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-w-md w-full -translate-x-1/2 -translate-y-1/2 p-6 rounded-lg bg-white shadow-lg">
            <Dialog.Title className="text-lg font-semibold">Edit Course</Dialog.Title>
            <div className="mt-3 text-xs text-gray-400">Edit course feature coming soon.</div>
            <div className="flex justify-end mt-4">
              <button className="px-4 py-2 rounded bg-gray-100 text-gray-800 hover:bg-gray-200" onClick={() => setEditCourse(null)}>
                Close
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}


