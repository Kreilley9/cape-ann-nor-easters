import { useState, useEffect } from "react";
import { PortalLayout } from "@/react-app/components/layout/PortalLayout";
import { Plus, Edit2, Trash2, Eye, EyeOff, Save, X, Upload } from "lucide-react";
import { formatDateTime } from "@/react-app/utils/dateFormat";

interface NewsPost {
  id: number;
  title: string;
  content: string;
  author_name: string | null;
  is_published: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  image_key: string | null;
  images?: Array<{
    id: number;
    image_key: string;
    caption: string | null;
    order_index: number;
  }>;
}

export default function PortalNews() {
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPost, setEditingPost] = useState<NewsPost | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    is_published: false,
    image_key: null as string | null,
    images: [] as Array<{ image_key: string; caption: string }>,
  });
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    try {
      const response = await fetch("/api/portal/news-posts", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setPosts(data);
      }
    } catch (error) {
      console.error("Error loading posts:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingPost(null);
    setFormData({ title: "", content: "", is_published: false, image_key: null, images: [] });
    setShowModal(true);
  };

  const handleEdit = (post: NewsPost) => {
    setEditingPost(post);
    setFormData({
      title: post.title,
      content: post.content,
      is_published: post.is_published === 1,
      image_key: post.image_key,
      images: post.images?.map(img => ({ image_key: img.image_key, caption: img.caption || "" })) || [],
    });
    setShowModal(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/portal/news-posts/upload-image", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setFormData((prev) => ({ 
          ...prev, 
          images: [...prev.images, { image_key: data.image_key, caption: "" }]
        }));
      } else {
        const error = await response.json();
        console.error("Upload failed:", error);
        alert(`Failed to upload image: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      alert(`Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const handleUpdateCaption = (index: number, caption: string) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.map((img, i) => i === index ? { ...img, caption } : img)
    }));
  };

  const handleMoveImage = (index: number, direction: 'up' | 'down') => {
    const newImages = [...formData.images];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newImages.length) return;
    
    [newImages[index], newImages[targetIndex]] = [newImages[targetIndex], newImages[index]];
    setFormData((prev) => ({ ...prev, images: newImages }));
  };

  const handleSave = async () => {
    // Validate required fields
    if (!formData.title.trim()) {
      alert("Please enter a title for the post");
      return;
    }
    if (!formData.content.trim()) {
      alert("Please enter content for the post");
      return;
    }

    try {
      const url = editingPost
        ? `/api/portal/news-posts/${editingPost.id}`
        : "/api/portal/news-posts";
      const method = editingPost ? "PUT" : "POST";

      console.log("Submitting news post:", { url, method, data: formData });

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(formData),
      });

      console.log("Response status:", response.status);

      if (response.ok) {
        setShowModal(false);
        loadPosts();
        alert("Post saved successfully!");
      } else {
        const errorData = await response.json();
        console.error("Server error:", errorData);
        alert(`Failed to save post: ${errorData.error || 'Unknown error'}\n${errorData.details || ''}`);
      }
    } catch (error) {
      console.error("Error saving post:", error);
      alert(`Error saving post: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this post?")) return;

    try {
      const response = await fetch(`/api/portal/news-posts/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (response.ok) {
        loadPosts();
      }
    } catch (error) {
      console.error("Error deleting post:", error);
    }
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
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1
            className="text-2xl md:text-3xl font-bold text-white"
            style={{ fontFamily: "Oswald, sans-serif" }}
          >
            NEWS POSTS
          </h1>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 bg-[#00c4ff] text-[#0a0f14] font-bold rounded-lg hover:bg-[#00a3d9] transition-colors"
          >
            <Plus className="w-5 h-5" />
            New Post
          </button>
        </div>

        <div className="space-y-4">
          {posts.map((post) => (
            <div
              key={post.id}
              className="bg-[rgba(18,26,36,0.8)] border border-[#00c4ff]/30 rounded-xl p-6 shadow-[0_0_15px_rgba(0,196,255,0.1)]"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-xl font-bold text-white" style={{ fontFamily: "Oswald, sans-serif" }}>
                      {post.title}
                    </h2>
                    {post.is_published ? (
                      <span className="flex items-center gap-1 px-2 py-1 bg-green-600/20 text-green-400 text-xs font-medium rounded border border-green-500/30">
                        <Eye className="w-3 h-3" />
                        Published
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-2 py-1 bg-gray-600/20 text-gray-400 text-xs font-medium rounded border border-gray-500/30">
                        <EyeOff className="w-3 h-3" />
                        Draft
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-400 mb-3">
                    {post.author_name && <span>By {post.author_name}</span>}
                    {post.published_at && (
                      <span className="ml-3">Published {formatDateTime(post.published_at)}</span>
                    )}
                    {!post.published_at && (
                      <span className="ml-3">Created {formatDateTime(post.created_at)}</span>
                    )}
                  </div>
                  <p className="text-gray-300 line-clamp-3">{post.content}</p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => handleEdit(post)}
                    className="p-2 text-[#00c4ff] hover:bg-[#00c4ff]/10 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(post.id)}
                    className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {posts.length === 0 && (
            <div className="bg-[rgba(18,26,36,0.8)] border border-[#00c4ff]/30 rounded-xl p-12 text-center">
              <p className="text-gray-400">No news posts yet. Create your first post to get started!</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0f14] border border-[#00c4ff]/30 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white" style={{ fontFamily: "Oswald, sans-serif" }}>
                {editingPost ? "EDIT POST" : "NEW POST"}
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
                <label className="block text-sm font-medium text-gray-400 mb-2">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-3 bg-[rgba(18,26,36,0.8)] border border-[#00c4ff]/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#00c4ff] focus:shadow-[0_0_10px_rgba(0,196,255,0.2)]"
                  placeholder="Enter post title..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Images (optional)</label>
                <div className="space-y-3">
                  {formData.images.length > 0 && (
                    <div className="space-y-3">
                      {formData.images.map((image, index) => (
                        <div key={index} className="relative bg-[rgba(18,26,36,0.8)] border border-[#00c4ff]/30 rounded-lg p-3">
                          <div className="flex gap-3">
                            <img
                              src={`/api/public/news-images/${image.image_key.replace('news-images/', '')}`}
                              alt={`Image ${index + 1}`}
                              className="w-32 h-32 object-cover rounded-lg border border-[#00c4ff]/30"
                            />
                            <div className="flex-1 space-y-2">
                              <input
                                type="text"
                                value={image.caption}
                                onChange={(e) => handleUpdateCaption(index, e.target.value)}
                                placeholder="Add caption (optional)..."
                                className="w-full px-3 py-2 bg-[rgba(18,26,36,0.8)] border border-[#00c4ff]/30 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-[#00c4ff]"
                              />
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleMoveImage(index, 'up')}
                                  disabled={index === 0}
                                  className="px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-500 disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                  ↑ Move Up
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveImage(index, 'down')}
                                  disabled={index === formData.images.length - 1}
                                  className="px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-500 disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                  ↓ Move Down
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveImage(index)}
                                  className="ml-auto px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-500"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-[#00c4ff]/30 rounded-lg cursor-pointer hover:border-[#00c4ff]/50 transition-colors bg-[rgba(18,26,36,0.4)]">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      {uploadingImage ? (
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#00c4ff]"></div>
                      ) : (
                        <>
                          <Upload className="w-8 h-8 mb-2 text-gray-400" />
                          <p className="text-sm text-gray-400">Click to add image</p>
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
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Content</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={12}
                  className="w-full px-4 py-3 bg-[rgba(18,26,36,0.8)] border border-[#00c4ff]/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#00c4ff] focus:shadow-[0_0_10px_rgba(0,196,255,0.2)] resize-none"
                  placeholder="Write your post content..."
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-[rgba(18,26,36,0.8)] border border-[#00c4ff]/30 rounded-lg">
                <span className="text-gray-300 font-medium">Publish immediately</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_published}
                    onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
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
                {editingPost ? "Save Changes" : "Create Post"}
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
