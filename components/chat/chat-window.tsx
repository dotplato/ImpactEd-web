"use client";

import { Conversation, Message, getMessages, sendMessage, getUserInfo } from "@/lib/actions/chat";
import { AppUser } from "@/lib/auth/session";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, Users, Paperclip, X, FileIcon, ImageIcon, Loader2 } from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useDropzone } from "react-dropzone";
import { supabaseClient } from "@/lib/db/supabase-client";

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
    const [isUploading, setIsUploading] = useState(false);
    const [attachments, setAttachments] = useState<File[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    };

    const isGroup = conversation.type === "group";
    const title = isGroup
        ? conversation.course?.title || "Course Group"
        : conversation.participants?.[0]?.name || "Unknown User";

    // Fetch initial messages and mark as read
    useEffect(() => {
        const fetchMessages = async () => {
            console.log("Fetching messages for conversation:", conversation.id);
            setIsLoading(true);
            setMessages([]); // Clear previous messages immediately
            try {
                const msgs = await getMessages(conversation.id);
                console.log("Fetched messages:", msgs);
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
        const channel = supabaseClient
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
                    console.log("Realtime message received:", newMsg.id);

                    // If it's not from me, we need to fetch the sender info because Realtime only sends the raw row
                    if (newMsg.sender_id !== currentUser.id && !newMsg.sender) {
                        try {
                            const userData = await getUserInfo(newMsg.sender_id);
                            if (userData) {
                                newMsg.sender = userData;
                            }
                        } catch (error) {
                            console.error("Failed to resolve sender info:", error);
                        }
                    }

                    setMessages(prev => {
                        const exists = prev.find(m => m.id === newMsg.id);
                        if (exists) {
                            console.log("Message already exists in state, skipping:", newMsg.id);
                            return prev;
                        }
                        console.log("Adding new message from Realtime to state:", newMsg.id);
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
            supabaseClient.removeChannel(channel);
        };
    }, [conversation.id, currentUser.id]);

    const onDrop = useCallback((acceptedFiles: File[]) => {
        // Filter files > 5MB
        const validFiles = acceptedFiles.filter(file => {
            if (file.size > 5 * 1024 * 1024) {
                alert(`File ${file.name} is too large. Max 5MB.`);
                return false;
            }
            return true;
        });
        setAttachments(prev => [...prev, ...validFiles]);
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        noClick: true,
        noKeyboard: true,
        maxSize: 5 * 1024 * 1024
    });

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const uploadFiles = async () => {
        if (attachments.length === 0) return [];

        const uploadedAttachments = [];
        const { uploadChatAttachment } = await import("@/lib/actions/chat");

        for (const file of attachments) {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('conversationId', conversation.id);

            try {
                const result = await uploadChatAttachment(formData);
                if (result) {
                    console.log("File uploaded:", result.name, "Public URL:", result.url);
                    uploadedAttachments.push(result);
                }
            } catch (error) {
                console.error('Error uploading file:', error);
            }
        }

        return uploadedAttachments;
    };

    const isSendingRef = useRef(false);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSendingRef.current) return;
        if (!newMessage.trim() && attachments.length === 0) return;

        const content = newMessage;
        const currentAttachments = [...attachments]; // Snapshot for optimistic update

        setNewMessage("");
        setAttachments([]);
        setIsUploading(true);
        isSendingRef.current = true;

        try {
            const uploadedFiles = await uploadFiles();

            // Optimistic update
            const messageId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);

            console.log("Sending message with ID:", messageId);

            const optimisticMsg: Message = {
                id: messageId,
                conversation_id: conversation.id,
                sender_id: currentUser.id,
                content: content,
                created_at: new Date().toISOString(),
                sender: { name: currentUser.name || "You", role: currentUser.role, image_url: currentUser.image_url },
                attachments: uploadedFiles
            };

            setMessages(prev => {
                console.log("Adding optimistic message to state");
                return [...prev, optimisticMsg];
            });
            setTimeout(scrollToBottom, 10);

            if (onMessageSent) {
                onMessageSent(optimisticMsg);
            }

            await sendMessage(conversation.id, content, uploadedFiles, messageId);
            console.log("Message sent successfully");
        } catch (error) {
            console.error("Failed to send message:", error);
            // Restore state on error
            setNewMessage(content);
            setAttachments(currentAttachments);
        } finally {
            setIsUploading(false);
            isSendingRef.current = false;
        }
    };

    return (
        <div className="flex flex-col h-full" {...getRootProps()}>
            <input {...getInputProps()} />
            {isDragActive && (
                <div className="absolute hidden inset-0 z-50 bg-primary/10 flex items-center justify-center backdrop-blur-sm">
                    <div className="bg-background p-6 rounded-lg shadow-lg text-center">
                        <FileIcon className="h-12 w-12 mx-auto mb-2 text-primary" />
                        <p className="font-medium">Drop files here to attach</p>
                    </div>
                </div>
            )}

            <div className="p-4 border-b flex items-center gap-3 shadow-sm bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <Button variant="ghost" size="icon" className="md:hidden" onClick={onBack}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <Avatar>
                    {isGroup ? (
                        <AvatarFallback>
                            <Users className="h-4 w-4" />
                        </AvatarFallback>
                    ) : (
                        <>
                            {(() => {
                                const otherParticipant = conversation.participants?.find(p => p.id !== currentUser.id);
                                if (otherParticipant?.image_url) {
                                    return <AvatarImage src={otherParticipant.image_url} />;
                                }
                                return <AvatarFallback>{title[0]}</AvatarFallback>;
                            })()}
                        </>
                    )}
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
                        const senderName = msg.sender?.name || "User";

                        return (
                            <div
                                key={msg.id}
                                className={cn(
                                    "flex gap-3 max-w-[85%]",
                                    isMe ? "ml-auto flex-row-reverse" : "mr-auto flex-row"
                                )}
                            >
                                {!isMe && isGroup && (
                                    <Avatar className="h-8 w-8 mt-1 shrink-0">
                                        {msg.sender?.image_url ? (
                                            <AvatarImage src={msg.sender.image_url} />
                                        ) : (
                                            <AvatarFallback className="text-[10px]">
                                                {senderName[0]}
                                            </AvatarFallback>
                                        )}
                                    </Avatar>
                                )}
                                <div className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                                    {showSender && (
                                        <span className="text-xs text-muted-foreground mb-1 ml-1">
                                            {senderName}
                                        </span>
                                    )}
                                    {(msg.content || (Array.isArray(msg.attachments) && msg.attachments.length > 0)) ? (
                                        <div
                                            className={cn(
                                                "rounded-2xl text-sm overflow-hidden",
                                                isMe
                                                    ? "bg-primary text-primary-foreground rounded-br-none"
                                                    : "bg-muted text-foreground rounded-bl-none",
                                                // If it's only an image, we might want less padding
                                                (msg.content || (msg.attachments?.some(a => !a.type?.startsWith('image/')))) ? "px-4 py-2" : "p-1"
                                            )}
                                        >
                                            {Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                                                <div className="flex flex-col gap-2 mb-2">
                                                    {msg.attachments.map((att, idx) => {
                                                        if (!att || !att.url) return null;

                                                        // Infer type if missing
                                                        const fileType = att.type || (att.name?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? 'image/jpeg' : 'application/octet-stream');
                                                        const isImage = fileType.startsWith('image/');

                                                        return (
                                                            <div key={idx} className="max-w-full">
                                                                {isImage ? (
                                                                    <a href={att.url} target="_blank" rel="noopener noreferrer" className="block">
                                                                        <img
                                                                            src={att.url}
                                                                            alt={att.name || 'Attachment'}
                                                                            className="max-w-full rounded-lg max-h-[300px] object-cover border border-border/50"
                                                                        />
                                                                    </a>
                                                                ) : (
                                                                    <a
                                                                        href={att.url}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className={cn(
                                                                            "flex items-center gap-3 p-3 rounded-lg transition-colors border max-w-xs",
                                                                            isMe
                                                                                ? "bg-primary-foreground/10 border-primary-foreground/20 hover:bg-primary-foreground/20"
                                                                                : "bg-background border-border hover:bg-accent"
                                                                        )}
                                                                    >
                                                                        <div className={cn(
                                                                            "p-2 rounded-full",
                                                                            isMe ? "bg-primary-foreground/20" : "bg-muted"
                                                                        )}>
                                                                            <FileIcon className="h-4 w-4" />
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className="text-sm font-medium truncate">{att.name || 'File'}</p>
                                                                            {att.size && (
                                                                                <p className={cn("text-xs opacity-70", isMe ? "text-primary-foreground/70" : "text-muted-foreground")}>
                                                                                    {(att.size / 1024).toFixed(1)} KB
                                                                                </p>
                                                                            )}
                                                                        </div>
                                                                    </a>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                            {msg.content && <div className={cn("whitespace-pre-wrap", (Array.isArray(msg.attachments) && msg.attachments.length > 0) && "mt-2")}>{msg.content}</div>}
                                        </div>
                                    ) : (
                                        // If somehow we have an empty message, don't render the bubble but log it
                                        <div className="hidden">{console.log("Empty message detected:", msg.id)}</div>
                                    )}
                                    <span className="text-[10px] text-muted-foreground mt-1 px-1">
                                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <div className="p-4 border-t bg-background space-y-4">
                {attachments.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                        {attachments.map((file, i) => (
                            <div key={i} className="relative bg-muted p-2 rounded-md flex items-center gap-2 text-xs">
                                <span className="max-w-[100px] truncate">{file.name}</span>
                                <button onClick={() => removeAttachment(i)} className="text-muted-foreground hover:text-foreground">
                                    <X className="h-3 w-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
                <form onSubmit={handleSend} className="flex gap-2">
                    <div className="relative">
                        <input
                            type="file"
                            multiple
                            className="hidden"
                            id="file-upload"
                            onChange={(e) => {
                                if (e.target.files) {
                                    onDrop(Array.from(e.target.files));
                                    e.target.value = ""; // Reset input
                                }
                            }}
                        />
                        <label htmlFor="file-upload">
                            <Button variant="ghost" size="icon" type="button" asChild>
                                <span><Paperclip className="h-4 w-4" /></span>
                            </Button>
                        </label>
                    </div>
                    <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1"
                    />
                    <Button variant="secondary" type="submit" size="icon" disabled={(!newMessage.trim() && attachments.length === 0) || isUploading}>
                        {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                </form>
            </div>
        </div>
    );
}
