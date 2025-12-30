"use server";

import { getSupabaseServerClient } from "@/lib/db/supabase-server";
import { getCurrentUser } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";

export type ConversationType = "direct" | "group";

export type Conversation = {
    id: string;
    type: ConversationType;
    course_id: string | null;
    created_at: string;
    updated_at: string;
    last_message?: Message | null;
    participants?: UserParticipant[];
    course?: { title: string } | null;
    unread_count?: number;
};

export type Message = {
    id: string;
    conversation_id: string;
    sender_id: string;
    content: string;
    created_at: string;
    sender?: { name: string; role: string; image_url?: string | null };
    attachments?: { url: string; name: string; type: string; size: number }[];
};

export type UserParticipant = {
    id: string;
    name: string;
    role: string;
    email: string;
    image_url?: string | null;
};

export async function getConversations(): Promise<Conversation[]> {
    const user = await getCurrentUser();
    if (!user) return [];

    const supabase = getSupabaseServerClient();

    // 1. Get Direct Conversations
    const { data: directConvos, error: directError } = await supabase
        .from("conversation_participants")
        .select(`
      conversation_id,
      conversation:conversations!inner(
        id, type, created_at, updated_at,
        participants:conversation_participants(
          user:users(id, name, role, email, image_url)
        )
      )
    `)
        .eq("user_id", user.id);

    if (directError) {
        console.error("Error fetching direct conversations:", directError);
        return [];
    }

    const formattedDirectConvos = directConvos.map((item: any) => {
        const conv = item.conversation;
        const otherParticipants = conv.participants
            .map((p: any) => p.user)
            .filter((u: any) => u.id !== user.id);

        return {
            ...conv,
            participants: otherParticipants,
        };
    });

    // 2. Get Course Group Conversations
    let courses: { id: string, title: string }[] = [];

    if (user.role === "admin") {
        const { data } = await supabase.from("courses").select("id, title");
        courses = data || [];
    } else if (user.role === "teacher") {
        const { data: teacher } = await supabase
            .from("teachers")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();

        if (teacher) {
            const { data } = await supabase
                .from("courses")
                .select("id, title")
                .eq("teacher_id", teacher.id);
            courses = data || [];
        }
    } else if (user.role === "student") {
        const { data: student } = await supabase
            .from("students")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();

        if (student) {
            const { data: enrollments } = await supabase
                .from("course_students")
                .select("course:courses(id, title)")
                .eq("student_id", student.id);
            courses = (enrollments || []).map((e: any) => e.course).filter(Boolean);
        }
    }

    const courseIds = courses.map(c => c.id);

    // Fetch existing group conversations
    let groupConvos: any[] = [];
    if (courseIds.length > 0) {
        const { data, error: groupError } = await supabase
            .from("conversations")
            .select(`
          id, type, course_id, created_at, updated_at,
          course:courses(title)
        `)
            .eq("type", "group")
            .in("course_id", courseIds);

        if (groupError) {
            console.error("Error fetching group conversations:", groupError);
        } else {
            groupConvos = data || [];
        }

        // Add placeholders for missing conversations instead of auto-creating here
        const existingCourseIds = new Set(groupConvos.map(c => c.course_id));
        const missingCourses = courses.filter(c => !existingCourseIds.has(c.id));

        for (const course of missingCourses) {
            groupConvos.push({
                id: `course:${course.id}`, // Placeholder ID
                type: "group",
                course_id: course.id,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                course: { title: course.title },
                last_message: null,
                unread_count: 0
            });
        }
    }

    // Combine and sort
    const allConvos = [...formattedDirectConvos, ...groupConvos];

    // Fetch last message and calculate unread count for each conversation
    for (const conv of allConvos) {
        if (conv.id.startsWith("course:")) continue; // Skip placeholders

        try {
            const { data: lastMsg } = await supabase
                .from("messages")
                .select("*")
                .eq("conversation_id", conv.id)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();
            conv.last_message = lastMsg;

            const { data: participant } = await supabase
                .from("conversation_participants")
                .select("last_read_at")
                .eq("conversation_id", conv.id)
                .eq("user_id", user.id)
                .maybeSingle();

            const lastReadAt = participant?.last_read_at || new Date(0).toISOString();

            const { count } = await supabase
                .from("messages")
                .select("id", { count: "exact", head: true })
                .eq("conversation_id", conv.id)
                .gt("created_at", lastReadAt);

            conv.unread_count = count || 0;
        } catch (err) {
            console.error(`Error processing conversation ${conv.id}:`, err);
            conv.last_message = null;
            conv.unread_count = 0;
        }
    }

    // Deduplicate by ID to prevent React "duplicate key" warnings
    const uniqueConvosMap = new Map<string, Conversation>();
    for (const conv of allConvos) {
        uniqueConvosMap.set(conv.id, conv);
    }
    const deduplicatedConvos = Array.from(uniqueConvosMap.values());

    // Sort by last message time or updated_at
    deduplicatedConvos.sort((a, b) => {
        const timeA = a.last_message?.created_at || a.updated_at;
        const timeB = b.last_message?.created_at || b.updated_at;
        return new Date(timeB).getTime() - new Date(timeA).getTime();
    });

    return deduplicatedConvos;
}

