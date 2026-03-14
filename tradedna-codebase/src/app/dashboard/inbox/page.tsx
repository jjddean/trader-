"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Inbox,
  Mail,
  MessageCircle,
  Phone,
  Send,
  Paperclip,
  Star,
  Reply,
  Forward,
  X,
  Zap,
  Plus,
  MoreVertical,
  Archive,
  Bell,
  UserPlus,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DashboardHeader } from "@/components/dashboard-header";

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
    lastMessage:
      "Thank you for your interest in our cotton exports. We can provide competitive pricing...",
    timestamp: "2h ago",
    unread: true,
    country: "Bangladesh",
    location: "Dhaka, BD",
    messages: [
      {
        id: "m1",
        sender: "You",
        content:
          "Hello Dhaka Textiles Ltd, we specialize in Chemicals shipments for the Africa trade route. Would you be open to a quick chat?",
        timestamp: "10:30",
        incoming: false,
        status: "delivered",
      },
      {
        id: "m2",
        sender: "You",
        content:
          "Checking in, Dhaka Textiles Ltd. Did you have a chance to review my note about your Cotton logistics on the Africa lane?",
        timestamp: "10:30",
        incoming: false,
        status: "queued",
      },
      {
        id: "m3",
        sender: "You",
        content:
          "Last check, Dhaka Textiles Ltd. Should I keep you in the loop for Cotton updates on the Africa lane?",
        timestamp: "10:30",
        incoming: false,
        status: "queued",
      },
      {
        id: "m4",
        sender: "Dhaka Textiles Ltd",
        content:
          "Thank you for your interest in our cotton exports. We can provide competitive pricing for HS code 610910 with full DCTS documentation including Form A certificates.",
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
        content:
          "Hi Karachi Cotton Mills, I'd like to discuss DCTS opportunities for your textile exports.",
        timestamp: "09:15",
        incoming: false,
        status: "delivered",
      },
      {
        id: "m6",
        sender: "Karachi Cotton Mills",
        content:
          "We've attached the updated Form A certificate for your review. Our compliance team has verified all origin documentation.",
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
        content:
          "Our next shipment of Arabica beans (HS 090121) is scheduled for next month. Can you confirm the DCTS preferential rate?",
        timestamp: "Yesterday",
        incoming: true,
        status: "delivered",
      },
      {
        id: "m8",
        sender: "You",
        content:
          "Kenya falls under the Comprehensive tier. For HS 090121, the preferential duty rate is 0%. I'll send the full breakdown.",
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
        content:
          "Can you confirm the DCTS eligibility for our premium Ceylon? We need to prepare the Form A documentation.",
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
  const [view, setView] = useState<"list" | "detail">("list");
  const [messageInput, setMessageInput] = useState("");
  const [isReplying, setIsReplying] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [starred, setStarred] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  const filtered =
    channelFilter === "all"
      ? CONVERSATIONS
      : CONVERSATIONS.filter((c) => c.channel === channelFilter);

  const selected = CONVERSATIONS.find((c) => c.id === selectedId);

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
  }, [selectedId, view]);

  const toggleStar = (id: string) => {
    setStarred((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectConversation = (id: string) => {
    setSelectedId(id);
    setView("detail");
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <DashboardHeader
        title="Inbox"
        badge="HUB"
        badgeVariant="default"
        buttonLabel="+ Compose"
        buttonIcon={<Plus className="h-3.5 w-3.5" />}
      >
        <div className="flex items-center gap-1 border-gray-100 pr-4">
          {["all", "email", "whatsapp", "sms"].map((tab) => (
            <button
              key={tab}
              onClick={() => setChannelFilter(tab)}
              className={cn(
                "rounded-md px-3 py-1 text-[10px] font-medium capitalize transition-all",
                channelFilter === tab
                  ? "bg-gray-100 text-black shadow-sm"
                  : "text-gray-400 hover:text-gray-600",
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </DashboardHeader>

      {/* Main Content Area */}
      <div className="relative flex flex-1 flex-col overflow-hidden">
        {view === "list" ? (
          /* Scrollable List View */
          <div className="w-full flex-1 overflow-y-auto">
            {filtered.map((conv) => {
              const Icon = channelIcons[conv.channel];
              return (
                <button
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv.id)}
                  className={cn(
                    "w-full border-b border-gray-50 px-6 py-4 text-left transition-colors",
                    selectedId === conv.id ? "bg-gray-50/80" : "hover:bg-gray-50/50",
                  )}
                >
                  <div className="mb-1.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded",
                          channelColors[conv.channel],
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <span
                        className={cn(
                          "truncate text-[13.75px]",
                          conv.unread ? "font-semibold text-black" : "font-normal text-gray-700",
                        )}
                      >
                        {conv.name}
                      </span>
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase",
                          conv.status === "open"
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500",
                        )}
                      >
                        {conv.status}
                      </span>
                    </div>
                    <span className="text-[10px] font-medium text-gray-400">{conv.timestamp}</span>
                  </div>
                  <p
                    className={cn(
                      "ml-9 truncate text-[13px]",
                      conv.unread ? "font-medium text-gray-700" : "text-gray-400",
                    )}
                  >
                    {conv.lastMessage}
                  </p>
                  <div className="mt-2 ml-9 flex items-center gap-2">
                    <span className="text-[11px] font-medium text-gray-300 capitalize">
                      {conv.channel}
                    </span>
                    <span className="text-[11px] text-gray-200">·</span>
                    <span className="text-[11px] font-medium text-gray-300">{conv.country}</span>
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                <Inbox className="mb-4 h-10 w-10 text-gray-100" />
                <p className="text-sm font-medium text-gray-400">
                  No messages found in {channelFilter}
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Detail View */
          <div className="flex flex-1 flex-col overflow-hidden bg-gray-50/30">
            {selected ? (
              <>
                {/* Chat Header */}
                <div className="border-b border-gray-200 bg-white px-6 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => setView("list")}
                        className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-black"
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </button>
                      <div
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold",
                          channelColors[selected.channel],
                        )}
                      >
                        {selected.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-medium text-black">{selected.name}</p>
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase",
                              selected.status === "open"
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-500",
                            )}
                          >
                            {selected.status}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          {React.createElement(channelIcons[selected.channel], {
                            className: "h-3 w-3 text-gray-400",
                          })}
                          <p className="text-[11px] text-gray-400">
                            {selected.channel} · {selected.location}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => setIsReplying(true)}
                        className="inline-flex items-center gap-1 text-xs text-gray-500 transition-colors hover:text-black"
                      >
                        <Reply className="h-3.5 w-3.5" />
                        Reply
                      </button>
                      <button className="inline-flex items-center text-gray-400 transition-colors hover:text-black">
                        <Plus className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => toggleStar(selected.id)}
                        className="inline-flex items-center transition-colors hover:text-black"
                      >
                        <Star
                          className={cn(
                            "h-4 w-4",
                            starred.has(selected.id)
                              ? "fill-amber-400 text-amber-400"
                              : "text-gray-400",
                          )}
                        />
                      </button>

                      {/* Kebab Menu */}
                      <div className="relative inline-flex items-center" ref={actionMenuRef}>
                        <button
                          onClick={() => setShowActionMenu(!showActionMenu)}
                          className="inline-flex items-center text-gray-400 transition-colors hover:text-black"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>

                        {showActionMenu && (
                          <div className="animate-in fade-in slide-in-from-top-2 absolute top-full right-0 z-50 mt-1 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg duration-150">
                            <p className="px-3 py-1.5 text-[10px] font-semibold tracking-widest text-gray-400 uppercase">
                              Thread Management
                            </p>
                            <button className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-gray-50">
                              <Archive className="h-3.5 w-3.5 text-green-500" />
                              <div>
                                <p className="text-xs font-medium text-gray-700">
                                  Resolve & Archive
                                </p>
                                <p className="text-[10px] text-gray-400">Mark as completed</p>
                              </div>
                            </button>
                            <button className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-gray-50">
                              <Bell className="h-3.5 w-3.5 text-orange-500" />
                              <div>
                                <p className="text-xs font-medium text-gray-700">
                                  Snooze Follow-up
                                </p>
                                <p className="text-[10px] text-gray-400">Remind me later</p>
                              </div>
                            </button>
                            <div className="mt-1 border-t border-gray-50 pt-1">
                              <p className="px-3 py-1.5 text-[10px] font-semibold tracking-widest text-gray-400 uppercase">
                                Collaboration
                              </p>
                              <button className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-gray-50">
                                <UserPlus className="h-3.5 w-3.5 text-blue-500" />
                                <div>
                                  <p className="text-xs font-medium text-gray-700">
                                    Assign to Agent
                                  </p>
                                  <p className="text-[10px] text-gray-400">Designate team member</p>
                                </div>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-1 flex-col overflow-hidden">
                  {/* Messages Scroll Area */}
                  <div className="mx-auto flex-1 w-full max-w-4xl space-y-6 overflow-y-auto p-8 no-scrollbar">
                    {selected.messages.map((msg) => (
                      <div key={msg.id}>
                        <p className="mb-2 text-[11px] font-semibold tracking-wider text-gray-400 uppercase">
                          {msg.incoming ? msg.sender : "YOU"} · {msg.timestamp}
                        </p>
                        <div className="flex justify-start">
                          <div
                            className={cn(
                              "relative max-w-[85%] rounded-2xl px-5 py-4 shadow-sm",
                              msg.incoming
                                ? "border border-gray-100 bg-white"
                                : "border border-blue-100 bg-blue-50",
                            )}
                          >
                            <p
                              className={cn(
                                "text-[13.75px] leading-relaxed",
                                msg.incoming ? "text-gray-700" : "text-gray-800",
                              )}
                            >
                              {msg.content}
                            </p>
                            <div className="mt-2 flex justify-end">
                              <span
                                className={cn(
                                  "rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase",
                                  statusBadgeColors[msg.status].bg,
                                  statusBadgeColors[msg.status].text,
                                )}
                              >
                                {statusBadgeColors[msg.status].label}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Fixed Bottom Reply Area */}
                  <div className="border-t border-gray-100 bg-white px-8 py-4">
                    <div className="mx-auto max-w-4xl">
                      {!isReplying ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setIsReplying(true)}
                            className="flex h-8 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-xs font-medium text-gray-600 shadow-sm transition-all hover:bg-gray-50 active:scale-95"
                          >
                            <Reply className="h-3.5 w-3.5" />
                            Reply
                          </button>
                          <button className="flex h-8 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-xs font-medium text-gray-600 shadow-sm transition-all hover:bg-gray-50 active:scale-95">
                            <Forward className="h-3.5 w-3.5" />
                            Forward
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
                          <textarea
                            placeholder="Write a message..."
                            value={messageInput}
                            onChange={(e) => setMessageInput(e.target.value)}
                            rows={4}
                            className="w-full resize-none border-none bg-white p-4 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-0"
                            autoFocus
                          />
                          <div className="flex items-center justify-between border-t border-gray-50 bg-gray-50/50 px-4 py-3">
                            <button
                              onClick={() => setIsReplying(false)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                            >
                              <X className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => {
                                setIsReplying(false);
                                setMessageInput("");
                              }}
                              className="flex h-8 items-center gap-2 rounded-lg bg-black px-4 text-xs font-semibold text-white transition-all hover:bg-gray-800 active:scale-95 shadow-sm"
                            >
                              <Send className="h-3.5 w-3.5" />
                              Send Message
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <div className="text-center">
                  <Inbox className="mx-auto mb-4 h-12 w-12 text-gray-100" />
                  <p className="text-sm font-medium text-gray-400">Conversation not found</p>
                  <button
                    onClick={() => setView("list")}
                    className="mt-4 text-sm text-blue-500 hover:underline"
                  >
                    Return to list
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
