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
    tenureStart: z.string().optional(),
    tenureEnd: z.string().optional(),
    studentIds: z.array(z.string()).optional(),
    curriculum: z.any().optional(),
});

export async function GET() {
    const user = await getCurrentUser();
    if (!user || (user.role !== "admin" && user.role !== "teacher")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabaseServerClient();
    
    // Teachers can only see their own courses
    if (user.role === "teacher") {
        const { data: teacher } = await supabase
            .from("teachers")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();
        
        if (!teacher) {
            return NextResponse.json({ courses: [] });
        }

        const { data: courses, error } = await supabase
            .from("courses")
            .select(`
                *,
                teacher:teachers(
                    id,
                    user:users(id, name, email, image_url)
                ),
                students:course_students(id)
            `)
            .eq("teacher_id", teacher.id)
            .order("created_at", { ascending: false });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Transform to include student count
        const coursesWithCount = (courses || []).map((c: any) => ({
            ...c,
            studentCount: Array.isArray(c.students) ? c.students.length : 0,
        }));

        return NextResponse.json({ courses: coursesWithCount });
    }

    // Admin sees all courses
    const { data: courses, error } = await supabase
        .from("courses")
        .select(`
            *,
            teacher:teachers(
                id,
                user:users(id, name, email, image_url)
            ),
            students:course_students(id)
        `)
        .order("created_at", { ascending: false });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform to include student count
    const coursesWithCount = (courses || []).map((c: any) => ({
        ...c,
        studentCount: Array.isArray(c.students) ? c.students.length : 0,
    }));

    return NextResponse.json({ courses: coursesWithCount });
}

export async function POST(req: Request) {
    const user = await getCurrentUser();
    if (!user || (user.role !== "admin" && user.role !== "teacher")) {
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
            studentIds,
            curriculum
        } = parsed.data;

        const supabase = getSupabaseServerClient();

        // Teachers can only create courses for themselves
        let finalTeacherId = teacherId;
        if (user.role === "teacher") {
            const { data: teacher } = await supabase
                .from("teachers")
                .select("id")
                .eq("user_id", user.id)
                .maybeSingle();
            
            if (!teacher) {
                return NextResponse.json({ error: "Teacher profile not found" }, { status: 400 });
            }
            finalTeacherId = teacher.id;
        }

        // Create course
        const { data: course, error: createError } = await supabase
            .from("courses")
            .insert({
                title,
                description,
                teacher_id: finalTeacherId || null,
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
                .from("course_students")
                .insert(enrollments);

            if (enrollError) {
                console.error("Failed to enroll students:", enrollError);
                // Not failing the whole request, just logging
            }
        }

        // Create Sessions from Curriculum
        if (curriculum && Array.isArray(curriculum)) {
            for (const section of curriculum) {
                for (const lesson of section.lessons) {
                    // Use scheduledAt from lesson if provided, otherwise use current time as placeholder
                    const scheduledAt = lesson.scheduledAt 
                        ? new Date(lesson.scheduledAt).toISOString()
                        : new Date().toISOString();

                    if (lesson.type === 'lecture') {
                        // Create session for lectures
                        const { error: sessionError } = await supabase
                            .from("course_sessions")
                            .insert({
                                course_id: course.id,
                                title: lesson.title || `Session from ${section.title || 'Untitled Section'}`,
                                teacher_id: finalTeacherId || null,
                                scheduled_at: scheduledAt,
                                duration_minutes: 60,
                                status: 'upcoming'
                            });

                        if (sessionError) {
                            console.error("Failed to create session:", sessionError);
                        }
                    } else if (lesson.type === 'assignment') {
                        // Create assignment with all fields
                        const { data: assignment, error: assignmentError } = await supabase
                            .from("assignments")
                            .insert({
                                course_id: course.id,
                                title: lesson.title || `Assignment from ${section.title || 'Untitled Section'}`,
                                description_richjson: lesson.description || null,
                                due_at: scheduledAt,
                                total_marks: lesson.totalMarks ? Number(lesson.totalMarks) : null,
                                min_pass_marks: lesson.minPassMarks ? Number(lesson.minPassMarks) : null,
                                created_by: finalTeacherId || null,
                            })
                            .select("id")
                            .single();

                        if (assignmentError) {
                            console.error("Failed to create assignment:", assignmentError);
                        } else if (assignment && studentIds && studentIds.length > 0) {
                            // Assign to all enrolled students (from course enrollment)
                            const assignmentStudents = studentIds.map((studentId: string) => ({
                                assignment_id: assignment.id,
                                student_id: studentId,
                            }));
                            const { error: assignError } = await supabase
                                .from("assignment_students")
                                .insert(assignmentStudents);
                            
                            if (assignError) {
                                console.error("Failed to assign students to assignment:", assignError);
                            }
                        }
                    } else if (lesson.type === 'quiz') {
                        // Create quiz with all fields
                        const { data: quiz, error: quizError } = await supabase
                            .from("quizzes")
                            .insert({
                                course_id: course.id,
                                title: lesson.title || `Quiz from ${section.title || 'Untitled Section'}`,
                                description: lesson.description || null,
                                due_at: scheduledAt,
                                total_marks: lesson.totalMarks ? Number(lesson.totalMarks) : null,
                                min_pass_marks: null, // Quizzes don't use min_pass_marks in the same way
                                created_by: finalTeacherId || null,
                                attachment_required: lesson.attachmentRequired || false,
                            })
                            .select("id")
                            .single();

                        if (quizError) {
                            console.error("Failed to create quiz:", quizError);
                        } else if (quiz && studentIds && studentIds.length > 0) {
                            // Assign to all enrolled students (from course enrollment)
                            const quizStudents = studentIds.map((studentId: string) => ({
                                quiz_id: quiz.id,
                                student_id: studentId,
                            }));
                            const { error: quizAssignError } = await supabase
                                .from("quiz_students")
                                .insert(quizStudents);
                            
                            if (quizAssignError) {
                                console.error("Failed to assign students to quiz:", quizAssignError);
                            }
                        }
                    }
                }
            }
        }

        return NextResponse.json({ id: course.id });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

