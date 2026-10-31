import React, { useEffect, useState } from "react";
import axios from "axios";
import { MessageSquare, Send, User, Phone, CheckCircle2 } from "lucide-react";

interface Thread {
  customerId: number;
  customerName: string;
  customerPhone: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

interface ThreadDetail {
  customer: {
    id: number;
    name: string;
    phone: string;
  };
  messages: {
    id: number;
    senderType: "CUSTOMER" | "STAFF";
    senderId: number | null;
    text: string;
    readAt: string | null;
    createdAt: string;
  }[];
}

export default function CustomerMessages() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<number | null>(null);
  const [activeThread, setActiveThread] = useState<ThreadDetail | null>(null);
  const [replyText, setReplyText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const fetchThreads = async () => {
    try {
      const res = await axios.get<Thread[]>("/api/customer-messages/threads", { withCredentials: true });
      setThreads(res.data);
      if (res.data.length > 0 && selectedCustomer === null) {
        setSelectedCustomer(res.data[0].customerId);
      }
    } catch (err) {
      console.error("Failed to load customer message threads", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchThreadDetail = async (customerId: number) => {
    try {
      const res = await axios.get<ThreadDetail>(`/api/customer-messages/${customerId}`, { withCredentials: true });
      setActiveThread(res.data);
    } catch (err) {
      console.error("Failed to load thread detail", err);
    }
  };

  useEffect(() => {
    fetchThreads();
    const interval = setInterval(fetchThreads, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedCustomer) {
      fetchThreadDetail(selectedCustomer);
    }
  }, [selectedCustomer]);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedCustomer || sending) return;

    const text = replyText.trim();
    setReplyText("");
    setSending(true);

    try {
      await axios.post(
        `/api/customer-messages/${selectedCustomer}/reply`,
        { text },
        { withCredentials: true }
      );
      await fetchThreadDetail(selectedCustomer);
      await fetchThreads();
    } catch (err) {
      alert("Failed to send reply");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Customer Messages</h1>
        <p className="text-sm text-slate-500">
          Inquiries, callback requests, and questions sent directly from the customer self-service portal.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden grid grid-cols-1 md:grid-cols-3 h-[75vh]">
        {/* Threads List Sidebar */}
        <div className="border-r border-slate-200 overflow-y-auto">
          <div className="p-3 border-b border-slate-100 bg-slate-50">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              Conversations ({threads.length})
            </span>
          </div>

          {threads.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              No customer message threads yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {threads.map((t) => {
                const active = selectedCustomer === t.customerId;
                return (
                  <button
                    key={t.customerId}
                    onClick={() => setSelectedCustomer(t.customerId)}
                    className={`w-full text-left p-4 hover:bg-slate-50 transition-colors flex flex-col gap-1 ${
                      active ? "bg-amber-50/50 border-l-4 border-amber-500" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-slate-900">
                        {t.customerName}
                      </span>
                      {t.unreadCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950">
                          {t.unreadCount} new
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-mono text-slate-400">{t.customerPhone}</span>
                    <p className="text-xs text-slate-600 truncate mt-0.5">{t.lastMessage}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Active Thread Detail */}
        <div className="md:col-span-2 flex flex-col h-full bg-slate-50/50">
          {activeThread ? (
            <>
              {/* Header */}
              <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    {activeThread.customer.name}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    Phone: {activeThread.customer.phone}
                  </p>
                </div>
              </div>

              {/* Messages Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {activeThread.messages.map((m) => {
                  const isCustomer = m.senderType === "CUSTOMER";
                  return (
                    <div
                      key={m.id}
                      className={`flex ${isCustomer ? "justify-start" : "justify-end"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                          isCustomer
                            ? "bg-white text-slate-900 border border-slate-200 rounded-bl-none"
                            : "bg-slate-900 text-white rounded-br-none"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{m.text}</p>
                        <span className="text-[10px] text-slate-400 block mt-1 text-right">
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reply Form */}
              <form onSubmit={handleReply} className="p-3 bg-white border-t border-slate-200 flex gap-2">
                <input
                  type="text"
                  placeholder={`Reply to ${activeThread.customer.name}…`}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="flex-1 px-4 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
                <button
                  type="submit"
                  disabled={!replyText.trim() || sending}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold flex items-center gap-1.5 disabled:opacity-50 transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
              Select a conversation to view messages
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
