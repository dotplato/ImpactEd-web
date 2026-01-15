import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/db/supabase-server";
import { getCurrentUser } from "@/lib/auth/session";

const GradeSubmissionSchema = z.object({
    grade: z.number().min(0),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role === "student") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id: submissionId } = await params;
    const body = await req.json();
    const parsed = GradeSubmissionSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { grade } = parsed.data;
    const supabase = getSupabaseServerClient();

    try {
        // Verify if the user is the teacher who created the assignment or an admin
        if (user.role === "teacher") {
            const { data: teacher } = await supabase
                .from("teachers")
                .select("id")
                .eq("user_id", user.id)
                .maybeSingle();

            if (!teacher) return NextResponse.json({ error: "Teacher profile not found" }, { status: 400 });

            const { data: submission } = await supabase
                .from("assignment_submissions")
                .select("assignment:assignments(created_by)")
                .eq("id", submissionId)
                .maybeSingle();

            if (!submission || (submission.assignment as any).created_by !== teacher.id) {
                return NextResponse.json({ error: "You are not authorized to grade this submission" }, { status: 403 });
            }
        }

        const { error } = await supabase
            .from("assignment_submissions")
            .update({
                grade,
                status: 'graded'
            })
            .eq("id", submissionId);

        if (error) throw new Error(error.message);

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
    }
}
