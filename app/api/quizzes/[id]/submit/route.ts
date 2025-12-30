import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/db/supabase-server";
import { getCurrentUser } from "@/lib/auth/session";

const SubmitQuizSchema = z.object({
    answers: z.any(), // Record<questionId, answer>
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "student") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const quizId = params.id;
    const body = await req.json();
    const parsed = SubmitQuizSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { answers } = parsed.data;
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
                // For short answer, we might need manual grading or simple string match
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
            })
            .select("id")
            .single();

        if (subErr) throw new Error(subErr.message);

        return NextResponse.json({ ok: true, score, id: submission.id });
    } catch (e: any) {
        return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
    }
}
