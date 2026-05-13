import { useState, useEffect } from "react";
import { useAuth } from "@getmocha/users-service/react";
import { useNavigate } from "react-router";
import { Loader2, ArrowLeft } from "lucide-react";
import type { Board, Reservation } from "@/shared/types";

export default function Admin() {
  const { user, isPending } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();
  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<string>("");
  const [selectedBoard, setSelectedBoard] = useState<Board | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [admins, setAdmins] = useState<string[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [editForm, setEditForm] = useState({ buyer_name: "", email: "", venmo_handle: "" });

  // Form state
  const [formData, setFormData] = useState({
    slug: "",
    title: "",
    team_top: "",
    team_side: "",
    cost_per_square: 20,
    game_date: "",
    venmo_handle: "",
    payout_mode: "percent" as "percent" | "fixed",
    payouts: { q1: 5, ht: 15, q3: 5, final: 25 },
    lock_at: "",
  });

  const [scores, setScores] = useState({
    q1: { top: "", side: "" },
    ht: { top: "", side: "" },
    q3: { top: "", side: "" },
    final: { top: "", side: "" },
  });

  useEffect(() => {
    if (!isPending && !user) {
      navigate("/");
    } else if (user) {
      checkAdminStatus();
    }
  }, [user, isPending, navigate]);

  const checkAdminStatus = async () => {
    try {
      const response = await fetch("/api/users/me");
      if (response.ok) {
        const data = await response.json();
        if (!data.is_admin) {
          alert("Admin access required");
          navigate("/");
        } else {
          setIsAdmin(true);
        }
      }
    } catch (error) {
      console.error("Error checking admin status:", error);
      navigate("/");
    }
  };

  useEffect(() => {
    if (user) {
      loadBoards();
      loadAdmins();
    }
  }, [user]);

  useEffect(() => {
    if (selectedBoard) {
      setFormData({
        slug: selectedBoard.slug,
        title: selectedBoard.title,
        team_top: selectedBoard.team_top,
        team_side: selectedBoard.team_side,
        cost_per_square: selectedBoard.cost_per_square,
        game_date: selectedBoard.game_date,
        venmo_handle: selectedBoard.venmo_handle,
        payout_mode: selectedBoard.payout_mode,
        payouts: selectedBoard.payouts,
        lock_at: selectedBoard.lock_at,
      });
      
      if (selectedBoard.scores) {
        setScores({
          q1: { 
            top: selectedBoard.scores.q1?.top?.toString() || "", 
            side: selectedBoard.scores.q1?.side?.toString() || "" 
          },
          ht: { 
            top: selectedBoard.scores.ht?.top?.toString() || "", 
            side: selectedBoard.scores.ht?.side?.toString() || "" 
          },
          q3: { 
            top: selectedBoard.scores.q3?.top?.toString() || "", 
            side: selectedBoard.scores.q3?.side?.toString() || "" 
          },
          final: { 
            top: selectedBoard.scores.final?.top?.toString() || "", 
            side: selectedBoard.scores.final?.side?.toString() || "" 
          },
        });
      }
    }
  }, [selectedBoard]);

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

  const loadAdmins = async () => {
    try {
      const response = await fetch("/api/admins");
      if (response.ok) {
        const data = await response.json();
        setAdmins(data.map((a: any) => a.email));
      }
    } catch (error) {
      console.error("Error loading admins:", error);
    }
  };

  const loadReservations = async (boardId: number) => {
    try {
      const response = await fetch(`/api/reservations?board_id=${boardId}`);
      const data = await response.json();
      setReservations(data);
    } catch (error) {
      console.error("Error loading reservations:", error);
    }
  };

  const handleLoadBoard = () => {
    const board = boards.find((b) => b.id.toString() === selectedBoardId);
    if (board) {
      setSelectedBoard(board);
      loadReservations(board.id);
    }
  };

  const handleDeleteBoard = async () => {
    if (!selectedBoard || !confirm("Are you sure you want to delete this board and all its reservations?")) {
      return;
    }

    try {
      await fetch(`/api/boards/${selectedBoard.id}`, { method: "DELETE" });
      await loadBoards();
      setSelectedBoard(null);
      setSelectedBoardId("");
      setReservations([]);
    } catch (error) {
      console.error("Error deleting board:", error);
    }
  };

  const handleToggleOpen = async (isOpen: boolean) => {
    if (!selectedBoard) return;

    try {
      await fetch(`/api/boards/${selectedBoard.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_open: isOpen }),
      });
      await loadBoards();
      setSelectedBoard({ ...selectedBoard, is_open: isOpen });
    } catch (error) {
      console.error("Error toggling board:", error);
    }
  };

  const handleRandomize = async () => {
    if (!selectedBoard) return;
    
    if (!confirm("Are you sure you want to randomize the numbers? This can only be done once and requires the board to be full (100/100 squares).")) {
      return;
    }

    try {
      const response = await fetch(`/api/boards/${selectedBoard.id}/randomize`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || "Failed to randomize");
        return;
      }

      const data = await response.json();
      setSelectedBoard({
        ...selectedBoard,
        top_nums: data.topNums,
        side_nums: data.sideNums,
        randomized_at: new Date().toISOString(),
      });
      await loadBoards();
      alert("Numbers randomized successfully!");
    } catch (error) {
      console.error("Error randomizing:", error);
    }
  };

  const handleExportCSV = () => {
    if (!selectedBoard || reservations.length === 0) return;

    const csv = [
      ["Square", "Name", "Email", "Venmo", "Status", "Reserved At", "Paid At"],
      ...reservations.map((r) => [
        r.square_idx,
        r.buyer_name,
        r.email || "",
        r.venmo_handle || "",
        r.status,
        new Date(r.created_at).toLocaleString(),
        r.paid_at ? new Date(r.paid_at).toLocaleString() : "",
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedBoard.slug}-reservations.csv`;
    a.click();
  };

  const handleCreateOrUpdateBoard = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (selectedBoard) {
        // Update existing board
        await fetch(`/api/boards/${selectedBoard.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        alert("Board updated successfully!");
      } else {
        // Create new board
        await fetch("/api/boards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...formData, is_open: true }),
        });
        alert("Board created successfully!");
      }
      await loadBoards();
    } catch (error) {
      console.error("Error saving board:", error);
      alert("Failed to save board");
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBoard) return;

    try {
      await fetch(`/api/boards/${selectedBoard.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payouts: formData.payouts,
          lock_at: formData.lock_at,
          payout_mode: formData.payout_mode,
        }),
      });
      await loadBoards();
      alert("Settings saved successfully!");
    } catch (error) {
      console.error("Error saving settings:", error);
    }
  };

  const handleSaveScores = async () => {
    if (!selectedBoard) return;

    const scoresData: any = {};
    (["q1", "ht", "q3", "final"] as const).forEach((checkpoint) => {
      if (scores[checkpoint].top && scores[checkpoint].side) {
        scoresData[checkpoint] = {
          top: parseInt(scores[checkpoint].top),
          side: parseInt(scores[checkpoint].side),
        };
      }
    });

    try {
      await fetch(`/api/boards/${selectedBoard.id}/scores`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scoresData),
      });
      setSelectedBoard({ ...selectedBoard, scores: scoresData });
      await loadBoards();
      alert("Scores saved successfully!");
    } catch (error) {
      console.error("Error saving scores:", error);
    }
  };

  const handleMarkPaid = async (reservationId: number) => {
    try {
      await fetch(`/api/reservations/${reservationId}/paid`, {
        method: "PATCH",
      });
      await loadReservations(selectedBoard!.id);
    } catch (error) {
      console.error("Error marking paid:", error);
    }
  };

  const handleEditReservation = (reservation: Reservation) => {
    setEditingReservation(reservation);
    setEditForm({
      buyer_name: reservation.buyer_name,
      email: reservation.email || "",
      venmo_handle: reservation.venmo_handle || "",
    });
  };

  const handleSaveEdit = async () => {
    if (!editingReservation) return;

    try {
      await fetch(`/api/reservations/${editingReservation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      await loadReservations(selectedBoard!.id);
      setEditingReservation(null);
    } catch (error) {
      console.error("Error updating reservation:", error);
      alert("Failed to update reservation");
    }
  };

  const handleDeleteReservation = async (reservationId: number) => {
    if (!confirm("Are you sure you want to delete this reservation?")) {
      return;
    }

    try {
      await fetch(`/api/reservations/${reservationId}`, {
        method: "DELETE",
      });
      await loadReservations(selectedBoard!.id);
    } catch (error) {
      console.error("Error deleting reservation:", error);
      alert("Failed to delete reservation");
    }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail) return;

    try {
      const response = await fetch("/api/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newAdminEmail }),
      });

      if (response.ok) {
        setNewAdminEmail("");
        await loadAdmins();
        alert("Admin added successfully! They must create an account first at the login page.");
      } else {
        const error = await response.json();
        alert(error.error || "Failed to add admin");
      }
    } catch (error) {
      console.error("Error adding admin:", error);
    }
  };

  if (isPending || loading || !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const reservedCount = reservations.length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img 
                src="https://019b7617-c3ef-76fd-99cc-e86fca2684d0.mochausercontent.com/Nor'easters.jpg" 
                alt="Cape Ann Nor'easters"
                className="h-10 w-auto"
              />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Nor'easters — Admin</h1>
                <p className="text-sm text-gray-600">Sign in to manage boards, sales, payouts, randomization & winners</p>
              </div>
            </div>
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:text-blue-700 font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Boards
            </button>
          </div>
        </div>

        {/* Select Board */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Select Board</h2>
          <div className="flex gap-3">
            <select
              value={selectedBoardId}
              onChange={(e) => setSelectedBoardId(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="">Choose a board...</option>
              {boards.map((board) => (
                <option key={board.id} value={board.id}>
                  {board.slug}
                </option>
              ))}
            </select>
            <button
              onClick={handleLoadBoard}
              disabled={!selectedBoardId}
              className="px-6 py-2 bg-blue-700 hover:bg-blue-800 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
            >
              Load
            </button>
            <button
              onClick={handleDeleteBoard}
              disabled={!selectedBoard}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
            >
              Delete Board
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Board Controls */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Board Controls</h2>
            <div className="space-y-3">
              <button
                onClick={() => handleToggleOpen(true)}
                disabled={!selectedBoard || selectedBoard?.is_open}
                className="w-full px-4 py-2 bg-blue-700 hover:bg-blue-800 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
              >
                Open Sales
              </button>
              <button
                onClick={() => handleToggleOpen(false)}
                disabled={!selectedBoard || !selectedBoard?.is_open}
                className="w-full px-4 py-2 bg-blue-700 hover:bg-blue-800 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
              >
                Close Sales
              </button>
              <button
                onClick={handleRandomize}
                disabled={!selectedBoard || !!selectedBoard?.randomized_at}
                className="w-full px-4 py-2 bg-blue-700 hover:bg-blue-800 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
              >
                Randomize Numbers {selectedBoard?.randomized_at && "(once)"}
              </button>
              <button
                onClick={handleExportCSV}
                disabled={!selectedBoard}
                className="w-full px-4 py-2 bg-blue-700 hover:bg-blue-800 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
              >
                Export CSV
              </button>
            </div>
          </div>

          {/* Payouts & Lock Time */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Payouts & Lock Time</h2>
            <form onSubmit={handleSaveSettings} className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Q1</label>
                  <input
                    type="number"
                    value={formData.payouts.q1}
                    onChange={(e) => setFormData({
                      ...formData,
                      payouts: { ...formData.payouts, q1: parseFloat(e.target.value) }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">HT</label>
                  <input
                    type="number"
                    value={formData.payouts.ht}
                    onChange={(e) => setFormData({
                      ...formData,
                      payouts: { ...formData.payouts, ht: parseFloat(e.target.value) }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Q3</label>
                  <input
                    type="number"
                    value={formData.payouts.q3}
                    onChange={(e) => setFormData({
                      ...formData,
                      payouts: { ...formData.payouts, q3: parseFloat(e.target.value) }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Final</label>
                <input
                  type="number"
                  value={formData.payouts.final}
                  onChange={(e) => setFormData({
                    ...formData,
                    payouts: { ...formData.payouts, final: parseFloat(e.target.value) }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Lock / Randomize At</label>
                <input
                  type="datetime-local"
                  value={formData.lock_at}
                  onChange={(e) => setFormData({ ...formData, lock_at: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Payout Mode</label>
                <select
                  value={formData.payout_mode}
                  onChange={(e) => setFormData({ ...formData, payout_mode: e.target.value as "percent" | "fixed" })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="percent">Percent of Pot</option>
                  <option value="fixed">Fixed Dollar</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={!selectedBoard}
                className="w-full px-4 py-2 bg-blue-700 hover:bg-blue-800 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
              >
                Save Settings
              </button>
              <p className="text-xs text-gray-600">Payouts appear on the public rules.</p>
            </form>
          </div>

          {/* Official Scores */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Official Scores</h2>
            <div className="space-y-3">
              {(["q1", "ht", "q3", "final"] as const).map((checkpoint) => (
                <div key={checkpoint}>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    {checkpoint.toUpperCase()} (Top, Side)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      placeholder="Top"
                      value={scores[checkpoint].top}
                      onChange={(e) => setScores({
                        ...scores,
                        [checkpoint]: { ...scores[checkpoint], top: e.target.value }
                      })}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    <input
                      type="number"
                      placeholder="Side"
                      value={scores[checkpoint].side}
                      onChange={(e) => setScores({
                        ...scores,
                        [checkpoint]: { ...scores[checkpoint], side: e.target.value }
                      })}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>
              ))}
              <button
                onClick={handleSaveScores}
                disabled={!selectedBoard}
                className="w-full px-4 py-2 bg-blue-700 hover:bg-blue-800 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
              >
                Save Scores
              </button>
            </div>
          </div>
        </div>

        {/* Create / Update Board */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Create / Update Board</h2>
          <form onSubmit={handleCreateOrUpdateBoard} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slug (unique)</label>
              <input
                type="text"
                placeholder="e.g., week-4-lions"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                placeholder="Week 4 vs Lions"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Top team</label>
              <input
                type="text"
                placeholder="Nor'easters"
                value={formData.team_top}
                onChange={(e) => setFormData({ ...formData, team_top: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Side team</label>
              <input
                type="text"
                placeholder="Opponents"
                value={formData.team_side}
                onChange={(e) => setFormData({ ...formData, team_side: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">$ per square</label>
              <input
                type="number"
                value={formData.cost_per_square}
                onChange={(e) => setFormData({ ...formData, cost_per_square: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Game date</label>
              <input
                type="date"
                value={formData.game_date}
                onChange={(e) => setFormData({ ...formData, game_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Venmo handle</label>
              <input
                type="text"
                placeholder="@NoreastersFlag FB"
                value={formData.venmo_handle}
                onChange={(e) => setFormData({ ...formData, venmo_handle: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-medium transition-colors"
              >
                Create/Update Board
              </button>
            </div>
          </form>
          <p className="text-sm text-gray-600 mt-2">Creates or updates by slug.</p>
        </div>

        {/* Reservations */}
        {selectedBoard && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              Reservations ({reservedCount}/100)
            </h2>
            <p className="text-sm text-gray-600 mb-4">Click "Mark Paid" to confirm payment.</p>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">When</th>
                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">idx</th>
                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Name</th>
                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Email</th>
                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Status</th>
                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Paid At</th>
                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reservations.map((reservation) => (
                    <tr key={reservation.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-3 text-sm text-gray-900">
                        {new Date(reservation.created_at).toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-sm text-gray-900">{reservation.square_idx + 1}</td>
                      <td className="py-2 px-3 text-sm text-gray-900">{reservation.buyer_name}</td>
                      <td className="py-2 px-3 text-sm text-gray-900">{reservation.email || "-"}</td>
                      <td className="py-2 px-3">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          reservation.status === "paid" 
                            ? "bg-green-100 text-green-800" 
                            : "bg-yellow-100 text-yellow-800"
                        }`}>
                          {reservation.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-sm text-gray-900">
                        {reservation.paid_at ? new Date(reservation.paid_at).toLocaleString() : "-"}
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex gap-2">
                          {reservation.status === "pending" && (
                            <button
                              onClick={() => handleMarkPaid(reservation.id)}
                              className="px-3 py-1 bg-blue-700 hover:bg-blue-800 text-white rounded text-sm font-medium transition-colors"
                            >
                              Mark Paid
                            </button>
                          )}
                          <button
                            onClick={() => handleEditReservation(reservation)}
                            className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm font-medium transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteReservation(reservation.id)}
                            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Edit Reservation Modal */}
        {editingReservation && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                Edit Reservation (Square {editingReservation.square_idx + 1})
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={editForm.buyer_name}
                    onChange={(e) => setEditForm({ ...editForm, buyer_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Venmo Handle</label>
                  <input
                    type="text"
                    value={editForm.venmo_handle}
                    onChange={(e) => setEditForm({ ...editForm, venmo_handle: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleSaveEdit}
                  className="flex-1 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-medium transition-colors"
                >
                  Save Changes
                </button>
                <button
                  onClick={() => setEditingReservation(null)}
                  className="flex-1 px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Admins */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Admins</h2>
          <form onSubmit={handleAddAdmin} className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Add admin by email (must exist as a user)
            </label>
            <div className="flex gap-3">
              <input
                type="email"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                placeholder="newadmin@yourdomain"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <button
                type="submit"
                className="px-6 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-medium transition-colors"
              >
                Add Admin
              </button>
            </div>

          </form>
          
          {admins.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Current admins:</p>
              <ul className="space-y-1">
                {admins.map((email) => (
                  <li key={email} className="text-sm text-gray-600">• {email}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
