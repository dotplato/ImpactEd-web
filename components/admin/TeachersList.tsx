"use client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { StatusTag } from "../ui/status-tag";

type Teacher = {
  id: string;
  profile_pic?: string | null;
  qualification?: string | null;
  user?: { name: string; email: string } | null;
};

type Props = {
  teachers: Teacher[];
};

export function TeachersList({ teachers }: Props) {
  return (
    <div className="space-y-2">
      {teachers.map((t) => {
        const initials = (t.user?.name || "?")
          .split(" ")
          .map((p) => p[0])
          .join("")
          .slice(0, 2)
          .toUpperCase();

        return (
          <Link
            key={t.id}
            href={`/teachers`}
            className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors border-b last:border-b-0"
          >
            <Avatar className="size-10">
              <AvatarImage src={t.profile_pic || undefined} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{t.user?.name || "Unknown"}</div>
              <div className="text-xs text-muted-foreground truncate">{t.user?.email || "No email"}</div>
            </div>
            {t.qualification && (
<StatusTag>

                {t.qualification}
</StatusTag>
            )}
          </Link>
        );
      })}
    </div>
  );
}

