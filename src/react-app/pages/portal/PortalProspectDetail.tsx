import { useState, useEffect } from "react";
import { useAuth } from "@/react-app/contexts/AuthContext";
import { useNavigate, useParams } from "react-router";
import { PortalLayout } from "@/react-app/components/layout/PortalLayout";
import { formatDateTime } from "@/react-app/utils/dateFormat";
import {
  Loader2,
  ArrowLeft,
  Edit,
  Trash2,
  Save,
  X,
  Plus,
  Calendar,
  Phone,
  Mail,
  MessageSquare,
} from "lucide-react";
import { apiFetch } from "@/react-app/lib/api";

interface Prospect {
  id: number;
  first_name: string;
  last_name: string;
  birth_date: string | null;
  age_group: string | null;
  email: string | null;
  phone: string | null;
  parent_name: string | null;
  parent_email: string | null;
  parent_phone: string | null;
  status: string | null;
  interest_level: string | null;
  next_follow_up_date: string | null;
  source: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  current_team: string | null;
  position: string | null;
  notes: string | null;
  rating: number | null;
}

interface Note {
  id: number;
  prospect_id: number;
  note: string;
  contact_type: string | null;
  created_by: string;
  created_at: string;
}

export default function PortalProspectDetail() {
  const { id } = useParams();
  const { user, isPending } = useAuth();
  const navigate = useNavigate();
  const [prospect, setProspect] = useState<Prospect | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Prospect>>({});
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [newNote, setNewNote] = useState({ note: "", contact_type: "" });

  useEffect(() => {
    if (!isPending && !user) {
      navigate("/");
    }
  }, [user, isPending, navigate]);

  useEffect(() => {
    if (user && id) {
      loadProspect();
      loadNotes();
    }
  }, [user, id]);

  const loadProspect = async () => {
    try {
      const response = await apiFetch(`/api/portal/prospects/${id}`, {
      });
      if (response.ok) {
        const data = await response.json();
        setProspect(data);
        setEditForm(data);
      }
    } catch (error) {
      console.error("Error loading prospect:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadNotes = async () => {
    try {
      const response = await apiFetch(`/api/portal/prospects/${id}/notes`, {
      });
      if (response.ok) {
        const data = await response.json();
        setNotes(data);
      }
    } catch (error) {
      console.error("Error loading notes:", error);
    }
  };

  const handleUpdate = async () => {
    try {
      const response = await apiFetch(`/api/portal/prospects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });

      const responseText = await response.text();
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        console.error("Failed to parse response:", e);
        responseData = { error: "Invalid response from server" };
      }

      if (response.ok) {
        setIsEditing(false);
        await loadProspect();
        alert("Prospect updated successfully!");
      } else {
        console.error("Update failed:", responseData);
        const errorMessage = typeof responseData.error === 'string' 
          ? responseData.error 
          : JSON.stringify(responseData, null, 2);
        alert(`Failed to update prospect: ${errorMessage}`);
      }
    } catch (error) {
      console.error("Error in handleUpdate:", error);
      alert(`An error occurred: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this prospect?")) return;

    try {
      const response = await apiFetch(`/api/portal/prospects/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        navigate("/portal/recruiting");
      }
    } catch (error) {
      console.error("Error deleting prospect:", error);
    }
  };

  const handleAddNote = async () => {
    try {
      const response = await apiFetch(`/api/portal/prospects/${id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newNote),
      });

      if (response.ok) {
        setShowNoteModal(false);
        setNewNote({ note: "", contact_type: "" });
        loadNotes();
      }
    } catch (error) {
      console.error("Error adding note:", error);
    }
  };

  const handleDeleteNote = async (noteId: number) => {
    if (!confirm("Delete this note?")) return;

    try {
      const response = await apiFetch(`/api/portal/prospect-notes/${noteId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        loadNotes();
      }
    } catch (error) {
      console.error("Error deleting note:", error);
    }
  };

  if (isPending || !user || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!prospect) {
    return (
      <PortalLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">Prospect not found</p>
          <button onClick={() => navigate("/portal/recruiting")} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Back to Recruiting
          </button>
        </div>
      </PortalLayout>
    );
  }

  const getInterestBadgeColor = (level: string | null) => {
    switch (level) {
      case "High":
        return "bg-green-100 text-green-800";
      case "Medium":
        return "bg-yellow-100 text-yellow-800";
      case "Low":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusBadgeColor = (status: string | null) => {
    switch (status) {
      case "New":
        return "bg-blue-100 text-blue-800";
      case "Contacted":
        return "bg-purple-100 text-purple-800";
      case "In Discussion":
        return "bg-orange-100 text-orange-800";
      case "Committed":
        return "bg-green-100 text-green-800";
      case "Not Interested":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <PortalLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/portal/recruiting")}
              className="px-3 py-2 border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-lg bg-[rgba(18,26,36,0.8)] text-white hover:bg-[rgba(0,196,255,0.2)] transition-all flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white font-[Oswald]">
                {prospect.first_name} {prospect.last_name}
              </h1>
              <div className="flex gap-2 mt-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(prospect.status)}`}>
                  {prospect.status || "New"}
                </span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getInterestBadgeColor(prospect.interest_level)}`}>
                  {prospect.interest_level || "Medium"} Interest
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {!isEditing ? (
              <>
                <button onClick={() => setIsEditing(true)} className="px-4 py-2 border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-lg bg-[rgba(18,26,36,0.8)] text-white hover:bg-[rgba(0,196,255,0.2)] transition-all flex items-center gap-2">
                  <Edit className="w-4 h-4" />
                  Edit
                </button>
                <button onClick={handleDelete} className="px-4 py-2 border border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] rounded-lg bg-[rgba(18,26,36,0.8)] text-red-400 hover:bg-[rgba(239,68,68,0.2)] transition-all flex items-center gap-2">
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setIsEditing(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
                  <X className="w-4 h-4" />
                  Cancel
                </button>
                <button onClick={handleUpdate} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  Save Changes
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Player Info */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 font-[Oswald] mb-4">Player Information</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Birth Date</label>
                  {isEditing ? (
                    <input
                      type="date"
                      value={editForm.birth_date || ""}
                      onChange={(e) => setEditForm({ ...editForm, birth_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900 font-[Oswald]">
                      {prospect.birth_date || "Not set"}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Age Group</label>
                  {isEditing ? (
                    <select
                      value={editForm.age_group || ""}
                      onChange={(e) => setEditForm({ ...editForm, age_group: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select...</option>
                      {["5U", "6U", "7U", "8U", "9U", "10U", "11U", "12U", "13U", "14U", "15U", "16U", "17U", "18U"].map((age) => (
                        <option key={age} value={age}>{age}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-gray-900 font-[Oswald]">{prospect.age_group || "Not set"}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Position</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editForm.position || ""}
                      onChange={(e) => setEditForm({ ...editForm, position: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900 font-[Oswald]">{prospect.position || "Not set"}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Current Team</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editForm.current_team || ""}
                      onChange={(e) => setEditForm({ ...editForm, current_team: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900 font-[Oswald]">{prospect.current_team || "Not set"}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Parent Contact */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 font-[Oswald] mb-4">Parent Contact</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Name</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editForm.parent_name || ""}
                      onChange={(e) => setEditForm({ ...editForm, parent_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900 font-[Oswald]">{prospect.parent_name || "Not set"}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Email</label>
                  {isEditing ? (
                    <input
                      type="email"
                      value={editForm.parent_email || ""}
                      onChange={(e) => setEditForm({ ...editForm, parent_email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  ) : prospect.parent_email ? (
                    <a href={`mailto:${prospect.parent_email}`} className="text-blue-600 hover:underline flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      {prospect.parent_email}
                    </a>
                  ) : (
                    <p className="text-gray-900 font-[Oswald]">Not set</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Phone</label>
                  {isEditing ? (
                    <input
                      type="tel"
                      value={editForm.parent_phone || ""}
                      onChange={(e) => setEditForm({ ...editForm, parent_phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  ) : prospect.parent_phone ? (
                    <a href={`tel:${prospect.parent_phone}`} className="text-blue-600 hover:underline flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      {prospect.parent_phone}
                    </a>
                  ) : (
                    <p className="text-gray-900 font-[Oswald]">Not set</p>
                  )}
                </div>
              </div>
            </div>

            {/* Conversation History */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-gray-900 font-[Oswald]">Conversation History</h2>
                <button onClick={() => setShowNoteModal(true)} className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm">
                  <Plus className="w-4 h-4" />
                  Add Note
                </button>
              </div>
              {notes.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <MessageSquare className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                  <p>No conversation notes yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {notes.map((note) => (
                    <div key={note.id} className="border border-[#00c4ff]/20 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          {note.contact_type && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                              {note.contact_type}
                            </span>
                          )}
                          <span className="text-sm text-gray-500">
                            {formatDateTime(note.created_at)}
                          </span>
                        </div>
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          className="text-gray-500 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-gray-900 font-[Oswald] whitespace-pre-wrap">{note.note}</p>
                      <p className="text-xs text-gray-500 mt-2">By {note.created_by}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status & Follow-up */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 font-[Oswald] mb-4">Status</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Status</label>
                  {isEditing ? (
                    <select
                      value={editForm.status || ""}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="New">New</option>
                      <option value="Contacted">Contacted</option>
                      <option value="In Discussion">In Discussion</option>
                      <option value="Committed">Committed</option>
                      <option value="Not Interested">Not Interested</option>
                    </select>
                  ) : (
                    <p className="text-gray-900 font-[Oswald]">{prospect.status || "New"}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Interest Level</label>
                  {isEditing ? (
                    <select
                      value={editForm.interest_level || ""}
                      onChange={(e) => setEditForm({ ...editForm, interest_level: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  ) : (
                    <p className="text-gray-900 font-[Oswald]">{prospect.interest_level || "Medium"}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Player Rating</label>
                  {isEditing ? (
                    <select
                      value={editForm.rating?.toString() || ""}
                      onChange={(e) => setEditForm({ ...editForm, rating: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Not rated</option>
                      <option value="1">⭐ 1 - Developing</option>
                      <option value="2">⭐⭐ 2 - Average</option>
                      <option value="3">⭐⭐⭐ 3 - Good</option>
                      <option value="4">⭐⭐⭐⭐ 4 - Very Good</option>
                      <option value="5">⭐⭐⭐⭐⭐ 5 - Excellent</option>
                    </select>
                  ) : (
                    <p className="text-gray-900 font-[Oswald]">
                      {prospect.rating
                        ? "⭐".repeat(prospect.rating) + ` ${prospect.rating}/5`
                        : "Not rated"}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Next Follow-up</label>
                  {isEditing ? (
                    <input
                      type="date"
                      value={editForm.next_follow_up_date || ""}
                      onChange={(e) => setEditForm({ ...editForm, next_follow_up_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900 font-[Oswald] flex items-center gap-2">
                      {prospect.next_follow_up_date ? (
                        <>
                          <Calendar className="w-4 h-4" />
                          {prospect.next_follow_up_date}
                        </>
                      ) : (
                        "Not set"
                      )}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Source */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 font-[Oswald] mb-4">Source</h2>
              {isEditing ? (
                <input
                  type="text"
                  value={editForm.source || ""}
                  onChange={(e) => setEditForm({ ...editForm, source: e.target.value })}
                  placeholder="e.g., Tryout, Referral, Camp"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <p className="text-gray-900 font-[Oswald]">{prospect.source || "Not set"}</p>
              )}
            </div>

            {/* General Notes */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 font-[Oswald] mb-4">General Notes</h2>
              {isEditing ? (
                <textarea
                  value={editForm.notes || ""}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <p className="text-gray-900 font-[Oswald] whitespace-pre-wrap">{prospect.notes || "No notes"}</p>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Save Button (only when editing) */}
        {isEditing && (
          <div className="flex justify-end gap-3 pt-6 border-t border-[#00c4ff]/20">
            <button onClick={() => setIsEditing(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
              <X className="w-4 h-4" />
              Cancel
            </button>
            <button onClick={handleUpdate} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
              <Save className="w-4 h-4" />
              Save Changes
            </button>
          </div>
        )}
      </div>

      {/* Add Note Modal */}
      {showNoteModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[rgba(18,26,36,0.98)] border border-[#00c4ff]/30 rounded-xl shadow-xl w-full max-w-lg">
            <div className="p-6 border-b border-[#00c4ff]/20">
              <h2 className="text-xl font-bold text-white font-[Oswald]">Add Conversation Note</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Contact Type</label>
                <select
                  value={newNote.contact_type}
                  onChange={(e) => setNewNote({ ...newNote, contact_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select...</option>
                  <option value="Phone Call">Phone Call</option>
                  <option value="Email">Email</option>
                  <option value="In Person">In Person</option>
                  <option value="Text Message">Text Message</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Note</label>
                <textarea
                  value={newNote.note}
                  onChange={(e) => setNewNote({ ...newNote, note: e.target.value })}
                  rows={5}
                  placeholder="Conversation details, next steps, etc."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="p-6 border-t border-[#00c4ff]/20 flex justify-end gap-3">
              <button onClick={() => setShowNoteModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleAddNote}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!newNote.note}
              >
                Add Note
              </button>
            </div>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}
