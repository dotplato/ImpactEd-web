import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AdminHomePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Admin Overview</h1>
      <p className="text-sm text-muted-foreground">Quick links</p>
      <div className="flex gap-2 flex-wrap">
        <Button asChild><Link href="/admin/courses/new">Create Course</Link></Button>
        <Button variant="secondary" asChild><Link href="/admin/courses">View Courses</Link></Button>
        <Button variant="secondary" asChild><Link href="/admin/teachers">View Teachers</Link></Button>
        <Button variant="secondary" asChild><Link href="/admin/students">View Students</Link></Button>
        <Button variant="secondary" asChild><Link href="/admin/sessions">View Sessions</Link></Button>
      </div>
    </div>
  );
}


