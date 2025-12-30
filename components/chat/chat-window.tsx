"use client";

import { Conversation, Message, getMessages, sendMessage } from "@/lib/actions/chat";
import { AppUser } from "@/lib/auth/session";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";

interface ChatWindowProps {
    conversation: Conversation;
    currentUser: AppUser;
    onBack: () => void;
    onMessageSent?: (message: Message) => void;
}

export function ChatWindow({ conversation, currentUser, onBack, onMessageSent }: ChatWindowProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    const isGroup = conversation.type === "group";
    const title = isGroup
        ? conversation.course?.title || "Course Group"
        : conversation.participants?.[0]?.name || "Unknown User";

    // Fetch initial messages and mark as read
    // Fetch initial messages and mark as read
    useEffect(() => {
        const fetchMessages = async () => {
            setIsLoading(true);
            setMessages([]); // Clear previous messages immediately
            try {
                const msgs = await getMessages(conversation.id);
                setMessages(msgs);
                setTimeout(scrollToBottom, 100);

                // Mark as read
                const { markConversationAsRead } = await import("@/lib/actions/chat");
                await markConversationAsRead(conversation.id);
            } catch (error) {
                console.error("Failed to fetch messages:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchMessages();
    }, [conversation.id]);

    // Realtime subscription for new messages
    useEffect(() => {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const channel = supabase
            .channel(`chat:${conversation.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `conversation_id=eq.${conversation.id}`,
                },
                async (payload) => {
                    const newMsg = payload.new as Message;
                    setMessages(prev => {
                        if (prev.find(m => m.id === newMsg.id)) return prev;
                        return [...prev, newMsg];
                    });
                    setTimeout(scrollToBottom, 100);
                }
            )
            .subscribe();

        const markRead = async () => {
            const { markConversationAsRead } = await import("@/lib/actions/chat");
            await markConversationAsRead(conversation.id);
        };
        markRead();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [conversation.id]);

    const scrollToBottom = () => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        const content = newMessage;
        setNewMessage("");

        // Optimistic update
        const optimisticMsg: Message = {
            id: crypto.randomUUID(),
            conversation_id: conversation.id,
            sender_id: currentUser.id,
            content: content,
            created_at: new Date().toISOString(),
            sender: { name: currentUser.name || "You", role: currentUser.role }
        };

        setMessages(prev => [...prev, optimisticMsg]);
        setTimeout(scrollToBottom, 10);

        // Notify parent immediately
        if (onMessageSent) {
            onMessageSent(optimisticMsg);
        }

        try {
            await sendMessage(conversation.id, content);
        } catch (error) {
            console.error("Failed to send message:", error);
            // Revert optimistic update? Or show error.
        }
    };

    return (
        <div className="flex flex-col h-full">
            <div className="p-4 border-b flex items-center gap-3 shadow-sm bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <Button variant="ghost" size="icon" className="md:hidden" onClick={onBack}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <Avatar>
                    <AvatarFallback>
                        {isGroup ? <Users className="h-4 w-4" /> : title[0]}
                    </AvatarFallback>
                </Avatar>
                <div>
                    <h3 className="font-semibold">{title}</h3>
                    {isGroup && <p className="text-xs text-muted-foreground">Course Discussion</p>}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
                {isLoading ? (
                    <div className="flex h-full items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                ) : (
                    messages.map((msg, i) => {
                        const isMe = msg.sender_id === currentUser.id;
                        const showSender = isGroup && !isMe && (i === 0 || messages[i - 1].sender_id !== msg.sender_id);

                        return (
                            <div
                                key={msg.id}
                                className={cn(
                                    "flex flex-col max-w-[75%]",
                                    isMe ? "ml-auto items-end" : "mr-auto items-start"
                                )}
                            >
                                {showSender && (
                                    <span className="text-xs text-muted-foreground mb-1 ml-1">
                                        {msg.sender?.name || "User"}
                                    </span>
                                )}
                                <div
                                    className={cn(
                                        "rounded-2xl px-4 py-2 text-sm",
                                        isMe
                                            ? "bg-primary text-primary-foreground rounded-br-none"
                                            : "bg-muted text-foreground rounded-bl-none"
                                    )}
                                >
                                    {msg.content}
                                </div>
                                <span className="text-[10px] text-muted-foreground mt-1 px-1">
                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        );
                    })
                )}
            </div>

            <div className="p-4 border-t bg-background">
                <form onSubmit={handleSend} className="flex gap-2">
                    <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1"
                    />
                    <Button variant="secondary" type="submit" size="icon" disabled={!newMessage.trim()}>
                        <Send className="h-4 w-4" />
                    </Button>
                </form>
            </div>
        </div >
    );
}
