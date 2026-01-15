import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/db/supabase-server";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
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

    // Check access based on role
    if (user.role === "student") {
      const { data: student } = await supabase
        .from("students")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!student) {
        return NextResponse.json(
          { error: "Student profile not found" },
          { status: 404 }
        );
      }

      const { data: enrollment } = await supabase
        .from("course_students")
        .select("id")
        .eq("course_id", courseId)
        .eq("student_id", student.id)
        .maybeSingle();

      if (!enrollment) {
        return NextResponse.json(
          { error: "Unauthorized: Not enrolled in this course" },
          { status: 401 }
        );
      }
    } else if (user.role !== "admin" && user.role !== "teacher") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Build query
    let query = supabase
      .from("courses")
      .select(
        `
                *,
                teacher:teachers(
                    id,
                    user:users(id, name, email, image_url)
                ),
                students:course_students(
                    student:students(
                        id,
                        user:users(id, name, email)
                    )
                )
            `
      )
      .eq("id", courseId);

    // Teachers can only see their own courses
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

      query = query.eq("teacher_id", teacher.id);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Transform students to match expected format
    const course = {
      ...data,
      students: (data.students || []).map((row: any) => {
        const student = row.student;
        const user = student?.user || {};
        return {
          id: student?.id,
          name: user.name || "",
          email: user.email || "",
        };
      }),
    };

    return NextResponse.json({ course });
  } catch (e: any) {
    return NextResponse.json(
      { error: String(e?.message || e) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
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

    const { error } = await supabase
      .from("courses")
      .delete()
      .eq("id", courseId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
