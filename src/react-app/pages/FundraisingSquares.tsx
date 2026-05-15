import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router";
import { Loader2, Calendar, DollarSign, Clock, Trophy, ArrowLeft, Users } from "lucide-react";
import { PublicLayout } from "@/react-app/components/layout";
import type { Board, Reservation } from "@/shared/types";

export default function FundraisingSquares() {
  const [searchParams] = useSearchParams();
  const boardSlug = searchParams.get("board");
  const [boards, setBoards] = useState<Board[]>([]);
  const [board, setBoard] = useState<Board | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSquare, setSelectedSquare] = useState<number | null>(null);
  const [showReserveModal, setShowReserveModal] = useState(false);
  const [buyerName, setBuyerName] = useState("");
  const [email, setEmail] = useState("");
  const [venmoHandle, setVenmoHandle] = useState("");
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    if (boardSlug) {
      loadBoard();
    } else {
      loadBoards();
    }
  }, [boardSlug]);

  useEffect(() => {
    const savedEmail = localStorage.getItem("userEmail");
    if (savedEmail) {
      setUserEmail(savedEmail);
    }
  }, []);

  const loadBoards = async () => {
    try {
      const response = await fetch("/api/boards");
      if (response.ok) {
        const data = await response.json();
        setBoards(data);
      }
      setLoading(false);
    } catch (error) {
      console.error("Error loading boards:", error);
      setLoading(false);
    }
  };

  const loadBoard = async () => {
    try {
      const [boardRes, reservationsRes] = await Promise.all([
        fetch(`/api/boards/${boardSlug}`),
        fetch(`/api/boards/${boardSlug}/reservations`),
      ]);

      if (boardRes.ok) {
        const boardData = await boardRes.json();
        setBoard(boardData);
      }

      if (reservationsRes.ok) {
        const reservationsData = await reservationsRes.json();
        setReservations(reservationsData);
      }

      setLoading(false);
    } catch (error) {
      console.error("Error loading board:", error);
      setLoading(false);
    }
  };

  const handleSquareClick = (squareNumber: number) => {
    if (!board?.is_open) return;
    const isReserved = reservations.some((r) => r.square_idx === squareNumber - 1);
    if (isReserved) return;
    setSelectedSquare(squareNumber);
    setShowReserveModal(true);
  };

  const handleReserve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!board || selectedSquare === null) return;

    try {
      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          board_id: board.id,
          square_idx: selectedSquare,
          buyer_name: buyerName,
          email: email,
          venmo_handle: venmoHandle,
        }),
      });

      if (response.ok) {
        localStorage.setItem("userEmail", email);
        setUserEmail(email);
        
        setShowReserveModal(false);
        setBuyerName("");
        setEmail("");
        setVenmoHandle("");
        setSelectedSquare(null);
        await loadBoard();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to reserve square");
      }
    } catch (error) {
      console.error("Error reserving square:", error);
    }
  };

  const getReservationForSquare = (idx: number) => {
    return reservations.find((r) => r.square_idx === idx);
  };

  const isUserSquare = (idx: number) => {
    if (!userEmail) return false;
    const reservation = getReservationForSquare(idx);
    return reservation?.email === userEmail;
  };

  const getWinners = () => {
    if (!board?.scores || !board.top_nums || !board.side_nums) return {};

    const winners: Record<string, { square_idx: number; buyer_name: string } | null> = {
      q1: null,
      ht: null,
      q3: null,
      final: null,
    };

    (["q1", "ht", "q3", "final"] as const).forEach((checkpoint) => {
      const score = board.scores?.[checkpoint];
      if (score) {
        const topDigit = score.top % 10;
        const sideDigit = score.side % 10;
        const topIdx = board.top_nums!.indexOf(topDigit);
        const sideIdx = board.side_nums!.indexOf(sideDigit);
        const squareIdx = sideIdx * 10 + topIdx;
        const reservation = getReservationForSquare(squareIdx);
        if (reservation) {
          winners[checkpoint] = { square_idx: squareIdx, buyer_name: reservation.buyer_name };
        }
      }
    });

    return winners;
  };

  const isWinningSquare = (idx: number) => {
    const winners = getWinners();
    return Object.values(winners).some((w) => w?.square_idx === idx);
  };

  const calculatePayout = (checkpoint: "q1" | "ht" | "q3" | "final"): number => {
    if (!board) return 0;
    const payoutValue = checkpoint === "q3" && !board.payouts.q3 
      ? (board.payouts as any).q4 
      : board.payouts[checkpoint];
    
    if (payoutValue === undefined) return 0;
    
    if (board.payout_mode === "fixed") {
      return payoutValue;
    }
    const totalCollected = reservations.length * board.cost_per_square;
    return (totalCollected * payoutValue) / 100;
  };

  const calculatePot = (): number => {
    if (!board) return 0;
    return calculatePayout("q1") + calculatePayout("ht") + calculatePayout("q3") + calculatePayout("final");
  };

  if (loading) {
    return (
      <PublicLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
        </div>
      </PublicLayout>
    );
  }

  // Board list view
  if (!boardSlug) {
    const activeBoards = boards.filter(b => !b.scores);
    const completedBoards = boards.filter(b => b.scores);

    return (
      <PublicLayout>
        <div className="max-w-6xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
            <div className="flex items-center gap-4">
              <img 
                src="https://qbtfofrikbawvjwpmbob.supabase.co/storage/v1/object/public/assets/Nor'easters.jpg" 
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
                  <Link
                    key={board.id}
                    to={`/fundraising/squares?board=${board.slug}`}
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
                  </Link>
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
                  <Link
                    key={board.id}
                    to={`/fundraising/squares?board=${board.slug}`}
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
                  </Link>
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
        </div>
      </PublicLayout>
    );
  }

  // Board not found
  if (!board) {
    return (
      <PublicLayout>
        <div className="min-h-[60vh] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-sm p-8 max-w-md w-full text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Board Not Found</h1>
            <p className="text-gray-600 mb-6">The board you're looking for doesn't exist.</p>
            <Link
              to="/fundraising/squares"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-lg font-medium hover:bg-blue-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to All Boards
            </Link>
          </div>
        </div>
      </PublicLayout>
    );
  }

  const winners = getWinners();
  const pot = calculatePot();

  // Single board view
  return (
    <PublicLayout>
      <div className="bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img 
                  src="https://qbtfofrikbawvjwpmbob.supabase.co/storage/v1/object/public/assets/Nor'easters.jpg" 
                  alt="Cape Ann Nor'easters"
                  className="h-10 w-auto"
                />
                <div>
                  <h1 className="text-xl font-bold text-gray-900">{board.title}</h1>
                  <p className="text-sm text-gray-600">Cape Ann Nor'easters Fundraiser</p>
                </div>
              </div>
              <Link
                to="/fundraising/squares"
                className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:text-blue-700 font-medium"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Boards
              </Link>
            </div>
          </div>

          {/* Game Info */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900">{board.team_top}</h2>
                <span className="text-gray-600">vs</span>
                <h2 className="text-lg font-bold text-gray-900">{board.team_side}</h2>
              </div>
              {!board.is_open && (
                <span className="px-3 py-1 bg-red-100 text-red-800 rounded-lg text-sm font-medium">
                  Sales Closed
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <Calendar className="w-4 h-4 text-gray-500" />
                <span>{new Date(board.game_date).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <DollarSign className="w-4 h-4 text-green-600" />
                <span>${board.cost_per_square} per square</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Clock className="w-4 h-4 text-blue-600" />
                <span>Lock: {new Date(board.lock_at).toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Trophy className="w-4 h-4 text-yellow-600" />
                <span>Reserved: {reservations.length}/100</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Grid */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="overflow-x-auto">
                  <div className="inline-block min-w-full">
                    <div className="flex mb-1">
                      <div className="w-12"></div>
                      <div className="flex justify-center">
                        <div className="w-[480px] text-center text-sm font-semibold text-gray-700">{board.team_top}</div>
                      </div>
                    </div>
                    
                    <div className="flex mb-2">
                      <div className="w-12"></div>
                      <div className="flex">
                        <div className="w-12"></div>
                        {board.randomized_at && board.top_nums ? (
                          board.top_nums.map((num, i) => (
                            <div key={i} className="w-12 h-8 flex items-center justify-center font-bold text-gray-700">
                              {num}
                            </div>
                          ))
                        ) : (
                          Array.from({ length: 10 }).map((_, i) => (
                            <div key={i} className="w-12 h-8 flex items-center justify-center text-gray-400">
                              ?
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-start">
                      <div className="w-12 h-[480px] flex items-center justify-center mr-0">
                        <div className="transform -rotate-90 origin-center whitespace-nowrap text-sm font-semibold text-gray-700">
                          {board.team_side}
                        </div>
                      </div>
                      
                      <div>
                        {Array.from({ length: 10 }).map((_, row) => (
                          <div key={row} className="flex">
                            <div className="w-12 h-12 flex items-center justify-center font-bold text-gray-700">
                              {board.randomized_at && board.side_nums ? board.side_nums[row] : "?"}
                            </div>
                            {Array.from({ length: 10 }).map((_, col) => {
                              const idx = row * 10 + col;
                              const squareNumber = idx + 1;
                              const reservation = getReservationForSquare(idx);
                              const isWinner = isWinningSquare(idx);
                              const isOwnedByUser = isUserSquare(idx);
                              
                              let bgClass = "bg-white";
                              let borderClass = "border border-gray-300";
                              let textClass = "text-xs text-gray-900";
                              let cursorClass = "cursor-pointer";
                              
                              if (isWinner) {
                                bgClass = "bg-green-200";
                                borderClass = "border-2 border-green-600";
                                textClass = "text-xs text-green-900 font-bold";
                                cursorClass = "cursor-default";
                              } else if (reservation) {
                                cursorClass = "cursor-default";
                                if (reservation.status === "paid") {
                                  bgClass = "bg-blue-100";
                                  borderClass = "border border-blue-500";
                                  textClass = "text-xs text-blue-900 font-semibold";
                                } else {
                                  bgClass = isOwnedByUser ? "bg-yellow-200" : "bg-yellow-100";
                                  borderClass = isOwnedByUser ? "border border-yellow-600" : "border border-yellow-400";
                                  textClass = isOwnedByUser ? "text-xs text-yellow-900 font-semibold" : "text-xs text-yellow-800";
                                }
                              } else if (board.is_open) {
                                bgClass = "bg-white hover:bg-blue-50";
                                borderClass = "border border-gray-300 hover:border-blue-500";
                                cursorClass = "cursor-pointer";
                              } else {
                                bgClass = "bg-white";
                                borderClass = "border border-gray-200";
                                cursorClass = "cursor-not-allowed";
                              }

                              const tooltipText = reservation 
                                ? `${reservation.buyer_name}${reservation.status === "pending" ? " (Pending Payment)" : ""}`
                                : "Available";

                              return (
                                <div
                                  key={col}
                                  onClick={() => handleSquareClick(squareNumber)}
                                  title={tooltipText}
                                  className={`w-12 h-12 ${borderClass} ${bgClass} ${cursorClass} flex items-center justify-center ${textClass} transition-all relative group`}
                                >
                                  {reservation && (
                                    <>
                                      <span className="truncate px-1">{reservation.buyer_name.split(' ')[0]}</span>
                                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10 transition-opacity">
                                        {tooltipText}
                                      </div>
                                    </>
                                  )}
                                  {!reservation && board.is_open && (
                                    <span className="text-gray-400">+</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-4 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-white border border-gray-300"></div>
                    <span className="text-gray-600">Available</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-yellow-50 border border-yellow-300"></div>
                    <span className="text-gray-600">Pending Payment</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-blue-100 border border-blue-400"></div>
                    <span className="text-gray-600">Reserved (Paid)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-green-100 border-2 border-green-500"></div>
                    <span className="text-gray-600">Winner</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {/* Payouts */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Payouts</h3>
                <div className="space-y-3">
                  {(["q1", "ht", "q3", "final"] as const).map((checkpoint) => (
                    <div key={checkpoint} className="flex justify-between items-center text-sm">
                      <span className="font-medium text-gray-700">{checkpoint.toUpperCase()}</span>
                      <span className="text-green-700 font-semibold">
                        ${calculatePayout(checkpoint).toFixed(2)}
                      </span>
                    </div>
                  ))}
                  <div className="pt-3 border-t border-gray-200">
                    <div className="flex justify-between items-center font-bold">
                      <span className="text-gray-900">Total Pot</span>
                      <span className="text-blue-700">${pot.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Winners */}
              {Object.keys(winners).some((k) => winners[k as keyof typeof winners]) && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-600" />
                    Winners
                  </h3>
                  <div className="space-y-2">
                    {(["q1", "ht", "q3", "final"] as const).map((checkpoint) => {
                      const winner = winners[checkpoint];
                      if (!winner) return null;
                      return (
                        <div key={checkpoint} className="p-3 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex justify-between items-center">
                            <span className="font-medium text-green-800">{checkpoint.toUpperCase()}</span>
                            <span className="text-gray-900 font-semibold">{winner.buyer_name}</span>
                          </div>
                          <div className="text-xs text-gray-600 mt-1">
                            Square {winner.square_idx + 1}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* How to Play */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">How to Play</h3>
                <ol className="space-y-2 text-sm text-gray-600">
                  <li className="flex gap-2">
                    <span className="font-bold text-blue-700">1.</span>
                    <span>Select an available square on the grid</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-blue-700">2.</span>
                    <span>Enter your name and reserve it</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-blue-700">3.</span>
                    <span>Send ${board.cost_per_square} via Venmo to @{board.venmo_handle}</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-blue-700">4.</span>
                    <span>Numbers are assigned randomly once the board is full</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-blue-700">5.</span>
                    <span>Winners are determined by the last digit of each team's score</span>
                  </li>
                </ol>
                <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
                  <p className="text-xs text-gray-600 italic">
                    Note: Payment verification is done manually and can take some time.
                  </p>
                  <p className="text-xs text-gray-600">
                    For any questions email Kevin at{" "}
                    <a href="mailto:kevin@capeannnoreasters.com" className="text-blue-600 hover:text-blue-700 underline">
                      kevin@capeannnoreasters.com
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reserve Modal */}
      {showReserveModal && selectedSquare !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Reserve Square {selectedSquare}</h3>
            <form onSubmit={handleReserve} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your Name *</label>
                <input
                  type="text"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="your@email.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Venmo Handle *</label>
                <input
                  type="text"
                  value={venmoHandle}
                  onChange={(e) => setVenmoHandle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="@yourvenmo"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">For payment verification purposes</p>
              </div>
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-gray-700">
                  After reserving, please send ${board.cost_per_square} via Venmo to{" "}
                  <span className="font-bold text-gray-900">@{board.venmo_handle}</span>
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowReserveModal(false);
                    setSelectedSquare(null);
                    setBuyerName("");
                    setEmail("");
                    setVenmoHandle("");
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-medium transition-colors"
                >
                  Reserve
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PublicLayout>
  );
}
