import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/db/supabase-server";
import { getCurrentUser } from "@/lib/auth/session";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "admin" && user.role !== "teacher")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: courseId, fileId } = await params;

    if (!courseId || !fileId) {
      return NextResponse.json(
        { error: "Course ID and File ID are required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();

    // Verify course exists and user has access
    let courseQuery = supabase
      .from("courses")
      .select("id, teacher_id")
      .eq("id", courseId);

    if (user.role === "teacher") {
      const { data: teacher } = await supabase
        .from("teachers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!teacher) {
        return NextResponse.json(
          { error: "Teacher profile not found" },
          { status: 404 }
        );
      }

      courseQuery = courseQuery.eq("teacher_id", teacher.id);
    }

    const { data: course, error: courseError } = await courseQuery.maybeSingle();

    if (courseError || !course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Get file record
    const { data: fileRecord, error: fileError } = await supabase
      .from("course_files")
      .select("file_path")
      .eq("id", fileId)
      .eq("course_id", courseId)
      .maybeSingle();

    if (fileError || !fileRecord) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Delete from storage (extract path from URL if needed)
    const filePath = fileRecord.file_path;
    if (filePath) {
      // Extract path from public URL if it's a full URL
      const pathMatch = filePath.match(/courses\/[^/]+\/(.+)$/);
      const storagePath = pathMatch
        ? `courses/${courseId}/${pathMatch[1]}`
        : filePath;

      await supabase.storage.from("course-files").remove([storagePath]);
    }

    // Delete file record
    const { error: deleteError } = await supabase
      .from("course_files")
      .delete()
      .eq("id", fileId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
