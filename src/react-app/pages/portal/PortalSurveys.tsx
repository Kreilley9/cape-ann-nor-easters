import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { PortalLayout } from "@/react-app/components/layout/PortalLayout";
import { Plus, Send, BarChart2, Eye, Trash2, Clock, Edit } from "lucide-react";
import { formatDate } from "@/react-app/utils/dateFormat";

interface Survey {
  id: number;
  title: string;
  description?: string;
  target_type: string;
  team_ids?: string;
  expires_at?: string;
  is_active: number;
  created_at: string;
  response_count?: number;
  recipient_count?: number;
}

export default function PortalSurveys() {
  const navigate = useNavigate();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSurveys();
  }, []);

  async function loadSurveys() {
    try {
      const response = await fetch("/api/portal/surveys", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setSurveys(data);
      }
    } catch (error) {
      console.error("Error loading surveys:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Are you sure you want to delete this survey?")) return;

    try {
      const response = await fetch(`/api/portal/surveys/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (response.ok) {
        loadSurveys();
      }
    } catch (error) {
      console.error("Error deleting survey:", error);
    }
  }

  if (loading) {
    return (
      <PortalLayout>
        <div className="p-8">Loading surveys...</div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-white font-[Oswald]">Surveys</h1>
          <button
            onClick={() => navigate("/portal/surveys/new")}
            className="bg-[#00c4ff] border border-[#00c4ff] text-white px-4 py-2 rounded-lg hover:bg-[#00a3d9] shadow-[0_0_8px_rgba(0,196,255,0.5)] flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Create Survey
          </button>
        </div>

        {surveys.length === 0 ? (
          <div className="bg-[rgba(18,26,36,0.8)] border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-lg p-12 text-center">
            <Send className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white font-[Oswald] mb-2">
              No surveys yet
            </h3>
            <p className="text-gray-400 mb-6">
              Create your first survey to gather feedback from families and players
            </p>
            <button
              onClick={() => navigate("/portal/surveys/new")}
              className="bg-[#00c4ff] border border-[#00c4ff] text-white px-6 py-2 rounded-lg hover:bg-[#00a3d9] shadow-[0_0_8px_rgba(0,196,255,0.5)]"
            >
              Create Survey
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {surveys.map((survey) => (
              <div
                key={survey.id}
                className="bg-[rgba(18,26,36,0.8)] border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-lg p-6 hover:shadow-[0_0_12px_rgba(0,196,255,0.7)] transition-shadow"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-xl font-semibold text-white font-[Oswald]">{survey.title}</h3>
                      {survey.is_active ? (
                        <span className="px-2 py-1 bg-[rgba(0,255,0,0.2)] border border-green-500 text-green-400 text-xs rounded">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-[rgba(100,100,100,0.3)] border border-gray-500 text-gray-300 text-xs rounded">
                          Closed
                        </span>
                      )}
                    </div>
                    {survey.description && (
                      <p className="text-gray-400 mb-3">{survey.description}</p>
                    )}
                    <div className="flex gap-4 text-sm text-gray-400">
                      <div className="flex items-center gap-1">
                        <Send className="w-4 h-4" />
                        {survey.recipient_count || 0} recipients
                      </div>
                      <div className="flex items-center gap-1">
                        <BarChart2 className="w-4 h-4" />
                        {survey.response_count || 0} responses
                      </div>
                      {survey.expires_at && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          Expires {formatDate(survey.expires_at)}
                        </div>
                      )}
                    </div>
                    <div className="mt-2 text-sm text-gray-400">
                      Target: {survey.target_type === "all" ? "All families" : survey.target_type === "team" ? "Specific teams" : "Selected families/players"}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(`/portal/surveys/${survey.id}`)}
                      className="p-2 text-green-400 hover:bg-[rgba(0,255,0,0.2)] rounded transition-colors"
                      title="Take Survey"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => navigate(`/portal/surveys/${survey.id}/results`)}
                      className="p-2 text-[#00c4ff] hover:bg-[rgba(0,196,255,0.2)] rounded transition-colors"
                      title="View Results"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(survey.id)}
                      className="p-2 text-red-400 hover:bg-[rgba(255,0,0,0.2)] rounded transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
