import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { BookOpen, Video, FileText, MoreHorizontal, Trash, Pencil } from "lucide-react";

type Props = {
  id: string;
  title: string;
  teacherName?: string | null;
  teacherAvatarUrl?: string | null;
  teacherEmail?: string | null;
  onEdit?: ()=>void;
  onDelete?: ()=>void;
};

export function CourseCard({ id, title, teacherName, teacherAvatarUrl, teacherEmail, onEdit, onDelete }: Props) {
  const initials = (teacherName || "-")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="border rounded-lg p-0 overflow-hidden flex flex-col gap-0 hover:shadow-md transition-shadow relative">
      {/* Cover gradient */}
      <div className="h-4 w-full bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-pink-400" />
      {/* Top */}
      <div className="p-4 flex flex-col gap-4 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-md bg-muted flex items-center justify-center"><BookOpen className="size-5" /></div>
            <div>
              <Link href={`/admin/courses/${id}`} className="font-medium hover:underline">
                {title}
              </Link>
              <div className="text-xs text-muted-foreground">Course</div>
            </div>
          </div>
          <div className="flex gap-1 items-center">
            {onEdit && (
              <button onClick={onEdit} className="rounded-full bg-gray-100 hover:bg-blue-100 focus-visible:ring-2 focus-visible:ring-blue-300 p-1" title="Edit course"><Pencil className="size-4 text-blue-600" /></button>
            )}
            {onDelete && (
              <button onClick={onDelete} className="rounded-full bg-gray-100 hover:bg-red-100 focus-visible:ring-2 focus-visible:ring-red-300 p-1" title="Delete course"><Trash className="size-4 text-red-600" /></button>
            )}
            <Button variant="ghost" size="icon"><MoreHorizontal /></Button>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Avatar className="size-7">
              <AvatarImage src={teacherAvatarUrl || undefined} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="text-sm font-medium" title={teacherEmail || undefined}>
              {teacherName || <span className="text-gray-400">Unassigned</span>}
              {teacherEmail && <span className="block text-xs text-gray-400">{teacherEmail}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/admin/courses/${id}/videos`}><Video className="mr-1 size-4" /> Videos</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/admin/courses/${id}/files`}><FileText className="mr-1 size-4" /> Files</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}


