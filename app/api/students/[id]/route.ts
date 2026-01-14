import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/db/supabase-server";
import { getCurrentUser } from "@/lib/auth/session";
import { z } from "zod";

const UpdateStudentSchema = z.object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    studentId: z.string().optional(),
    feeStatus: z.string().optional(),
    gender: z.string().optional(),
    joinDate: z.string().optional(),
    phone: z.string().optional(),
    image_url: z.string().optional(),
});

export async function PATCH(
    req: Request,
    { params }: { params: { id: string } }
) {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const studentId = params.id;
        if (!studentId) {
            return NextResponse.json({ error: "Student ID is required" }, { status: 400 });
        }

        const body = await req.json();
        const parsed = UpdateStudentSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
        }

        const supabase = getSupabaseServerClient();

        // Get student to find user_id
        const { data: student, error: studentError } = await supabase
            .from("students")
            .select("user_id")
            .eq("id", studentId)
            .maybeSingle();

        if (studentError || !student) {
            return NextResponse.json({ error: "Student not found" }, { status: 404 });
        }

        // Update user if name, email, or image_url provided
        const userUpdates: any = {};
        if (parsed.data.name !== undefined) userUpdates.name = parsed.data.name;
        if (parsed.data.email !== undefined) userUpdates.email = parsed.data.email.toLowerCase();
        if (parsed.data.image_url !== undefined) userUpdates.image_url = parsed.data.image_url;

        if (Object.keys(userUpdates).length > 0) {
            const { error: userError } = await supabase
                .from("users")
                .update(userUpdates)
                .eq("id", student.user_id);

            if (userError) {
                throw new Error(userError.message);
            }
        }

        // Update student record
        const studentUpdates: any = {};
        if (parsed.data.studentId !== undefined) studentUpdates.student_id = parsed.data.studentId;
        if (parsed.data.feeStatus !== undefined) studentUpdates.fee_status = parsed.data.feeStatus;
        if (parsed.data.gender !== undefined) studentUpdates.gender = parsed.data.gender;
        if (parsed.data.joinDate !== undefined) studentUpdates.join_date = parsed.data.joinDate ? new Date(parsed.data.joinDate).toISOString() : null;
        if (parsed.data.phone !== undefined) studentUpdates.phone = parsed.data.phone;

        if (Object.keys(studentUpdates).length > 0) {
            const { error: updateError } = await supabase
                .from("students")
                .update(studentUpdates)
                .eq("id", studentId);

            if (updateError) {
                throw new Error(updateError.message);
            }
        }

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json(
            { error: String(e?.message || e) },
            { status: 500 }
        );
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: { id: string } }
) {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const studentId = params.id;
        if (!studentId) {
            return NextResponse.json({ error: "Student ID is required" }, { status: 400 });
        }

        const supabase = getSupabaseServerClient();

        // Get student to find user_id
        const { data: student, error: studentError } = await supabase
            .from("students")
            .select("user_id")
            .eq("id", studentId)
            .maybeSingle();

        if (studentError || !student) {
            return NextResponse.json({ error: "Student not found" }, { status: 404 });
        }

        // Delete student (cascade should handle related records)
        const { error: deleteError } = await supabase
            .from("students")
            .delete()
            .eq("id", studentId);

        if (deleteError) {
            throw new Error(deleteError.message);
        }

        // Delete password credentials
        await supabase
            .from("password_credentials")
            .delete()
            .eq("user_id", student.user_id);

        // Delete user
        const { error: userError } = await supabase
            .from("users")
            .delete()
            .eq("id", student.user_id);

        if (userError) {
            throw new Error(userError.message);
        }

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json(
            { error: String(e?.message || e) },
            { status: 500 }
        );
    }
}

