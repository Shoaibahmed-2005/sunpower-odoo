import React, { useEffect, useRef, useState } from "react";
import { MessageItem, portalService } from "../../portal/api";
import { usePortal } from "../../portal/PortalContext";
import { Send, User, Bot, CheckCheck, PhoneCall } from "lucide-react";

export default function CustomerMessages() {
  const { customer } = usePortal();
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
    try {
      const res = await portalService.getMessages();
      setMessages(res.data);
    } catch (err) {
      console.error("Failed to load messages", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000); // 5s live polling
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || sending) return;

    const content = text.trim();
    setText("");
    setSending(true);

    try {
      const res = await portalService.sendMessage({ text: content });
      setMessages((prev) => [...prev, res.data]);
    } catch {
      alert("Failed to send message. Please try again.");
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
    <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[70vh] sm:h-[75vh]">
      {/* Chat Header */}
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-slate-900 text-amber-400 flex items-center justify-center font-bold text-sm">
            SP
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">SunPower Support & Helpdesk</h2>
            <p className="text-xs text-emerald-600 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              Direct Engineering Helpdesk
            </p>
          </div>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/50">
        {messages.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">
            <p>No messages yet. Send a message below to chat with our solar team.</p>
          </div>
        ) : (
          messages.map((m) => {
            const isMe = m.senderType === "CUSTOMER";
            return (
              <div
                key={m.id}
                className={`flex items-end gap-2 ${isMe ? "justify-end" : "justify-start"}`}
              >
                {!isMe && (
                  <div className="w-7 h-7 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center text-xs font-bold shrink-0 mb-1">
                    SP
                  </div>
                )}
                <div
                  className={`max-w-[80%] sm:max-w-md rounded-2xl px-4 py-2.5 shadow-sm text-sm ${
                    isMe
                      ? "bg-slate-900 text-white rounded-br-none"
                      : "bg-white text-slate-800 border border-slate-200 rounded-bl-none"
                  }`}
                >
                  <p className="leading-relaxed whitespace-pre-wrap">{m.text}</p>
                  <div
                    className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                      isMe ? "text-slate-400" : "text-slate-400"
                    }`}
                  >
                    <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    {isMe && m.readAt && (
                      <CheckCheck className="w-3.5 h-3.5 text-sky-400 ml-0.5" />
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input Box */}
      <form onSubmit={handleSend} className="p-3 bg-white border-t border-slate-200 flex gap-2">
        <input
          type="text"
          placeholder="Type your message to SunPower support…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="flex-1 px-4 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold flex items-center gap-1.5 disabled:opacity-50 transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
