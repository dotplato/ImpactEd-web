import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/db/supabase-server";
import { getCurrentUser } from "@/lib/auth/session";

const CreateAssignmentSchema = z.object({
    title: z.string().min(1),
    description: z.any().optional(), // rich json
    courseId: z.string().uuid(),
    dueAt: z.string().optional(),
    totalMarks: z.number().optional(),
    minPassMarks: z.number().optional(),
    selectedStudents: z.array(z.string().uuid()).optional(),
    attachments: z.array(z.object({
        filePath: z.string(),
        fileName: z.string(),
        mime: z.string().optional()
    })).optional()
});

export async function GET() {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const supabase = getSupabaseServerClient();

    try {
        if (user.role === "admin") {
            const { data, error } = await supabase
                .from("assignments")
                .select(`
          *,
          course:courses(id, title),
          students:assignment_students(student:students(id, user:users(id, name, email))),
          attachments:assignment_attachments(*),
          submissions:assignment_submissions(*, attachments:submission_attachments(*))
        `)
                .order("created_at", { ascending: false });
            if (error) throw new Error(error.message);
            return NextResponse.json({ assignments: data });
        }

        if (user.role === "teacher") {
            const { data: teacher } = await supabase
                .from("teachers")
                .select("id")
                .eq("user_id", user.id)
                .maybeSingle();
            if (!teacher) return NextResponse.json({ assignments: [] });

            const { data, error } = await supabase
                .from("assignments")
                .select(`
          *,
          course:courses(id, title),
          students:assignment_students(student:students(id, user:users(id, name, email))),
          attachments:assignment_attachments(*),
          submissions:assignment_submissions(*, attachments:submission_attachments(*))
        `)
                .eq("created_by", teacher.id)
                .order("created_at", { ascending: false });
            if (error) throw new Error(error.message);
            return NextResponse.json({ assignments: data });
        }

        if (user.role === "student") {
            const { data: student } = await supabase
                .from("students")
                .select("id")
                .eq("user_id", user.id)
                .maybeSingle();
            if (!student) return NextResponse.json({ assignments: [] });

            const { data, error } = await supabase
                .from("assignment_students")
                .select(`
          assignment:assignments(
            *,
            course:courses(id, title),
            attachments:assignment_attachments(*),
            submissions:assignment_submissions(*, attachments:submission_attachments(*))
          )
        `)
                .eq("student_id", student.id)
                .eq("assignment.submissions.student_id", student.id);
            if (error) throw new Error(error.message);

            const assignments = (data ?? []).map((row: any) => row.assignment).filter(Boolean);
            return NextResponse.json({ assignments });
        }

        return NextResponse.json({ assignments: [] });
    } catch (e: any) {
        return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role === "student") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const parsed = CreateAssignmentSchema.safeParse(body);
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
        attachments
    } = parsed.data;

    const supabase = getSupabaseServerClient();

    try {
        let teacherId: string | null = null;
        const { data: teacher } = await supabase
            .from("teachers")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();
        teacherId = teacher?.id || null;

        if (user.role === "teacher" && !teacherId) {
            return NextResponse.json({ error: "Teacher profile not found" }, { status: 400 });
        }

        // Insert assignment
        const { data: assignment, error: insErr } = await supabase
            .from("assignments")
            .insert({
                course_id: courseId,
                title,
                description_richjson: description,
                due_at: dueAt ? new Date(dueAt).toISOString() : null,
                total_marks: totalMarks,
                min_pass_marks: minPassMarks,
                created_by: teacherId,
            })
            .select("id")
            .single();

        if (insErr) throw new Error(insErr.message);
        const assignmentId = assignment.id;

        // Insert assignment_students
        if (selectedStudents && selectedStudents.length > 0) {
            const studentRels = selectedStudents.map(sId => ({
                assignment_id: assignmentId,
                student_id: sId
            }));
            const { error: relErr } = await supabase.from("assignment_students").insert(studentRels);
            if (relErr) throw new Error(relErr.message);
        }

        // Insert assignment_attachments
        if (attachments && attachments.length > 0) {
            const attachmentRels = attachments.map(a => ({
                assignment_id: assignmentId,
                file_path: a.filePath,
                file_name: a.fileName,
                mime: a.mime
            }));
            const { error: attErr } = await supabase.from("assignment_attachments").insert(attachmentRels);
            if (attErr) throw new Error(attErr.message);
        }

        return NextResponse.json({ ok: true, id: assignmentId });
    } catch (e: any) {
        return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
    }
}
