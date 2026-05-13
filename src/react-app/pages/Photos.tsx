import { PublicLayout } from "@/react-app/components/layout";
import { useState, useEffect } from "react";
import { X } from "lucide-react";

interface GalleryPhoto {
  id: number;
  image_key: string;
  caption: string | null;
  order_index: number;
}

export default function Photos() {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<GalleryPhoto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPhotos = async () => {
      try {
        const response = await fetch("/api/gallery/public");
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
    loadPhotos();
  }, []);

  return (
    <PublicLayout>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-[#0a0f14] via-[#121a24] to-[#0a0f14] text-white py-20">
        <div className="relative max-w-7xl mx-auto px-4">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-black mb-6 font-[Oswald] tracking-wide">Photo Gallery</h1>
            <p className="text-xl text-gray-300 leading-relaxed">
              Capturing moments from tournaments, practices, and team events throughout the seasons.
            </p>
          </div>
        </div>
      </section>

      {/* Photo Grid */}
      <section className="py-16 bg-[#0a0f14]">
        <div className="max-w-7xl mx-auto px-4">
          {loading ? (
            <div className="text-center text-white">Loading photos...</div>
          ) : photos.length === 0 ? (
            <div className="text-center text-gray-400">No photos available yet.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className="group relative overflow-hidden rounded-xl border border-[#00c4ff]/20 hover:border-[#00c4ff]/60 transition-all cursor-pointer"
                  onClick={() => setSelectedPhoto(photo)}
                >
                  <div className="aspect-[4/3] bg-[rgba(18,26,36,0.8)]">
                    <img
                      src={`/api/gallery/images/${photo.image_key.replace("gallery-photos/", "")}`}
                      alt={photo.caption || "Team photo"}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                  {photo.caption && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                      <p className="text-white text-sm">{photo.caption}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Lightbox Modal */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-[#00c4ff] transition-colors"
            onClick={() => setSelectedPhoto(null)}
          >
            <X className="w-8 h-8" />
          </button>
          <div className="flex flex-col items-center max-w-full max-h-full">
            <img
              src={`/api/gallery/images/${selectedPhoto.image_key.replace("gallery-photos/", "")}`}
              alt={selectedPhoto.caption || "Full size"}
              className="max-w-full max-h-[85vh] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            {selectedPhoto.caption && (
              <p className="text-white text-lg mt-4 text-center">{selectedPhoto.caption}</p>
            )}
          </div>
        </div>
      )}
    </PublicLayout>
  );
}
