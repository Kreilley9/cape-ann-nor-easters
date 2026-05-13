import { useState, useEffect } from "react";
import { PortalLayout } from "@/react-app/components/layout/PortalLayout";
import { Upload, Trash2 } from "lucide-react";

interface Team {
  id: number;
  name: string;
  photo_key: string | null;
  season_name: string | null;
  created_at: string;
}

export default function PortalTeamsPhotoManagement() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingTeamId, setUploadingTeamId] = useState<number | null>(null);

  useEffect(() => {
    loadTeams();
  }, []);

  const loadTeams = async () => {
    try {
      const response = await fetch("/api/public/teams", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setTeams(data);
      }
    } catch (error) {
      console.error("Error loading teams:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (teamId: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingTeamId(teamId);
    try {
      // Upload the photo
      const uploadData = new FormData();
      uploadData.append("photo", file);

      const uploadResponse = await fetch("/api/public/teams/upload-photo", {
        method: "POST",
        credentials: "include",
        body: uploadData,
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload photo");
      }

      const { photo_key } = await uploadResponse.json();

      // Update the team with the new photo
      const updateResponse = await fetch(`/api/public/teams/${teamId}/photo`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ photo_key }),
      });

      if (updateResponse.ok) {
        loadTeams();
      } else {
        throw new Error("Failed to update team photo");
      }
    } catch (error) {
      console.error("Error uploading team photo:", error);
      alert("Failed to upload photo");
    } finally {
      setUploadingTeamId(null);
    }
  };

  const handleRemovePhoto = async (teamId: number) => {
    if (!confirm("Are you sure you want to remove this team photo?")) return;

    try {
      const response = await fetch(`/api/public/teams/${teamId}/photo`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ photo_key: null }),
      });

      if (response.ok) {
        loadTeams();
      }
    } catch (error) {
      console.error("Error removing team photo:", error);
      alert("Failed to remove photo");
    }
  };

  const getPhotoUrl = (photoKey: string) => {
    const key = photoKey.replace("team-photos/", "");
    return `/api/public/teams/photos/${key}`;
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
        <div className="mb-6">
          <h1
            className="text-2xl md:text-3xl font-bold text-white"
            style={{ fontFamily: "Oswald, sans-serif" }}
          >
            TEAM PHOTOS
          </h1>
          <p className="text-gray-400 mt-2">Upload photos for each team to display on the public Teams page.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((team) => (
            <div
              key={team.id}
              className="bg-[rgba(18,26,36,0.8)] border border-[#00c4ff]/30 rounded-xl overflow-hidden shadow-[0_0_15px_rgba(0,196,255,0.1)]"
            >
              <div className="relative aspect-video bg-gray-800">
                {team.photo_key ? (
                  <>
                    <img
                      src={getPhotoUrl(team.photo_key)}
                      alt={team.name}
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => handleRemovePhoto(team.id)}
                      className="absolute top-2 right-2 p-2 bg-red-600/80 text-white rounded-lg hover:bg-red-500 backdrop-blur-sm transition-colors"
                      title="Remove photo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-gray-700/50 transition-colors">
                    {uploadingTeamId === team.id ? (
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#00c4ff]"></div>
                    ) : (
                      <>
                        <Upload className="w-10 h-10 mb-2 text-gray-400" />
                        <p className="text-sm text-gray-400">Click to upload</p>
                      </>
                    )}
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => handlePhotoUpload(team.id, e)}
                      disabled={uploadingTeamId === team.id}
                    />
                  </label>
                )}
              </div>
              <div className="p-4">
                <h3 className="text-lg font-bold text-white" style={{ fontFamily: "Oswald, sans-serif" }}>
                  {team.name}
                </h3>
                {team.season_name && (
                  <p className="text-gray-400 text-sm">{team.season_name}</p>
                )}
                
                {team.photo_key && (
                  <label className="mt-3 flex items-center justify-center gap-2 px-4 py-2 border border-[#00c4ff]/30 text-[#00c4ff] rounded-lg hover:bg-[#00c4ff]/10 transition-colors cursor-pointer">
                    {uploadingTeamId === team.id ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-[#00c4ff]"></div>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Replace Photo
                      </>
                    )}
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => handlePhotoUpload(team.id, e)}
                      disabled={uploadingTeamId === team.id}
                    />
                  </label>
                )}
              </div>
            </div>
          ))}

          {teams.length === 0 && (
            <div className="col-span-full bg-[rgba(18,26,36,0.8)] border border-[#00c4ff]/30 rounded-xl p-12 text-center">
              <p className="text-gray-400">No teams found. Create teams in the Teams section first.</p>
            </div>
          )}
        </div>
      </div>
    </PortalLayout>
  );
}
