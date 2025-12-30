import { Suspense } from "react";
import { getConversations, getPotentialChatPartners } from "@/lib/actions/chat";
import { ChatLayout } from "@/components/chat/chat-layout";
import { getCurrentUser } from "@/lib/auth/session";

export default async function MessagesPage() {
    const user = await getCurrentUser();
    const conversations = await getConversations();
    const potentialPartners = await getPotentialChatPartners();

    return (
        <div className="h-[calc(100vh-4rem)] p-4">
            <Suspense fallback={<div>Loading chat...</div>}>
                <ChatLayout
                    initialConversations={conversations}
                    currentUser={user!}
                    potentialPartners={potentialPartners}
                />
            </Suspense>
        </div>
    );
}
