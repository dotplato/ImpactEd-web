"use client";

import { useState, useEffect } from "react";
import { Conversation, Message } from "@/lib/actions/chat";
import { ConversationList } from "./conversation-list";
import { ChatWindow } from "./chat-window";
import { AppUser } from "@/lib/auth/session";
import { createClient } from "@supabase/supabase-js";
import { Loader2 } from "lucide-react";
import { supabaseClient } from "@/lib/db/supabase-client";

interface ChatLayoutProps {
    initialConversations: Conversation[];
    currentUser: AppUser;
    potentialPartners: any[];
}

export function ChatLayout({ initialConversations, currentUser, potentialPartners }: ChatLayoutProps) {
    const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    // Sync state with props when server revalidates
    useEffect(() => {
        setConversations(initialConversations);
    }, [initialConversations]);

    const selectedConversation = conversations.find(c => c.id === selectedConversationId);

    // Realtime subscription
    useEffect(() => {
        const channel = supabaseClient
            .channel('chat_updates')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                },
                async (payload) => {
                    const newMessage = payload.new as Message;

                    // Update conversations list with new message
                    setConversations(prev => {
                        const updated = prev.map(conv => {
                            if (conv.id === newMessage.conversation_id) {
                                // If this is the currently selected conversation, we assume it's being read?
                                // Actually, ChatLayout doesn't know if the window is focused or if user is active.
                                // But if it IS selected, the ChatWindow will likely mark it as read.
                                // However, for the LIST, we might want to show it as unread until that happens?
                                // Or if it's selected, we don't increment?
                                const isSelected = conv.id === selectedConversationId;

                                // Only increment if NOT selected (or maybe even if selected, let ChatWindow clear it?)
                                // Let's increment if not selected.
                                const newUnreadCount = isSelected
                                    ? (conv.unread_count || 0)
                                    : (conv.unread_count || 0) + 1;

                                return {
                                    ...conv,
                                    last_message: newMessage,
                                    updated_at: newMessage.created_at,
                                    unread_count: newUnreadCount
                                };
                            }
                            return conv;
                        });

                        // Sort again
                        return updated.sort((a, b) => {
                            const timeA = a.last_message?.created_at || a.updated_at;
                            const timeB = b.last_message?.created_at || b.updated_at;
                            return new Date(timeB).getTime() - new Date(timeA).getTime();
                        });
                    });
                }
            )
            .subscribe();

        return () => {
            supabaseClient.removeChannel(channel);
        };
    }, [selectedConversationId]);

    return (
        <div className="flex h-full border rounded-lg overflow-hidden bg-background shadow-sm">
            <div className={`w-full md:w-80 border-r flex flex-col ${selectedConversationId ? 'hidden md:flex' : 'flex'}`}>
                <ConversationList
                    conversations={conversations}
                    selectedId={selectedConversationId}
                    onSelect={(id) => {
                        setSelectedConversationId(id);
                        // Optimistically mark as read
                        setConversations(prev => prev.map(c => {
                            if (c.id === id) {
                                return { ...c, unread_count: 0 };
                            }
                            return c;
                        }));
                    }}
                    currentUser={currentUser}
                    potentialPartners={potentialPartners}
                />
            </div>
            <div className={`flex-1 flex flex-col ${!selectedConversationId ? 'hidden md:flex' : 'flex'}`}>
                {selectedConversation ? (
                    <ChatWindow
                        key={selectedConversation.id}
                        conversation={selectedConversation}
                        currentUser={currentUser}
                        onBack={() => setSelectedConversationId(null)}
                        onMessageSent={(msg: Message) => {
                            setConversations(prev => {
                                const updated = prev.map(c => {
                                    if (c.id === msg.conversation_id) {
                                        return {
                                            ...c,
                                            last_message: msg,
                                            updated_at: msg.created_at,
                                            unread_count: 0 // Sent by me, so read
                                        };
                                    }
                                    return c;
                                });
                                return updated.sort((a, b) => {
                                    const timeA = a.last_message?.created_at || a.updated_at;
                                    const timeB = b.last_message?.created_at || b.updated_at;
                                    return new Date(timeB).getTime() - new Date(timeA).getTime();
                                });
                            });
                        }}
                    />
                ) : selectedConversationId ? (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground">
                        Select a conversation to start chatting
                    </div>
                )}
            </div>
        </div>
    );
}
