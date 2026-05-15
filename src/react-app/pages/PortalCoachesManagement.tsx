import { useState, useEffect } from "react";
import { PortalLayout } from "@/react-app/components/layout/PortalLayout";
import { Plus, Trash2, Eye, EyeOff, Save, X, Upload, ArrowUp, ArrowDown, Edit2 } from "lucide-react";
import { apiFetch } from "@/react-app/lib/api";

interface Coach {
  id: number;
  name: string;
  role: string | null;
  photo_key: string | null;
  team_id: number | null;
  team_name: string | null;
  bio: string | null;
  email: string | null;
  phone: string | null;
  order_index: number;
  is_visible: number;
  created_at: string;
}

interface Team {
  id: number;
  name: string;
}

export default function PortalCoachesManagement() {
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCoach, setEditingCoach] = useState<Coach | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    role: "",
    photo_key: "",
    team_id: null as number | null,
    bio: "",
    email: "",
    phone: "",
    is_visible: true,
  });
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    loadCoaches();
    loadTeams();
  }, []);

  const loadCoaches = async () => {
    try {
      const response = await apiFetch("/api/public/coaches", {
      });
      if (response.ok) {
        const data = await response.json();
        setCoaches(data);
      }
    } catch (error) {
      console.error("Error loading coaches:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadTeams = async () => {
    try {
      const response = await apiFetch("/api/portal/teams", {
      });
      if (response.ok) {
        const data = await response.json();
        setTeams(data);
      }
    } catch (error) {
      console.error("Error loading teams:", error);
    }
  };

  const handleCreate = () => {
    setEditingCoach(null);
    setFormData({
      name: "",
      role: "",
      photo_key: "",
      team_id: null,
      bio: "",
      email: "",
      phone: "",
      is_visible: true,
    });
    setShowModal(true);
  };

  const handleEdit = (coach: Coach) => {
    setEditingCoach(coach);
    setFormData({
      name: coach.name,
      role: coach.role || "",
      photo_key: coach.photo_key || "",
      team_id: coach.team_id,
      bio: coach.bio || "",
      email: coach.email || "",
      phone: coach.phone || "",
      is_visible: coach.is_visible === 1,
    });
    setShowModal(true);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    try {
      const uploadData = new FormData();
      uploadData.append("photo", file);

      const response = await apiFetch("/api/public/coaches/upload-photo", {
        method: "POST",
        body: uploadData,
      });

      if (response.ok) {
        const data = await response.json();
        setFormData((prev) => ({ ...prev, photo_key: data.photo_key }));
      } else {
        alert("Failed to upload photo");
      }
    } catch (error) {
      console.error("Error uploading photo:", error);
      alert("Failed to upload photo");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert("Please enter a name");
      return;
    }

    try {
      const url = editingCoach
        ? `/api/public/coaches/${editingCoach.id}`
        : "/api/public/coaches";
      const method = editingCoach ? "PUT" : "POST";

      const response = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          role: formData.role || null,
          photo_key: formData.photo_key || null,
          team_id: formData.team_id,
          bio: formData.bio || null,
          email: formData.email || null,
          phone: formData.phone || null,
          order_index: editingCoach?.order_index ?? coaches.length,
          is_visible: formData.is_visible,
        }),
      });

      if (response.ok) {
        setShowModal(false);
        loadCoaches();
      } else {
        alert("Failed to save coach");
      }
    } catch (error) {
      console.error("Error saving coach:", error);
      alert("Failed to save coach");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this coach?")) return;

    try {
      const response = await apiFetch(`/api/public/coaches/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        loadCoaches();
      }
    } catch (error) {
      console.error("Error deleting coach:", error);
    }
  };

  const handleToggleVisibility = async (coach: Coach) => {
    try {
      const response = await apiFetch(`/api/public/coaches/${coach.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: coach.name,
          role: coach.role,
          photo_key: coach.photo_key,
          team_id: coach.team_id,
          bio: coach.bio,
          email: coach.email,
          phone: coach.phone,
          order_index: coach.order_index,
          is_visible: coach.is_visible !== 1,
        }),
      });

      if (response.ok) {
        loadCoaches();
      }
    } catch (error) {
      console.error("Error toggling visibility:", error);
    }
  };

  const handleReorder = async (coach: Coach, direction: "up" | "down") => {
    const currentIndex = coaches.findIndex((c) => c.id === coach.id);
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= coaches.length) return;

    const targetCoach = coaches[targetIndex];

    try {
      await Promise.all([
        apiFetch(`/api/public/coaches/${coach.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: coach.name,
            role: coach.role,
            photo_key: coach.photo_key,
            team_id: coach.team_id,
            bio: coach.bio,
            email: coach.email,
            phone: coach.phone,
            order_index: targetCoach.order_index,
            is_visible: coach.is_visible === 1,
          }),
        }),
        apiFetch(`/api/public/coaches/${targetCoach.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: targetCoach.name,
            role: targetCoach.role,
            photo_key: targetCoach.photo_key,
            team_id: targetCoach.team_id,
            bio: targetCoach.bio,
            email: targetCoach.email,
            phone: targetCoach.phone,
            order_index: coach.order_index,
            is_visible: targetCoach.is_visible === 1,
          }),
        }),
      ]);

      loadCoaches();
    } catch (error) {
      console.error("Error reordering coaches:", error);
    }
  };

  const getPhotoUrl = (photoKey: string) => {
    const key = photoKey.replace("coach-photos/", "");
    return `/api/public/coaches/photos/${key}`;
  };

  if (loading) {
    return (
      <PortalLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#00c4ff]"></div>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1
            className="text-2xl md:text-3xl font-bold text-white"
            style={{ fontFamily: "Oswald, sans-serif" }}
          >
            COACHES
          </h1>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 bg-[#00c4ff] text-[#0a0f14] font-bold rounded-lg hover:bg-[#00a3d9] transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Coach
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {coaches.map((coach, index) => (
            <div
              key={coach.id}
              className={`bg-[rgba(18,26,36,0.8)] border rounded-xl overflow-hidden shadow-[0_0_15px_rgba(0,196,255,0.1)] ${
                coach.is_visible === 1
                  ? "border-[#00c4ff]/30"
                  : "border-gray-600/30 opacity-60"
              }`}
            >
              <div className="relative aspect-square bg-gray-800">
                {coach.photo_key ? (
                  <img
                    src={getPhotoUrl(coach.photo_key)}
                    alt={coach.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500">
                    <span className="text-6xl font-bold">{coach.name.charAt(0)}</span>
                  </div>
                )}
                <div className="absolute top-2 right-2 flex gap-1">
                  <button
                    onClick={() => handleToggleVisibility(coach)}
                    className={`p-2 rounded-lg backdrop-blur-sm transition-colors ${
                      coach.is_visible === 1
                        ? "bg-green-600/80 text-white hover:bg-green-500"
                        : "bg-gray-600/80 text-gray-300 hover:bg-gray-500"
                    }`}
                    title={coach.is_visible === 1 ? "Hide coach" : "Show coach"}
                  >
                    {coach.is_visible === 1 ? (
                      <Eye className="w-4 h-4" />
                    ) : (
                      <EyeOff className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              <div className="p-4">
                <h3 className="text-lg font-bold text-white" style={{ fontFamily: "Oswald, sans-serif" }}>
                  {coach.name}
                </h3>
                {coach.role && (
                  <p className="text-[#00c4ff] text-sm font-medium">{coach.role}</p>
                )}
                {coach.team_name && (
                  <p className="text-gray-400 text-sm">{coach.team_name}</p>
                )}
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleReorder(coach, "up")}
                      disabled={index === 0}
                      className="p-2 text-gray-400 hover:text-[#00c4ff] hover:bg-[#00c4ff]/10 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move up"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleReorder(coach, "down")}
                      disabled={index === coaches.length - 1}
                      className="p-2 text-gray-400 hover:text-[#00c4ff] hover:bg-[#00c4ff]/10 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move down"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEdit(coach)}
                      className="p-2 text-[#00c4ff] hover:bg-[#00c4ff]/10 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(coach.id)}
                      className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {coaches.length === 0 && (
            <div className="col-span-full bg-[rgba(18,26,36,0.8)] border border-[#00c4ff]/30 rounded-xl p-12 text-center">
              <p className="text-gray-400">No coaches added yet. Add your first coach!</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0f14] border border-[#00c4ff]/30 rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white" style={{ fontFamily: "Oswald, sans-serif" }}>
                {editingCoach ? "EDIT COACH" : "ADD COACH"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Photo</label>
                {formData.photo_key ? (
                  <div className="relative">
                    <img
                      src={getPhotoUrl(formData.photo_key)}
                      alt="Preview"
                      className="w-32 h-32 object-cover rounded-lg border border-[#00c4ff]/30"
                    />
                    <button
                      onClick={() => setFormData((prev) => ({ ...prev, photo_key: "" }))}
                      className="absolute top-1 right-1 p-1 bg-red-600/80 text-white rounded-lg hover:bg-red-500 backdrop-blur-sm"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed border-[#00c4ff]/30 rounded-lg cursor-pointer hover:border-[#00c4ff]/50 transition-colors bg-[rgba(18,26,36,0.4)]">
                    <div className="flex flex-col items-center justify-center">
                      {uploadingPhoto ? (
                        <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-[#00c4ff]"></div>
                      ) : (
                        <>
                          <Upload className="w-6 h-6 mb-1 text-gray-400" />
                          <p className="text-xs text-gray-400">Upload</p>
                        </>
                      )}
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      disabled={uploadingPhoto}
                    />
                  </label>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-[rgba(18,26,36,0.8)] border border-[#00c4ff]/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#00c4ff] focus:shadow-[0_0_10px_rgba(0,196,255,0.2)]"
                  placeholder="Coach name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Role</label>
                <input
                  type="text"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-4 py-3 bg-[rgba(18,26,36,0.8)] border border-[#00c4ff]/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#00c4ff] focus:shadow-[0_0_10px_rgba(0,196,255,0.2)]"
                  placeholder="Head Coach, Assistant Coach, etc."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Team</label>
                <select
                  value={formData.team_id ?? ""}
                  onChange={(e) => setFormData({ ...formData, team_id: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full px-4 py-3 bg-[rgba(18,26,36,0.8)] border border-[#00c4ff]/30 rounded-lg text-white focus:outline-none focus:border-[#00c4ff] focus:shadow-[0_0_10px_rgba(0,196,255,0.2)]"
                >
                  <option value="">No team assigned</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Bio</label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 bg-[rgba(18,26,36,0.8)] border border-[#00c4ff]/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#00c4ff] focus:shadow-[0_0_10px_rgba(0,196,255,0.2)] resize-none"
                  placeholder="Brief bio..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 bg-[rgba(18,26,36,0.8)] border border-[#00c4ff]/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#00c4ff] focus:shadow-[0_0_10px_rgba(0,196,255,0.2)]"
                    placeholder="Email"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-3 bg-[rgba(18,26,36,0.8)] border border-[#00c4ff]/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#00c4ff] focus:shadow-[0_0_10px_rgba(0,196,255,0.2)]"
                    placeholder="Phone"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-[rgba(18,26,36,0.8)] border border-[#00c4ff]/30 rounded-lg">
                <span className="text-gray-300 font-medium">Visible on website</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_visible}
                    onChange={(e) => setFormData({ ...formData, is_visible: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00c4ff]"></div>
                </label>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={handleSave}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-[#00c4ff] text-[#0a0f14] font-bold rounded-lg hover:bg-[#00a3d9] transition-colors"
              >
                <Save className="w-5 h-5" />
                {editingCoach ? "Save Changes" : "Add Coach"}
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="px-6 py-3 bg-gray-600 text-white font-bold rounded-lg hover:bg-gray-500 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}
