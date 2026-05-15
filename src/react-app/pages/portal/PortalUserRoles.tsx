import { useState, useEffect } from "react";
import { Shield, Plus, Trash2, Users, X, Edit } from "lucide-react";
import { PortalLayout } from "@/react-app/components/layout/PortalLayout";
import { formatDate } from "@/react-app/utils/dateFormat";
import { apiFetch } from "@/react-app/lib/api";

interface UserRole {
  id: number;
  user_id: string;
  email: string;
  name?: string;
  role: string;
  team_id: number | null;
  family_id: number | null;
  team_name?: string;
  family_name?: string;
  created_at: string;
}

interface Team {
  id: number;
  name: string;
}

interface Family {
  id: number;
  name: string;
}

export default function PortalUserRoles() {
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRole, setEditingRole] = useState<UserRole | null>(null);
  const [formData, setFormData] = useState({
    user_id: "",
    email: "",
    name: "",
    role: "parent" as "admin" | "coach" | "parent",
    team_id: null as number | null,
    family_id: null as number | null,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [rolesRes, teamsRes, familiesRes] = await Promise.all([
        apiFetch("/api/portal/user-roles", { }),
        apiFetch("/api/portal/teams", { }),
        apiFetch("/api/portal/families", { }),
      ]);

      if (rolesRes.ok) {
        const rolesData = await rolesRes.json();
        setRoles(rolesData);
      }

      if (teamsRes.ok) {
        const teamsData = await teamsRes.json();
        setTeams(teamsData);
      }

      if (familiesRes.ok) {
        const familiesData = await familiesRes.json();
        setFamilies(familiesData);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRole = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      const response = await apiFetch("/api/portal/user-roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setShowAddModal(false);
        setFormData({
          user_id: "",
          email: "",
          name: "",
          role: "parent",
          team_id: null,
          family_id: null,
        });
        loadData();
      }
    } catch (error) {
      console.error("Error adding role:", error);
    }
  };

  const handleEditRole = (role: UserRole) => {
    setEditingRole(role);
    setFormData({
      user_id: role.user_id,
      email: role.email,
      name: role.name || "",
      role: role.role as "admin" | "coach" | "parent",
      team_id: role.team_id,
      family_id: role.family_id,
    });
    setShowEditModal(true);
  };

  const handleUpdateRole = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!editingRole) return;

    try {
      const response = await apiFetch(`/api/portal/user-roles/${editingRole.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setShowEditModal(false);
        setEditingRole(null);
        setFormData({
          user_id: "",
          email: "",
          name: "",
          role: "parent",
          team_id: null,
          family_id: null,
        });
        loadData();
      }
    } catch (error) {
      console.error("Error updating role:", error);
    }
  };

  const handleDeleteRole = async (id: number) => {
    if (!confirm("Remove this role assignment?")) return;

    try {
      const response = await apiFetch(`/api/portal/user-roles/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        loadData();
      }
    } catch (error) {
      console.error("Error deleting role:", error);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-red-100 text-red-800";
      case "coach":
        return "bg-blue-100 text-blue-800";
      case "parent":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

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
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Shield className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white font-[Oswald]">User Roles</h1>
              <p className="text-sm text-gray-500">
                Manage role assignments for portal users
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#00c4ff] hover:bg-[#00a3d9] shadow-lg shadow-[#00c4ff]/20 text-white rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Assign Role
          </button>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="p-6">
            <div className="space-y-4">
              {roles.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No role assignments yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium text-gray-700">
                          Name
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">
                          Email
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">
                          Role
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">
                          Team
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">
                          Family
                        </th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">
                          Assigned
                        </th>
                        <th className="w-20"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {roles.map((role) => (
                        <tr key={role.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4 text-sm text-gray-900">
                            {role.name || "-"}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-900">
                            {role.email || role.user_id}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(
                                role.role
                              )}`}
                            >
                              {role.role}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-900">
                            {role.team_name || "-"}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-900">
                            {role.family_name || "-"}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-500">
                            {formatDate(role.created_at)}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleEditRole(role)}
                                className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteRole(role.id)}
                                className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
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
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2">Role Descriptions</h3>
          <div className="space-y-2 text-sm text-blue-800">
            <div>
              <span className="font-medium">Admin:</span> Full access to all
              portal features and settings
            </div>
            <div>
              <span className="font-medium">Coach:</span> Can manage assigned
              teams, rosters, and events
            </div>
            <div>
              <span className="font-medium">Parent:</span> Can view family
              information and RSVP to events
            </div>
          </div>
        </div>

        {/* Edit Role Modal */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 font-[Oswald]">Edit User Role</h2>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingRole(null);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUpdateRole} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    placeholder="user@example.com"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    User ID
                  </label>
                  <input
                    type="text"
                    value={formData.user_id}
                    onChange={(e) =>
                      setFormData({ ...formData, user_id: e.target.value })
                    }
                    placeholder="Enter user ID (from auth system)"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="Enter user's full name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        role: e.target.value as "admin" | "coach" | "parent",
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="admin">Admin</option>
                    <option value="coach">Coach</option>
                    <option value="parent">Parent</option>
                  </select>
                </div>

                {formData.role === "coach" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Team (Optional)
                    </label>
                    <select
                      value={formData.team_id?.toString() || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          team_id: e.target.value ? parseInt(e.target.value) : null,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select team</option>
                      {teams.map((team) => (
                        <option key={team.id} value={team.id.toString()}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {formData.role === "parent" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Family (Optional)
                    </label>
                    <select
                      value={formData.family_id?.toString() || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          family_id: e.target.value ? parseInt(e.target.value) : null,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select family</option>
                      {families.map((family) => (
                        <option key={family.id} value={family.id.toString()}>
                          {family.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setEditingRole(null);
                    }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#00c4ff] hover:bg-[#00a3d9] shadow-lg shadow-[#00c4ff]/20 text-white rounded-lg font-medium transition-colors"
                  >
                    Update Role
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add Role Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 font-[Oswald]">Assign Role to User</h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddRole} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    placeholder="user@example.com"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    User must have signed in at least once
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    User ID
                  </label>
                  <input
                    type="text"
                    value={formData.user_id}
                    onChange={(e) =>
                      setFormData({ ...formData, user_id: e.target.value })
                    }
                    placeholder="Enter user ID (from auth system)"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Copy from user's profile or auth system
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="Enter user's full name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        role: e.target.value as "admin" | "coach" | "parent",
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="admin">Admin</option>
                    <option value="coach">Coach</option>
                    <option value="parent">Parent</option>
                  </select>
                </div>

                {formData.role === "coach" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Team (Optional)
                    </label>
                    <select
                      value={formData.team_id?.toString() || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          team_id: e.target.value ? parseInt(e.target.value) : null,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select team</option>
                      {teams.map((team) => (
                        <option key={team.id} value={team.id.toString()}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {formData.role === "parent" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Family (Optional)
                    </label>
                    <select
                      value={formData.family_id?.toString() || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          family_id: e.target.value ? parseInt(e.target.value) : null,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select family</option>
                      {families.map((family) => (
                        <option key={family.id} value={family.id.toString()}>
                          {family.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#00c4ff] hover:bg-[#00a3d9] shadow-lg shadow-[#00c4ff]/20 text-white rounded-lg font-medium transition-colors"
                  >
                    Assign Role
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
