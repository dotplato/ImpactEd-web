import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/db/supabase-server";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET() {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabaseServerClient();
    const { data: students, error } = await supabase
        .from("students")
        .select(`
      id,
      user:users(id, name, email, image_url, gender)
    `);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ students });
}
