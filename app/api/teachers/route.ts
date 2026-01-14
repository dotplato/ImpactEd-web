import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/db/supabase-server";
import { getCurrentUser } from "@/lib/auth/session";
import { z } from "zod";
import bcrypt from "bcryptjs";

const CreateTeacherSchema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(8),
    phone: z.string().optional(),
    joinDate: z.string().optional(),
    qualification: z.string().optional(),
    profile_pic: z.string().optional(),
});

export async function GET() {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabaseServerClient();
    const { data: teachers, error } = await supabase
        .from("teachers")
        .select(`
            id,
            user:users(id, name, email, image_url),
            phone,
            join_date,
            qualification
        `);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ teachers });
}

export async function POST(req: Request) {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const parsed = CreateTeacherSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
        }

        const {
            name,
            email,
            password,
            phone,
            joinDate,
            qualification,
            profile_pic,
        } = parsed.data;

        const supabase = getSupabaseServerClient();

        // Check if user already exists
        const { data: existingUser } = await supabase
            .from("users")
            .select("id")
            .eq("email", email.toLowerCase())
            .maybeSingle();

        if (existingUser) {
            return NextResponse.json({ error: "User with this email already exists" }, { status: 400 });
        }

        // Create user
        const { data: newUser, error: userError } = await supabase
            .from("users")
            .insert({
                name,
                email: email.toLowerCase(),
                role: "teacher",
                image_url: profile_pic || null,
            })
            .select("id")
            .single();

        if (userError) {
            throw new Error(userError.message);
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Create password credential
        const { error: credError } = await supabase
            .from("password_credentials")
            .insert({
                user_id: newUser.id,
                password_hash: passwordHash,
            });

        if (credError) {
            // Rollback: delete user if credential creation fails
            await supabase.from("users").delete().eq("id", newUser.id);
            throw new Error(credError.message);
        }

        // Create teacher record
        const { data: teacher, error: teacherError } = await supabase
            .from("teachers")
            .insert({
                user_id: newUser.id,
                phone: phone || null,
                join_date: joinDate ? new Date(joinDate).toISOString() : null,
                qualification: qualification || null,
            })
            .select("id")
            .single();

        if (teacherError) {
            // Rollback: delete user and credential
            await supabase.from("password_credentials").delete().eq("user_id", newUser.id);
            await supabase.from("users").delete().eq("id", newUser.id);
            throw new Error(teacherError.message);
        }

        return NextResponse.json({ id: teacher.id });
    } catch (e: any) {
        return NextResponse.json(
            { error: String(e?.message || e) },
            { status: 500 }
        );
    }
}

