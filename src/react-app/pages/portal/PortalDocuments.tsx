import { useEffect, useState } from "react";
import { PortalLayout } from "@/react-app/components/layout/PortalLayout";
import { useRoles } from "@/react-app/contexts/RoleContext";
import { Download, Trash2, FileText, Plus } from "lucide-react";
import { formatDateCustom } from "@/react-app/utils/dateFormat";
import { apiFetch } from "@/react-app/lib/api";

interface Document {
  id: number;
  team_id?: number;
  family_id?: number;
  title: string;
  description?: string;
  file_key: string;
  file_name: string;
  file_size: number;
  uploaded_by_user_id: string;
  team_name?: string;
  family_name?: string;
  created_at: string;
}

interface Team {
  id: number;
  name: string;
}

function PortalDocuments() {
  const { isAdmin: isAdminRole, isCoach, isParent, familyId } = useRoles();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    title: "",
    description: "",
    team_id: "",
    file: null as File | null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [uploadError, setUploadError] = useState("");

  useEffect(() => {
    loadDocuments();
    if (isParent) {
      loadTeams();
    }
  }, []);

  const loadDocuments = async () => {
    try {
      const response = await apiFetch("/api/portal/documents", {
      });
      if (response.ok) {
        const data = await response.json();
        setDocuments(data);
      }
    } catch (error) {
      console.error("Error loading documents:", error);
    } finally {
      setIsLoading(false);
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

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError("");

    if (!uploadForm.file || !uploadForm.title || !uploadForm.team_id) {
      setUploadError("Please fill in all required fields");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", uploadForm.file);
      formData.append("title", uploadForm.title);
      formData.append("description", uploadForm.description);
      formData.append("team_id", uploadForm.team_id);

      const response = await apiFetch("/api/portal/documents", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        setShowUploadModal(false);
        setUploadForm({
          title: "",
          description: "",
          team_id: "",
          file: null,
        });
        await loadDocuments();
      } else {
        const error = await response.json();
        setUploadError(error.error || "Failed to upload document");
      }
    } catch (error) {
      console.error("Error uploading document:", error);
      setUploadError("Failed to upload document");
    }
  };

  const handleDownload = async (docId: number, fileName: string) => {
    try {
      const response = await apiFetch(`/api/portal/documents/${docId}/download`, {
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Download failed:", response.status, errorText);
        alert(`Failed to download: ${response.status} ${response.statusText}`);
        return;
      }

      // Check content type header
      const contentType = response.headers.get("Content-Type") || "";

      // If we got JSON error response instead of file
      if (contentType.includes("application/json")) {
        const json = await response.json();
        console.error("Got JSON error:", json);
        alert("Download error: " + (json.error || "Unknown error"));
        return;
      }

      const blob = await response.blob();

      if (blob.size === 0) {
        alert("Download error - file is empty. It may not exist in storage.");
        return;
      }

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);
    } catch (error) {
      console.error("Error downloading document:", error);
      alert("Failed to download document: " + (error instanceof Error ? error.message : "Unknown error"));
    }
  };

  const handleDelete = async (docId: number) => {
    if (!confirm("Are you sure you want to delete this document?")) return;

    try {
      const response = await apiFetch(`/api/portal/documents/${docId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await loadDocuments();
      }
    } catch (error) {
      console.error("Error deleting document:", error);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const formatDate = (dateStr: string) => {
    return formatDateCustom(dateStr, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const canDeleteDocument = (doc: Document) => {
    if (isAdminRole) return true;
    if (isParent && doc.family_id === familyId) return true;
    return false;
  };

  return (
    <PortalLayout>
      <div className="space-y-6">
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
              <h1 className="text-3xl font-bold text-white font-[Oswald] tracking-wide">Documents</h1>
              <p className="text-gray-400 mt-1">
                {isParent
                  ? "Upload and manage documents for your teams"
                  : isCoach
                  ? "View documents from your teams"
                  : "View and manage all team documents"}
              </p>
            </div>
            {isParent && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[#00c4ff] hover:bg-[#00a8dd] text-black font-semibold rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Upload Document
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-400">Loading documents...</p>
          </div>
        ) : documents.length === 0 ? (
          <div
            className="text-center py-12 rounded-lg border"
            style={{
              background: "rgba(18, 26, 36, 0.6)",
              borderColor: "#00c4ff",
            }}
          >
            <FileText className="w-12 h-12 mx-auto text-gray-500 mb-4" />
            <p className="text-gray-400">No documents available</p>
            {isParent && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="mt-4 text-[#00c4ff] hover:text-[#00a8dd] underline"
              >
                Upload your first document
              </button>
            )}
          </div>
        ) : (
          <div
            className="rounded-lg border"
            style={{
              background: "rgba(18, 26, 36, 0.8)",
              borderColor: "#00c4ff",
            }}
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead
                  className="border-b"
                  style={{ borderColor: "#00c4ff33" }}
                >
                  <tr>
                    <th className="text-left p-4 font-semibold text-gray-400 text-sm">Document</th>
                    <th className="text-left p-4 font-semibold text-gray-400 text-sm">Team</th>
                    {(isAdminRole || isCoach) && (
                      <th className="text-left p-4 font-semibold text-gray-400 text-sm">Family</th>
                    )}
                    <th className="text-left p-4 font-semibold text-gray-400 text-sm">Size</th>
                    <th className="text-left p-4 font-semibold text-gray-400 text-sm">Uploaded</th>
                    <th className="text-right p-4 font-semibold text-gray-400 text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#00c4ff]/10">
                  {documents.map((doc) => (
                    <tr key={doc.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-4">
                        <div>
                          <div className="font-medium text-white">{doc.title}</div>
                          {doc.description && (
                            <div className="text-sm text-gray-400">
                              {doc.description}
                            </div>
                          )}
                          <div className="text-xs text-gray-500 mt-1">
                            {doc.file_name}
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-gray-300">{doc.team_name || "—"}</span>
                      </td>
                      {(isAdminRole || isCoach) && (
                        <td className="p-4">
                          <span className="text-sm text-gray-300">
                            {doc.family_name || "—"}
                          </span>
                        </td>
                      )}
                      <td className="p-4">
                        <span className="text-sm text-gray-300">
                          {formatFileSize(doc.file_size)}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-gray-300">
                          {formatDate(doc.created_at)}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleDownload(doc.id, doc.file_name)}
                            className="p-2 text-gray-400 hover:text-[#00c4ff] rounded-md transition-colors"
                            title="Download"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          {canDeleteDocument(doc) && (
                            <button
                              onClick={() => handleDelete(doc.id)}
                              className="p-2 text-gray-400 hover:text-red-400 rounded-md transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div
            className="rounded-lg p-6 w-full max-w-md border"
            style={{
              background: "rgba(18, 26, 36, 0.98)",
              borderColor: "#00c4ff",
            }}
          >
            <h2 className="text-xl font-semibold text-white font-[Oswald] mb-4">Upload Document</h2>
            <form onSubmit={handleUploadDocument} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={uploadForm.title}
                  onChange={(e) =>
                    setUploadForm({ ...uploadForm, title: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-[#00c4ff]/30 rounded-md bg-black/40 text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Description
                </label>
                <textarea
                  value={uploadForm.description}
                  onChange={(e) =>
                    setUploadForm({ ...uploadForm, description: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-[#00c4ff]/30 rounded-md bg-black/40 text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Team <span className="text-red-400">*</span>
                </label>
                <select
                  value={uploadForm.team_id}
                  onChange={(e) =>
                    setUploadForm({ ...uploadForm, team_id: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-[#00c4ff]/30 rounded-md bg-black/40 text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                  required
                >
                  <option value="">Select team</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  File <span className="text-red-400">*</span>
                </label>
                <input
                  type="file"
                  onChange={(e) =>
                    setUploadForm({
                      ...uploadForm,
                      file: e.target.files?.[0] || null,
                    })
                  }
                  className="w-full px-3 py-2 border border-[#00c4ff]/30 rounded-md bg-black/40 text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                  required
                />
              </div>

              {uploadError && (
                <div className="text-sm text-red-400">{uploadError}</div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadModal(false);
                    setUploadError("");
                    setUploadForm({
                      title: "",
                      description: "",
                      team_id: "",
                      file: null,
                    });
                  }}
                  className="px-4 py-2 border border-gray-600 text-gray-300 hover:bg-white/5 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#00c4ff] hover:bg-[#00a8dd] text-black font-semibold rounded-md transition-colors"
                >
                  Upload
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}

export default PortalDocuments;
