import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { PortalLayout } from "@/react-app/components/layout/PortalLayout";
import { Plus, Trash2, GripVertical } from "lucide-react";

interface Team {
  id: number;
  name: string;
  age_group?: string;
}

interface Family {
  id: number;
  name: string;
}

interface Player {
  id: number;
  first_name: string;
  last_name: string;
  family_name?: string;
}

interface Question {
  question_text: string;
  question_type: "text" | "textarea" | "multiple_choice" | "rating";
  options?: string;
  is_required: boolean;
}

export default function PortalSurveyCreate() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetType, setTargetType] = useState<"all" | "team" | "custom">("all");
  const [selectedTeams, setSelectedTeams] = useState<number[]>([]);
  const [selectedFamilies, setSelectedFamilies] = useState<number[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<number[]>([]);
  const [expiresAt, setExpiresAt] = useState("");
  const [questions, setQuestions] = useState<Question[]>([
    { question_text: "", question_type: "text", is_required: false }
  ]);
  
  const [teams, setTeams] = useState<Team[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [teamsRes, familiesRes, playersRes] = await Promise.all([
        fetch("/api/portal/teams", { credentials: "include" }),
        fetch("/api/portal/families", { credentials: "include" }),
        fetch("/api/portal/players/all", { credentials: "include" })
      ]);

      if (teamsRes.ok) setTeams(await teamsRes.json());
      if (familiesRes.ok) setFamilies(await familiesRes.json());
      if (playersRes.ok) setPlayers(await playersRes.json());
    } catch (error) {
      console.error("Error loading data:", error);
    }
  }

  function addQuestion() {
    setQuestions([...questions, { question_text: "", question_type: "text", is_required: false }]);
  }

  function removeQuestion(index: number) {
    setQuestions(questions.filter((_, i) => i !== index));
  }

  function updateQuestion(index: number, field: keyof Question, value: any) {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };
    setQuestions(updated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!title.trim()) {
      alert("Please enter a survey title");
      return;
    }

    if (questions.some(q => !q.question_text.trim())) {
      alert("Please fill in all question text");
      return;
    }

    if (targetType === "team" && selectedTeams.length === 0) {
      alert("Please select at least one team");
      return;
    }

    if (targetType === "custom" && selectedFamilies.length === 0 && selectedPlayers.length === 0) {
      alert("Please select at least one family or player");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/portal/surveys", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          target_type: targetType,
          team_ids: targetType === "team" ? selectedTeams : null,
          family_ids: targetType === "custom" ? selectedFamilies : null,
          player_ids: targetType === "custom" ? selectedPlayers : null,
          expires_at: expiresAt || null,
          questions
        })
      });

      if (response.ok) {
        navigate("/portal/surveys");
      } else {
        const error = await response.json();
        alert(error.error || "Failed to create survey");
      }
    } catch (error) {
      console.error("Error creating survey:", error);
      alert("Failed to create survey");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PortalLayout>
      <div className="p-8 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-white font-[Oswald]">Create Survey</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-[rgba(18,26,36,0.8)] border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-white font-[Oswald]">Survey Details</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full border border-[#00c4ff]/50 bg-[rgba(18,26,36,0.9)] text-white rounded-lg px-3 py-2 focus:outline-none focus:border-[#00c4ff] focus:shadow-[0_0_8px_rgba(0,196,255,0.5)]"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border border-[#00c4ff]/50 bg-[rgba(18,26,36,0.9)] text-white rounded-lg px-3 py-2 focus:outline-none focus:border-[#00c4ff] focus:shadow-[0_0_8px_rgba(0,196,255,0.5)]"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Expiration Date (optional)
                </label>
                <input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full border border-[#00c4ff]/50 bg-[rgba(18,26,36,0.9)] text-white rounded-lg px-3 py-2 focus:outline-none focus:border-[#00c4ff] focus:shadow-[0_0_8px_rgba(0,196,255,0.5)]"
                />
              </div>
            </div>
          </div>

          <div className="bg-[rgba(18,26,36,0.8)] border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-white font-[Oswald]">Target Audience</h2>
            
            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-2 text-gray-300">
                  <input
                    type="radio"
                    value="all"
                    checked={targetType === "all"}
                    onChange={(e) => setTargetType(e.target.value as any)}
                    className="w-4 h-4 text-[#00c4ff]"
                  />
                  <span>All families (program-wide)</span>
                </label>
              </div>

              <div>
                <label className="flex items-center gap-2 text-gray-300">
                  <input
                    type="radio"
                    value="team"
                    checked={targetType === "team"}
                    onChange={(e) => setTargetType(e.target.value as any)}
                    className="w-4 h-4 text-[#00c4ff]"
                  />
                  <span>Specific teams</span>
                </label>
                
                {targetType === "team" && (
                  <div className="mt-2 ml-6 space-y-2 max-h-48 overflow-y-auto border border-[#00c4ff]/30 rounded p-3 bg-[rgba(18,26,36,0.9)]">
                    {teams.map(team => (
                      <label key={team.id} className="flex items-center gap-2 text-gray-300">
                        <input
                          type="checkbox"
                          checked={selectedTeams.includes(team.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTeams([...selectedTeams, team.id]);
                            } else {
                              setSelectedTeams(selectedTeams.filter(id => id !== team.id));
                            }
                          }}
                          className="w-4 h-4 text-[#00c4ff]"
                        />
                        <span>{team.name} {team.age_group && `(${team.age_group})`}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="flex items-center gap-2 text-gray-300">
                  <input
                    type="radio"
                    value="custom"
                    checked={targetType === "custom"}
                    onChange={(e) => setTargetType(e.target.value as any)}
                    className="w-4 h-4 text-[#00c4ff]"
                  />
                  <span>Custom selection (families/players)</span>
                </label>
                
                {targetType === "custom" && (
                  <div className="mt-2 ml-6 space-y-4">
                    <div>
                      <h4 className="font-medium mb-2 text-white font-[Oswald]">Families</h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto border border-[#00c4ff]/30 rounded p-3 bg-[rgba(18,26,36,0.9)]">
                        {families.map(family => (
                          <label key={family.id} className="flex items-center gap-2 text-gray-300">
                            <input
                              type="checkbox"
                              checked={selectedFamilies.includes(family.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedFamilies([...selectedFamilies, family.id]);
                                } else {
                                  setSelectedFamilies(selectedFamilies.filter(id => id !== family.id));
                                }
                              }}
                              className="w-4 h-4 text-[#00c4ff]"
                            />
                            <span>{family.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-2 text-white font-[Oswald]">Players</h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto border border-[#00c4ff]/30 rounded p-3 bg-[rgba(18,26,36,0.9)]">
                        {players.map(player => (
                          <label key={player.id} className="flex items-center gap-2 text-gray-300">
                            <input
                              type="checkbox"
                              checked={selectedPlayers.includes(player.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedPlayers([...selectedPlayers, player.id]);
                                } else {
                                  setSelectedPlayers(selectedPlayers.filter(id => id !== player.id));
                                }
                              }}
                              className="w-4 h-4 text-[#00c4ff]"
                            />
                            <span>{player.first_name} {player.last_name} {player.family_name && `(${player.family_name})`}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-[rgba(18,26,36,0.8)] border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-white font-[Oswald]">Questions</h2>
              <button
                type="button"
                onClick={addQuestion}
                className="text-[#00c4ff] hover:text-[#00a3d9] flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Add Question
              </button>
            </div>

            <div className="space-y-4">
              {questions.map((question, index) => (
                <div key={index} className="border border-[#00c4ff]/30 rounded-lg p-4 bg-[rgba(18,26,36,0.9)]">
                  <div className="flex items-start gap-2">
                    <GripVertical className="w-5 h-5 text-gray-400 mt-2" />
                    <div className="flex-1 space-y-3">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={question.question_text}
                          onChange={(e) => updateQuestion(index, "question_text", e.target.value)}
                          placeholder="Enter your question"
                          className="flex-1 border border-[#00c4ff]/50 bg-[rgba(18,26,36,0.9)] text-white rounded px-3 py-2 focus:outline-none focus:border-[#00c4ff] focus:shadow-[0_0_8px_rgba(0,196,255,0.5)]"
                        />
                        <select
                          value={question.question_type}
                          onChange={(e) => updateQuestion(index, "question_type", e.target.value)}
                          className="border border-[#00c4ff]/50 bg-[rgba(18,26,36,0.9)] text-white rounded px-3 py-2 focus:outline-none focus:border-[#00c4ff]"
                        >
                          <option value="text">Short Answer</option>
                          <option value="textarea">Long Answer</option>
                          <option value="multiple_choice">Multiple Choice</option>
                          <option value="rating">Rating (1-5)</option>
                        </select>
                      </div>

                      {question.question_type === "multiple_choice" && (
                        <input
                          type="text"
                          value={question.options || ""}
                          onChange={(e) => updateQuestion(index, "options", e.target.value)}
                          placeholder="Enter options separated by commas"
                          className="w-full border border-[#00c4ff]/50 bg-[rgba(18,26,36,0.9)] text-white rounded px-3 py-2 text-sm focus:outline-none focus:border-[#00c4ff] focus:shadow-[0_0_8px_rgba(0,196,255,0.5)]"
                        />
                      )}

                      <label className="flex items-center gap-2 text-sm text-gray-300">
                        <input
                          type="checkbox"
                          checked={question.is_required}
                          onChange={(e) => updateQuestion(index, "is_required", e.target.checked)}
                          className="w-4 h-4 text-[#00c4ff]"
                        />
                        <span>Required</span>
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeQuestion(index)}
                      className="text-red-400 hover:text-red-300 p-2 transition-colors"
                      disabled={questions.length === 1}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="bg-[#00c4ff] border border-[#00c4ff] text-white px-6 py-2 rounded-lg hover:bg-[#00a3d9] shadow-[0_0_8px_rgba(0,196,255,0.5)] disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Survey"}
            </button>
            <button
              type="button"
              onClick={() => navigate("/portal/surveys")}
              className="border border-[#00c4ff]/50 text-gray-300 px-6 py-2 rounded-lg hover:bg-[rgba(0,196,255,0.1)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </PortalLayout>
  );
}
