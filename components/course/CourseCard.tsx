import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, FileText, MoreHorizontal, Trash, Pencil, Users } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Props = {
  id: string;
  title: string;
  coverImage?: string | null;
  category?: string | null;
  level?: string | null;
  teacherName?: string | null;
  teacherAvatarUrl?: string | null;
  teacherEmail?: string | null;
  studentCount?: number;
  onEdit?: () => void;
  onDelete?: () => void;
};

export function CourseCard({ 
  id, 
  title, 
  coverImage,
  category,
  level,
  teacherName, 
  teacherAvatarUrl, 
  teacherEmail,
  studentCount,
  onEdit, 
  onDelete 
}: Props) {
  const initials = (teacherName || "-")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow group">
      {/* Cover Image */}
      {coverImage ? (
        <div className="relative w-full h-48 overflow-hidden bg-muted">
          <img 
            src={coverImage} 
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      ) : (
        <div className="w-full h-48 bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400" />
      )}

      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <Link 
              href={`/courses/${id}`} 
              className="font-semibold text-lg hover:text-primary transition-colors line-clamp-2 block"
            >
              {title}
            </Link>
            <div className="flex items-center gap-2 mt-1">
              {category && (
                <Badge variant="outline" className="text-xs">
                  {category}
                </Badge>
              )}
              {level && (
                <Badge variant="outline" className="text-xs">
                  {level}
                </Badge>
              )}
            </div>
          </div>
          {(onEdit || onDelete) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onEdit && (
                  <DropdownMenuItem onClick={onEdit}>
                    <Pencil className="size-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <DropdownMenuItem onClick={onDelete} className="text-destructive">
                    <Trash className="size-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Teacher Info */}
        <div className="flex items-center gap-3">
          <Avatar className="size-8">
            <AvatarImage src={teacherAvatarUrl || undefined} />
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">
              {teacherName || <span className="text-muted-foreground">Unassigned</span>}
            </div>
            {teacherEmail && (
              <div className="text-xs text-muted-foreground truncate">{teacherEmail}</div>
            )}
          </div>
        </div>

        {/* Stats & Actions */}
        <div className="flex items-center justify-between pt-2 border-t">
          {studentCount !== undefined && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="size-3.5" />
              <span>{studentCount} students</span>
            </div>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/courses/${id}?tab=schedule`}>
                <Calendar className="size-3.5 mr-1.5" />
                Schedule
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/courses/${id}?tab=files`}>
                <FileText className="size-3.5 mr-1.5" />
                Files
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