export async function getMessages(conversationId: string): Promise<Message[]> {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
        .from("messages")
        .select(`
      *,
      sender:users(id, name, role, image_url)
    `)
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

    if (error) {
        console.error("Error fetching messages:", error);
        return [];
    }
    return data as Message[];
}

export async function uploadChatAttachment(formData: FormData): Promise<{ url: string; name: string; type: string; size: number } | null> {
    const user = await getCurrentUser();
    if (!user) return null;

    const file = formData.get('file') as File;
    const conversationId = formData.get('conversationId') as string;

    if (!file || !conversationId) return null;

    const supabase = getSupabaseServerClient();
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${conversationId}/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage
        .from('chat-attachments')
        .upload(filePath, buffer, {
            contentType: file.type,
            upsert: false
        });

    if (uploadError) {
        console.error('Error uploading file:', uploadError);
        return null;
    }

    const { data: { publicUrl } } = supabase.storage
        .from('chat-attachments')
        .getPublicUrl(filePath);

    return {
        url: publicUrl,
        name: file.name,
        type: file.type,
        size: file.size
    };
}

export async function sendMessage(
    conversationId: string,
    content: string,
    attachments: { url: string; name: string; type: string; size: number }[] = [],
    messageId?: string
) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");

    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("messages").insert({
        id: messageId,
        conversation_id: conversationId,
        sender_id: user.id,
        content,
        attachments,
    });

    if (error) throw error;

    await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);

    await markConversationAsRead(conversationId);

    revalidatePath("/messages");
}

export async function createDirectConversation(targetUserId: string) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");

    const supabase = getSupabaseServerClient();

    const { data: existingId } = await supabase
        .rpc('get_direct_chat_id', {
            user1_id: user.id,
            user2_id: targetUserId
        });

    if (existingId) {
        return existingId;
    }

    const { data: conv, error: convError } = await supabase
        .from("conversations")
        .insert({ type: "direct" })
        .select()
        .single();

    if (convError) throw convError;

    const { error: partError } = await supabase.from("conversation_participants").insert([
        { conversation_id: conv.id, user_id: user.id },
        { conversation_id: conv.id, user_id: targetUserId },
    ]);

    if (partError) throw partError;

    revalidatePath("/messages");
    return conv.id;
}

