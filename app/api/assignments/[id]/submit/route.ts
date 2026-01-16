import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/db/supabase-server";
import { getCurrentUser } from "@/lib/auth/session";

const SubmitAssignmentSchema = z.object({
    content: z.any().optional(), // rich json
    attachments: z.array(z.object({
        filePath: z.string(),
        fileName: z.string(),
        mime: z.string().optional()
    })).optional()
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "student") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id: assignmentId } = await params;
    const body = await req.json();
    const parsed = SubmitAssignmentSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { content, attachments } = parsed.data;
    const supabase = getSupabaseServerClient();

    try {
        const { data: student } = await supabase
            .from("students")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();

        if (!student) return NextResponse.json({ error: "Student profile not found" }, { status: 400 });

        // Check if student is assigned to this assignment
        const { data: assigned } = await supabase
            .from("assignment_students")
            .select("id")
            .eq("assignment_id", assignmentId)
            .eq("student_id", student.id)
            .maybeSingle();

        if (!assigned) return NextResponse.json({ error: "Assignment not assigned to you" }, { status: 403 });

        // Upsert submission
        const { data: submission, error: subErr } = await supabase
            .from("assignment_submissions")
            .upsert({
                assignment_id: assignmentId,
                student_id: student.id,
                content_richjson: content,
                submitted_at: new Date().toISOString(),
            })
            .select("id")
            .single();

        if (subErr) throw new Error(subErr.message);
        const submissionId = submission.id;

        // Insert submission_attachments
        if (attachments && attachments.length > 0) {
            // Clear old attachments if re-submitting
            await supabase.from("submission_attachments").delete().eq("submission_id", submissionId);

            const attachmentRels = attachments.map(a => ({
                submission_id: submissionId,
                file_path: a.filePath,
                file_name: a.fileName,
                mime: a.mime
            }));
            const { error: attErr } = await supabase.from("submission_attachments").insert(attachmentRels);
            if (attErr) throw new Error(attErr.message);
        }

        return NextResponse.json({ ok: true, id: submissionId });
    } catch (e: any) {
        return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
    }
}
