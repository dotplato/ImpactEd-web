import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/db/supabase-server";
import { getCurrentUser } from "@/lib/auth/session";
import { z } from "zod";

const CreateCourseSchema = z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    teacherId: z.string().uuid().optional(),
    category: z.string().optional(),
    level: z.string().optional(),
    whatStudentsWillLearn: z.array(z.string()).optional(),
    coverImage: z.string().optional(),
    // Tenure fields from previous code, keeping them optional if needed, or removing if not in new design.
    // The user didn't explicitly ask to remove them, but the screenshot doesn't show them.
    // I'll keep them as optional for backward compatibility if needed, but focus on new fields.
    tenureStart: z.string().optional(),
    tenureEnd: z.string().optional(),
    studentIds: z.array(z.string()).optional(),
});

export async function GET() {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabaseServerClient();
    const { data: courses, error } = await supabase
        .from("courses")
        .select(`
      *,
      teacher:teachers(
        id,
        user:users(id, name, email, image_url)
      )
    `)
        .order("created_at", { ascending: false });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ courses });
}

export async function POST(req: Request) {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const parsed = CreateCourseSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
        }

        const {
            title,
            description,
            teacherId,
            category,
            level,
            whatStudentsWillLearn,
            coverImage,
            tenureStart,
            tenureEnd,
            studentIds
        } = parsed.data;

        const supabase = getSupabaseServerClient();

        // Create course
        const { data: course, error: createError } = await supabase
            .from("courses")
            .insert({
                title,
                description,
                teacher_id: teacherId || null,
                category,
                level,
                what_students_will_learn: whatStudentsWillLearn,
                cover_image: coverImage,
                tenure_start: tenureStart ? new Date(tenureStart).toISOString() : null,
                tenure_end: tenureEnd ? new Date(tenureEnd).toISOString() : null,
            })
            .select("id")
            .single();

        if (createError) {
            throw new Error(createError.message);
        }

        // Enroll students if any
        if (studentIds && studentIds.length > 0) {
            const enrollments = studentIds.map((sid) => ({
                course_id: course.id,
                student_id: sid,
            }));
            const { error: enrollError } = await supabase
                .from("enrollments")
                .insert(enrollments);

            if (enrollError) {
                console.error("Failed to enroll students:", enrollError);
                // Not failing the whole request, just logging
            }
        }

        return NextResponse.json({ id: course.id });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
