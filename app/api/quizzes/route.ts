import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/db/supabase-server";
import { getCurrentUser } from "@/lib/auth/session";

const CreateQuizSchema = z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    courseId: z.string().uuid(),
    dueAt: z.string().optional(),
    totalMarks: z.number().optional(),
    minPassMarks: z.number().optional(),
    selectedStudents: z.array(z.string().uuid()).optional(),
    questions: z.array(z.object({
        questionText: z.string().min(1),
        questionType: z.string().default("multiple_choice"),
        options: z.any().optional(),
        correctAnswer: z.string().optional(),
        points: z.number().default(1),
        sortOrder: z.number().default(0)
    })).optional()
});

export async function GET() {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const supabase = getSupabaseServerClient();

    try {
        if (user.role === "admin") {
            const { data, error } = await supabase
                .from("quizzes")
                .select(`
          *,
          course:courses(id, title),
          students:quiz_students(student:students(id, user:users(id, name, email, image_url))),
          submissions:quiz_submissions(*, student:students(id, user:users(name, email, image_url))),
          questions:quiz_questions(*)
        `)
                .order("created_at", { ascending: false });

            if (error) throw new Error(error.message);

            if (data) {
                for (const quiz of data) {
                    for (const sub of (quiz.submissions || [])) {
                        const { data: atts } = await supabase
                            .from("quiz_submission_attachments")
                            .select("*")
                            .eq("submission_id", sub.id);
                        sub.attachments = atts || [];
                    }
                }
            }

            return NextResponse.json({ quizzes: data });
        }

        if (user.role === "teacher") {
            const { data: teacher } = await supabase
                .from("teachers")
                .select("id")
                .eq("user_id", user.id)
                .maybeSingle();
            if (!teacher) return NextResponse.json({ quizzes: [] });

            const { data, error } = await supabase
                .from("quizzes")
                .select(`
          *,
          course:courses(id, title),
          students:quiz_students(student:students(id, user:users(id, name, email, image_url))),
          questions:quiz_questions(*),
          submissions:quiz_submissions(*, student:students(id, user:users(name, email, image_url)))
        `)
                .eq("created_by", teacher.id)
                .order("created_at", { ascending: false });

            if (error) throw new Error(error.message);

            if (data) {
                for (const quiz of data) {
                    for (const sub of (quiz.submissions || [])) {
                        const { data: atts } = await supabase
                            .from("quiz_submission_attachments")
                            .select("*")
                            .eq("submission_id", sub.id);
                        sub.attachments = atts || [];
                    }
                }
            }

            return NextResponse.json({ quizzes: data });
        }

        if (user.role === "student") {
            const { data: student } = await supabase
                .from("students")
                .select("id")
                .eq("user_id", user.id)
                .maybeSingle();
            if (!student) return NextResponse.json({ quizzes: [] });

            const { data, error } = await supabase
                .from("quiz_students")
                .select(`
          quiz:quizzes(
            *,
            course:courses(id, title),
            submissions:quiz_submissions(*, student:students(id, user:users(name, email, image_url))),
            questions:quiz_questions(*)
          )
        `)
                .eq("student_id", student.id)
                .eq("quiz.submissions.student_id", student.id);

            if (error) throw new Error(error.message);

            const quizzes = (data ?? []).map((row: any) => row.quiz).filter(Boolean);

            for (const quiz of quizzes) {
                for (const sub of (quiz.submissions || [])) {
                    const { data: atts } = await supabase
                        .from("quiz_submission_attachments")
                        .select("*")
                        .eq("submission_id", sub.id);
                    sub.attachments = atts || [];
                }
            }

            return NextResponse.json({ quizzes });
        }

        return NextResponse.json({ quizzes: [] });
    } catch (e: any) {
        return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role === "student") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const parsed = CreateQuizSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const {
        title,
        description,
        courseId,
        dueAt,
        totalMarks,
        minPassMarks,
        selectedStudents,
        questions
    } = parsed.data;

    const attachmentRequired = (body as any).attachmentRequired || false;

    const supabase = getSupabaseServerClient();

    try {
        let teacherId: string | null = null;
        const { data: teacher } = await supabase
            .from("teachers")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();
        teacherId = teacher?.id || null;

        // If user is admin and no teacher profile, create one
        if (!teacherId && user.role === "admin") {
            const { data: newTeacher, error: createErr } = await supabase
                .from("teachers")
                .insert({ user_id: user.id })
                .select("id")
                .single();

            if (!createErr && newTeacher) {
                teacherId = newTeacher.id;
            }
        }

        if (!teacherId) {
            return NextResponse.json({ error: "Teacher profile required to create quiz" }, { status: 400 });
        }

        // Insert quiz
        const { data: quiz, error: insErr } = await supabase
            .from("quizzes")
            .insert({
                course_id: courseId,
                title,
                description,
                due_at: dueAt ? new Date(dueAt).toISOString() : null,
                total_marks: totalMarks,
                min_pass_marks: minPassMarks,
                created_by: teacherId,
                attachment_required: attachmentRequired
            })
            .select("id")
            .single();

        if (insErr) throw new Error(insErr.message);
        const quizId = quiz.id;

        // Insert attachments
        const attachments = (parsed.data as any).attachments;
        if (attachments && Array.isArray(attachments) && attachments.length > 0) {
            const attachmentRows = attachments.map((att: any) => ({
                quiz_id: quizId,
                file_url: att.url,
                file_name: att.name,
                file_type: att.type
            }));
            const { error: attErr } = await supabase.from("quiz_attachments").insert(attachmentRows);
            if (attErr) console.error("Failed to save attachments", attErr);
        }

        // Insert quiz_students
        if (selectedStudents && selectedStudents.length > 0) {
            const studentRels = selectedStudents.map(sId => ({
                quiz_id: quizId,
                student_id: sId
            }));
            const { error: relErr } = await supabase.from("quiz_students").insert(studentRels);
            if (relErr) throw new Error(relErr.message);
        }

        // Insert quiz_questions
        if (questions && questions.length > 0) {
            const questionRels = questions.map(q => ({
                quiz_id: quizId,
                question_text: q.questionText,
                question_type: q.questionType,
                options: q.options,
                correct_answer: q.correctAnswer,
                points: q.points,
                sort_order: q.sortOrder
            }));
            const { error: qErr } = await supabase.from("quiz_questions").insert(questionRels);
            if (qErr) throw new Error(qErr.message);
        }

        return NextResponse.json({ ok: true, id: quizId });
    } catch (e: any) {
        return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role === "student") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const supabase = getSupabaseServerClient();

    try {
        // Verify ownership
        if (user.role === "teacher") {
            const { data: teacher } = await supabase
                .from("teachers")
                .select("id")
                .eq("user_id", user.id)
                .single();

            if (!teacher) return NextResponse.json({ error: "Teacher profile not found" }, { status: 404 });

            const { data: quiz } = await supabase
                .from("quizzes")
                .select("created_by")
                .eq("id", id)
                .single();

            if (!quiz || quiz.created_by !== teacher.id) {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }
        }

        const { error } = await supabase.from("quizzes").delete().eq("id", id);
        if (error) throw new Error(error.message);

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
    }
}
