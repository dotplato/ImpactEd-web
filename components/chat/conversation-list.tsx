"use client";

import { Conversation, createDirectConversation } from "@/lib/actions/chat";
import { AppUser } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Plus, MessageSquare, Users, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ConversationListProps {
    conversations: Conversation[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    currentUser: AppUser;
    potentialPartners: any[];
}

export function ConversationList({
    conversations,
    selectedId,
    onSelect,
    currentUser,
    potentialPartners
}: ConversationListProps) {
    const [isNewChatOpen, setIsNewChatOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const router = useRouter();

    const handleStartChat = async (userId: string) => {
        try {
            setIsLoading(true);
            const conversationId = await createDirectConversation(userId);
            setIsNewChatOpen(false);
            onSelect(conversationId);
            router.refresh();
        } catch (error) {
            console.error("Failed to start chat:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredConversations = conversations.filter(conv => {
        const isGroup = conv.type === "group";
        const name = isGroup
            ? conv.course?.title || "Course Group"
            : conv.participants?.[0]?.name || "Unknown User";
        return name.toLowerCase().includes(searchQuery.toLowerCase());
    });

    return (
        <div className="flex flex-col h-full">
            <div className="p-4 border-b space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-lg">Messages</h2>
                    <Dialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen}>
                        <DialogTrigger asChild>
                            <Button variant="secondary" size="icon" >
                                <Plus className="h-5 w-5" />
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>New Message</DialogTitle>
                            </DialogHeader>
                            <div className="max-h-[300px] overflow-y-auto">
                                {potentialPartners.length === 0 ? (
                                    <p className="text-center text-muted-foreground py-4">No contacts available.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {potentialPartners.map((user) => (
                                            <Button
                                                key={user.id}
                                                variant="ghost"
                                                className="w-full justify-start"
                                                onClick={() => handleStartChat(user.id)}
                                                disabled={isLoading}
                                            >
                                                <Avatar className="h-8 w-8 mr-2">
                                                    <AvatarFallback>{user.name?.[0] || "?"}</AvatarFallback>
                                                </Avatar>
                                                <div className="text-left flex-1">
                                                    <div className="font-medium">{user.name}</div>
                                                    <div className="text-xs text-muted-foreground capitalize">{user.role}</div>
                                                </div>
                                                {isLoading && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                                            </Button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
                <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search messages..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8"
                    />
                </div>
            </div>
            <div className="flex-1 overflow-y-auto">
                {filteredConversations.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground text-sm">
                        {searchQuery ? "No conversations found." : "No conversations yet. Start a new one!"}
                    </div>
                ) : (
                    <div className="flex flex-col">
                        {filteredConversations.map((conv) => {
                            const isGroup = conv.type === "group";
                            const name = isGroup
                                ? conv.course?.title || "Course Group"
                                : conv.participants?.[0]?.name || "Unknown User";

                            const lastMessage = conv.last_message?.content || "No messages yet";
                            const time = new Date(conv.last_message?.created_at || conv.updated_at).toLocaleDateString();

                            const isUnread = (conv.unread_count || 0) > 0;

                            return (
                                <button
                                    key={conv.id}
                                    onClick={() => onSelect(conv.id)}
                                    className={cn(
                                        "flex items-start gap-3 p-4 text-left hover:bg-muted/50 transition-colors border-b last:border-0",
                                        selectedId === conv.id && "bg-muted"
                                    )}
                                >
                                    <div className="relative">
                                        <Avatar>
                                            <AvatarFallback>
                                                {isGroup ? <Users className="h-4 w-4" /> : name[0]}
                                            </AvatarFallback>
                                        </Avatar>
                                        {isUnread && (
                                            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-blue-600 border-2 border-background" />
                                        )}
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className={cn("truncate", isUnread ? "font-bold text-foreground" : "font-medium")}>{name}</span>
                                            <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">{time}</span>
                                        </div>
                                        <p className={cn("text-sm truncate", isUnread ? "font-semibold text-foreground" : "text-muted-foreground")}>
                                            {conv.last_message?.sender_id === currentUser.id && "You: "}
                                            {lastMessage}
                                        </p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
