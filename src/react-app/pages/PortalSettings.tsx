import { useState, useEffect } from "react";
import { PortalLayout } from "@/react-app/components/layout/PortalLayout";
import { 
  Save, Eye, AlertCircle, Info, AlertTriangle, CheckCircle, 
  Users, Shield, Search, UserCog, FileText, MessageSquare, 
  Calendar, UserPlus, X
} from "lucide-react";

interface BannerConfig {
  enabled: boolean;
  text: string;
  link: string;
  type: "info" | "warning" | "success" | "alert";
}

interface UserRole {
  id: number;
  user_id: string;
  email: string;
  name: string;
  role: string;
  team_id: number | null;
  family_id: number | null;
}

interface UserPermissions {
  recruiting_access: "full" | "limited" | "none";
  recruiting_age_groups: string[];
  messaging_send: boolean;
  documents_upload: boolean;
  documents_download: boolean;
  events_manage: boolean;
}

const bannerTypes = [
  { value: "info", label: "Info (Blue)", icon: Info, color: "bg-blue-600" },
  { value: "warning", label: "Warning (Yellow)", icon: AlertTriangle, color: "bg-yellow-500" },
  { value: "success", label: "Success (Green)", icon: CheckCircle, color: "bg-green-600" },
  { value: "alert", label: "Alert (Red)", icon: AlertCircle, color: "bg-red-600" },
];

const ageGroups = ["5U", "6U", "7U", "8U", "9U", "10U", "11U", "12U", "13U", "14U", "15U", "16U", "17U", "18U"];

const getDefaultPermissionsByRole = (role: string): UserPermissions => {
  // Admins and coaches get full access by default
  if (role === "admin" || role === "coach") {
    return {
      recruiting_access: "full",
      recruiting_age_groups: [],
      messaging_send: true,
      documents_upload: true,
      documents_download: true,
      events_manage: true,
    };
  }
  
  // Parents get restricted access by default
  return {
    recruiting_access: "none",
    recruiting_age_groups: [],
    messaging_send: false,
    documents_upload: false,
    documents_download: true, // Parents can download documents
    events_manage: false,
  };
};

