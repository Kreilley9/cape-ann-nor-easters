import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { PortalLayout } from "@/react-app/components/layout/PortalLayout";
import {
  MessageSquare,
  Plus,
  Pin,
  MessageCircle,
  Clock,
  ArrowLeft,
} from "lucide-react";
import { formatRelativeTime } from "@/react-app/utils/dateFormat";

interface CoachesMessage {
  id: number;
  title: string;
  content: string;
  author_name: string;
  is_pinned: number;
  reply_count: number;
  created_at: string;
}

export function PortalCoachesMessages() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<CoachesMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    loadMessages();
  }, []);

  async function loadMessages() {
    try {
      const response = await fetch("/api/portal/coaches/messages", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (error) {
      console.error("Failed to load messages:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!title.trim() || !content.trim()) {
      alert("Please provide a title and message");
      return;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/portal/coaches/messages", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
        }),
      });

      if (response.ok) {
        setCreateOpen(false);
        resetForm();
        loadMessages();
      } else {
        const errorData = await response.json();
        console.error("Create failed:", errorData);
        alert(`Failed to create message: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error("Create failed:", error);
      alert("Failed to create message");
    } finally {
      setCreating(false);
    }
  }

  function resetForm() {
    setTitle("");
    setContent("");
  }

  return (
    <PortalLayout>
      <div className="space-y-6">
        {/* Back Button */}
        <button
          onClick={() => navigate("/portal")}
          className="flex items-center gap-2 text-[#00c4ff] hover:text-[#00a8dd] transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Portal
        </button>

      {/* Header */}
      <div
        className="rounded-lg border p-6"
        style={{
          background: "rgba(18, 26, 36, 0.8)",
          borderColor: "#00c4ff",
          boxShadow: "0 0 20px rgba(0, 196, 255, 0.15)",
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white font-[Oswald] tracking-wide">
              Coaches Portal - Message Board
            </h1>
            <p className="text-gray-400 mt-1">
              Discuss strategies, share insights, and coordinate with coaching staff
            </p>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="px-4 py-2 bg-[#00c4ff] hover:bg-[#00a8dd] text-black font-semibold rounded-lg transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Thread
          </button>
        </div>
      </div>

      {/* Messages List */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : messages.length === 0 ? (
        <div
          className="text-center py-12 rounded-lg border"
          style={{
            background: "rgba(18, 26, 36, 0.6)",
            borderColor: "#00c4ff",
          }}
        >
          <MessageSquare className="w-16 h-16 mx-auto text-gray-500 mb-4" />
          <p className="text-gray-400">No messages yet</p>
          <p className="text-gray-500 text-sm mt-2">
            Start a conversation with your coaching staff
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((message) => (
            <div
              key={message.id}
              onClick={() => navigate(`/portal/coaches/messages/${message.id}`)}
              className="rounded-lg border p-4 cursor-pointer hover:border-[#00c4ff] transition-colors"
              style={{
                background: "rgba(18, 26, 36, 0.6)",
                borderColor: message.is_pinned ? "#00c4ff" : "#00c4ff33",
              }}
            >
              <div className="flex items-start gap-3">
                {message.is_pinned ? (
                  <Pin className="w-5 h-5 text-[#00c4ff] flex-shrink-0 mt-1" />
                ) : (
                  <MessageCircle className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold text-white text-lg">
                      {message.title}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-gray-400 flex-shrink-0">
                      <Clock className="w-3 h-3" />
                      {formatRelativeTime(message.created_at)}
                    </div>
                  </div>
                  <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                    {message.content}
                  </p>
                  <div className="flex items-center gap-4 mt-3 text-sm">
                    <span className="text-[#00c4ff]">{message.author_name}</span>
                    <span className="text-gray-500">
                      {message.reply_count} {message.reply_count === 1 ? "reply" : "replies"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      {createOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0f14] border border-[#00c4ff]/30 rounded-lg max-w-2xl w-full p-6">
            <div className="mb-6">
              <h2 className="text-white font-[Oswald] text-xl mb-2">New Discussion Thread</h2>
              <p className="text-gray-400 text-sm">Start a conversation with your coaching staff</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm block mb-1">Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
                  placeholder="e.g., New offensive formation for this week"
                  className="w-full px-3 py-2 bg-black/40 border border-[#00c4ff]/30 text-white rounded-lg"
                />
              </div>

              <div>
                <label className="text-gray-400 text-sm block mb-1">Message *</label>
                <textarea
                  value={content}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setContent(e.target.value)}
                  placeholder="Share your thoughts..."
                  className="w-full px-3 py-2 bg-black/40 border border-[#00c4ff]/30 text-white rounded-lg"
                  rows={8}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setCreateOpen(false);
                  resetForm();
                }}
                className="px-4 py-2 border border-gray-600 text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !title.trim() || !content.trim()}
                className="px-4 py-2 bg-[#00c4ff] hover:bg-[#00a8dd] text-black rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? "Posting..." : "Post Thread"}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </PortalLayout>
  );
}
