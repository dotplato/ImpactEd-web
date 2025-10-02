import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { BookOpen, Video, FileText, MoreHorizontal } from "lucide-react";

type Props = {
  id: string;
  title: string;
  teacherName?: string | null;
  teacherAvatarUrl?: string | null;
};

export function CourseCard({ id, title, teacherName, teacherAvatarUrl }: Props) {
  const initials = (teacherName || "-")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="border rounded-lg p-4 flex flex-col gap-4 hover:shadow-sm transition-shadow">
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
        <Button variant="ghost" size="icon"><MoreHorizontal /></Button>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Avatar className="size-7">
            <AvatarImage src={teacherAvatarUrl || undefined} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="text-sm">{teacherName || "Unassigned"}</div>
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
  );
}


