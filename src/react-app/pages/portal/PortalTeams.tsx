import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { PortalLayout } from "@/react-app/components/layout/PortalLayout";
import { useRoles } from "@/react-app/contexts/RoleContext";
import { Plus, UserPlus, X, Edit2, Trash2, Upload, FileText, Download, MessageSquare, Send, Pin, Clock, MessageCircle } from "lucide-react";
import { apiFetch } from "@/react-app/lib/api";

interface Team {
  id: number;
  name: string;
  age_group: string;
  coach_name?: string;
  coach_phone?: string;
  coach_email?: string;
}

interface Player {
  id: number;
  first_name: string;
  last_name: string;
  family_name?: string;
  jersey_number?: number;
  birth_date?: string;
  status?: string;
  zorts_expiration_date?: string;
}

interface Coach {
  id: number;
  name: string;
  title: string;
  email?: string;
  phone?: string;
}

interface Season {
  id: number;
  name: string;
  division?: string;
}

interface Family {
  id: number;
  name: string;
}

interface Document {
  id: number;
  title: string;
  description?: string;
  file_name: string;
  file_size: number;
  file_key: string;
  uploaded_by_user_id: string;
  created_at: string;
}

interface TeamMessage {
  id: number;
  title: string;
  content: string;
  author_name: string;
  is_pinned: number;
  reply_count: number;
  created_at: string;
}

interface MessageReply {
  id: number;
  content: string;
  author_name: string;
  created_at: string;
}

