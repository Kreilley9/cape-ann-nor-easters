import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { PortalLayout } from "@/react-app/components/layout/PortalLayout";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { formatDate } from "@/react-app/utils/dateFormat";
import { apiFetch } from "@/react-app/lib/api";

interface Question {
  id: number;
  question_text: string;
  question_type: string;
  options?: string;
  is_required: number;
  order_index: number;
}

interface Survey {
  id: number;
  title: string;
  description?: string;
  expires_at?: string;
  is_active: number;
}

export default function PortalSurveyTake() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [alreadyResponded, setAlreadyResponded] = useState(false);

  useEffect(() => {
    loadSurvey();
  }, [id]);

  async function loadSurvey() {
    try {
      const response = await apiFetch(`/api/portal/surveys/${id}`, {
      });
      
      if (response.ok) {
        const data = await response.json();
        setSurvey(data.survey);
        setQuestions(data.questions);
        setAlreadyResponded(data.already_responded || false);
      } else if (response.status === 403) {
        alert("You don't have access to this survey");
        navigate("/portal/surveys");
      }
    } catch (error) {
      console.error("Error loading survey:", error);
    } finally {
      setLoading(false);
    }
  }

  function handleAnswerChange(questionId: number, value: string) {
    setAnswers({ ...answers, [questionId]: value });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validate required questions
    const unansweredRequired = questions.filter(
      (q) => q.is_required === 1 && !answers[q.id]?.trim()
    );

    if (unansweredRequired.length > 0) {
      alert("Please answer all required questions");
      return;
    }

    setSubmitting(true);

    try {
      const response = await apiFetch(`/api/portal/surveys/${id}/response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });

      if (response.ok) {
        setSubmitted(true);
      } else {
        const error = await response.json();
        alert(error.error || "Failed to submit survey");
      }
    } catch (error) {
      console.error("Error submitting survey:", error);
      alert("Failed to submit survey");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <PortalLayout>
        <div className="p-8 text-white">Loading survey...</div>
      </PortalLayout>
    );
  }

  if (!survey) {
    return (
      <PortalLayout>
        <div className="p-8 text-white">Survey not found</div>
      </PortalLayout>
    );
  }

  if (submitted) {
    return (
      <PortalLayout>
        <div className="p-8 max-w-3xl mx-auto">
          <div className="bg-[rgba(18,26,36,0.8)] border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-xl p-12 text-center">
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white font-[Oswald] mb-2">
              Thank you!
            </h2>
            <p className="text-gray-400 mb-6">
              Your response has been recorded.
            </p>
            <button
              onClick={() => navigate("/portal")}
              className="bg-[#00c4ff] border border-[#00c4ff] text-white px-6 py-2 rounded-lg hover:bg-[#00a3d9] shadow-[0_0_8px_rgba(0,196,255,0.5)]"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </PortalLayout>
    );
  }

  if (alreadyResponded) {
    return (
      <PortalLayout>
        <div className="p-8 max-w-3xl mx-auto">
          <div className="bg-[rgba(18,26,36,0.8)] border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-xl p-12 text-center">
            <h2 className="text-2xl font-bold text-white font-[Oswald] mb-2">
              Already Submitted
            </h2>
            <p className="text-gray-400 mb-6">
              You've already responded to this survey.
            </p>
            <button
              onClick={() => navigate("/portal")}
              className="bg-[#00c4ff] border border-[#00c4ff] text-white px-6 py-2 rounded-lg hover:bg-[#00a3d9] shadow-[0_0_8px_rgba(0,196,255,0.5)]"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </PortalLayout>
    );
  }

  if (!survey.is_active) {
    return (
      <PortalLayout>
        <div className="p-8 max-w-3xl mx-auto">
          <div className="bg-[rgba(18,26,36,0.8)] border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-xl p-12 text-center">
            <h2 className="text-2xl font-bold text-white font-[Oswald] mb-2">
              Survey Closed
            </h2>
            <p className="text-gray-400 mb-6">
              This survey is no longer accepting responses.
            </p>
            <button
              onClick={() => navigate("/portal")}
              className="bg-[#00c4ff] border border-[#00c4ff] text-white px-6 py-2 rounded-lg hover:bg-[#00a3d9] shadow-[0_0_8px_rgba(0,196,255,0.5)]"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </PortalLayout>
    );
  }

  const isExpired = survey.expires_at && new Date(survey.expires_at) < new Date();

  if (isExpired) {
    return (
      <PortalLayout>
        <div className="p-8 max-w-3xl mx-auto">
          <div className="bg-[rgba(18,26,36,0.8)] border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-xl p-12 text-center">
            <h2 className="text-2xl font-bold text-white font-[Oswald] mb-2">
              Survey Expired
            </h2>
            <p className="text-gray-400 mb-6">
              This survey expired on {formatDate(survey.expires_at!)}.
            </p>
            <button
              onClick={() => navigate("/portal")}
              className="bg-[#00c4ff] border border-[#00c4ff] text-white px-6 py-2 rounded-lg hover:bg-[#00a3d9] shadow-[0_0_8px_rgba(0,196,255,0.5)]"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="p-8 max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate("/portal")}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-3xl font-bold text-white font-[Oswald] flex-1">
            {survey.title}
          </h1>
        </div>

        {survey.description && (
          <p className="text-gray-400 mb-6">{survey.description}</p>
        )}

        {survey.expires_at && (
          <div className="bg-[rgba(255,165,0,0.2)] border border-orange-500 rounded-lg p-3 mb-6">
            <p className="text-sm text-orange-400">
              This survey expires on {formatDate(survey.expires_at)}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {questions.map((question, idx) => (
            <div
              key={question.id}
              className="bg-[rgba(18,26,36,0.8)] border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-xl p-6"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="w-8 h-8 bg-[rgba(0,196,255,0.2)] border border-[#00c4ff] text-[#00c4ff] rounded-full flex items-center justify-center font-semibold">
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg text-white font-[Oswald]">
                    {question.question_text}
                    {question.is_required === 1 && (
                      <span className="text-red-400 ml-1">*</span>
                    )}
                  </h3>
                </div>
              </div>

              {question.question_type === "text" && (
                <input
                  type="text"
                  value={answers[question.id] || ""}
                  onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                  className="w-full border border-[#00c4ff]/50 bg-[rgba(18,26,36,0.9)] text-white rounded-lg px-4 py-2 focus:outline-none focus:border-[#00c4ff] focus:shadow-[0_0_8px_rgba(0,196,255,0.5)]"
                  required={question.is_required === 1}
                />
              )}

              {question.question_type === "textarea" && (
                <textarea
                  value={answers[question.id] || ""}
                  onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                  className="w-full border border-[#00c4ff]/50 bg-[rgba(18,26,36,0.9)] text-white rounded-lg px-4 py-2 focus:outline-none focus:border-[#00c4ff] focus:shadow-[0_0_8px_rgba(0,196,255,0.5)]"
                  rows={4}
                  required={question.is_required === 1}
                />
              )}

              {question.question_type === "multiple_choice" && question.options && (
                <div className="space-y-2">
                  {question.options.split(",").map((option, i) => (
                    <label
                      key={i}
                      className="flex items-center gap-3 p-3 border border-[#00c4ff]/30 rounded-lg hover:bg-[rgba(0,196,255,0.1)] cursor-pointer transition-colors"
                    >
                      <input
                        type="radio"
                        name={`question-${question.id}`}
                        value={option.trim()}
                        checked={answers[question.id] === option.trim()}
                        onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                        className="w-4 h-4 text-[#00c4ff]"
                        required={question.is_required === 1}
                      />
                      <span className="text-gray-300">{option.trim()}</span>
                    </label>
                  ))}
                </div>
              )}

              {question.question_type === "rating" && (
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      key={rating}
                      type="button"
                      onClick={() => handleAnswerChange(question.id, rating.toString())}
                      className={`w-12 h-12 rounded-lg border transition-all ${
                        answers[question.id] === rating.toString()
                          ? "bg-[#00c4ff] border-[#00c4ff] text-white shadow-[0_0_8px_rgba(0,196,255,0.5)]"
                          : "bg-[rgba(18,26,36,0.9)] border-[#00c4ff]/30 text-gray-400 hover:border-[#00c4ff]/50"
                      }`}
                    >
                      {rating}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="bg-[#00c4ff] border border-[#00c4ff] text-white px-6 py-2 rounded-lg hover:bg-[#00a3d9] shadow-[0_0_8px_rgba(0,196,255,0.5)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Submitting..." : "Submit Survey"}
            </button>
            <button
              type="button"
              onClick={() => navigate("/portal")}
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
