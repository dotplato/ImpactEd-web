import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/db/supabase-server";
import { getCurrentUser } from "@/lib/auth/session";

const SubmitQuizSchema = z.object({
    answers: z.record(z.string(), z.any()),
    attachments: z.array(z.object({
        name: z.string(),
        url: z.string(),
        type: z.string().optional(),
    })).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "student") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id: quizId } = await params;
    const body = await req.json();
    console.log("Quiz submission received:", { quizId, attachmentsCount: body.attachments?.length });

    const parsed = SubmitQuizSchema.safeParse(body);
    if (!parsed.success) {
        console.error("Quiz submission validation failed:", parsed.error.format());
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { answers, attachments } = parsed.data;
    const supabase = getSupabaseServerClient();

    try {
        const { data: student } = await supabase
            .from("students")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();

        if (!student) return NextResponse.json({ error: "Student profile not found" }, { status: 400 });

        // Check if student is assigned to this quiz
        const { data: assigned } = await supabase
            .from("quiz_students")
            .select("id")
            .eq("quiz_id", quizId)
            .eq("student_id", student.id)
            .maybeSingle();

        if (!assigned) return NextResponse.json({ error: "Quiz not assigned to you" }, { status: 403 });

        // Fetch questions to calculate score
        const { data: questions } = await supabase
            .from("quiz_questions")
            .select("*")
            .eq("quiz_id", quizId);

        let score = 0;
        if (questions) {
            questions.forEach(q => {
                const studentAnswer = answers[q.id];
                if (q.question_type === "multiple_choice") {
                    if (studentAnswer === q.correct_answer) {
                        score += Number(q.points || 0);
                    }
                }
                else if (q.question_type === "short_answer") {
                    if (studentAnswer?.trim().toLowerCase() === q.correct_answer?.trim().toLowerCase()) {
                        score += Number(q.points || 0);
                    }
                }
            });
        }

        // Upsert submission
        const { data: submission, error: subErr } = await supabase
            .from("quiz_submissions")
            .upsert({
                quiz_id: quizId,
                student_id: student.id,
                answers,
                score,
                submitted_at: new Date().toISOString(),
            }, { onConflict: 'quiz_id,student_id' })
            .select("id")
            .single();

        if (subErr) {
            console.error("Submission upsert error:", subErr);
            throw new Error(subErr.message);
        }

        // Delete old attachments if any
        const { error: delErr } = await supabase.from("quiz_submission_attachments").delete().eq("submission_id", submission.id);
        if (delErr) console.error("Failed to delete old attachments:", delErr);

        // Insert attachments
        if (attachments && Array.isArray(attachments) && attachments.length > 0) {
            const attachmentRows = attachments.map((att: any) => ({
                submission_id: submission.id,
                file_url: att.url,
                file_name: att.name,
                file_type: att.type
            }));
            const { error: attErr } = await supabase.from("quiz_submission_attachments").insert(attachmentRows);
            if (attErr) {
                console.error("Failed to save submission attachments:", attErr);
                throw new Error("Failed to save attachments: " + attErr.message);
            }
        }

        return NextResponse.json({ ok: true, score, id: submission.id });
    } catch (e: any) {
        console.error("Quiz submission error:", e);
        return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
    }
}
