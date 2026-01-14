import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/db/supabase-server";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const user = await getCurrentUser();
        if (!user || (user.role !== "admin" && user.role !== "teacher")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const courseId = params.id;
        if (!courseId) {
            return NextResponse.json({ error: "Course ID is required" }, { status: 400 });
        }

        const supabase = getSupabaseServerClient();

        // Verify course exists and user has access
        let courseQuery = supabase
            .from("courses")
            .select("id, teacher_id")
            .eq("id", courseId)
            .maybeSingle();

        if (user.role === "teacher") {
            const { data: teacher } = await supabase
                .from("teachers")
                .select("id")
                .eq("user_id", user.id)
                .maybeSingle();
            
            if (!teacher) {
                return NextResponse.json({ error: "Teacher profile not found" }, { status: 404 });
            }

            courseQuery = courseQuery.eq("teacher_id", teacher.id);
        }

        const { data: course, error: courseError } = await courseQuery;

        if (courseError || !course) {
            return NextResponse.json({ error: "Course not found" }, { status: 404 });
        }

        // Fetch sessions for this course
        const { data: sessions, error } = await supabase
            .from("course_sessions")
            .select("id, title, scheduled_at, duration_minutes, status")
            .eq("course_id", courseId)
            .order("scheduled_at", { ascending: true });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ sessions: sessions || [] });
    } catch (e: any) {
        return NextResponse.json(
            { error: String(e?.message || e) },
            { status: 500 }
        );
    }
}

