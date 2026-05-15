import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { PortalLayout } from "@/react-app/components/layout/PortalLayout";
import { Upload, Download, Trash2, FileText, FolderOpen, ArrowLeft } from "lucide-react";
import { formatDate } from "@/react-app/utils/dateFormat";
import { apiFetch } from "@/react-app/lib/api";

interface CoachesDocument {
  id: number;
  title: string;
  description: string | null;
  category: string | null;
  file_key: string;
  file_name: string;
  file_size: number | null;
  uploaded_by_name: string | null;
  created_at: string;
}

const CATEGORIES = [
  "Plays - Offense",
  "Plays - Defense",
  "Drills - Fundamentals",
  "Drills - Team",
  "Strategy & Game Plans",
  "Training Materials",
  "Other",
];

export function PortalCoachesDocuments() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<CoachesDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");

  useEffect(() => {
    loadDocuments();
  }, []);

  async function loadDocuments() {
    try {
      const response = await apiFetch("/api/portal/coaches/documents", {
      });
      if (response.ok) {
        const data = await response.json();
        setDocuments(data);
      }
    } catch (error) {
      console.error("Failed to load documents:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload() {
    if (!selectedFile || !title.trim()) {
      alert("Please provide a title and select a file");
      return;
    }

    setUploading(true);
    try {
      // Upload file to R2
      const formData = new FormData();
      formData.append("file", selectedFile);

      const uploadResponse = await apiFetch("/api/portal/coaches/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error("File upload failed");
      }

      const { file_key } = await uploadResponse.json();

      // Create document record
      const createResponse = await apiFetch("/api/portal/coaches/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          category: category || null,
          file_key,
          file_name: selectedFile.name,
          file_size: selectedFile.size,
        }),
      });

      if (createResponse.ok) {
        setUploadOpen(false);
        resetForm();
        loadDocuments();
      }
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Failed to upload document");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(doc: CoachesDocument) {
    if (!confirm(`Delete "${doc.title}"?`)) return;

    try {
      const response = await apiFetch(`/api/portal/coaches/documents/${doc.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        loadDocuments();
      }
    } catch (error) {
      console.error("Delete failed:", error);
    }
  }

  async function handleDownload(doc: CoachesDocument) {
    try {
      const response = await apiFetch(
        `/api/portal/coaches/documents/download/${doc.file_key}`,
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

  function resetForm() {
    setTitle("");
    setDescription("");
    setCategory("");
    setSelectedFile(null);
  }

  function formatFileSize(bytes: number | null): string {
    if (!bytes) return "Unknown";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  const filteredDocuments =
    filterCategory === "all"
      ? documents
      : documents.filter((d) => d.category === filterCategory);

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
              Coaches Portal - Documents
            </h1>
            <p className="text-gray-400 mt-1">
              Share plays, drills, and coaching resources with your staff
            </p>
          </div>
          <button
            onClick={() => setUploadOpen(true)}
            className="px-4 py-2 bg-[#00c4ff] hover:bg-[#00a8dd] text-black font-semibold rounded-lg transition-colors flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Upload Document
          </button>
        </div>

        {/* Filter */}
        <div className="mt-4 flex items-center gap-3">
          <label className="text-gray-400 text-sm">Filter:</label>
          <select
            value={filterCategory}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterCategory(e.target.value)}
            className="px-3 py-2 bg-black/40 border border-[#00c4ff]/30 text-white rounded-lg w-64"
          >
            <option value="all">All Categories</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Documents Grid */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : filteredDocuments.length === 0 ? (
        <div
          className="text-center py-12 rounded-lg border"
          style={{
            background: "rgba(18, 26, 36, 0.6)",
            borderColor: "#00c4ff",
          }}
        >
          <FolderOpen className="w-16 h-16 mx-auto text-gray-500 mb-4" />
          <p className="text-gray-400">No documents found</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredDocuments.map((doc) => (
            <div
              key={doc.id}
              className="rounded-lg border p-4"
              style={{
                background: "rgba(18, 26, 36, 0.6)",
                borderColor: "#00c4ff",
              }}
            >
              <div className="flex items-start gap-3">
                <FileText className="w-8 h-8 text-[#00c4ff] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white truncate">
                    {doc.title}
                  </h3>
                  {doc.category && (
                    <p className="text-xs text-[#00c4ff] mt-1">{doc.category}</p>
                  )}
                  {doc.description && (
                    <p className="text-sm text-gray-400 mt-2 line-clamp-2">
                      {doc.description}
                    </p>
                  )}
                  <div className="text-xs text-gray-500 mt-2 space-y-1">
                    <div>{doc.file_name}</div>
                    <div>
                      {formatFileSize(doc.file_size)} • Uploaded by{" "}
                      {doc.uploaded_by_name || "Unknown"}
                    </div>
                    <div>
                      {formatDate(doc.created_at)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => handleDownload(doc)}
                  className="flex-1 px-3 py-2 border border-[#00c4ff]/30 text-[#00c4ff] hover:bg-[#00c4ff]/10 rounded-lg transition-colors text-sm flex items-center justify-center gap-1"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
                <button
                  onClick={() => handleDelete(doc)}
                  className="px-3 py-2 border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors text-sm"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Dialog */}
      {uploadOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0f14] border border-[#00c4ff]/30 rounded-lg max-w-2xl w-full p-6">
            <div className="mb-6">
              <h2 className="text-white font-[Oswald] text-xl mb-2">Upload Document</h2>
              <p className="text-gray-400 text-sm">Share a play, drill, or coaching resource</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm block mb-1">Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
                  placeholder="e.g., Double Reverse Play"
                  className="w-full px-3 py-2 bg-black/40 border border-[#00c4ff]/30 text-white rounded-lg"
                />
              </div>

              <div>
                <label className="text-gray-400 text-sm block mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-black/40 border border-[#00c4ff]/30 text-white rounded-lg"
                >
                  <option value="">Select category...</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-gray-400 text-sm block mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                  placeholder="Brief description..."
                  className="w-full px-3 py-2 bg-black/40 border border-[#00c4ff]/30 text-white rounded-lg"
                  rows={3}
                />
              </div>

              <div>
                <label className="text-gray-400 text-sm block mb-1">File *</label>
                <input
                  type="file"
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setSelectedFile(e.target.files?.[0] || null)
                  }
                  className="w-full px-3 py-2 bg-black/40 border border-[#00c4ff]/30 text-white rounded-lg"
                />
                {selectedFile && (
                  <p className="text-sm text-gray-400 mt-1">
                    {selectedFile.name} ({formatFileSize(selectedFile.size)})
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setUploadOpen(false);
                  resetForm();
                }}
                className="px-4 py-2 border border-gray-600 text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading || !title.trim() || !selectedFile}
                className="px-4 py-2 bg-[#00c4ff] hover:bg-[#00a8dd] text-black rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? "Uploading..." : "Upload"}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </PortalLayout>
  );
}