function PortalTeams() {
  const navigate = useNavigate();
  const { isAdmin: isAdminRole, isCoach, coachTeamIds } = useRoles();
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Check if user can manage a specific team (admin can manage all, coach can manage their teams)
  const canManageTeam = (teamId: number) => {
    return isAdmin || isAdminRole || (isCoach && coachTeamIds.includes(teamId));
  };
  
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamSeasons, setTeamSeasons] = useState<Season[]>([]);
  const [roster, setRoster] = useState<Player[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);
  const [showEditPlayerModal, setShowEditPlayerModal] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<any>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState(0);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [newTeamForm, setNewTeamForm] = useState({
    name: "",
    age_group: "",
  });
  const [newPlayerForm, setNewPlayerForm] = useState({
    family_id: 0,
    first_name: "",
    last_name: "",
    jersey_number: "",
    birth_date: "",
    status: "",
    uniform_size: "",
    zorts_expiration_date: "",
    zorts_id: "",
    grade: "",
    address_1: "",
    address_2: "",
    town: "",
    state: "",
    zip_code: "",
    parent_1_name: "",
    parent_1_phone: "",
    parent_1_email: "",
    parent_2_name: "",
    parent_2_phone: "",
    parent_2_email: "",
  });
  const [showCreateFamily, setShowCreateFamily] = useState(false);
  const [newFamilyForm, setNewFamilyForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
  });
  const [showAddCoachModal, setShowAddCoachModal] = useState(false);
  const [showEditCoachModal, setShowEditCoachModal] = useState(false);
  const [editingCoach, setEditingCoach] = useState<Coach | null>(null);
  const [newCoachForm, setNewCoachForm] = useState({
    name: "",
    title: "Head Coach",
    email: "",
    phone: "",
  });
  const [documents, setDocuments] = useState<Document[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    title: "",
    description: "",
    file: null as File | null,
  });

  // Message board state
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<TeamMessage | null>(null);
  const [messageReplies, setMessageReplies] = useState<MessageReply[]>([]);
  const [showCreateMessage, setShowCreateMessage] = useState(false);
  const [showMessageDetail, setShowMessageDetail] = useState(false);
  const [messageTitle, setMessageTitle] = useState("");
  const [messageContent, setMessageContent] = useState("");
  const [replyContent, setReplyContent] = useState("");
  const [submittingMessage, setSubmittingMessage] = useState(false);
  const [submittingReply, setSubmittingReply] = useState(false);

  async function handleDownloadDocument(doc: Document) {
    try {
      const response = await apiFetch(
        `/api/portal/teams/documents/download/${doc.file_key}`,
        { }
      );
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = doc.file_name;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error("Download failed:", error);
    }
  }

  function formatFileSize(bytes: number | null): string {
    if (!bytes) return "Unknown";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  useEffect(() => {
    checkAdminAndLoad();
  }, []);

  const checkAdminAndLoad = async () => {
    try {
      const adminResponse = await apiFetch("/api/portal/admin-check", {
      });
      if (adminResponse.ok) {
        const adminData = await adminResponse.json();
        setIsAdmin(adminData.isAdmin);
      }
      await loadTeams();
    } catch (error) {
      console.error("Error checking admin status:", error);
    }
  };

  const loadTeams = async () => {
    try {
      const response = await apiFetch("/api/portal/teams/all", {
      });
      if (response.ok) {
        const data = await response.json();
        setTeams(data);
      }
    } catch (error) {
      console.error("Error loading teams:", error);
    }
  };

  const loadRoster = async (teamId: number) => {
    try {
      const response = await apiFetch(`/api/portal/teams/${teamId}/roster`, {
      });
      if (response.ok) {
        const data = await response.json();
        setRoster(data);
      }
    } catch (error) {
      console.error("Error loading roster:", error);
    }
  };

  const loadCoaches = async (teamId: number) => {
    try {
      const response = await apiFetch(`/api/portal/teams/${teamId}/coaches`, {
      });
      if (response.ok) {
        const data = await response.json();
        setCoaches(data);
      }
    } catch (error) {
      console.error("Error loading coaches:", error);
    }
  };

  const handleTeamClick = async (team: Team) => {
    setSelectedTeam(team);
    await Promise.all([
      loadRoster(team.id),
      loadTeamSeasons(team.id),
      loadCoaches(team.id),
      loadDocuments(team.id),
      loadMessages(team.id),
    ]);
  };

  const loadTeamSeasons = async (teamId: number) => {
    try {
      const response = await apiFetch(`/api/portal/teams/${teamId}/seasons`, {
      });
      if (response.ok) {
        const data = await response.json();
        setTeamSeasons(data);
      }
    } catch (error) {
      console.error("Error loading team seasons:", error);
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await apiFetch("/api/portal/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTeamForm),
      });

      if (response.ok) {
        setShowCreateTeamModal(false);
        setNewTeamForm({
          name: "",
          age_group: "",
        });
        await loadTeams();
      }
    } catch (error) {
      console.error("Error creating team:", error);
    }
  };

  const calculateAge = (birthDate: string) => {
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const loadAllPlayers = async () => {
    try {
      const response = await apiFetch("/api/portal/players/all", {
      });
      if (response.ok) {
        const data = await response.json();
        setAllPlayers(data);
      }
    } catch (error) {
      console.error("Error loading players:", error);
    }
  };

  const handleAddPlayerClick = () => {
    setShowAddPlayerModal(true);
    loadAllPlayers();
  };

  const handleEditPlayerClick = async (player: Player) => {
    try {
      // Load families first
      const familiesResponse = await apiFetch("/api/portal/families", {
      });
      if (familiesResponse.ok) {
        const familiesData = await familiesResponse.json();
        setFamilies(familiesData);
      }

      // Fetch complete player details
      const playerResponse = await apiFetch(`/api/portal/players/${player.id}`, {
      });
      
      if (playerResponse.ok) {
        const playerData = await playerResponse.json();
        setEditingPlayer(playerData);
        setShowEditPlayerModal(true);
      }
    } catch (error) {
      console.error("Error loading player details:", error);
    }
  };

  const handleUpdatePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlayer) return;

    try {
      const response = await apiFetch(`/api/portal/players/${editingPlayer.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingPlayer),
      });

      if (response.ok) {
        setShowEditPlayerModal(false);
        setEditingPlayer(null);
        if (selectedTeam) {
          await loadRoster(selectedTeam.id);
        }
      }
    } catch (error) {
      console.error("Error updating player:", error);
    }
  };

  const handleAddExistingPlayer = async () => {
    if (!selectedTeam || selectedPlayerId === 0) return;

    try {
      const response = await apiFetch("/api/portal/team-players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          team_id: selectedTeam.id,
          player_id: selectedPlayerId 
        }),
      });

      if (response.ok) {
        setShowAddPlayerModal(false);
        setSelectedPlayerId(0);
        await loadRoster(selectedTeam.id);
      }
    } catch (error) {
      console.error("Error adding player:", error);
    }
  };

  const handleCreateAndAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam) return;

    try {
      // Create new player
      const createResponse = await apiFetch("/api/portal/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPlayerForm),
      });

      if (createResponse.ok) {
        const { id } = await createResponse.json();

        // Add player to team
        const addResponse = await apiFetch("/api/portal/team-players", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            team_id: selectedTeam.id,
            player_id: id 
          }),
        });

        if (addResponse.ok) {
          setShowAddPlayerModal(false);
          setNewPlayerForm({
            family_id: 0,
            first_name: "",
            last_name: "",
            jersey_number: "",
            birth_date: "",
            status: "",
            uniform_size: "",
            zorts_expiration_date: "",
            zorts_id: "",
            grade: "",
            address_1: "",
            address_2: "",
            town: "",
            state: "",
            zip_code: "",
            parent_1_name: "",
            parent_1_phone: "",
            parent_1_email: "",
            parent_2_name: "",
            parent_2_phone: "",
            parent_2_email: "",
          });
          await loadRoster(selectedTeam.id);
        }
      }
    } catch (error) {
      console.error("Error creating player:", error);
    }
  };

  const loadFamilies = async () => {
    try {
      const response = await apiFetch("/api/portal/families", {
      });
      if (response.ok) {
        const data = await response.json();
        setFamilies(data);
      }
    } catch (error) {
      console.error("Error loading families:", error);
    }
  };

  const handleCreateFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await apiFetch("/api/portal/families", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newFamilyForm),
      });

      if (response.ok) {
        const { id } = await response.json();
        setShowCreateFamily(false);
        setNewFamilyForm({
          name: "",
          email: "",
          phone: "",
          address: "",
          emergency_contact_name: "",
          emergency_contact_phone: "",
        });
        
        // Reload families and select the new one
        await loadFamilies();
        setNewPlayerForm({ ...newPlayerForm, family_id: id });
      }
    } catch (error) {
      console.error("Error creating family:", error);
    }
  };

  const handleAddCoach = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam) return;

    try {
      const response = await apiFetch(`/api/portal/teams/${selectedTeam.id}/coaches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCoachForm),
      });

      if (response.ok) {
        setShowAddCoachModal(false);
        setNewCoachForm({
          name: "",
          title: "Head Coach",
          email: "",
          phone: "",
        });
        await loadCoaches(selectedTeam.id);
      }
    } catch (error) {
      console.error("Error adding coach:", error);
    }
  };

  const handleEditCoach = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCoach) return;

    try {
      const response = await apiFetch(`/api/portal/team-coaches/${editingCoach.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingCoach.name,
          title: editingCoach.title,
          email: editingCoach.email,
          phone: editingCoach.phone,
        }),
      });

      if (response.ok) {
        setShowEditCoachModal(false);
        setEditingCoach(null);
        if (selectedTeam) {
          await loadCoaches(selectedTeam.id);
        }
      }
    } catch (error) {
      console.error("Error updating coach:", error);
    }
  };

  const handleDeleteCoach = async (coachId: number) => {
    if (!selectedTeam || !confirm("Are you sure you want to remove this coach?")) return;

    try {
      const response = await apiFetch(`/api/portal/team-coaches/${coachId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await loadCoaches(selectedTeam.id);
      }
    } catch (error) {
      console.error("Error deleting coach:", error);
    }
  };

  useEffect(() => {
    if (showAddPlayerModal) {
      loadFamilies();
    }
  }, [showAddPlayerModal]);

  const loadDocuments = async (teamId: number) => {
    try {
      const response = await apiFetch(`/api/portal/teams/${teamId}/documents`, {
      });
      if (response.ok) {
        const data = await response.json();
        setDocuments(data);
      }
    } catch (error) {
      console.error("Error loading documents:", error);
    }
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam || !uploadForm.file) return;

    try {
      const formData = new FormData();
      formData.append("file", uploadForm.file);
      formData.append("title", uploadForm.title);
      formData.append("description", uploadForm.description);

      const response = await apiFetch(`/api/portal/teams/${selectedTeam.id}/documents`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        setShowUploadModal(false);
        setUploadForm({
          title: "",
          description: "",
          file: null,
        });
        await loadDocuments(selectedTeam.id);
      }
    } catch (error) {
      console.error("Error uploading document:", error);
    }
  };

  const handleDeleteDocument = async (docId: number) => {
    if (!selectedTeam || !confirm("Are you sure you want to delete this document?")) return;

    try {
      const response = await apiFetch(`/api/portal/documents/${docId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await loadDocuments(selectedTeam.id);
      }
    } catch (error) {
      console.error("Error deleting document:", error);
    }
  };

  // Message board functions
  const loadMessages = async (teamId: number) => {
    try {
      const response = await apiFetch(`/api/portal/teams/${teamId}/messages`, {
      });
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  };

  const handleCreateMessage = async () => {
    if (!selectedTeam || !messageTitle.trim() || !messageContent.trim()) return;

    setSubmittingMessage(true);
    try {
      const response = await apiFetch(`/api/portal/teams/${selectedTeam.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: messageTitle.trim(),
          content: messageContent.trim(),
        }),
      });

      if (response.ok) {
        setShowCreateMessage(false);
        setMessageTitle("");
        setMessageContent("");
        await loadMessages(selectedTeam.id);
      }
    } catch (error) {
      console.error("Error creating message:", error);
    } finally {
      setSubmittingMessage(false);
    }
  };

  const handleLoadMessageDetail = async (message: TeamMessage) => {
    if (!selectedTeam) return;

    setSelectedMessage(message);
    try {
      const response = await apiFetch(`/api/portal/teams/${selectedTeam.id}/messages/${message.id}`, {
      });
      if (response.ok) {
        const data = await response.json();
        setMessageReplies(data.replies);
        setShowMessageDetail(true);
      }
    } catch (error) {
      console.error("Error loading message detail:", error);
    }
  };

  const handleReplyToMessage = async () => {
    if (!selectedTeam || !selectedMessage || !replyContent.trim()) return;

    setSubmittingReply(true);
    try {
      const response = await apiFetch(
        `/api/portal/teams/${selectedTeam.id}/messages/${selectedMessage.id}/replies`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: replyContent.trim() }),
        }
      );

      if (response.ok) {
        setReplyContent("");
        await handleLoadMessageDetail(selectedMessage);
        await loadMessages(selectedTeam.id);
      }
    } catch (error) {
      console.error("Error posting reply:", error);
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleTogglePin = async (messageId: number) => {
    if (!selectedTeam) return;

    try {
      const response = await apiFetch(
        `/api/portal/teams/${selectedTeam.id}/messages/${messageId}/pin`,
        {
          method: "PUT",
        }
      );

      if (response.ok) {
        await loadMessages(selectedTeam.id);
        if (selectedMessage && selectedMessage.id === messageId) {
          await handleLoadMessageDetail(selectedMessage);
        }
      }
    } catch (error) {
      console.error("Error toggling pin:", error);
    }
  };

  const handleDeleteMessage = async (messageId: number) => {
    if (!selectedTeam || !confirm("Delete this message and all replies?")) return;

    try {
      const response = await apiFetch(
        `/api/portal/teams/${selectedTeam.id}/messages/${messageId}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        setShowMessageDetail(false);
        setSelectedMessage(null);
        await loadMessages(selectedTeam.id);
      }
    } catch (error) {
      console.error("Error deleting message:", error);
    }
  };



  return (
    <PortalLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white font-[Oswald] tracking-wide">Team Management</h1>
          {isAdmin && (
            <button
              onClick={() => setShowCreateTeamModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#00c4ff] hover:bg-[#00a3d9] text-white rounded-lg font-medium transition-colors shadow-lg shadow-[#00c4ff]/20"
            >
              <Plus className="w-5 h-5" />
              New Team
            </button>
          )}
        </div>

        {/* Teams Grid */}
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">Teams</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teams.map((team) => (
              <button
                key={team.id}
                onClick={() => handleTeamClick(team)}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  selectedTeam?.id === team.id
                    ? "border-[#00c4ff] bg-[#00c4ff]/10 shadow-[0_0_15px_rgba(0,196,255,0.2)]"
                    : "border-[#00c4ff]/20 bg-[rgba(18,26,36,0.8)] hover:border-[#00c4ff]/40"
                }`}
              >
                <h3 className="text-lg font-semibold text-white">{team.name}</h3>
                <p className="text-sm text-gray-400">{team.age_group}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Team Details */}
        {selectedTeam && (
          <div className="bg-[rgba(18,26,36,0.8)] rounded-lg border border-[#00c4ff]/20">
            <div className="p-6 border-b border-[#00c4ff]/20">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white font-[Oswald]">{selectedTeam.name}</h2>
                  <p className="text-gray-400">{selectedTeam.age_group}</p>
                </div>
                {canManageTeam(selectedTeam.id) && (
                  <button
                    onClick={handleAddPlayerClick}
                    className="flex items-center gap-2 px-4 py-2 bg-[#00c4ff] hover:bg-[#00a3d9] text-white rounded-lg font-medium transition-colors shadow-lg shadow-[#00c4ff]/20"
                  >
                    <UserPlus className="w-5 h-5" />
                    Add Player
                  </button>
                )}
              </div>

              {/* Seasons this team participates in */}
              {teamSeasons.length > 0 && (
                <div className="mt-4 pt-4 border-t border-[#00c4ff]/20">
                  <h3 className="text-sm font-semibold text-gray-400 mb-2">Seasons</h3>
                  <div className="flex flex-wrap gap-2">
                    {teamSeasons.map((season) => (
                      <span
                        key={season.id}
                        className="px-3 py-1 bg-[#00c4ff]/20 text-[#00c4ff] border border-[#00c4ff]/30 rounded-full text-sm font-medium"
                      >
                        {season.name}
                        {season.division && ` - ${season.division}`}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Coaches Section */}
              <div className="mt-4 pt-4 border-t border-[#00c4ff]/20">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-400">Coaches</h3>
                  {canManageTeam(selectedTeam.id) && (
                    <button
                      onClick={() => setShowAddCoachModal(true)}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm bg-[#00c4ff] hover:bg-[#00a3d9] text-white rounded-lg font-medium transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add Coach
                    </button>
                  )}
                </div>
                {coaches.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">No coaches assigned</p>
                ) : (
                  <div className="space-y-2">
                    {coaches.map((coach) => (
                      <div
                        key={coach.id}
                        className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-[#00c4ff]/10"
                      >
                        <div>
                          <p className="font-medium text-white">{coach.name}</p>
                          <p className="text-sm text-gray-400">{coach.title}</p>
                          {coach.email && (
                            <p className="text-sm text-gray-400">{coach.email}</p>
                          )}
                          {coach.phone && (
                            <p className="text-sm text-gray-400">{coach.phone}</p>
                          )}
                        </div>
                        {canManageTeam(selectedTeam.id) && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setEditingCoach(coach);
                                setShowEditCoachModal(true);
                              }}
                              className="p-1 text-gray-500 hover:text-[#00c4ff]"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteCoach(coach.id)}
                              className="p-1 text-gray-500 hover:text-red-400"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Documents Section */}
              <div className="mt-4 pt-4 border-t border-[#00c4ff]/20">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-400">Documents</h3>
                  {canManageTeam(selectedTeam.id) && (
                    <button
                      onClick={() => setShowUploadModal(true)}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm bg-[#00c4ff] hover:bg-[#00a3d9] text-white rounded-lg font-medium transition-colors"
                    >
                      <Upload className="w-4 h-4" />
                      Upload Document
                    </button>
                  )}
                </div>
                {documents.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">No documents uploaded</p>
                ) : (
                  <div className="space-y-2">
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-[#00c4ff]/10"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-gray-500" />
                          <div>
                            <p className="font-medium text-white">{doc.title}</p>
                            {doc.description && (
                              <p className="text-sm text-gray-400">{doc.description}</p>
                            )}
                            <p className="text-xs text-gray-500">
                              {doc.file_name} • {formatFileSize(doc.file_size)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDownloadDocument(doc)}
                            className="p-1 text-gray-500 hover:text-[#00c4ff]"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          {canManageTeam(selectedTeam.id) && (
                            <button
                              onClick={() => handleDeleteDocument(doc.id)}
                              className="p-1 text-gray-500 hover:text-red-400"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Team Message Board Section */}
              <div className="mt-4 pt-4 border-t border-[#00c4ff]/20">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-400">Team Message Board</h3>
                  {canManageTeam(selectedTeam.id) && (
                    <button
                      onClick={() => setShowCreateMessage(true)}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm bg-[#00c4ff] hover:bg-[#00a3d9] text-white rounded-lg font-medium transition-colors"
                    >
                      <MessageSquare className="w-4 h-4" />
                      New Thread
                    </button>
                  )}
                </div>
                {messages.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">No messages yet</p>
                ) : (
                  <div className="space-y-2">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        onClick={() => handleLoadMessageDetail(msg)}
                        className="flex items-start gap-3 p-3 bg-white/5 rounded-lg border border-[#00c4ff]/10 cursor-pointer hover:border-[#00c4ff]/30 transition-colors"
                      >
                        {msg.is_pinned ? (
                          <Pin className="w-4 h-4 text-[#00c4ff] flex-shrink-0 mt-1" />
                        ) : (
                          <MessageCircle className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-medium text-white text-sm">{msg.title}</h4>
                            <Clock className="w-3 h-3 text-gray-500 flex-shrink-0 mt-0.5" />
                          </div>
                          <p className="text-xs text-gray-400 line-clamp-1 mt-1">{msg.content}</p>
                          <div className="flex items-center gap-3 mt-2 text-xs">
                            <span className="text-[#00c4ff]">{msg.author_name}</span>
                            <span className="text-gray-500">
                              {msg.reply_count} {msg.reply_count === 1 ? "reply" : "replies"}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/5 border-b border-[#00c4ff]/20">
                  <tr>
                    <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      #
                    </th>
                    <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Age
                    </th>
                    <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Birth Date
                    </th>
                    <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      ZORTS Exp
                    </th>
                    {canManageTeam(selectedTeam.id) && (
                      <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#00c4ff]/10">
                  {roster.map((player) => (
                    <tr key={player.id} className="hover:bg-white/5">
                      <td className="py-3 px-4 text-sm font-medium text-white">
                        {player.jersey_number || "-"}
                      </td>
                      <td 
                        className="py-3 px-4 text-sm text-[#00c4ff] hover:text-[#00c4ff]/80 cursor-pointer font-medium"
                        onClick={() => navigate(`/portal/players/${player.id}`)}
                      >
                        {player.first_name} {player.last_name}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-400">{player.status || "-"}</td>
                      <td className="py-3 px-4 text-sm text-gray-400">
                        {player.birth_date ? calculateAge(player.birth_date) : "-"}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-400">
                        {player.birth_date || "-"}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-400">
                        {player.zorts_expiration_date || "-"}
                      </td>
                      {canManageTeam(selectedTeam.id) && (
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => handleEditPlayerClick(player)}
                              className="p-1 text-gray-500 hover:text-[#00c4ff]"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button className="p-1 text-gray-500 hover:text-red-400">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Create Team Modal */}
      {showCreateTeamModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[rgba(18,26,36,0.98)] border border-[#00c4ff]/30 rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white font-[Oswald]">Create Team</h2>
              <button
                onClick={() => setShowCreateTeamModal(false)}
                className="text-gray-500 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Team Name *
                </label>
                <input
                  type="text"
                  required
                  value={newTeamForm.name}
                  onChange={(e) => setNewTeamForm({ ...newTeamForm, name: e.target.value })}
                  className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                  placeholder="e.g., Lightning, Thunder, Storm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Age Group *
                </label>
                <select
                  required
                  value={newTeamForm.age_group}
                  onChange={(e) => setNewTeamForm({ ...newTeamForm, age_group: e.target.value })}
                  className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                >
                  <option value="">Select Age Group</option>
                  <option value="5U">5U</option>
                  <option value="6U">6U</option>
                  <option value="7U">7U</option>
                  <option value="8U">8U</option>
                  <option value="9U">9U</option>
                  <option value="10U">10U</option>
                  <option value="11U">11U</option>
                  <option value="12U">12U</option>
                  <option value="13U">13U</option>
                  <option value="14U">14U</option>
                  <option value="15U">15U</option>
                  <option value="16U">16U</option>
                  <option value="17U">17U</option>
                  <option value="18U">18U</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateTeamModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-600 text-gray-300 hover:bg-white/5 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-[#00c4ff] hover:bg-[#00a3d9] text-white rounded-lg font-medium transition-colors shadow-lg shadow-[#00c4ff]/20"
                >
                  Create Team
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Player Modal */}
      {showAddPlayerModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[rgba(18,26,36,0.98)] border border-[#00c4ff]/30 rounded-xl shadow-xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white font-[Oswald]">Add Player to Team</h2>
              <button
                onClick={() => setShowAddPlayerModal(false)}
                className="text-gray-500 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Tab to choose between existing or new player */}
            <div className="mb-6">
              <div className="flex space-x-4 border-b border-gray-200">
                <button
                  className="pb-2 px-4 border-b-2 border-blue-500 text-blue-600 font-medium"
                >
                  Add Existing Player
                </button>
              </div>
            </div>

            {/* Add existing player section */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Select Player
                </label>
                <select
                  value={selectedPlayerId}
                  onChange={(e) => setSelectedPlayerId(Number(e.target.value))}
                  className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                >
                  <option value={0}>Choose a player...</option>
                  {allPlayers.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.first_name} {player.last_name} {player.family_name ? `(${player.family_name})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleAddExistingPlayer}
                  disabled={selectedPlayerId === 0}
                  className="flex-1 px-4 py-2 bg-[#00c4ff] hover:bg-[#00a3d9] disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors shadow-lg shadow-[#00c4ff]/20"
                >
                  Add Selected Player
                </button>
              </div>

              <div className="my-6 border-t border-[#00c4ff]/20 relative">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[rgba(18,26,36,0.98)] px-4 text-sm text-gray-500">
                  or create new
                </span>
              </div>

              {/* Create new player form */}
              <form onSubmit={handleCreateAndAddPlayer} className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">Basic Information</h3>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          First Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={newPlayerForm.first_name}
                          onChange={(e) =>
                            setNewPlayerForm({ ...newPlayerForm, first_name: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          Last Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={newPlayerForm.last_name}
                          onChange={(e) =>
                            setNewPlayerForm({ ...newPlayerForm, last_name: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-sm font-medium text-gray-700">
                          Family *
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowCreateFamily(true)}
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          + New Family
                        </button>
                      </div>
                      <select
                        required
                        value={newPlayerForm.family_id}
                        onChange={(e) =>
                          setNewPlayerForm({ ...newPlayerForm, family_id: Number(e.target.value) })
                        }
                        className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                      >
                        <option value={0}>Select Family</option>
                        {families.map((family) => (
                          <option key={family.id} value={family.id}>
                            {family.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          Jersey #
                        </label>
                        <input
                          type="text"
                          value={newPlayerForm.jersey_number}
                          onChange={(e) =>
                            setNewPlayerForm({ ...newPlayerForm, jersey_number: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          Birth Date
                        </label>
                        <input
                          type="date"
                          value={newPlayerForm.birth_date}
                          onChange={(e) =>
                            setNewPlayerForm({ ...newPlayerForm, birth_date: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          Status
                        </label>
                        <select
                          value={newPlayerForm.status}
                          onChange={(e) =>
                            setNewPlayerForm({ ...newPlayerForm, status: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                        >
                          <option value="">Select</option>
                          <option value="Full Time">Full Time</option>
                          <option value="Alternate">Alternate</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          Uniform Size
                        </label>
                        <select
                          value={newPlayerForm.uniform_size}
                          onChange={(e) =>
                            setNewPlayerForm({ ...newPlayerForm, uniform_size: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                        >
                          <option value="">Select</option>
                          <option value="YXS">YXS</option>
                          <option value="YS">YS</option>
                          <option value="YM">YM</option>
                          <option value="YL">YL</option>
                          <option value="YXL">YXL</option>
                          <option value="AS">AS</option>
                          <option value="AM">AM</option>
                          <option value="AL">AL</option>
                          <option value="AXL">AXL</option>
                          <option value="AXXL">AXXL</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          ZORTS Exp Date
                        </label>
                        <input
                          type="date"
                          value={newPlayerForm.zorts_expiration_date}
                          onChange={(e) =>
                            setNewPlayerForm({ ...newPlayerForm, zorts_expiration_date: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          ZORTS ID
                        </label>
                        <input
                          type="text"
                          value={newPlayerForm.zorts_id}
                          onChange={(e) =>
                            setNewPlayerForm({ ...newPlayerForm, zorts_id: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          Grade
                        </label>
                        <select
                          value={newPlayerForm.grade}
                          onChange={(e) =>
                            setNewPlayerForm({ ...newPlayerForm, grade: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                        >
                          <option value="">Select</option>
                          <option value="Preschool">Preschool</option>
                          <option value="Kindergarten">Kindergarten</option>
                          <option value="1st">1st</option>
                          <option value="2nd">2nd</option>
                          <option value="3rd">3rd</option>
                          <option value="4th">4th</option>
                          <option value="5th">5th</option>
                          <option value="6th">6th</option>
                          <option value="7th">7th</option>
                          <option value="8th">8th</option>
                          <option value="9th">9th</option>
                          <option value="10th">10th</option>
                          <option value="11th">11th</option>
                          <option value="12th">12th</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">Address</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">
                        Address Line 1
                      </label>
                      <input
                        type="text"
                        value={newPlayerForm.address_1}
                        onChange={(e) =>
                          setNewPlayerForm({ ...newPlayerForm, address_1: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">
                        Address Line 2
                      </label>
                      <input
                        type="text"
                        value={newPlayerForm.address_2}
                        onChange={(e) =>
                          setNewPlayerForm({ ...newPlayerForm, address_2: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          Town
                        </label>
                        <input
                          type="text"
                          value={newPlayerForm.town}
                          onChange={(e) =>
                            setNewPlayerForm({ ...newPlayerForm, town: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          State
                        </label>
                        <input
                          type="text"
                          value={newPlayerForm.state}
                          onChange={(e) =>
                            setNewPlayerForm({ ...newPlayerForm, state: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          Zip Code
                        </label>
                        <input
                          type="text"
                          value={newPlayerForm.zip_code}
                          onChange={(e) =>
                            setNewPlayerForm({ ...newPlayerForm, zip_code: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">Parent 1</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">
                        Name
                      </label>
                      <input
                        type="text"
                        value={newPlayerForm.parent_1_name}
                        onChange={(e) =>
                          setNewPlayerForm({ ...newPlayerForm, parent_1_name: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          Phone
                        </label>
                        <input
                          type="tel"
                          value={newPlayerForm.parent_1_phone}
                          onChange={(e) =>
                            setNewPlayerForm({ ...newPlayerForm, parent_1_phone: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          Email
                        </label>
                        <input
                          type="email"
                          value={newPlayerForm.parent_1_email}
                          onChange={(e) =>
                            setNewPlayerForm({ ...newPlayerForm, parent_1_email: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">Parent 2</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">
                        Name
                      </label>
                      <input
                        type="text"
                        value={newPlayerForm.parent_2_name}
                        onChange={(e) =>
                          setNewPlayerForm({ ...newPlayerForm, parent_2_name: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          Phone
                        </label>
                        <input
                          type="tel"
                          value={newPlayerForm.parent_2_phone}
                          onChange={(e) =>
                            setNewPlayerForm({ ...newPlayerForm, parent_2_phone: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          Email
                        </label>
                        <input
                          type="email"
                          value={newPlayerForm.parent_2_email}
                          onChange={(e) =>
                            setNewPlayerForm({ ...newPlayerForm, parent_2_email: e.target.value })
                          }
                          className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddPlayerModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-600 text-gray-300 hover:bg-white/5 rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-[#00c4ff] hover:bg-[#00a3d9] shadow-lg shadow-[#00c4ff]/20 text-white rounded-lg font-medium transition-colors"
                  >
                    Create & Add Player
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Player Modal */}
      {showEditPlayerModal && editingPlayer && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[rgba(18,26,36,0.98)] border border-[#00c4ff]/30 rounded-xl shadow-xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white font-[Oswald]">Edit Player</h2>
              <button
                onClick={() => setShowEditPlayerModal(false)}
                className="text-gray-500 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleUpdatePlayer} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingPlayer.first_name}
                    onChange={(e) =>
                      setEditingPlayer({ ...editingPlayer, first_name: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingPlayer.last_name}
                    onChange={(e) =>
                      setEditingPlayer({ ...editingPlayer, last_name: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Family *</label>
                <select
                  required
                  value={editingPlayer.family_id}
                  onChange={(e) =>
                    setEditingPlayer({ ...editingPlayer, family_id: Number(e.target.value) })
                  }
                  className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                >
                  <option value={0}>Select Family</option>
                  {families.map((family) => (
                    <option key={family.id} value={family.id}>
                      {family.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Jersey #
                  </label>
                  <input
                    type="text"
                    value={editingPlayer.jersey_number || ""}
                    onChange={(e) =>
                      setEditingPlayer({ ...editingPlayer, jersey_number: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Birth Date
                  </label>
                  <input
                    type="date"
                    value={editingPlayer.birth_date || ""}
                    onChange={(e) =>
                      setEditingPlayer({ ...editingPlayer, birth_date: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Status
                  </label>
                  <select
                    value={editingPlayer.status || ""}
                    onChange={(e) =>
                      setEditingPlayer({ ...editingPlayer, status: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                  >
                    <option value="">Select</option>
                    <option value="Full Time">Full Time</option>
                    <option value="Alternate">Alternate</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Uniform Size
                  </label>
                  <select
                    value={editingPlayer.uniform_size || ""}
                    onChange={(e) =>
                      setEditingPlayer({ ...editingPlayer, uniform_size: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                  >
                    <option value="">Select</option>
                    <option value="YXS">YXS</option>
                    <option value="YS">YS</option>
                    <option value="YM">YM</option>
                    <option value="YL">YL</option>
                    <option value="YXL">YXL</option>
                    <option value="AS">AS</option>
                    <option value="AM">AM</option>
                    <option value="AL">AL</option>
                    <option value="AXL">AXL</option>
                    <option value="AXXL">AXXL</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    ZORTS Exp Date
                  </label>
                  <input
                    type="date"
                    value={editingPlayer.zorts_expiration_date || ""}
                    onChange={(e) =>
                      setEditingPlayer({ ...editingPlayer, zorts_expiration_date: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    ZORTS ID
                  </label>
                  <input
                    type="text"
                    value={editingPlayer.zorts_id || ""}
                    onChange={(e) =>
                      setEditingPlayer({ ...editingPlayer, zorts_id: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Grade
                  </label>
                  <select
                    value={editingPlayer.grade || ""}
                    onChange={(e) =>
                      setEditingPlayer({ ...editingPlayer, grade: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                  >
                    <option value="">Select</option>
                    <option value="Preschool">Preschool</option>
                    <option value="Kindergarten">Kindergarten</option>
                    <option value="1st">1st</option>
                    <option value="2nd">2nd</option>
                    <option value="3rd">3rd</option>
                    <option value="4th">4th</option>
                    <option value="5th">5th</option>
                    <option value="6th">6th</option>
                    <option value="7th">7th</option>
                    <option value="8th">8th</option>
                    <option value="9th">9th</option>
                    <option value="10th">10th</option>
                    <option value="11th">11th</option>
                    <option value="12th">12th</option>
                  </select>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Address</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      Address Line 1
                    </label>
                    <input
                      type="text"
                      value={editingPlayer.address_1 || ""}
                      onChange={(e) =>
                        setEditingPlayer({ ...editingPlayer, address_1: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      Address Line 2
                    </label>
                    <input
                      type="text"
                      value={editingPlayer.address_2 || ""}
                      onChange={(e) =>
                        setEditingPlayer({ ...editingPlayer, address_2: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">
                        Town
                      </label>
                      <input
                        type="text"
                        value={editingPlayer.town || ""}
                        onChange={(e) =>
                          setEditingPlayer({ ...editingPlayer, town: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">
                        State
                      </label>
                      <input
                        type="text"
                        value={editingPlayer.state || ""}
                        onChange={(e) =>
                          setEditingPlayer({ ...editingPlayer, state: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">
                        Zip Code
                      </label>
                      <input
                        type="text"
                        value={editingPlayer.zip_code || ""}
                        onChange={(e) =>
                          setEditingPlayer({ ...editingPlayer, zip_code: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Parent 1</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      value={editingPlayer.parent_1_name || ""}
                      onChange={(e) =>
                        setEditingPlayer({ ...editingPlayer, parent_1_name: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">
                        Phone
                      </label>
                      <input
                        type="tel"
                        value={editingPlayer.parent_1_phone || ""}
                        onChange={(e) =>
                          setEditingPlayer({ ...editingPlayer, parent_1_phone: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        value={editingPlayer.parent_1_email || ""}
                        onChange={(e) =>
                          setEditingPlayer({ ...editingPlayer, parent_1_email: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Parent 2</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      value={editingPlayer.parent_2_name || ""}
                      onChange={(e) =>
                        setEditingPlayer({ ...editingPlayer, parent_2_name: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">
                        Phone
                      </label>
                      <input
                        type="tel"
                        value={editingPlayer.parent_2_phone || ""}
                        onChange={(e) =>
                          setEditingPlayer({ ...editingPlayer, parent_2_phone: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        value={editingPlayer.parent_2_email || ""}
                        onChange={(e) =>
                          setEditingPlayer({ ...editingPlayer, parent_2_email: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditPlayerModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-600 text-gray-300 hover:bg-white/5 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-[#00c4ff] hover:bg-[#00a3d9] shadow-lg shadow-[#00c4ff]/20 text-white rounded-lg font-medium transition-colors"
                >
                  Update Player
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Family Modal */}
      {showCreateFamily && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-[rgba(18,26,36,0.98)] border border-[#00c4ff]/30 rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white font-[Oswald]">Create Family</h2>
              <button
                onClick={() => setShowCreateFamily(false)}
                className="text-gray-500 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleCreateFamily} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Family Name *
                </label>
                <input
                  type="text"
                  required
                  value={newFamilyForm.name}
                  onChange={(e) => setNewFamilyForm({ ...newFamilyForm, name: e.target.value })}
                  className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                  placeholder="e.g., Smith Family"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={newFamilyForm.email}
                  onChange={(e) => setNewFamilyForm({ ...newFamilyForm, email: e.target.value })}
                  className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={newFamilyForm.phone}
                  onChange={(e) => setNewFamilyForm({ ...newFamilyForm, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={newFamilyForm.address}
                  onChange={(e) => setNewFamilyForm({ ...newFamilyForm, address: e.target.value })}
                  className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Emergency Contact Name
                </label>
                <input
                  type="text"
                  value={newFamilyForm.emergency_contact_name}
                  onChange={(e) => setNewFamilyForm({ ...newFamilyForm, emergency_contact_name: e.target.value })}
                  className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Emergency Contact Phone
                </label>
                <input
                  type="tel"
                  value={newFamilyForm.emergency_contact_phone}
                  onChange={(e) => setNewFamilyForm({ ...newFamilyForm, emergency_contact_phone: e.target.value })}
                  className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateFamily(false)}
                  className="flex-1 px-4 py-2 border border-gray-600 text-gray-300 hover:bg-white/5 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-[#00c4ff] hover:bg-[#00a3d9] shadow-lg shadow-[#00c4ff]/20 text-white rounded-lg font-medium transition-colors"
                >
                  Create Family
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Coach Modal */}
      {showAddCoachModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[rgba(18,26,36,0.98)] border border-[#00c4ff]/30 rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white font-[Oswald]">Add Coach</h2>
              <button
                onClick={() => setShowAddCoachModal(false)}
                className="text-gray-500 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleAddCoach} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  required
                  value={newCoachForm.name}
                  onChange={(e) => setNewCoachForm({ ...newCoachForm, name: e.target.value })}
                  className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Title *
                </label>
                <select
                  required
                  value={newCoachForm.title}
                  onChange={(e) => setNewCoachForm({ ...newCoachForm, title: e.target.value })}
                  className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                >
                  <option value="Head Coach">Head Coach</option>
                  <option value="Assistant Coach">Assistant Coach</option>
                  <option value="Team Manager">Team Manager</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={newCoachForm.email}
                  onChange={(e) => setNewCoachForm({ ...newCoachForm, email: e.target.value })}
                  className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={newCoachForm.phone}
                  onChange={(e) => setNewCoachForm({ ...newCoachForm, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddCoachModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-600 text-gray-300 hover:bg-white/5 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-[#00c4ff] hover:bg-[#00a3d9] shadow-lg shadow-[#00c4ff]/20 text-white rounded-lg font-medium transition-colors"
                >
                  Add Coach
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Coach Modal */}
      {showEditCoachModal && editingCoach && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[rgba(18,26,36,0.98)] border border-[#00c4ff]/30 rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white font-[Oswald]">Edit Coach</h2>
              <button
                onClick={() => setShowEditCoachModal(false)}
                className="text-gray-500 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleEditCoach} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  required
                  value={editingCoach.name}
                  onChange={(e) => setEditingCoach({ ...editingCoach, name: e.target.value })}
                  className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Title *
                </label>
                <select
                  required
                  value={editingCoach.title}
                  onChange={(e) => setEditingCoach({ ...editingCoach, title: e.target.value })}
                  className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                >
                  <option value="Head Coach">Head Coach</option>
                  <option value="Assistant Coach">Assistant Coach</option>
                  <option value="Team Manager">Team Manager</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={editingCoach.email || ""}
                  onChange={(e) => setEditingCoach({ ...editingCoach, email: e.target.value })}
                  className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={editingCoach.phone || ""}
                  onChange={(e) => setEditingCoach({ ...editingCoach, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditCoachModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-600 text-gray-300 hover:bg-white/5 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-[#00c4ff] hover:bg-[#00a3d9] shadow-lg shadow-[#00c4ff]/20 text-white rounded-lg font-medium transition-colors"
                >
                  Update Coach
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Document Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[rgba(18,26,36,0.98)] border border-[#00c4ff]/30 rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white font-[Oswald]">Upload Document</h2>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-gray-500 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleUploadDocument} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  required
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                  className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                  placeholder="e.g., Practice Schedule, Permission Form"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Description
                </label>
                <textarea
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                  className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                  rows={3}
                  placeholder="Optional description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  File *
                </label>
                <input
                  type="file"
                  required
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setUploadForm({ ...uploadForm, file });
                  }}
                  className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                />
                {uploadForm.file && (
                  <p className="text-sm text-gray-600 mt-1">
                    {uploadForm.file.name} ({formatFileSize(uploadForm.file.size)})
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-600 text-gray-300 hover:bg-white/5 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-[#00c4ff] hover:bg-[#00a3d9] shadow-lg shadow-[#00c4ff]/20 text-white rounded-lg font-medium transition-colors"
                >
                  Upload
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Message Modal */}
      {showCreateMessage && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[rgba(18,26,36,0.98)] border border-[#00c4ff]/30 rounded-xl shadow-xl max-w-2xl w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white font-[Oswald]">New Message Thread</h2>
              <button
                onClick={() => {
                  setShowCreateMessage(false);
                  setMessageTitle("");
                  setMessageContent("");
                }}
                className="text-gray-500 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Title *</label>
                <input
                  type="text"
                  value={messageTitle}
                  onChange={(e) => setMessageTitle(e.target.value)}
                  placeholder="e.g., Practice schedule for this week"
                  className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Message *</label>
                <textarea
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  placeholder="Share updates with your team..."
                  rows={8}
                  className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateMessage(false);
                  setMessageTitle("");
                  setMessageContent("");
                }}
                className="flex-1 px-4 py-2 border border-gray-600 text-gray-300 hover:bg-white/5 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateMessage}
                disabled={submittingMessage || !messageTitle.trim() || !messageContent.trim()}
                className="flex-1 px-4 py-2 bg-[#00c4ff] hover:bg-[#00a3d9] text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submittingMessage ? "Posting..." : "Post Thread"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Message Detail Modal */}
      {showMessageDetail && selectedMessage && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-[rgba(18,26,36,0.98)] border border-[#00c4ff]/30 rounded-xl shadow-xl max-w-4xl w-full p-6 my-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white font-[Oswald]">{selectedMessage.title}</h2>
              <div className="flex items-center gap-2">
                {canManageTeam(selectedTeam!.id) && (
                  <>
                    <button
                      onClick={() => handleTogglePin(selectedMessage.id)}
                      className="p-2 border border-[#00c4ff]/30 text-[#00c4ff] hover:bg-[#00c4ff]/10 rounded-lg transition-colors"
                      title={selectedMessage.is_pinned ? "Unpin" : "Pin"}
                    >
                      <Pin className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteMessage(selectedMessage.id)}
                      className="p-2 border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
                <button
                  onClick={() => {
                    setShowMessageDetail(false);
                    setSelectedMessage(null);
                    setReplyContent("");
                  }}
                  className="text-gray-500 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              {/* Original Message */}
              <div className="p-4 bg-white/5 rounded-lg border border-[#00c4ff]/20">
                <div className="flex items-center gap-3 text-sm text-gray-400 mb-3">
                  <span className="text-[#00c4ff] font-medium">{selectedMessage.author_name}</span>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(selectedMessage.created_at).toLocaleString()}
                  </div>
                  {selectedMessage.is_pinned && (
                    <>
                      <span>•</span>
                      <Pin className="w-3 h-3 text-[#00c4ff]" />
                      <span className="text-[#00c4ff] text-xs">Pinned</span>
                    </>
                  )}
                </div>
                <p className="text-gray-300 whitespace-pre-wrap">{selectedMessage.content}</p>
              </div>

              {/* Replies */}
              {messageReplies.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-400">
                    Replies ({messageReplies.length})
                  </h3>
                  {messageReplies.map((reply) => (
                    <div
                      key={reply.id}
                      className="p-4 bg-white/5 rounded-lg border border-[#00c4ff]/10"
                    >
                      <div className="flex items-center gap-3 text-sm text-gray-400 mb-3">
                        <span className="text-[#00c4ff] font-medium">{reply.author_name}</span>
                        <span>•</span>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(reply.created_at).toLocaleString()}
                        </div>
                      </div>
                      <p className="text-gray-300 whitespace-pre-wrap">{reply.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Reply Form */}
            <div className="mt-6 pt-6 border-t border-[#00c4ff]/20">
              <h3 className="text-sm font-semibold text-white mb-3 font-[Oswald]">Add a Reply</h3>
              <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Share your thoughts..."
                rows={4}
                className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff] mb-3"
              />
              <button
                onClick={handleReplyToMessage}
                disabled={submittingReply || !replyContent.trim()}
                className="px-4 py-2 bg-[#00c4ff] hover:bg-[#00a3d9] text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                {submittingReply ? "Posting..." : "Post Reply"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}

export default PortalTeams;