export async function getPotentialChatPartners() {
    const user = await getCurrentUser();
    if (!user) return [];

    const supabase = getSupabaseServerClient();
    let targetUserIds: string[] = [];

    if (user.role === "admin") {
        const { data } = await supabase.from("users").select("id, name, role, email, image_url");
        return data?.filter((u: any) => u.id !== user.id) || [];
    }

    if (user.role === "teacher") {
        const { data: teacher } = await supabase
            .from("teachers")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();

        if (teacher) {
            const { data: courses } = await supabase
                .from("courses")
                .select("id")
                .eq("teacher_id", teacher.id);

            const courseIds = courses?.map((c: any) => c.id) || [];

            if (courseIds.length > 0) {
                const { data: enrollments } = await supabase
                    .from("course_students")
                    .select("student_id")
                    .in("course_id", courseIds);

                const studentIds = enrollments?.map((e: any) => e.student_id) || [];

                if (studentIds.length > 0) {
                    const { data: students } = await supabase
                        .from("students")
                        .select("user_id")
                        .in("id", studentIds);

                    targetUserIds.push(...(students?.map((s: any) => s.user_id) || []));
                }
            }
        }

        const { data: admins } = await supabase
            .from("users")
            .select("id")
            .eq("role", "admin");
        targetUserIds.push(...(admins?.map((a: any) => a.id) || []));

    } else if (user.role === "student") {
        const { data: student } = await supabase
            .from("students")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();

        if (student) {
            const { data: enrollments } = await supabase
                .from("course_students")
                .select("course_id")
                .eq("student_id", student.id);

            const courseIds = enrollments?.map((e: any) => e.course_id) || [];

            if (courseIds.length > 0) {
                const { data: courses } = await supabase
                    .from("courses")
                    .select("teacher_id")
                    .in("id", courseIds);

                const teacherIds = courses?.map((c: any) => c.teacher_id).filter(Boolean) || [];

                if (teacherIds.length > 0) {
                    const { data: teachers } = await supabase
                        .from("teachers")
                        .select("user_id")
                        .in("id", teacherIds);

                    targetUserIds.push(...(teachers?.map((t: any) => t.user_id) || []));
                }
            }
        }

        const { data: admins } = await supabase
            .from("users")
            .select("id")
            .eq("role", "admin");
        targetUserIds.push(...(admins?.map((a: any) => a.id) || []));
    }

    if (targetUserIds.length === 0) return [];

    const { data, error } = await supabase
        .from("users")
        .select("id, name, role, email, image_url")
        .in("id", targetUserIds);

    if (error) {
        console.error("Error fetching chat partners:", error);
        return [];
    }

    const uniqueUsers = Array.from(new Map(data.map((item: any) => [item.id, item])).values());
    return uniqueUsers.filter((u: any) => u.id !== user.id);
}

export async function markConversationAsRead(conversationId: string) {
    const user = await getCurrentUser();
    if (!user) return;

    const supabase = getSupabaseServerClient();

    await supabase
        .from("conversation_participants")
        .upsert({
            conversation_id: conversationId,
            user_id: user.id,
            last_read_at: new Date().toISOString()
        }, { onConflict: "conversation_id,user_id" });

    revalidatePath("/messages");
}

export async function getTotalUnreadCount() {
    const user = await getCurrentUser();
    if (!user) return 0;

    const conversations = await getConversations();
    return conversations.reduce((acc, conv) => acc + (conv.unread_count || 0), 0);
}

export async function ensureGroupConversation(courseId: string): Promise<string> {
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");

    const supabase = getSupabaseServerClient();

    const { data: existing } = await supabase
        .from("conversations")
        .select("id")
        .eq("type", "group")
        .eq("course_id", courseId)
        .maybeSingle();

    if (existing) return existing.id;

    const { data, error } = await supabase
        .from("conversations")
        .upsert({
            type: "group",
            course_id: courseId
        }, { onConflict: "course_id" })
        .select("id")
        .single();

    if (error) {
        const { data: retry } = await supabase
            .from("conversations")
            .select("id")
            .eq("type", "group")
            .eq("course_id", courseId)
            .maybeSingle();

        if (retry) return retry.id;
        throw error;
    }

    return data.id;
}
export async function getUserInfo(userId: string) {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
        .from("users")
        .select("id, name, role, image_url")
        .eq("id", userId)
        .single();

    if (error) {
        console.error("Error fetching user info:", error);
        return null;
    }
    return data;
}
