import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/db/supabase-server";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "admin" && user.role !== "teacher")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: courseId } = await params;
    if (!courseId) {
      return NextResponse.json(
        { error: "Course ID is required" },
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

    // Fetch students enrolled in this course via course_students table
    const { data, error } = await supabase
      .from("course_students")
      .select(
        `
                student:students(
                    id,
                    user:users(id, name, email, image_url)
                )
            `
      )
      .eq("course_id", courseId);

    if (error) {
      console.error("Error fetching course students:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform the data to match the expected format
    const students = (data || [])
      .map((row: any) => {
        const student = row.student;
        const user = student?.user || {};
        return {
          id: student?.id,
          name: user.name || "",
          email: user.email || "",
          image_url: user.image_url || null,
        };
      })
      .filter((s: any) => s.id); // Filter out any invalid entries

    return NextResponse.json({ students });
  } catch (e: any) {
    console.error("Error in GET /api/courses/[id]/students:", e);
    return NextResponse.json(
      { error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
