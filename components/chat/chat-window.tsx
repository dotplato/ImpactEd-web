"use client";

import { Conversation, Message, getMessages, sendMessage } from "@/lib/actions/chat";
import { AppUser } from "@/lib/auth/session";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
            supabaseClient.removeChannel(channel);
        };
    }, [conversation.id]);

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

        for (const file of attachments) {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `${conversation.id}/${fileName}`;

            const { error: uploadError } = await supabaseClient.storage
                .from('chat-attachments')
                .upload(filePath, file);

            if (uploadError) {
                console.error('Error uploading file:', uploadError);
                continue;
            }

            const { data: { publicUrl } } = supabaseClient.storage
                .from('chat-attachments')
                .getPublicUrl(filePath);

            uploadedAttachments.push({
                url: publicUrl,
                name: file.name,
                type: file.type,
                size: file.size
            });
        }

        return uploadedAttachments;
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() && attachments.length === 0) return;

        const content = newMessage;
        const currentAttachments = [...attachments]; // Snapshot for optimistic update

        setNewMessage("");
        setAttachments([]);
        setIsUploading(true);

        try {
            const uploadedFiles = await uploadFiles();

            // Optimistic update
            const optimisticMsg: Message = {
                id: crypto.randomUUID(),
                conversation_id: conversation.id,
                sender_id: currentUser.id,
                content: content,
                created_at: new Date().toISOString(),
                sender: { name: currentUser.name || "You", role: currentUser.role },
                attachments: uploadedFiles // Use actual URLs if possible, or placeholders? 
                // For optimistic UI, we can't easily show local file previews as URLs without createObjectURL
                // But since we await uploadFiles first, it's not fully optimistic in terms of "instant" send,
                // but it ensures we have URLs.
                // To make it truly optimistic, we'd need to upload in background.
                // For now, let's wait for upload (loading state) then send.
            };

            setMessages(prev => [...prev, optimisticMsg]);
            setTimeout(scrollToBottom, 10);

            if (onMessageSent) {
                onMessageSent(optimisticMsg);
            }

            await sendMessage(conversation.id, content, uploadedFiles);
        } catch (error) {
            console.error("Failed to send message:", error);
            // Restore state on error
            setNewMessage(content);
            setAttachments(currentAttachments);
        } finally {
            setIsUploading(false);
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
                {/* ... Header content ... */}
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
                                    {Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                                        <div className="space-y-2 mb-2">
                                            {msg.attachments.map((att, idx) => {
                                                if (!att || !att.url || !att.type) return null;
                                                return (
                                                    <div key={idx}>
                                                        {att.type.startsWith('image/') ? (
                                                            <img
                                                                src={att.url}
                                                                alt={att.name || 'Attachment'}
                                                                className="max-w-full rounded-lg max-h-[200px] object-cover"
                                                            />
                                                        ) : (
                                                            <a
                                                                href={att.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="flex items-center gap-2 p-2 bg-background/20 rounded hover:bg-background/30 transition-colors"
                                                            >
                                                                <FileIcon className="h-4 w-4" />
                                                                <span className="truncate max-w-[150px]">{att.name || 'File'}</span>
                                                            </a>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                    {msg.content && <div className="whitespace-pre-wrap">{msg.content}</div>}
                                </div>
                                <span className="text-[10px] text-muted-foreground mt-1 px-1">
                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
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
