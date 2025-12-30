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
    sender?: { name: string; role: string };
};

export type UserParticipant = {
    id: string;
    name: string;
    role: string;
    email: string;
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
          user:users(id, name, role, email)
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
        // Filter out self from participants for display
        const otherParticipants = conv.participants
            .map((p: any) => p.user)
            .filter((u: any) => u.id !== user.id);

        return {
            ...conv,
            participants: otherParticipants,
        };
    });

    // 2. Get Course Group Conversations
    let courseIds: string[] = [];

    if (user.role === "admin") {
        // Admin sees all courses
        const { data: courses } = await supabase.from("courses").select("id");
        courseIds = courses?.map((c: any) => c.id) || [];
    } else if (user.role === "teacher") {
        // Teacher sees courses they teach
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
            courseIds = courses?.map((c: any) => c.id) || [];
        }
    } else if (user.role === "student") {
        // Student sees courses they are enrolled in
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
            courseIds = enrollments?.map((e: any) => e.course_id) || [];
        }
    }

    // Fetch existing group conversations
    const { data: groupConvos, error: groupError } = await supabase
        .from("conversations")
        .select(`
      id, type, course_id, created_at, updated_at,
      course:courses(title)
    `)
        .eq("type", "group")
        .in("course_id", courseIds);

    if (groupError) {
        console.error("Error fetching group conversations:", groupError);
    }

    // Combine and sort
    const allConvos = [...formattedDirectConvos, ...(groupConvos || [])];

    // Fetch last message and calculate unread count for each conversation
    for (const conv of allConvos) {
        const { data: lastMsg } = await supabase
            .from("messages")
            .select("*")
            .eq("conversation_id", conv.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();
        conv.last_message = lastMsg;

        // Get user's last read time
        const { data: participant } = await supabase
            .from("conversation_participants")
            .select("last_read_at")
            .eq("conversation_id", conv.id)
            .eq("user_id", user.id)
            .single();

        const lastReadAt = participant?.last_read_at || new Date(0).toISOString();

        // Count unread messages
        const { count } = await supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("conversation_id", conv.id)
            .gt("created_at", lastReadAt);

        conv.unread_count = count || 0;
    }

    // Sort by last message time or updated_at
    allConvos.sort((a, b) => {
        const timeA = a.last_message?.created_at || a.updated_at;
        const timeB = b.last_message?.created_at || b.updated_at;
        return new Date(timeB).getTime() - new Date(timeA).getTime();
    });

    return allConvos;
}

export async function getMessages(conversationId: string): Promise<Message[]> {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
        .from("messages")
        .select(`
      *,
      sender:users(id, name, role)
    `)
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

    if (error) {
        console.error("Error fetching messages:", error);
        return [];
    }
    return data as Message[];
}

export async function sendMessage(conversationId: string, content: string) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");

    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content,
    });

    if (error) throw error;

    // Update conversation updated_at
    await supabase
        .from("conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);

    // Mark as read for sender
    await markConversationAsRead(conversationId);

    revalidatePath("/messages");
}

export async function createDirectConversation(targetUserId: string) {
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");

    const supabase = getSupabaseServerClient();

    // Check if conversation already exists using RPC
    const { data: existingId, error: rpcError } = await supabase
        .rpc('get_direct_chat_id', {
            user1_id: user.id,
            user2_id: targetUserId
        });

    if (existingId) {
        return existingId;
    }

    // 1. Create conversation
    const { data: conv, error: convError } = await supabase
        .from("conversations")
        .insert({ type: "direct" })
        .select()
        .single();

    if (convError) throw convError;

    // 2. Add participants
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
        // Admin can chat with everyone
        const { data } = await supabase.from("users").select("id, name, role, email");
        return data?.filter((u: any) => u.id !== user.id) || [];
    }

    if (user.role === "teacher") {
        // 1. Get Teacher ID
        const { data: teacher } = await supabase
            .from("teachers")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();

        if (teacher) {
            // 2. Get Courses taught by teacher
            const { data: courses } = await supabase
                .from("courses")
                .select("id")
                .eq("teacher_id", teacher.id);

            const courseIds = courses?.map((c: any) => c.id) || [];

            if (courseIds.length > 0) {
                // 3. Get Student IDs from enrollments
                const { data: enrollments } = await supabase
                    .from("course_students")
                    .select("student_id")
                    .in("course_id", courseIds);

                const studentIds = enrollments?.map((e: any) => e.student_id) || [];

                if (studentIds.length > 0) {
                    // 4. Get User IDs from Students
                    const { data: students } = await supabase
                        .from("students")
                        .select("user_id")
                        .in("id", studentIds);

                    targetUserIds.push(...(students?.map((s: any) => s.user_id) || []));
                }
            }
        }

        // 5. Add Admins
        const { data: admins } = await supabase
            .from("users")
            .select("id")
            .eq("role", "admin");
        targetUserIds.push(...(admins?.map((a: any) => a.id) || []));

    } else if (user.role === "student") {
        // 1. Get Student ID
        const { data: student } = await supabase
            .from("students")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle();

        if (student) {
            // 2. Get Courses enrolled in
            const { data: enrollments } = await supabase
                .from("course_students")
                .select("course_id")
                .eq("student_id", student.id);

            const courseIds = enrollments?.map((e: any) => e.course_id) || [];

            if (courseIds.length > 0) {
                // 3. Get Teacher IDs from courses
                const { data: courses } = await supabase
                    .from("courses")
                    .select("teacher_id")
                    .in("id", courseIds);

                const teacherIds = courses?.map((c: any) => c.teacher_id).filter(Boolean) || [];

                if (teacherIds.length > 0) {
                    // 4. Get User IDs from Teachers
                    const { data: teachers } = await supabase
                        .from("teachers")
                        .select("user_id")
                        .in("id", teacherIds);

                    targetUserIds.push(...(teachers?.map((t: any) => t.user_id) || []));
                }
            }
        }

        // 5. Add Admins
        const { data: admins } = await supabase
            .from("users")
            .select("id")
            .eq("role", "admin");
        targetUserIds.push(...(admins?.map((a: any) => a.id) || []));
    }

    if (targetUserIds.length === 0) return [];

    // Fetch user details
    const { data, error } = await supabase
        .from("users")
        .select("id, name, role, email")
        .in("id", targetUserIds);

    if (error) {
        console.error("Error fetching chat partners:", error);
        return [];
    }

    // Filter out self and duplicates
    const uniqueUsers = Array.from(new Map(data.map((item: any) => [item.id, item])).values());
    return uniqueUsers.filter((u: any) => u.id !== user.id);
}

export async function markConversationAsRead(conversationId: string) {
    const user = await getCurrentUser();
    if (!user) return;

    const supabase = getSupabaseServerClient();

    // Upsert to handle case where participant might not exist (though they should)
    // or just update. For group chats, we might need to insert if not present?
    // Actually, for group chats based on courses, we didn't add participants explicitly.
    // So we MUST upsert here.

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
