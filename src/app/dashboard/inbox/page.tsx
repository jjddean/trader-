"use client";

import React, { useState, useRef, useEffect } from "react";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import {
    Inbox,
    Search,
    Mail,
    MessageCircle,
    Phone,
    Send,
    Paperclip,
    Star,
    Clock,
    Reply,
    Sparkles,
    Plus,
    MoreVertical,
    CheckCheck,
    AlertCircle,
    Archive,
    Bell,
    UserPlus,
    ArrowRight,
    ExternalLink,
    CircleDot,
    X,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Types
type Channel = "email" | "whatsapp" | "sms";
type Status = "open" | "resolved";
type MessageStatus = "sent" | "delivered" | "queued" | "failed";

interface Conversation {
    id: string;
    name: string;
    channel: Channel;
    status: Status;
    lastMessage: string;
    timestamp: string;
    unread: boolean;
    country: string;
    location?: string;
    messages: ChatMessage[];
}

interface ChatMessage {
    id: string;
    sender: string;
    content: string;
    timestamp: string;
    incoming: boolean;
    status: MessageStatus;
}

// Mock data matching LanesAI reference
const CONVERSATIONS: Conversation[] = [
    {
        id: "1",
        name: "Dhaka Textiles Ltd",
        channel: "email",
        status: "open",
        lastMessage: "Thank you for your interest in our cotton exports. We can provide competitive pricing...",
        timestamp: "2h ago",
        unread: true,
        country: "Bangladesh",
        location: "Dhaka, BD",
        messages: [
            {
                id: "m1",
                sender: "You",
                content: "Hello Dhaka Textiles Ltd, we specialize in Chemicals shipments for the Africa trade route. Would you be open to a quick chat?",
                timestamp: "10:30",
                incoming: false,
                status: "delivered",
            },
            {
                id: "m2",
                sender: "You",
                content: "Checking in, Dhaka Textiles Ltd. Did you have a chance to review my note about your Cotton logistics on the Africa lane?",
                timestamp: "10:30",
                incoming: false,
                status: "queued",
            },
            {
                id: "m3",
                sender: "You",
                content: "Last check, Dhaka Textiles Ltd. Should I keep you in the loop for Cotton updates on the Africa lane?",
                timestamp: "10:30",
                incoming: false,
                status: "queued",
            },
            {
                id: "m4",
                sender: "Dhaka Textiles Ltd",
                content: "Thank you for your interest in our cotton exports. We can provide competitive pricing for HS code 610910 with full DCTS documentation including Form A certificates.",
                timestamp: "14:32",
                incoming: true,
                status: "delivered",
            },
        ],
    },
    {
        id: "2",
        name: "Karachi Cotton Mills",
        channel: "whatsapp",
        status: "open",
        lastMessage: "We've attached the updated Form A certificate for your review.",
        timestamp: "5h ago",
        unread: true,
        country: "Pakistan",
        location: "Karachi, PK",
        messages: [
            {
                id: "m5",
                sender: "You",
                content: "Hi Karachi Cotton Mills, I'd like to discuss DCTS opportunities for your textile exports.",
                timestamp: "09:15",
                incoming: false,
                status: "delivered",
            },
            {
                id: "m6",
                sender: "Karachi Cotton Mills",
                content: "We've attached the updated Form A certificate for your review. Our compliance team has verified all origin documentation.",
                timestamp: "11:45",
                incoming: true,
                status: "delivered",
            },
        ],
    },
    {
        id: "3",
        name: "Nairobi Bean Growers",
        channel: "email",
        status: "resolved",
        lastMessage: "Our next shipment of Arabica beans (HS 090121) is scheduled for...",
        timestamp: "1d ago",
        unread: false,
        country: "Kenya",
        location: "Nairobi, KE",
        messages: [
            {
                id: "m7",
                sender: "Nairobi Bean Growers",
                content: "Our next shipment of Arabica beans (HS 090121) is scheduled for next month. Can you confirm the DCTS preferential rate?",
                timestamp: "Yesterday",
                incoming: true,
                status: "delivered",
            },
            {
                id: "m8",
                sender: "You",
                content: "Kenya falls under the Comprehensive tier. For HS 090121, the preferential duty rate is 0%. I'll send the full breakdown.",
                timestamp: "Yesterday",
                incoming: false,
                status: "delivered",
            },
        ],
    },
    {
        id: "4",
        name: "Phnom Penh Garments",
        channel: "sms",
        status: "open",
        lastMessage: "Confirming the order for 5000 units. PO attached.",
        timestamp: "2d ago",
        unread: false,
        country: "Cambodia",
        location: "Phnom Penh, KH",
        messages: [
            {
                id: "m9",
                sender: "Phnom Penh Garments",
                content: "Confirming the order for 5000 units. PO attached.",
                timestamp: "2d ago",
                incoming: true,
                status: "delivered",
            },
        ],
    },
    {
        id: "5",
        name: "Colombo Tea Estate",
        channel: "whatsapp",
        status: "open",
        lastMessage: "Can you confirm the DCTS eligibility for our premium Ceylon?",
        timestamp: "3d ago",
        unread: false,
        country: "Sri Lanka",
        location: "Colombo, LK",
        messages: [
            {
                id: "m10",
                sender: "Colombo Tea Estate",
                content: "Can you confirm the DCTS eligibility for our premium Ceylon? We need to prepare the Form A documentation.",
                timestamp: "3d ago",
                incoming: true,
                status: "delivered",
            },
        ],
    },
];

const channelIcons: Record<Channel, React.ComponentType<{ className?: string }>> = {
    email: Mail,
    whatsapp: MessageCircle,
    sms: Phone,
};

const channelColors: Record<Channel, string> = {
    email: "text-blue-500 bg-blue-50",
    whatsapp: "text-green-500 bg-green-50",
    sms: "text-purple-500 bg-purple-50",
};

const statusBadgeColors: Record<MessageStatus, { bg: string; text: string; label: string }> = {
    sent: { bg: "bg-gray-100", text: "text-gray-500", label: "SENT" },
    delivered: { bg: "bg-green-100", text: "text-green-600", label: "DELIVERED" },
    queued: { bg: "bg-amber-100", text: "text-amber-600", label: "QUEUED" },
    failed: { bg: "bg-red-100", text: "text-red-600", label: "FAILED" },
};

export default function InboxPage() {
    const [selectedId, setSelectedId] = useState("1");
    const [channelFilter, setChannelFilter] = useState<string>("all");
    const [messageInput, setMessageInput] = useState("");
    const [showActionMenu, setShowActionMenu] = useState(false);
    const [starred, setStarred] = useState<Set<string>>(new Set());
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const actionMenuRef = useRef<HTMLDivElement>(null);

    const filtered = channelFilter === "all"
        ? CONVERSATIONS
        : CONVERSATIONS.filter((c) => c.channel === channelFilter);

    const selected = CONVERSATIONS.find((c) => c.id === selectedId);
    const unreadCount = CONVERSATIONS.filter((c) => c.unread).length;

    // Close action menu on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
                setShowActionMenu(false);
            }
        };
        if (showActionMenu) document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showActionMenu]);

    // Scroll to bottom when selected conversation changes
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [selectedId]);

    const toggleStar = (id: string) => {
        setStarred((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    return (
        <div className="flex h-screen bg-white font-sans text-gray-600 overflow-hidden">
            <DashboardSidebar />

            <main className="flex-1 flex flex-col relative overflow-hidden">
                {/* Header */}
                <header className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-6 z-20">
                    <div className="flex items-center gap-4">
                        <h1 className="text-sm font-normal text-black tracking-tight">Inbox</h1>
                        {/* Channel Filters */}
                        <div className="flex items-center gap-1">
                            {(["all", "email", "whatsapp", "sms"] as const).map((ch) => (
                                <button
                                    key={ch}
                                    onClick={() => setChannelFilter(ch)}
                                    className={cn(
                                        "px-2 py-1 rounded text-[10px] font-medium transition-colors",
                                        channelFilter === ch
                                            ? "bg-gray-100 text-black border border-gray-200"
                                            : "text-gray-400 hover:text-gray-600"
                                    )}
                                >
                                    {ch === "all" ? "All" : ch === "whatsapp" ? "WhatsApp" : ch === "sms" ? "SMS" : "Email"}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search messages..."
                                className="h-8 pl-8 pr-3 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-700 focus:outline-none focus:border-gray-400 w-44 transition-colors"
                            />
                        </div>
                        <button className="h-8 px-3 bg-black hover:bg-gray-800 text-white text-xs font-normal rounded-md transition-colors flex items-center gap-1.5">
                            <Plus className="h-3 w-3" />
                            Compose
                        </button>
                    </div>
                </header>

                {/* Two-pane layout */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Conversation List */}
                    <div className="w-80 border-r border-gray-200 bg-white overflow-y-auto custom-scrollbar">
                        {filtered.map((conv) => {
                            const Icon = channelIcons[conv.channel];
                            return (
                                <button
                                    key={conv.id}
                                    onClick={() => setSelectedId(conv.id)}
                                    className={cn(
                                        "w-full px-4 py-3 text-left border-b border-gray-50 transition-colors",
                                        selectedId === conv.id ? "bg-gray-50" : "hover:bg-gray-50/50"
                                    )}
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-2">
                                            <div className={cn("w-5 h-5 rounded flex items-center justify-center", channelColors[conv.channel])}>
                                                <Icon className="h-3 w-3" />
                                            </div>
                                            <span className={cn(
                                                "text-xs truncate max-w-[140px]",
                                                conv.unread ? "font-medium text-black" : "font-normal text-gray-700"
                                            )}>
                                                {conv.name}
                                            </span>
                                            {/* Thread Status */}
                                            <span className={cn(
                                                "text-[8px] uppercase tracking-wider font-bold px-1 py-0.5 rounded",
                                                conv.status === "open"
                                                    ? "bg-green-100 text-green-700"
                                                    : "bg-gray-100 text-gray-500"
                                            )}>
                                                {conv.status}
                                            </span>
                                        </div>
                                        <span className="text-[9px] text-gray-400">{conv.timestamp}</span>
                                    </div>
                                    <p className={cn(
                                        "text-[11px] truncate",
                                        conv.unread ? "text-gray-600" : "text-gray-400"
                                    )}>
                                        {conv.lastMessage}
                                    </p>
                                    <span className="text-[9px] text-gray-300 mt-0.5 block">{conv.channel} · {conv.country}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Message View */}
                    <div className="flex-1 flex flex-col bg-gray-50/50">
                        {selected ? (
                            <>
                                {/* Chat Header with Action Bar */}
                                <div className="px-6 py-3 border-b border-gray-200 bg-white">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-sm font-semibold", channelColors[selected.channel])}>
                                                {selected.name.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-xs font-medium text-black">{selected.name}</p>
                                                    <span className={cn(
                                                        "text-[8px] uppercase tracking-wider font-bold px-1 py-0.5 rounded",
                                                        selected.status === "open"
                                                            ? "bg-green-100 text-green-700"
                                                            : "bg-gray-100 text-gray-500"
                                                    )}>
                                                        {selected.status}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    {React.createElement(channelIcons[selected.channel], { className: "h-2.5 w-2.5 text-gray-400" })}
                                                    <p className="text-[9px] text-gray-400">{selected.channel} · {selected.location}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action Buttons — all inline text-style */}
                                        <div className="flex items-center gap-4">
                                            <button className="text-xs text-gray-500 hover:text-black transition-colors inline-flex items-center gap-1">
                                                <Reply className="h-3.5 w-3.5" />
                                                Reply
                                            </button>
                                            <button className="text-xs text-gray-500 hover:text-black transition-colors inline-flex items-center gap-1">
                                                <Sparkles className="h-3.5 w-3.5" />
                                                AI Assistant
                                            </button>
                                            <button className="text-xs text-gray-500 hover:text-black transition-colors inline-flex items-center gap-1">
                                                AI Draft
                                            </button>
                                            <button className="text-gray-400 hover:text-black transition-colors inline-flex items-center">
                                                <Plus className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => toggleStar(selected.id)}
                                                className="hover:text-black transition-colors inline-flex items-center"
                                            >
                                                <Star className={cn(
                                                    "h-4 w-4",
                                                    starred.has(selected.id) ? "text-amber-400 fill-amber-400" : "text-gray-400"
                                                )} />
                                            </button>

                                            {/* Kebab Menu */}
                                            <div className="relative inline-flex items-center" ref={actionMenuRef}>
                                                <button
                                                    onClick={() => setShowActionMenu(!showActionMenu)}
                                                    className="text-gray-400 hover:text-black transition-colors inline-flex items-center"
                                                >
                                                    <MoreVertical className="h-4 w-4" />
                                                </button>

                                                {showActionMenu && (
                                                    <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 animate-in fade-in slide-in-from-top-2 duration-150">
                                                        {/* Thread Management */}
                                                        <p className="px-3 py-1.5 text-[9px] font-semibold text-gray-400 uppercase tracking-widest">Thread Management</p>
                                                        <button className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 transition-colors text-left">
                                                            <Archive className="h-3.5 w-3.5 text-green-500" />
                                                            <div>
                                                                <p className="text-xs text-gray-700">Resolve & Archive</p>
                                                                <p className="text-[9px] text-gray-400">Mark as completed</p>
                                                            </div>
                                                        </button>
                                                        <button className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 transition-colors text-left">
                                                            <Bell className="h-3.5 w-3.5 text-orange-500" />
                                                            <div>
                                                                <p className="text-xs text-gray-700">Snooze Follow-up</p>
                                                                <p className="text-[9px] text-gray-400">Remind me later</p>
                                                            </div>
                                                        </button>

                                                        {/* Collaboration */}
                                                        <div className="border-t border-gray-100 mt-1 pt-1">
                                                            <p className="px-3 py-1.5 text-[9px] font-semibold text-gray-400 uppercase tracking-widest">Collaboration</p>
                                                            <button className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 transition-colors text-left">
                                                                <UserPlus className="h-3.5 w-3.5 text-blue-500" />
                                                                <div>
                                                                    <p className="text-xs text-gray-700">Assign to Agent</p>
                                                                    <p className="text-[9px] text-gray-400">Designate team member</p>
                                                                </div>
                                                            </button>
                                                        </div>

                                                        {/* Engine Bridge */}
                                                        <div className="border-t border-gray-100 mt-1 pt-1">
                                                            <p className="px-3 py-1.5 text-[9px] font-semibold text-gray-400 uppercase tracking-widest">Engine Bridge</p>
                                                            <button className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 transition-colors text-left">
                                                                <ArrowRight className="h-3.5 w-3.5 text-purple-500" />
                                                                <div>
                                                                    <p className="text-xs text-gray-700">Move to Lane</p>
                                                                    <p className="text-[9px] text-gray-400">Direct lane activation</p>
                                                                </div>
                                                            </button>
                                                            <button className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 transition-colors text-left">
                                                                <ExternalLink className="h-3.5 w-3.5 text-indigo-500" />
                                                                <div>
                                                                    <p className="text-xs text-gray-700">View Lead DNA</p>
                                                                    <p className="text-[9px] text-gray-400">Full strategic profile</p>
                                                                </div>
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Messages */}
                                <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                                    {selected.messages.map((msg) => (
                                        <div key={msg.id}>
                                            {/* Timestamp label */}
                                            <p className={cn(
                                                "text-[9px] uppercase tracking-wider font-semibold mb-1.5",
                                                msg.incoming ? "text-gray-400" : "text-gray-400"
                                            )}>
                                                {msg.incoming ? msg.sender : "YOU"} · {msg.timestamp}
                                            </p>
                                            <div className={cn("flex", msg.incoming ? "justify-start" : "justify-start")}>
                                                <div className={cn(
                                                    "max-w-[75%] rounded-xl px-4 py-3 relative",
                                                    msg.incoming
                                                        ? "bg-white border border-gray-200"
                                                        : "bg-blue-50 border border-blue-100"
                                                )}>
                                                    <p className={cn(
                                                        "text-xs leading-relaxed",
                                                        msg.incoming ? "text-gray-700" : "text-gray-800"
                                                    )}>
                                                        {msg.content}
                                                    </p>
                                                    {/* Message Status Badge */}
                                                    <div className="flex justify-end mt-1.5">
                                                        <span className={cn(
                                                            "text-[8px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded",
                                                            statusBadgeColors[msg.status].bg,
                                                            statusBadgeColors[msg.status].text
                                                        )}>
                                                            {statusBadgeColors[msg.status].label}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Message Input */}
                                <div className="px-4 py-3 border-t border-gray-200 bg-white">
                                    <div className="flex items-center gap-2">
                                        <button className="p-2 hover:bg-gray-100 rounded-md transition-colors">
                                            <Paperclip className="h-4 w-4 text-gray-400" />
                                        </button>
                                        <input
                                            type="text"
                                            placeholder="Type a message..."
                                            value={messageInput}
                                            onChange={(e) => setMessageInput(e.target.value)}
                                            className="flex-1 h-9 px-3 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-700 focus:outline-none focus:border-gray-400 transition-colors"
                                        />
                                        <button className="h-9 px-4 bg-black hover:bg-gray-800 text-white text-xs font-normal rounded-md transition-colors flex items-center gap-1.5">
                                            <Send className="h-3 w-3" />
                                            Send
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center">
                                <div className="text-center">
                                    <Inbox className="h-8 w-8 text-gray-300 mx-auto mb-3" />
                                    <p className="text-sm text-gray-500">Select a conversation</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
