import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/db/supabase-server";
import { getCurrentUser } from "@/lib/auth/session";
import { z } from "zod";

const UpdateTeacherSchema = z.object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    joinDate: z.string().optional(),
    qualification: z.string().optional(),
    profile_pic: z.string().optional(),
});

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { id: teacherId } = await params;
        if (!teacherId) {
            return NextResponse.json({ error: "Teacher ID is required" }, { status: 400 });
        }

        const body = await req.json();
        const parsed = UpdateTeacherSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
        }

        const supabase = getSupabaseServerClient();

        // Get teacher to find user_id
        const { data: teacher, error: teacherError } = await supabase
            .from("teachers")
            .select("user_id")
            .eq("id", teacherId)
            .maybeSingle();

        if (teacherError || !teacher) {
            return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
        }

        // Update user if name, email, or image_url provided
        const userUpdates: any = {};
        if (parsed.data.name !== undefined) userUpdates.name = parsed.data.name;
        if (parsed.data.email !== undefined) userUpdates.email = parsed.data.email.toLowerCase();
        if (parsed.data.profile_pic !== undefined) userUpdates.image_url = parsed.data.profile_pic;

        if (Object.keys(userUpdates).length > 0) {
            const { error: userError } = await supabase
                .from("users")
                .update(userUpdates)
                .eq("id", teacher.user_id);

            if (userError) {
                throw new Error(userError.message);
            }
        }

        // Update teacher record
        const teacherUpdates: any = {};
        if (parsed.data.phone !== undefined) teacherUpdates.phone = parsed.data.phone;
        if (parsed.data.joinDate !== undefined) teacherUpdates.join_date = parsed.data.joinDate ? new Date(parsed.data.joinDate).toISOString() : null;
        if (parsed.data.qualification !== undefined) teacherUpdates.qualification = parsed.data.qualification;

        if (Object.keys(teacherUpdates).length > 0) {
            const { error: updateError } = await supabase
                .from("teachers")
                .update(teacherUpdates)
                .eq("id", teacherId);

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
    { params }: { params: Promise<{ id: string }> }
) {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { id: teacherId } = await params;
        if (!teacherId) {
            return NextResponse.json({ error: "Teacher ID is required" }, { status: 400 });
        }

        const supabase = getSupabaseServerClient();

        // Get teacher to find user_id
        const { data: teacher, error: teacherError } = await supabase
            .from("teachers")
            .select("user_id")
            .eq("id", teacherId)
            .maybeSingle();

        if (teacherError || !teacher) {
            return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
        }

        // Delete teacher (cascade should handle related records)
        const { error: deleteError } = await supabase
            .from("teachers")
            .delete()
            .eq("id", teacherId);

        if (deleteError) {
            throw new Error(deleteError.message);
        }

        // Delete password credentials
        await supabase
            .from("password_credentials")
            .delete()
            .eq("user_id", teacher.user_id);

        // Delete user
        const { error: userError } = await supabase
            .from("users")
            .delete()
            .eq("id", teacher.user_id);

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

