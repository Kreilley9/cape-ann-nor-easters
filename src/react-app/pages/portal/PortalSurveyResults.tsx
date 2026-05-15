import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { PortalLayout } from "@/react-app/components/layout/PortalLayout";
import { ArrowLeft, Download } from "lucide-react";
import { formatDateTime, formatDate } from "@/react-app/utils/dateFormat";
import { apiFetch } from "@/react-app/lib/api";

interface Question {
  id: number;
  question_text: string;
  question_type: string;
  options?: string;
  is_required: number;
}

interface Answer {
  question_id: number;
  question_text: string;
  question_type: string;
  answer_text?: string;
}

interface Response {
  id: number;
  family_name?: string;
  first_name?: string;
  last_name?: string;
  submitted_at: string;
  answers: Answer[];
}

interface SurveyResults {
  survey: {
    id: number;
    title: string;
    description?: string;
    created_at: string;
  };
  questions: Question[];
  responses: Response[];
}

export default function PortalSurveyResults() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<SurveyResults | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadResults();
  }, [id]);

  async function loadResults() {
    try {
      const response = await apiFetch(`/api/portal/surveys/${id}/results`, {
      });
      if (response.ok) {
        const results = await response.json();
        setData(results);
      }
    } catch (error) {
      console.error("Error loading survey results:", error);
    } finally {
      setLoading(false);
    }
  }

  function exportToCSV() {
    if (!data) return;

    const headers = ["Respondent", "Submitted At", ...data.questions.map(q => q.question_text)];
    const rows = data.responses.map(response => {
      const respondent = response.family_name || `${response.first_name} ${response.last_name}`;
      const submittedAt = formatDateTime(response.submitted_at);
      const answers = data.questions.map(q => {
        const answer = response.answers.find(a => a.question_id === q.id);
        return answer?.answer_text || "";
      });
      return [respondent, submittedAt, ...answers];
    });

    const csvContent = [
      headers.map(h => `"${h}"`).join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `survey-results-${id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function getQuestionSummary(question: Question) {
    if (!data) return null;

    const answers = data.responses.flatMap(r => 
      r.answers.filter(a => a.question_id === question.id)
    );

    if (question.question_type === "rating") {
      const ratings = answers.map(a => parseInt(a.answer_text || "0")).filter(r => r > 0);
      if (ratings.length === 0) return "No responses yet";
      const avg = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
      return `Average: ${avg.toFixed(1)} / 5 (${ratings.length} responses)`;
    }

    if (question.question_type === "multiple_choice" && question.options) {
      const options = question.options.split(",").map(o => o.trim());
      const counts = options.map(opt => ({
        option: opt,
        count: answers.filter(a => a.answer_text === opt).length
      }));
      return counts;
    }

    return `${answers.length} responses`;
  }

  if (loading) {
    return (
      <PortalLayout>
        <div className="p-8">Loading results...</div>
      </PortalLayout>
    );
  }

  if (!data) {
    return (
      <PortalLayout>
        <div className="p-8">Survey not found</div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate("/portal/surveys")}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-3xl font-bold text-white font-[Oswald] flex-1">{data.survey.title}</h1>
          <button
            onClick={exportToCSV}
            className="bg-green-600 border border-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-700 shadow-[0_0_8px_rgba(0,255,0,0.3)] flex items-center gap-2"
          >
            <Download className="w-5 h-5" />
            Export CSV
          </button>
        </div>

        {data.survey.description && (
          <p className="text-gray-400 mb-6">{data.survey.description}</p>
        )}

        <div className="bg-[rgba(0,196,255,0.2)] border border-[#00c4ff] rounded-lg p-4 mb-6">
          <div className="flex gap-6 text-sm">
            <div>
              <span className="font-medium text-white font-[Oswald]">Total Responses:</span> <span className="text-gray-300">{data.responses.length}</span>
            </div>
            <div>
              <span className="font-medium text-white font-[Oswald]">Created:</span>{" "}
              <span className="text-gray-300">{formatDate(data.survey.created_at)}</span>
            </div>
          </div>
        </div>

        <div className="space-y-6 mb-12">
          <h2 className="text-2xl font-semibold text-white font-[Oswald]">Individual Responses by Person</h2>
          
          {data.responses.length === 0 ? (
            <div className="bg-[rgba(18,26,36,0.8)] border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-lg p-12 text-center">
              <p className="text-gray-400">No responses yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {data.responses.map((response) => (
                <div key={response.id} className="bg-[rgba(18,26,36,0.8)] border border-[#00c4ff]/40 shadow-[0_0_8px_rgba(0,196,255,0.3)] rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#00c4ff]/30">
                    <h3 className="text-xl font-bold text-white font-[Oswald]">
                      {response.family_name || `${response.first_name} ${response.last_name}`}
                    </h3>
                    <span className="text-sm text-gray-400">
                      {formatDateTime(response.submitted_at)}
                    </span>
                  </div>
                  
                  <div className="space-y-4">
                    {data.questions.map((question, idx) => {
                      const answer = response.answers.find(a => a.question_id === question.id);
                      return (
                        <div key={question.id} className="bg-[rgba(18,26,36,0.6)] border border-[#00c4ff]/20 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <div className="w-6 h-6 bg-[rgba(0,196,255,0.2)] border border-[#00c4ff] text-[#00c4ff] rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0">
                              {idx + 1}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-400 mb-2">{question.question_text}</p>
                              <p className="text-white font-medium">
                                {answer?.answer_text || (
                                  <span className="text-gray-500 italic">No answer provided</span>
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <h2 className="text-2xl font-semibold text-white font-[Oswald]">Summary by Question</h2>

          {data.questions.map((question, idx) => {
            const summary = getQuestionSummary(question);
            return (
              <div key={question.id} className="bg-[rgba(18,26,36,0.8)] border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-lg p-6">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-8 h-8 bg-[rgba(0,196,255,0.2)] border border-[#00c4ff] text-[#00c4ff] rounded-full flex items-center justify-center font-semibold">
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-white font-[Oswald]">{question.question_text}</h3>
                    <span className="text-sm text-gray-400">
                      {question.question_type === "text" && "Short Answer"}
                      {question.question_type === "textarea" && "Long Answer"}
                      {question.question_type === "multiple_choice" && "Multiple Choice"}
                      {question.question_type === "rating" && "Rating"}
                      {question.is_required === 1 && " • Required"}
                    </span>
                  </div>
                </div>

                {question.question_type === "multiple_choice" && Array.isArray(summary) ? (
                  <div className="space-y-2">
                    {summary.map((item, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="flex-1 bg-[rgba(18,26,36,0.9)] border border-[#00c4ff]/30 rounded-full h-8 relative">
                          <div
                            className="bg-[#00c4ff] h-8 rounded-full transition-all shadow-[0_0_8px_rgba(0,196,255,0.5)]"
                            style={{
                              width: `${data.responses.length > 0 ? (item.count / data.responses.length) * 100 : 0}%`,
                            }}
                          />
                          <span className="absolute inset-0 flex items-center px-3 text-sm font-medium text-white">
                            {item.option}
                          </span>
                        </div>
                        <span className="text-sm font-medium w-12 text-right text-gray-300">
                          {item.count}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : typeof summary === "string" ? (
                  <div className="text-gray-400 mb-4">{summary}</div>
                ) : null}

                {(question.question_type === "text" || question.question_type === "textarea") && (
                  <div className="mt-4 space-y-3 max-h-96 overflow-y-auto">
                    {data.responses.map(response => {
                      const answer = response.answers.find(a => a.question_id === question.id);
                      if (!answer?.answer_text) return null;
                      
                      return (
                        <div key={response.id} className="bg-[rgba(18,26,36,0.9)] border border-[#00c4ff]/30 rounded p-3">
                          <div className="text-sm text-gray-400 mb-1">
                            {response.family_name || `${response.first_name} ${response.last_name}`} •{" "}
                            {formatDate(response.submitted_at)}
                          </div>
                          <div className="text-white">{answer.answer_text}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </PortalLayout>
  );
}
