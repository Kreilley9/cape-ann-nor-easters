import { useState, useEffect } from "react";
import { PublicLayout } from "@/react-app/components/layout";
import { formatDateTime } from "@/react-app/utils/dateFormat";

interface NewsPost {
  id: number;
  title: string;
  content: string;
  author_name: string | null;
  published_at: string | null;
  created_at: string;
  image_key: string | null;
  images?: Array<{
    id: number;
    image_key: string;
    caption: string | null;
    order_index: number;
  }>;
}

export default function News() {
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    try {
      const response = await fetch("/api/public/news-posts");
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

  return (
    <PublicLayout>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-[#0a0f14] via-[#121a24] to-[#0a0f14] text-white py-20">
        <div className="relative max-w-7xl mx-auto px-4">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-black mb-6 font-[Oswald] tracking-wide">News & Updates</h1>
            <p className="text-xl text-gray-300 leading-relaxed">
              Stay up to date with the latest from the Nor'easters
            </p>
          </div>
        </div>
      </section>

      {/* Posts Section */}
      <section className="py-16 bg-[#0a0f14] min-h-[60vh]">
        <div className="max-w-4xl mx-auto px-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#00c4ff]"></div>
            </div>
          ) : posts.length > 0 ? (
            <div className="space-y-8">
              {posts.map((post) => (
                <article
                  key={post.id}
                  className="bg-[rgba(18,26,36,0.8)] rounded-2xl border border-[#00c4ff]/30 p-8 shadow-[0_0_20px_rgba(0,196,255,0.1)] hover:shadow-[0_0_30px_rgba(0,196,255,0.2)] transition-shadow"
                >
                  <div className="mb-4">
                    <h2 className="text-2xl md:text-3xl font-black text-white font-[Oswald] mb-3 tracking-wide">
                      {post.title}
                    </h2>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      {post.author_name && <span>By {post.author_name}</span>}
                      {post.published_at && (
                        <span>{formatDateTime(post.published_at)}</span>
                      )}
                    </div>
                  </div>
                  {post.images && post.images.length > 0 && (
                    <div className="space-y-4 mb-6">
                      {post.images.map((image) => (
                        <div key={image.id} className="space-y-2">
                          <img
                            src={`/api/public/news-images/${image.image_key.replace('news-images/', '')}`}
                            alt={image.caption || post.title}
                            className="w-full h-auto rounded-lg border border-[#00c4ff]/30"
                          />
                          {image.caption && (
                            <p className="text-sm text-gray-400 italic text-center">{image.caption}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {post.content}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <div className="bg-[rgba(18,26,36,0.8)] rounded-2xl border border-[#00c4ff]/30 p-12 shadow-[0_0_30px_rgba(0,196,255,0.15)]">
                <h2 className="text-3xl md:text-4xl font-black text-white font-[Oswald] mb-4 tracking-wide">
                  Coming Soon
                </h2>
                <p className="text-xl text-gray-400 leading-relaxed">
                  We're working on bringing you the latest news, game recaps, and team updates. Check back soon!
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
    </PublicLayout>
  );
}
