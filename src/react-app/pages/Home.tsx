import { useState, useEffect } from "react";
import { useAuth } from "@getmocha/users-service/react";
import { useNavigate } from "react-router";
import { Loader2, Calendar, Users } from "lucide-react";
import type { Board } from "@/shared/types";

export default function Home() {
  const { user, isPending, redirectToLogin } = useAuth();
  const navigate = useNavigate();
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBoards();
  }, []);

  const loadBoards = async () => {
    try {
      const response = await fetch("/api/boards");
      const data = await response.json();
      setBoards(data);
      setLoading(false);
    } catch (error) {
      console.error("Error loading boards:", error);
      setLoading(false);
    }
  };

  const handleAdminAccess = () => {
    if (user) {
      navigate("/admin");
    } else {
      redirectToLogin();
    }
  };

  const activeBoards = boards.filter(b => !b.scores);
  const completedBoards = boards.filter(b => b.scores);

  if (isPending || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex items-center gap-4">
            <img 
              src="https://019b7617-c3ef-76fd-99cc-e86fca2684d0.mochausercontent.com/Nor'easters.jpg" 
              alt="Cape Ann Nor'easters"
              className="h-16 w-auto"
            />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Cape Ann Nor'easters</h1>
              <p className="text-gray-600">Football Squares Fundraiser</p>
            </div>
          </div>
        </div>

        {/* Active Boards */}
        {activeBoards.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Active Boards</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeBoards.map(board => (
                <button
                  key={board.id}
                  onClick={() => navigate(`/board?board=${board.slug}`)}
                  className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow text-left border border-gray-200 hover:border-blue-600"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-lg text-gray-900">{board.title}</h3>
                    {!board.is_open && (
                      <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">
                        Closed
                      </span>
                    )}
                  </div>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      <span>{board.team_top} vs {board.team_side}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date(board.game_date).toLocaleDateString()}</span>
                    </div>
                    <div className="font-semibold text-blue-700">
                      ${board.cost_per_square} per square
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Completed Boards */}
        {completedBoards.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Completed Boards</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {completedBoards.map(board => (
                <button
                  key={board.id}
                  onClick={() => navigate(`/board?board=${board.slug}`)}
                  className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow text-left border border-gray-200 hover:border-gray-400"
                >
                  <h3 className="font-bold text-lg text-gray-900 mb-2">{board.title}</h3>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      <span>{board.team_top} vs {board.team_side}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date(board.game_date).toLocaleDateString()}</span>
                    </div>
                    <div className="text-green-700 font-semibold">
                      View Results
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeBoards.length === 0 && completedBoards.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <p className="text-gray-600 text-lg">No boards available at this time.</p>
            <p className="text-gray-500 mt-2">Check back soon for new fundraising boards!</p>
          </div>
        )}

        {/* How It Works */}
        <div className="bg-white rounded-lg shadow-sm p-8 mt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">How It Works</h2>
          <div className="grid md:grid-cols-5 gap-6">
            <div>
              <div className="w-10 h-10 bg-blue-700 text-white rounded-lg flex items-center justify-center font-bold mb-3">
                1
              </div>
              <h3 className="font-semibold mb-2 text-gray-900">Select a Board</h3>
              <p className="text-sm text-gray-600">
                Choose from available open boards above
              </p>
            </div>
            <div>
              <div className="w-10 h-10 bg-blue-700 text-white rounded-lg flex items-center justify-center font-bold mb-3">
                2
              </div>
              <h3 className="font-semibold mb-2 text-gray-900">Pick Your Square</h3>
              <p className="text-sm text-gray-600">
                Select any available square on the 10×10 grid
              </p>
            </div>
            <div>
              <div className="w-10 h-10 bg-blue-700 text-white rounded-lg flex items-center justify-center font-bold mb-3">
                3
              </div>
              <h3 className="font-semibold mb-2 text-gray-900">Make Payment</h3>
              <p className="text-sm text-gray-600">
                Send payment via Venmo to secure your square
              </p>
            </div>
            <div>
              <div className="w-10 h-10 bg-blue-700 text-white rounded-lg flex items-center justify-center font-bold mb-3">
                4
              </div>
              <h3 className="font-semibold mb-2 text-gray-900">Numbers Randomized</h3>
              <p className="text-sm text-gray-600">
                Numbers are assigned when the board fills
              </p>
            </div>
            <div>
              <div className="w-10 h-10 bg-blue-700 text-white rounded-lg flex items-center justify-center font-bold mb-3">
                5
              </div>
              <h3 className="font-semibold mb-2 text-gray-900">Track & Win</h3>
              <p className="text-sm text-gray-600">
                See if your square wins at Q1, HT, Q3, or Final!
              </p>
            </div>
          </div>
        </div>

        {/* Admin Link */}
        <div className="mt-8 text-center">
          <button
            onClick={handleAdminAccess}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Admin log in
          </button>
        </div>
      </div>
    </div>
  );
}