export default function PortalSettings() {
  const [banner, setBanner] = useState<BannerConfig>({
    enabled: false,
    text: "",
    link: "",
    type: "info",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Permissions state
  const [users, setUsers] = useState<UserRole[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [permissions, setPermissions] = useState<UserPermissions>(getDefaultPermissionsByRole("parent"));
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [permissionsSaving, setPermissionsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadSettings();
    loadUsers();
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      loadUserPermissions(selectedUserId);
    }
  }, [selectedUserId]);

  const loadSettings = async () => {
    try {
      const response = await fetch("/api/portal/site-config", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setBanner({
          enabled: data.banner_enabled === "1",
          text: data.banner_text || "",
          link: data.banner_link || "",
          type: (data.banner_type as BannerConfig["type"]) || "info",
        });
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await fetch("/api/portal/user-roles", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        // Deduplicate users by user_id (a user might have multiple roles)
        const uniqueUsers = data.reduce((acc: UserRole[], curr: UserRole) => {
          if (!acc.find(u => u.user_id === curr.user_id)) {
            acc.push(curr);
          }
          return acc;
        }, []);
        setUsers(uniqueUsers);
      }
    } catch (error) {
      console.error("Error loading users:", error);
    }
  };

  const loadUserPermissions = async (userId: string) => {
    setPermissionsLoading(true);
    try {
      const response = await fetch(`/api/portal/user-permissions/${encodeURIComponent(userId)}`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setPermissions({
          recruiting_access: data.recruiting_access || "full",
          recruiting_age_groups: data.recruiting_age_groups ? JSON.parse(data.recruiting_age_groups) : [],
          messaging_send: data.messaging_send !== "false",
          documents_upload: data.documents_upload !== "false",
          documents_download: data.documents_download !== "false",
          events_manage: data.events_manage !== "false",
        });
      } else {
        // No permissions set - use role-based defaults
        const user = users.find(u => u.user_id === userId);
        const roleDefaults = getDefaultPermissionsByRole(user?.role || "parent");
        setPermissions(roleDefaults);
      }
    } catch (error) {
      console.error("Error loading permissions:", error);
      const user = users.find(u => u.user_id === userId);
      const roleDefaults = getDefaultPermissionsByRole(user?.role || "parent");
      setPermissions(roleDefaults);
    } finally {
      setPermissionsLoading(false);
    }
  };

  const savePermissions = async () => {
    if (!selectedUserId) return;
    setPermissionsSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/portal/user-permissions/${encodeURIComponent(selectedUserId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          recruiting_access: permissions.recruiting_access,
          recruiting_age_groups: JSON.stringify(permissions.recruiting_age_groups),
          messaging_send: permissions.messaging_send.toString(),
          documents_upload: permissions.documents_upload.toString(),
          documents_download: permissions.documents_download.toString(),
          events_manage: permissions.events_manage.toString(),
        }),
      });
      if (response.ok) {
        setMessage({ type: "success", text: "Permissions saved!" });
      } else {
        setMessage({ type: "error", text: "Failed to save permissions" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Error saving permissions" });
    } finally {
      setPermissionsSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const saveBanner = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/portal/site-config/banner", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          enabled: banner.enabled,
          text: banner.text,
          link: banner.link,
          type: banner.type,
        }),
      });
      if (response.ok) {
        setMessage({ type: "success", text: "Banner settings saved!" });
      } else {
        setMessage({ type: "error", text: "Failed to save settings" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Error saving settings" });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const getPreviewStyles = () => {
    switch (banner.type) {
      case "warning":
        return "bg-yellow-500 text-yellow-900";
      case "success":
        return "bg-green-600 text-white";
      case "alert":
        return "bg-red-600 text-white";
      default:
        return "bg-blue-600 text-white";
    }
  };

  const PreviewIcon = bannerTypes.find((t) => t.value === banner.type)?.icon || Info;

  const filteredUsers = users.filter(u => 
    (u.name?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
    (u.email?.toLowerCase() || "").includes(searchQuery.toLowerCase())
  );

  const selectedUser = users.find(u => u.user_id === selectedUserId);

  const toggleAgeGroup = (ag: string) => {
    setPermissions(prev => ({
      ...prev,
      recruiting_age_groups: prev.recruiting_age_groups.includes(ag)
        ? prev.recruiting_age_groups.filter(g => g !== ag)
        : [...prev.recruiting_age_groups, ag]
    }));
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
      <div className="max-w-4xl mx-auto">
        <h1
          className="text-2xl md:text-3xl font-bold text-white mb-6"
          style={{ fontFamily: "Oswald, sans-serif" }}
        >
          ADMIN TOOLS
        </h1>

        {message && (
          <div
            className={`mb-6 p-4 rounded-lg border ${
              message.type === "success"
                ? "bg-green-900/30 border-green-500/50 text-green-300"
                : "bg-red-900/30 border-red-500/50 text-red-300"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Homepage Banner Section */}
        <div className="bg-[rgba(18,26,36,0.8)] border border-[#00c4ff]/30 rounded-xl p-6 shadow-[0_0_15px_rgba(0,196,255,0.1)] mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white" style={{ fontFamily: "Oswald, sans-serif" }}>
              HOMEPAGE BANNER
            </h2>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={banner.enabled}
                onChange={(e) => setBanner({ ...banner, enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00c4ff]"></div>
              <span className="ml-3 text-sm font-medium text-gray-300">
                {banner.enabled ? "Enabled" : "Disabled"}
              </span>
            </label>
          </div>

          <div className="space-y-4">
            {/* Banner Type */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Banner Type</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {bannerTypes.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setBanner({ ...banner, type: type.value as BannerConfig["type"] })}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                      banner.type === type.value
                        ? "border-[#00c4ff] bg-[#00c4ff]/20 text-white"
                        : "border-gray-600 text-gray-400 hover:border-gray-500"
                    }`}
                  >
                    <div className={`w-3 h-3 rounded-full ${type.color}`}></div>
                    <span className="text-sm">{type.label.split(" ")[0]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Banner Text */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Banner Message</label>
              <input
                type="text"
                value={banner.text}
                onChange={(e) => setBanner({ ...banner, text: e.target.value })}
                placeholder="Enter your announcement message..."
                className="w-full px-4 py-3 bg-[#0a0f14] border border-[#00c4ff]/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#00c4ff] focus:shadow-[0_0_10px_rgba(0,196,255,0.2)]"
              />
            </div>

            {/* Banner Link */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Link URL (optional)
              </label>
              <input
                type="text"
                value={banner.link}
                onChange={(e) => setBanner({ ...banner, link: e.target.value })}
                placeholder="https://example.com/more-info"
                className="w-full px-4 py-3 bg-[#0a0f14] border border-[#00c4ff]/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#00c4ff] focus:shadow-[0_0_10px_rgba(0,196,255,0.2)]"
              />
              <p className="mt-1 text-xs text-gray-500">
                If provided, the banner will be clickable and link to this URL
              </p>
            </div>

            {/* Preview */}
            {banner.text && (
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  Preview
                </label>
                <div className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg ${getPreviewStyles()}`}>
                  <PreviewIcon className="w-5 h-5 flex-shrink-0" />
                  <span className="font-medium text-center">{banner.text}</span>
                </div>
              </div>
            )}

            {/* Save Button */}
            <div className="flex justify-end pt-4">
              <button
                onClick={saveBanner}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-[#00c4ff] text-[#0a0f14] font-bold rounded-lg hover:bg-[#00a3d9] transition-colors disabled:opacity-50"
              >
                <Save className="w-5 h-5" />
                {saving ? "Saving..." : "Save Banner Settings"}
              </button>
            </div>
          </div>
        </div>

        {/* User Permissions Section */}
        <div className="bg-[rgba(18,26,36,0.8)] border border-[#00c4ff]/30 rounded-xl p-6 shadow-[0_0_15px_rgba(0,196,255,0.1)]">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="w-6 h-6 text-[#00c4ff]" />
            <h2 className="text-xl font-bold text-white" style={{ fontFamily: "Oswald, sans-serif" }}>
              USER PERMISSIONS
            </h2>
          </div>

          {/* User Search/Select */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-400 mb-2">Select User</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or email..."
                className="w-full pl-10 pr-4 py-3 bg-[#0a0f14] border border-[#00c4ff]/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#00c4ff] focus:shadow-[0_0_10px_rgba(0,196,255,0.2)]"
              />
            </div>
            {searchQuery && filteredUsers.length > 0 && (
              <div className="mt-2 bg-[#0a0f14] border border-[#00c4ff]/30 rounded-lg max-h-48 overflow-y-auto">
                {filteredUsers.map((user) => (
                  <button
                    key={user.user_id}
                    onClick={() => {
                      setSelectedUserId(user.user_id);
                      setSearchQuery("");
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-[#00c4ff]/10 border-b border-[#00c4ff]/10 last:border-b-0"
                  >
                    <div className="text-white font-medium">{user.name || "Unknown"}</div>
                    <div className="text-gray-400 text-sm">{user.email}</div>
                  </button>
                ))}
              </div>
            )}
            {searchQuery && filteredUsers.length === 0 && (
              <div className="mt-2 text-gray-400 text-sm">No users found</div>
            )}
          </div>

          {/* Selected User Display */}
          {selectedUser && (
            <div className="mb-6 p-4 bg-[#0a0f14] rounded-lg border border-[#00c4ff]/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <UserCog className="w-8 h-8 text-[#00c4ff]" />
                  <div>
                    <div className="text-white font-bold">{selectedUser.name || "Unknown"}</div>
                    <div className="text-gray-400 text-sm">{selectedUser.email}</div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedUserId("")}
                  className="text-gray-400 hover:text-white p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Permissions Editor */}
          {selectedUserId && !permissionsLoading && (
            <div className="space-y-6">
              {/* Recruiting Access */}
              <div className="p-4 bg-[#0a0f14]/50 rounded-lg border border-[#00c4ff]/20">
                <div className="flex items-center gap-2 mb-3">
                  <UserPlus className="w-5 h-5 text-[#00c4ff]" />
                  <h3 className="text-white font-semibold">Recruiting Access</h3>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {["full", "limited", "none"].map((level) => (
                    <button
                      key={level}
                      onClick={() => setPermissions({ ...permissions, recruiting_access: level as "full" | "limited" | "none" })}
                      className={`px-4 py-2 rounded-lg border transition-all capitalize ${
                        permissions.recruiting_access === level
                          ? "border-[#00c4ff] bg-[#00c4ff]/20 text-white"
                          : "border-gray-600 text-gray-400 hover:border-gray-500"
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
                {permissions.recruiting_access === "limited" && (
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Allowed Age Groups</label>
                    <div className="flex flex-wrap gap-2">
                      {ageGroups.map((ag) => (
                        <button
                          key={ag}
                          onClick={() => toggleAgeGroup(ag)}
                          className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                            permissions.recruiting_age_groups.includes(ag)
                              ? "border-[#00c4ff] bg-[#00c4ff]/20 text-white"
                              : "border-gray-600 text-gray-400 hover:border-gray-500"
                          }`}
                        >
                          {ag}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Messaging */}
              <div className="p-4 bg-[#0a0f14]/50 rounded-lg border border-[#00c4ff]/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-[#00c4ff]" />
                    <h3 className="text-white font-semibold">Can Send Messages</h3>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissions.messaging_send}
                      onChange={(e) => setPermissions({ ...permissions, messaging_send: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00c4ff]"></div>
                  </label>
                </div>
                <p className="text-gray-500 text-sm mt-2">Allow this user to post messages on team and coach message boards</p>
              </div>

              {/* Documents */}
              <div className="p-4 bg-[#0a0f14]/50 rounded-lg border border-[#00c4ff]/20">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-5 h-5 text-[#00c4ff]" />
                  <h3 className="text-white font-semibold">Document Access</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300">Can Upload Documents</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={permissions.documents_upload}
                        onChange={(e) => setPermissions({ ...permissions, documents_upload: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00c4ff]"></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300">Can Download Documents</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={permissions.documents_download}
                        onChange={(e) => setPermissions({ ...permissions, documents_download: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00c4ff]"></div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Events */}
              <div className="p-4 bg-[#0a0f14]/50 rounded-lg border border-[#00c4ff]/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-[#00c4ff]" />
                    <h3 className="text-white font-semibold">Can Manage Events</h3>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissions.events_manage}
                      onChange={(e) => setPermissions({ ...permissions, events_manage: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00c4ff]"></div>
                  </label>
                </div>
                <p className="text-gray-500 text-sm mt-2">Allow this user to create, edit, and delete events on the schedule</p>
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-4">
                <button
                  onClick={savePermissions}
                  disabled={permissionsSaving}
                  className="flex items-center gap-2 px-6 py-3 bg-[#00c4ff] text-[#0a0f14] font-bold rounded-lg hover:bg-[#00a3d9] transition-colors disabled:opacity-50"
                >
                  <Save className="w-5 h-5" />
                  {permissionsSaving ? "Saving..." : "Save Permissions"}
                </button>
              </div>
            </div>
          )}

          {selectedUserId && permissionsLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#00c4ff]"></div>
            </div>
          )}

          {!selectedUserId && (
            <div className="text-center py-8 text-gray-400">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Search and select a user above to manage their permissions</p>
            </div>
          )}
        </div>
      </div>
    </PortalLayout>
  );
}
