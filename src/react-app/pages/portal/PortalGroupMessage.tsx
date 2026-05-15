import { useState, useEffect } from "react";
import { PortalLayout } from "@/react-app/components/layout/PortalLayout";
import { ArrowLeft, Send, Users, Mail, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useNavigate } from "react-router";
import { apiFetch } from "@/react-app/lib/api";

interface Team {
  id: number;
  name: string;
  age_group: string;
}

interface Recipient {
  email: string;
  player_name: string;
  family_name: string;
  team_name?: string;
  status?: string;
}

interface SentMessage {
  id: number;
  subject: string;
  recipient_type: string;
  recipient_count: number;
  sent_at: string;
  sent_by_name: string;
}

export default function PortalGroupMessage() {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [recipientType, setRecipientType] = useState<"all" | "teams" | "status">("all");
  const [selectedTeams, setSelectedTeams] = useState<number[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>("Full Time");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentMessages, setSentMessages] = useState<SentMessage[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    loadTeams();
    loadSentMessages();
  }, []);

  useEffect(() => {
    loadRecipients();
  }, [recipientType, selectedTeams, selectedStatus]);

  async function loadTeams() {
    try {
      const res = await apiFetch("/api/portal/teams", { });
      if (res.ok) {
        const data = await res.json();
        setTeams(data);
      }
    } catch (err) {
      console.error("Failed to load teams:", err);
    }
  }

  async function loadSentMessages() {
    try {
      const res = await apiFetch("/api/portal/group-messages", { });
      if (res.ok) {
        const data = await res.json();
        setSentMessages(data);
      }
    } catch (err) {
      console.error("Failed to load sent messages:", err);
    }
  }

  async function loadRecipients() {
    setLoadingRecipients(true);
    try {
      const params = new URLSearchParams();
      params.set("type", recipientType);
      if (recipientType === "teams" && selectedTeams.length > 0) {
        params.set("team_ids", selectedTeams.join(","));
      }
      if (recipientType === "status") {
        params.set("status", selectedStatus);
      }
      
      const res = await apiFetch(`/api/portal/group-message-recipients?${params}`, { });
      if (res.ok) {
        const data = await res.json();
        setRecipients(data);
      }
    } catch (err) {
      console.error("Failed to load recipients:", err);
    } finally {
      setLoadingRecipients(false);
    }
  }

  async function handleSend() {
    if (!subject.trim() || !content.trim()) {
      setSendResult({ success: false, message: "Please enter a subject and message." });
      return;
    }
    if (recipients.length === 0) {
      setSendResult({ success: false, message: "No recipients selected." });
      return;
    }

    setSending(true);
    setSendResult(null);
    try {
      const res = await apiFetch("/api/portal/group-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          content,
          recipient_type: recipientType,
          team_ids: recipientType === "teams" ? selectedTeams : null,
          player_status: recipientType === "status" ? selectedStatus : null,
        }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setSendResult({ 
          success: true, 
          message: `Message sent successfully to ${data.recipient_count} recipient(s).` 
        });
        setSubject("");
        setContent("");
        setShowPreview(false);
        loadSentMessages();
      } else {
        const error = await res.json();
        setSendResult({ success: false, message: error.error || "Failed to send message." });
      }
    } catch (err) {
      console.error("Failed to send message:", err);
      setSendResult({ success: false, message: "Failed to send message." });
    } finally {
      setSending(false);
    }
  }

  function toggleTeam(teamId: number) {
    setSelectedTeams(prev => 
      prev.includes(teamId) 
        ? prev.filter(id => id !== teamId)
        : [...prev, teamId]
    );
  }

  const uniqueEmails = [...new Set(recipients.map(r => r.email).filter(Boolean))];

  return (
    <PortalLayout>
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate("/portal")}
            className="p-2 rounded-lg border border-[#00c4ff]/30 text-[#00c4ff] hover:bg-[rgba(0,196,255,0.15)] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-white font-[Oswald] tracking-wide">
              Group Message
            </h1>
            <p className="text-gray-400 mt-1">Send emails to team members and families</p>
          </div>
        </div>

        {/* Result banner */}
        {sendResult && (
          <div className={`mb-6 p-4 rounded-lg border flex items-center gap-3 ${
            sendResult.success 
              ? "bg-green-500/10 border-green-500/30 text-green-400"
              : "bg-red-500/10 border-red-500/30 text-red-400"
          }`}>
            {sendResult.success ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            {sendResult.message}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column - Compose */}
          <div className="lg:col-span-2 space-y-6">
            {/* Recipients Selection */}
            <div className="bg-[rgba(18,26,36,0.8)] rounded-xl border border-[#00c4ff]/20 p-6 shadow-[0_0_15px_rgba(0,196,255,0.1)]">
              <h2 className="text-xl font-semibold text-white font-[Oswald] mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-[#00c4ff]" />
                Select Recipients
              </h2>
              
              <div className="space-y-4">
                {/* Recipient Type */}
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => setRecipientType("all")}
                    className={`px-4 py-2 rounded-lg border transition-colors ${
                      recipientType === "all"
                        ? "bg-[#00c4ff] border-[#00c4ff] text-black font-semibold"
                        : "border-[#00c4ff]/30 text-[#00c4ff] hover:bg-[rgba(0,196,255,0.15)]"
                    }`}
                  >
                    All Members
                  </button>
                  <button
                    onClick={() => setRecipientType("teams")}
                    className={`px-4 py-2 rounded-lg border transition-colors ${
                      recipientType === "teams"
                        ? "bg-[#00c4ff] border-[#00c4ff] text-black font-semibold"
                        : "border-[#00c4ff]/30 text-[#00c4ff] hover:bg-[rgba(0,196,255,0.15)]"
                    }`}
                  >
                    By Team
                  </button>
                  <button
                    onClick={() => setRecipientType("status")}
                    className={`px-4 py-2 rounded-lg border transition-colors ${
                      recipientType === "status"
                        ? "bg-[#00c4ff] border-[#00c4ff] text-black font-semibold"
                        : "border-[#00c4ff]/30 text-[#00c4ff] hover:bg-[rgba(0,196,255,0.15)]"
                    }`}
                  >
                    By Status
                  </button>
                </div>

                {/* Team Selection */}
                {recipientType === "teams" && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
                    {teams.map(team => (
                      <label
                        key={team.id}
                        className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedTeams.includes(team.id)
                            ? "bg-[rgba(0,196,255,0.2)] border-[#00c4ff]"
                            : "border-[#00c4ff]/20 hover:border-[#00c4ff]/40"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedTeams.includes(team.id)}
                          onChange={() => toggleTeam(team.id)}
                          className="rounded border-gray-600 text-[#00c4ff] focus:ring-[#00c4ff]"
                        />
                        <span className="text-white text-sm">{team.name}</span>
                      </label>
                    ))}
                  </div>
                )}

                {/* Status Selection */}
                {recipientType === "status" && (
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setSelectedStatus("Full Time")}
                      className={`px-4 py-2 rounded-lg border transition-colors ${
                        selectedStatus === "Full Time"
                          ? "bg-green-500/20 border-green-500 text-green-400"
                          : "border-[#00c4ff]/30 text-gray-400 hover:text-white"
                      }`}
                    >
                      Full Time
                    </button>
                    <button
                      onClick={() => setSelectedStatus("Alternate")}
                      className={`px-4 py-2 rounded-lg border transition-colors ${
                        selectedStatus === "Alternate"
                          ? "bg-yellow-500/20 border-yellow-500 text-yellow-400"
                          : "border-[#00c4ff]/30 text-gray-400 hover:text-white"
                      }`}
                    >
                      Alternate
                    </button>
                  </div>
                )}

                {/* Recipient Count */}
                <div className="flex items-center gap-2 text-sm text-gray-400 pt-2">
                  {loadingRecipients ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      <span>{uniqueEmails.length} unique email address{uniqueEmails.length !== 1 ? "es" : ""}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Message Compose */}
            <div className="bg-[rgba(18,26,36,0.8)] rounded-xl border border-[#00c4ff]/20 p-6 shadow-[0_0_15px_rgba(0,196,255,0.1)]">
              <h2 className="text-xl font-semibold text-white font-[Oswald] mb-4 flex items-center gap-2">
                <Mail className="w-5 h-5 text-[#00c4ff]" />
                Compose Message
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Subject</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Enter email subject..."
                    className="w-full px-4 py-3 rounded-lg bg-[rgba(0,0,0,0.3)] border border-[#00c4ff]/20 text-white placeholder-gray-500 focus:outline-none focus:border-[#00c4ff]/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Message</label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Type your message here..."
                    rows={8}
                    className="w-full px-4 py-3 rounded-lg bg-[rgba(0,0,0,0.3)] border border-[#00c4ff]/20 text-white placeholder-gray-500 focus:outline-none focus:border-[#00c4ff]/50 resize-none"
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => setShowPreview(true)}
                    disabled={!subject.trim() || !content.trim() || recipients.length === 0}
                    className="px-6 py-3 rounded-lg border border-[#00c4ff]/30 text-[#00c4ff] hover:bg-[rgba(0,196,255,0.15)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Preview Recipients
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={sending || !subject.trim() || !content.trim() || recipients.length === 0}
                    className="px-6 py-3 rounded-lg bg-[#00c4ff] text-black font-semibold hover:bg-[#00e5ff] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {sending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Send Message
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right column - History & Preview */}
          <div className="space-y-6">
            {/* Recipients Preview */}
            {showPreview && recipients.length > 0 && (
              <div className="bg-[rgba(18,26,36,0.8)] rounded-xl border border-[#00c4ff]/20 p-6 shadow-[0_0_15px_rgba(0,196,255,0.1)]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white font-[Oswald]">Recipients Preview</h3>
                  <button
                    onClick={() => setShowPreview(false)}
                    className="text-gray-400 hover:text-white text-sm"
                  >
                    Hide
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {recipients.map((r, idx) => (
                    <div key={idx} className="p-2 rounded bg-[rgba(0,0,0,0.2)] text-sm">
                      <div className="text-white">{r.player_name}</div>
                      <div className="text-gray-400 text-xs">{r.email}</div>
                      {r.team_name && <div className="text-[#00c4ff] text-xs">{r.team_name}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sent History */}
            <div className="bg-[rgba(18,26,36,0.8)] rounded-xl border border-[#00c4ff]/20 p-6 shadow-[0_0_15px_rgba(0,196,255,0.1)]">
              <h3 className="text-lg font-semibold text-white font-[Oswald] mb-4">Recent Messages</h3>
              {sentMessages.length === 0 ? (
                <p className="text-gray-500 text-sm">No messages sent yet.</p>
              ) : (
                <div className="space-y-3">
                  {sentMessages.slice(0, 5).map(msg => (
                    <div key={msg.id} className="p-3 rounded-lg bg-[rgba(0,0,0,0.2)] border border-[#00c4ff]/10">
                      <div className="font-medium text-white text-sm truncate">{msg.subject}</div>
                      <div className="text-xs text-gray-400 mt-1">
                        {msg.recipient_count} recipient{msg.recipient_count !== 1 ? "s" : ""} • {
                          new Date(msg.sent_at).toLocaleDateString()
                        }
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}
