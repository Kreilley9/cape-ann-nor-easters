import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { PortalLayout } from "@/react-app/components/layout/PortalLayout";
import {
  ArrowLeft,
  Pin,
  Trash2,
  Send,
  Clock,
} from "lucide-react";
import { useRoles } from "@/react-app/contexts/RoleContext";
import { formatDateTime } from "@/react-app/utils/dateFormat";
import { apiFetch } from "@/react-app/lib/api";

interface Message {
  id: number;
  title: string;
  content: string;
  author_name: string;
  author_user_id: string;
  is_pinned: number;
  created_at: string;
}

interface Reply {
  id: number;
  content: string;
  author_name: string;
  author_user_id: string;
  created_at: string;
}

export function PortalCoachesMessageDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useRoles();
  const [message, setMessage] = useState<Message | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyContent, setReplyContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadMessage();
  }, [id]);

  async function loadMessage() {
    try {
      const response = await apiFetch(`/api/portal/coaches/messages/${id}`, {
      });
      if (response.ok) {
        const data = await response.json();
        setMessage(data.message);
        setReplies(data.replies);
      }
    } catch (error) {
      console.error("Failed to load message:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleReply() {
    if (!replyContent.trim()) return;

    setSubmitting(true);
    try {
      const response = await apiFetch(`/api/portal/coaches/messages/${id}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: replyContent.trim() }),
      });

      if (response.ok) {
        setReplyContent("");
        loadMessage();
      }
    } catch (error) {
      console.error("Reply failed:", error);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTogglePin() {
    try {
      const response = await apiFetch(`/api/portal/coaches/messages/${id}/pin`, {
        method: "PUT",
      });

      if (response.ok) {
        loadMessage();
      }
    } catch (error) {
      console.error("Pin toggle failed:", error);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this thread and all replies?")) return;

    try {
      const response = await apiFetch(`/api/portal/coaches/messages/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        navigate("/portal/coaches/messages");
      }
    } catch (error) {
      console.error("Delete failed:", error);
    }
  }



  if (loading) {
    return (
      <PortalLayout>
        <div className="text-center py-12 text-gray-400">Loading...</div>
      </PortalLayout>
    );
  }

  if (!message) {
    return (
      <PortalLayout>
        <div className="text-center py-12 text-gray-400">Message not found</div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate("/portal/coaches/messages")}
          className="px-4 py-2 border border-[#00c4ff]/30 text-[#00c4ff] hover:bg-[#00c4ff]/10 rounded-lg transition-colors flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Messages
        </button>
        {isAdmin && (
          <>
            <button
              onClick={handleTogglePin}
              className="px-4 py-2 border border-[#00c4ff]/30 text-[#00c4ff] hover:bg-[#00c4ff]/10 rounded-lg transition-colors flex items-center gap-2"
            >
              <Pin className="w-4 h-4" />
              {message.is_pinned ? "Unpin" : "Pin"}
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2 border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </>
        )}
      </div>

      {/* Main Message */}
      <div
        className="rounded-lg border p-6"
        style={{
          background: "rgba(18, 26, 36, 0.8)",
          borderColor: "#00c4ff",
          boxShadow: "0 0 20px rgba(0, 196, 255, 0.15)",
        }}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <h1 className="text-2xl font-bold text-white font-[Oswald] tracking-wide">
            {message.title}
          </h1>
          {message.is_pinned && (
            <Pin className="w-5 h-5 text-[#00c4ff] flex-shrink-0" />
          )}
        </div>

        <div className="flex items-center gap-3 text-sm text-gray-400 mb-4">
          <span className="text-[#00c4ff] font-medium">{message.author_name}</span>
          <span>•</span>
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDateTime(message.created_at)}
          </div>
        </div>

        <div className="prose prose-invert max-w-none">
          <p className="text-gray-300 whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>

      {/* Replies */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-white font-[Oswald]">
          Replies ({replies.length})
        </h2>

        {replies.map((reply) => (
          <div
            key={reply.id}
            className="rounded-lg border p-4"
            style={{
              background: "rgba(18, 26, 36, 0.6)",
              borderColor: "#00c4ff33",
            }}
          >
            <div className="flex items-center gap-3 text-sm text-gray-400 mb-3">
              <span className="text-[#00c4ff] font-medium">{reply.author_name}</span>
              <span>•</span>
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDateTime(reply.created_at)}
              </div>
            </div>
            <p className="text-gray-300 whitespace-pre-wrap">{reply.content}</p>
          </div>
        ))}
      </div>

      {/* Reply Form */}
      <div
        className="rounded-lg border p-6"
        style={{
          background: "rgba(18, 26, 36, 0.6)",
          borderColor: "#00c4ff",
        }}
      >
        <h3 className="text-lg font-semibold text-white mb-4 font-[Oswald]">
          Add a Reply
        </h3>
        <textarea
          value={replyContent}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReplyContent(e.target.value)}
          placeholder="Share your thoughts..."
          className="w-full px-3 py-2 bg-black/40 border border-[#00c4ff]/30 text-white rounded-lg mb-4"
          rows={4}
        />
        <button
          onClick={handleReply}
          disabled={submitting || !replyContent.trim()}
          className="px-4 py-2 bg-[#00c4ff] hover:bg-[#00a8dd] text-black rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <Send className="w-4 h-4" />
          {submitting ? "Posting..." : "Post Reply"}
        </button>
      </div>
      </div>
    </PortalLayout>
  );
}
