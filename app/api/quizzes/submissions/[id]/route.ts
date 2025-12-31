import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/db/supabase-server";
import { getCurrentUser } from "@/lib/auth/session";

const UpdateScoreSchema = z.object({
    score: z.number().min(0),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role === "student") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const submissionId = params.id;
    const body = await req.json();
    const parsed = UpdateScoreSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { score } = parsed.data;
    const supabase = getSupabaseServerClient();

    try {
        // Verify teacher owns the quiz
        const { data: submission, error: fetchErr } = await supabase
            .from("quiz_submissions")
            .select(`
                id,
                quiz:quizzes(created_by)
            `)
            .eq("id", submissionId)
            .single();

        if (fetchErr || !submission) {
            return NextResponse.json({ error: "Submission not found" }, { status: 404 });
        }

        // Check if user is the teacher who created the quiz (or admin)
        if (user.role === "teacher") {
            const { data: teacher } = await supabase
                .from("teachers")
                .select("id")
                .eq("user_id", user.id)
                .single();

            if (!teacher || teacher.id !== (submission.quiz as any).created_by) {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }
        }

        // Update score
        const { error: updateErr } = await supabase
            .from("quiz_submissions")
            .update({ score })
            .eq("id", submissionId);

        if (updateErr) throw new Error(updateErr.message);

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
    }
}
