import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/db/supabase-server";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const user = await getCurrentUser();
        if (!user || (user.role !== "admin" && user.role !== "teacher")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const courseId = params.id;
        if (!courseId) {
            return NextResponse.json({ error: "Course ID is required" }, { status: 400 });
        }

        const supabase = getSupabaseServerClient();

        // Verify course exists and user has access
        let courseQuery = supabase
            .from("courses")
            .select("id, teacher_id")
            .eq("id", courseId)
            .maybeSingle();

        if (user.role === "teacher") {
            const { data: teacher } = await supabase
                .from("teachers")
                .select("id")
                .eq("user_id", user.id)
                .maybeSingle();
            
            if (!teacher) {
                return NextResponse.json({ error: "Teacher profile not found" }, { status: 404 });
            }

            courseQuery = courseQuery.eq("teacher_id", teacher.id);
        }

        const { data: course, error: courseError } = await courseQuery;

        if (courseError || !course) {
            return NextResponse.json({ error: "Course not found" }, { status: 404 });
        }

        // Fetch files for this course
        const { data: files, error } = await supabase
            .from("course_files")
            .select("id, file_name, file_path, mime, created_at")
            .eq("course_id", courseId)
            .order("created_at", { ascending: false });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ files: files || [] });
    } catch (e: any) {
        return NextResponse.json(
            { error: String(e?.message || e) },
            { status: 500 }
        );
    }
}

export async function POST(
    req: Request,
    { params }: { params: { id: string } }
) {
    try {
        const user = await getCurrentUser();
        if (!user || (user.role !== "admin" && user.role !== "teacher")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const courseId = params.id;
        if (!courseId) {
            return NextResponse.json({ error: "Course ID is required" }, { status: 400 });
        }

        const supabase = getSupabaseServerClient();

        // Verify course exists and user has access
        let courseQuery = supabase
            .from("courses")
            .select("id, teacher_id")
            .eq("id", courseId)
            .maybeSingle();

        if (user.role === "teacher") {
            const { data: teacher } = await supabase
                .from("teachers")
                .select("id")
                .eq("user_id", user.id)
                .maybeSingle();
            
            if (!teacher) {
                return NextResponse.json({ error: "Teacher profile not found" }, { status: 404 });
            }

            courseQuery = courseQuery.eq("teacher_id", teacher.id);
        }

        const { data: course, error: courseError } = await courseQuery;

        if (courseError || !course) {
            return NextResponse.json({ error: "Course not found" }, { status: 404 });
        }

        // Handle file upload
        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        // Upload to storage
        const fileExt = file.name.split(".").pop();
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `courses/${courseId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from("course-files")
            .upload(filePath, file);

        if (uploadError) {
            return NextResponse.json({ error: uploadError.message }, { status: 500 });
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from("course-files")
            .getPublicUrl(filePath);

        // Save file record
        const { data: fileRecord, error: insertError } = await supabase
            .from("course_files")
            .insert({
                course_id: courseId,
                file_name: file.name,
                file_path: urlData.publicUrl,
                mime: file.type,
            })
            .select()
            .single();

        if (insertError) {
            return NextResponse.json({ error: insertError.message }, { status: 500 });
        }

        return NextResponse.json({ file: fileRecord });
    } catch (e: any) {
        return NextResponse.json(
            { error: String(e?.message || e) },
            { status: 500 }
        );
    }
}

