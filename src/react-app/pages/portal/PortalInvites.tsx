import { useState, useEffect } from "react";
import { PortalLayout } from "@/react-app/components/layout/PortalLayout";
import { Plus, Copy, Trash2, Send, Check } from "lucide-react";
import { formatDate } from "@/react-app/utils/dateFormat";
import { apiFetch } from "@/react-app/lib/api";

interface Invite {
  id: number;
  email: string;
  code: string;
  role: string;
  team_id: number | null;
  team_name: string | null;
  family_id: number | null;
  family_name: string | null;
  status: string;
  expires_at: string;
  created_at: string;
  accepted_at: string | null;
}

interface Team {
  id: number;
  name: string;
}

interface Family {
  id: number;
  name: string;
}

export default function PortalInvites() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    email: "",
    role: "parent" as "admin" | "coach" | "parent",
    team_id: null as number | null,
    family_id: null as number | null,
    expires_in_days: 7,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [invitesRes, teamsRes, familiesRes] = await Promise.all([
        apiFetch("/api/portal/invites", { }),
        apiFetch("/api/portal/teams", { }),
        apiFetch("/api/portal/families", { }),
      ]);

      if (invitesRes.ok) setInvites(await invitesRes.json());
      if (teamsRes.ok) setTeams(await teamsRes.json());
      if (familiesRes.ok) setFamilies(await familiesRes.json());
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await apiFetch("/api/portal/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        await loadData();
        setShowCreateModal(false);
        setFormData({
          email: "",
          role: "parent",
          team_id: null,
          family_id: null,
          expires_in_days: 7,
        });
      }
    } catch (error) {
      console.error("Error creating invite:", error);
    }
  };

  const handleDeleteInvite = async (id: number) => {
    if (!confirm("Are you sure you want to delete this invite?")) return;

    try {
      const response = await apiFetch(`/api/portal/invites/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await loadData();
      }
    } catch (error) {
      console.error("Error deleting invite:", error);
    }
  };

  const handleResendInvite = async (id: number) => {
    try {
      const response = await apiFetch(`/api/portal/invites/${id}/resend`, {
        method: "POST",
      });

      if (response.ok) {
        await loadData();
      }
    } catch (error) {
      console.error("Error resending invite:", error);
    }
  };

  const copyInviteLink = (code: string) => {
    const link = `${window.location.origin}/invite/${code}`;
    navigator.clipboard.writeText(link);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const getStatusBadge = (invite: Invite) => {
    if (invite.status === "accepted") {
      return <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">Accepted</span>;
    }
    
    const expiresAt = new Date(invite.expires_at);
    const isExpired = expiresAt < new Date();
    
    if (isExpired) {
      return <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">Expired</span>;
    }
    
    return <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">Pending</span>;
  };

  const pendingInvites = invites.filter(i => i.status === "pending" && new Date(i.expires_at) > new Date());
  const expiredInvites = invites.filter(i => i.status === "pending" && new Date(i.expires_at) <= new Date());
  const acceptedInvites = invites.filter(i => i.status === "accepted");

  if (loading) {
    return (
      <PortalLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading...</div>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white font-[Oswald]">User Invites</h1>
            <p className="text-gray-500 mt-1">Invite users to access the portal</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Create Invite
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-[#00c4ff]/20">
            <div className="text-sm text-gray-500">Pending Invites</div>
            <div className="text-2xl font-bold text-blue-600">{pendingInvites.length}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-[#00c4ff]/20">
            <div className="text-sm text-gray-500">Accepted</div>
            <div className="text-2xl font-bold text-green-600">{acceptedInvites.length}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-[#00c4ff]/20">
            <div className="text-sm text-gray-500">Expired</div>
            <div className="text-2xl font-bold text-red-600">{expiredInvites.length}</div>
          </div>
        </div>

        {/* Pending Invites */}
        {pendingInvites.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white font-[Oswald] mb-3">Pending Invites</h2>
            <div className="bg-white rounded-lg shadow-sm border border-[#00c4ff]/20 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assignment</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expires</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pendingInvites.map((invite) => (
                    <tr key={invite.id}>
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium">{invite.email}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className="capitalize font-medium text-gray-700">{invite.role}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {invite.team_name || invite.family_name || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(invite.expires_at)}
                      </td>
                      <td className="px-4 py-3 text-sm">{getStatusBadge(invite)}</td>
                      <td className="px-4 py-3 text-sm text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => copyInviteLink(invite.code)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                            title="Copy invite link"
                          >
                            {copiedCode === invite.code ? (
                              <Check className="w-4 h-4" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleResendInvite(invite.id)}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                            title="Resend invite"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteInvite(invite.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                            title="Delete invite"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Accepted Invites */}
        {acceptedInvites.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white font-[Oswald] mb-3">Accepted Invites</h2>
            <div className="bg-white rounded-lg shadow-sm border border-[#00c4ff]/20 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assignment</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Accepted</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {acceptedInvites.map((invite) => (
                    <tr key={invite.id}>
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium">{invite.email}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className="capitalize font-medium text-gray-700">{invite.role}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {invite.team_name || invite.family_name || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {invite.accepted_at ? formatDate(invite.accepted_at) : "-"}
                      </td>
                      <td className="px-4 py-3 text-sm">{getStatusBadge(invite)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Create Invite Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h2 className="text-xl font-bold text-white font-[Oswald] mb-4">Create Invite</h2>
              
              <form onSubmit={handleCreateInvite} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Role *
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="parent">Parent</option>
                    <option value="coach">Coach</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                {formData.role === "coach" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      Assign to Team (Optional)
                    </label>
                    <select
                      value={formData.team_id || ""}
                      onChange={(e) => setFormData({ ...formData, team_id: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">No team assignment</option>
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>{team.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {formData.role === "parent" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      Assign to Family (Optional)
                    </label>
                    <select
                      value={formData.family_id || ""}
                      onChange={(e) => setFormData({ ...formData, family_id: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">No family assignment</option>
                      {families.map((family) => (
                        <option key={family.id} value={family.id}>{family.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Expires In (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={formData.expires_in_days}
                    onChange={(e) => setFormData({ ...formData, expires_in_days: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Create Invite
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
