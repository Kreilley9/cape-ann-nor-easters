import { useState, useEffect } from "react";
import { PortalLayout } from "@/react-app/components/layout/PortalLayout";
import { Plus, Trash2, Eye, EyeOff, Save, X, Upload, ArrowUp, ArrowDown } from "lucide-react";

interface GalleryPhoto {
  id: number;
  image_key: string;
  caption: string | null;
  order_index: number;
  is_visible: number;
  created_at: string;
}

export default function PortalGalleryManagement() {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState<GalleryPhoto | null>(null);
  const [formData, setFormData] = useState({
    image_key: "",
    caption: "",
    is_visible: true,
  });
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    loadPhotos();
  }, []);

  const loadPhotos = async () => {
    try {
      const response = await fetch("/api/gallery", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setPhotos(data);
      }
    } catch (error) {
      console.error("Error loading photos:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingPhoto(null);
    setFormData({ image_key: "", caption: "", is_visible: true });
    setShowModal(true);
  };

  const handleEdit = (photo: GalleryPhoto) => {
    setEditingPhoto(photo);
    setFormData({
      image_key: photo.image_key,
      caption: photo.caption || "",
      is_visible: photo.is_visible === 1,
    });
    setShowModal(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const uploadData = new FormData();
      uploadData.append("image", file);

      const response = await fetch("/api/gallery/upload-image", {
        method: "POST",
        credentials: "include",
        body: uploadData,
      });

      if (response.ok) {
        const data = await response.json();
        setFormData((prev) => ({ ...prev, image_key: data.image_key }));
      } else {
        alert("Failed to upload image");
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      alert("Failed to upload image");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async () => {
    if (!formData.image_key) {
      alert("Please upload an image");
      return;
    }

    try {
      const url = editingPhoto
        ? `/api/gallery/${editingPhoto.id}`
        : "/api/gallery";
      const method = editingPhoto ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          image_key: formData.image_key,
          caption: formData.caption || null,
          order_index: editingPhoto?.order_index ?? photos.length,
          is_visible: formData.is_visible,
        }),
      });

      if (response.ok) {
        setShowModal(false);
        loadPhotos();
      } else {
        alert("Failed to save photo");
      }
    } catch (error) {
      console.error("Error saving photo:", error);
      alert("Failed to save photo");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this photo?")) return;

    try {
      const response = await fetch(`/api/gallery/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (response.ok) {
        loadPhotos();
      }
    } catch (error) {
      console.error("Error deleting photo:", error);
    }
  };

  const handleToggleVisibility = async (photo: GalleryPhoto) => {
    try {
      const response = await fetch(`/api/gallery/${photo.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          image_key: photo.image_key,
          caption: photo.caption,
          order_index: photo.order_index,
          is_visible: photo.is_visible !== 1,
        }),
      });

      if (response.ok) {
        loadPhotos();
      }
    } catch (error) {
      console.error("Error toggling visibility:", error);
    }
  };

  const handleReorder = async (photo: GalleryPhoto, direction: "up" | "down") => {
    const currentIndex = photos.findIndex((p) => p.id === photo.id);
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= photos.length) return;

    const targetPhoto = photos[targetIndex];

    try {
      // Swap order indices
      await Promise.all([
        fetch(`/api/gallery/${photo.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            image_key: photo.image_key,
            caption: photo.caption,
            order_index: targetPhoto.order_index,
            is_visible: photo.is_visible === 1,
          }),
        }),
        fetch(`/api/gallery/${targetPhoto.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            image_key: targetPhoto.image_key,
            caption: targetPhoto.caption,
            order_index: photo.order_index,
            is_visible: targetPhoto.is_visible === 1,
          }),
        }),
      ]);

      loadPhotos();
    } catch (error) {
      console.error("Error reordering photos:", error);
    }
  };

  const getImageUrl = (imageKey: string) => {
    const key = imageKey.replace("gallery-photos/", "");
    return `/api/gallery/images/${key}`;
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
            PHOTO GALLERY
          </h1>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 bg-[#00c4ff] text-[#0a0f14] font-bold rounded-lg hover:bg-[#00a3d9] transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Photo
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {photos.map((photo, index) => (
            <div
              key={photo.id}
              className={`bg-[rgba(18,26,36,0.8)] border rounded-xl overflow-hidden shadow-[0_0_15px_rgba(0,196,255,0.1)] ${
                photo.is_visible === 1
                  ? "border-[#00c4ff]/30"
                  : "border-gray-600/30 opacity-60"
              }`}
            >
              <div className="relative aspect-video">
                <img
                  src={getImageUrl(photo.image_key)}
                  alt={photo.caption || "Gallery photo"}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 right-2 flex gap-1">
                  <button
                    onClick={() => handleToggleVisibility(photo)}
                    className={`p-2 rounded-lg backdrop-blur-sm transition-colors ${
                      photo.is_visible === 1
                        ? "bg-green-600/80 text-white hover:bg-green-500"
                        : "bg-gray-600/80 text-gray-300 hover:bg-gray-500"
                    }`}
                    title={photo.is_visible === 1 ? "Hide photo" : "Show photo"}
                  >
                    {photo.is_visible === 1 ? (
                      <Eye className="w-4 h-4" />
                    ) : (
                      <EyeOff className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              <div className="p-4">
                {photo.caption && (
                  <p className="text-gray-300 text-sm mb-3 line-clamp-2">{photo.caption}</p>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleReorder(photo, "up")}
                      disabled={index === 0}
                      className="p-2 text-gray-400 hover:text-[#00c4ff] hover:bg-[#00c4ff]/10 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move up"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleReorder(photo, "down")}
                      disabled={index === photos.length - 1}
                      className="p-2 text-gray-400 hover:text-[#00c4ff] hover:bg-[#00c4ff]/10 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move down"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEdit(photo)}
                      className="px-3 py-1.5 text-sm text-[#00c4ff] hover:bg-[#00c4ff]/10 rounded-lg transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(photo.id)}
                      className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {photos.length === 0 && (
            <div className="col-span-full bg-[rgba(18,26,36,0.8)] border border-[#00c4ff]/30 rounded-xl p-12 text-center">
              <p className="text-gray-400">No photos in gallery yet. Add your first photo!</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0f14] border border-[#00c4ff]/30 rounded-xl p-6 max-w-lg w-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white" style={{ fontFamily: "Oswald, sans-serif" }}>
                {editingPhoto ? "EDIT PHOTO" : "ADD PHOTO"}
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
                <label className="block text-sm font-medium text-gray-400 mb-2">Image</label>
                {formData.image_key ? (
                  <div className="relative">
                    <img
                      src={getImageUrl(formData.image_key)}
                      alt="Preview"
                      className="w-full aspect-video object-cover rounded-lg border border-[#00c4ff]/30"
                    />
                    <button
                      onClick={() => setFormData((prev) => ({ ...prev, image_key: "" }))}
                      className="absolute top-2 right-2 p-2 bg-red-600/80 text-white rounded-lg hover:bg-red-500 backdrop-blur-sm"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-[#00c4ff]/30 rounded-lg cursor-pointer hover:border-[#00c4ff]/50 transition-colors bg-[rgba(18,26,36,0.4)]">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      {uploadingImage ? (
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#00c4ff]"></div>
                      ) : (
                        <>
                          <Upload className="w-10 h-10 mb-3 text-gray-400" />
                          <p className="text-sm text-gray-400">Click to upload image</p>
                        </>
                      )}
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={uploadingImage}
                    />
                  </label>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Caption (optional)</label>
                <textarea
                  value={formData.caption}
                  onChange={(e) => setFormData({ ...formData, caption: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 bg-[rgba(18,26,36,0.8)] border border-[#00c4ff]/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#00c4ff] focus:shadow-[0_0_10px_rgba(0,196,255,0.2)] resize-none"
                  placeholder="Add a caption..."
                />
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
                {editingPhoto ? "Save Changes" : "Add Photo"}
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
