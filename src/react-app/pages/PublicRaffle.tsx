import { useState, useEffect } from "react";
import { useParams, Link } from "react-router";
import { Ticket, Trophy, CheckCircle, Clock, DollarSign, Users, ExternalLink } from "lucide-react";

interface Raffle {
  id: number;
  title: string;
  description: string | null;
  status: string;
  tickets_for_1: number | null;
  tickets_for_5: number | null;
  tickets_for_10: number | null;
  tickets_for_25: number | null;
  tickets_for_50: number | null;
  tickets_for_100: number | null;
  sales_close_at: string | null;
  winner_select_at: string | null;
  winning_ticket_number: string | null;
  winner_name: string | null;
  total_collected: number | null;
}

interface RaffleTicket {
  ticket_number: string;
  buyer_name: string;
  quantity: number;
  is_paid: number;
  created_at: string;
}

interface PricingOption {
  amount: number;
  tickets: number;
}

export default function PublicRaffle() {
  const { id } = useParams();
  const [raffle, setRaffle] = useState<Raffle | null>(null);
  const [tickets, setTickets] = useState<RaffleTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Purchase form
  const [buyerName, setBuyerName] = useState("");
  const [selectedOption, setSelectedOption] = useState<PricingOption | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseResult, setPurchaseResult] = useState<{ ticketNumbers: string[]; quantity: number } | null>(null);

  useEffect(() => {
    loadRaffle();
  }, [id]);

  const loadRaffle = async () => {
    try {
      const [raffleRes, ticketsRes] = await Promise.all([
        fetch(`/api/public/raffles/${id}`),
        fetch(`/api/public/raffles/${id}/tickets`)
      ]);

      if (!raffleRes.ok) {
        setError("Raffle not found");
        setLoading(false);
        return;
      }

      const raffleData = await raffleRes.json();
      const ticketsData = await ticketsRes.json();

      setRaffle(raffleData);
      setTickets(ticketsData);
    } catch (err) {
      setError("Failed to load raffle");
    } finally {
      setLoading(false);
    }
  };

  const getPricingOptions = (): PricingOption[] => {
    if (!raffle) return [];
    const options: PricingOption[] = [];
    if (raffle.tickets_for_1) options.push({ amount: 1, tickets: raffle.tickets_for_1 });
    if (raffle.tickets_for_5) options.push({ amount: 5, tickets: raffle.tickets_for_5 });
    if (raffle.tickets_for_10) options.push({ amount: 10, tickets: raffle.tickets_for_10 });
    if (raffle.tickets_for_25) options.push({ amount: 25, tickets: raffle.tickets_for_25 });
    if (raffle.tickets_for_50) options.push({ amount: 50, tickets: raffle.tickets_for_50 });
    if (raffle.tickets_for_100) options.push({ amount: 100, tickets: raffle.tickets_for_100 });
    return options;
  };

  const handlePurchase = async () => {
    if (!selectedOption || !buyerName.trim()) return;
    
    setPurchasing(true);
    try {
      const res = await fetch(`/api/public/raffles/${id}/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyer_name: buyerName.trim(),
          quantity: selectedOption.tickets,
          amount: selectedOption.amount
        })
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Purchase failed");
        return;
      }

      const result = await res.json();
      setPurchaseResult({ ticketNumbers: result.ticketNumbers, quantity: result.quantity });
      loadRaffle(); // Refresh ticket list
    } catch (err) {
      alert("Purchase failed");
    } finally {
      setPurchasing(false);
    }
  };

  const getVenmoUrl = () => {
    if (!selectedOption) return "";
    const note = encodeURIComponent(`Nor'easters 50/50 Raffle - ${selectedOption.tickets} ticket${selectedOption.tickets > 1 ? 's' : ''}`);
    return `https://venmo.com/u/kevinreilley?txn=pay&amount=${selectedOption.amount}&note=${note}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !raffle) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="text-center">
          <Ticket className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Raffle Not Found</h1>
          <p className="text-gray-400 mb-6">This raffle may have ended or doesn't exist.</p>
          <Link to="/" className="text-cyan-400 hover:text-cyan-300">← Back to Home</Link>
        </div>
      </div>
    );
  }

  const pricingOptions = getPricingOptions();
  const isOpen = raffle.status === "open";
  const isCompleted = raffle.status === "completed";
  const paidTickets = tickets.filter(t => t.is_paid).reduce((sum, t) => sum + t.quantity, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="bg-slate-800/80 border-b border-cyan-500/30">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                <Ticket className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">{raffle.title}</h1>
                <p className="text-cyan-400 text-sm">Nor'easters 50/50 Raffle</p>
              </div>
            </div>
            <Link to="/" className="text-cyan-400 hover:text-cyan-300 text-sm">
              ← Back to Site
            </Link>
          </div>
          {raffle.description && (
            <p className="text-gray-300 mt-3">{raffle.description}</p>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        
        {/* Winner Banner */}
        {isCompleted && raffle.winning_ticket_number && (
          <div className="bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border-2 border-yellow-500 rounded-xl p-6 text-center">
            <Trophy className="w-12 h-12 text-yellow-400 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-yellow-400 mb-2">We Have a Winner!</h2>
            <p className="text-white text-lg">{raffle.winner_name}</p>
            <p className="text-yellow-400/80 text-sm mt-1">Ticket #{raffle.winning_ticket_number}</p>
            {raffle.total_collected && (
              <p className="text-gray-300 mt-3">
                Prize: <span className="text-green-400 font-bold">${(raffle.total_collected / 2).toFixed(2)}</span>
              </p>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-800/60 border border-cyan-500/30 rounded-lg p-4 text-center">
            <Users className="w-5 h-5 text-cyan-400 mx-auto mb-1" />
            <div className="text-2xl font-bold text-white">{tickets.length}</div>
            <div className="text-xs text-gray-400">Entries</div>
          </div>
          <div className="bg-slate-800/60 border border-cyan-500/30 rounded-lg p-4 text-center">
            <Ticket className="w-5 h-5 text-cyan-400 mx-auto mb-1" />
            <div className="text-2xl font-bold text-white">{paidTickets}</div>
            <div className="text-xs text-gray-400">Paid Tickets</div>
          </div>
          <div className="bg-slate-800/60 border border-cyan-500/30 rounded-lg p-4 text-center">
            <DollarSign className="w-5 h-5 text-green-400 mx-auto mb-1" />
            <div className="text-2xl font-bold text-green-400">${raffle.total_collected || 0}</div>
            <div className="text-xs text-gray-400">Pot</div>
          </div>
        </div>

        {/* Purchase Form - Only show if raffle is open */}
        {isOpen && !purchaseResult && (
          <div className="bg-slate-800/60 border border-cyan-500/30 rounded-xl p-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Ticket className="w-5 h-5 text-cyan-400" />
              Buy Tickets
            </h2>

            {/* Name Input */}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Your Name</label>
              <input
                type="text"
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-4 py-3 bg-slate-900/50 border border-cyan-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* Pricing Options */}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Select Amount</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {pricingOptions.map((option) => (
                  <button
                    key={option.amount}
                    onClick={() => setSelectedOption(option)}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      selectedOption?.amount === option.amount
                        ? "border-cyan-400 bg-cyan-500/20 text-white"
                        : "border-slate-600 bg-slate-900/50 text-gray-300 hover:border-cyan-500/50"
                    }`}
                  >
                    <div className="text-lg font-bold">${option.amount}</div>
                    <div className="text-sm text-cyan-400">{option.tickets} ticket{option.tickets > 1 ? 's' : ''}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <button
              onClick={handlePurchase}
              disabled={!buyerName.trim() || !selectedOption || purchasing}
              className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:from-cyan-400 hover:to-blue-500 transition-all"
            >
              {purchasing ? "Processing..." : selectedOption ? `Reserve ${selectedOption.tickets} Ticket${selectedOption.tickets > 1 ? 's' : ''} - $${selectedOption.amount}` : "Select Amount"}
            </button>

            <p className="text-center text-gray-500 text-sm mt-3">
              You'll pay via Venmo after reserving
            </p>
          </div>
        )}

        {/* Purchase Success */}
        {purchaseResult && (
          <div className="bg-slate-800/60 border border-green-500/50 rounded-xl p-6 text-center">
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-white mb-2">Tickets Reserved!</h2>
            <div className="text-gray-300 mb-4">
              Your ticket number{purchaseResult.quantity > 1 ? 's' : ''}:{' '}
              <div className="mt-2 space-y-1">
                {purchaseResult.ticketNumbers.map((num, i) => (
                  <div key={i} className="text-cyan-400 font-mono text-xl">#{num}</div>
                ))}
              </div>
            </div>
            <p className="text-gray-400 text-sm mb-6">
              {purchaseResult.quantity} ticket{purchaseResult.quantity > 1 ? 's' : ''} reserved
            </p>
            
            <a
              href={getVenmoUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#008CFF] text-white font-bold rounded-lg hover:bg-[#0077DD] transition-colors mb-4"
            >
              Pay with Venmo
              <ExternalLink className="w-4 h-4" />
            </a>

            <div className="space-y-2">
              <button
                onClick={() => {
                  setPurchaseResult(null);
                  setBuyerName("");
                  setSelectedOption(null);
                }}
                className="block w-full text-cyan-400 hover:text-cyan-300"
              >
                Buy More Tickets
              </button>
              
              <Link to="/" className="block w-full text-gray-400 hover:text-gray-300">
                ← Back to Cape Ann Nor'easters
              </Link>
            </div>
          </div>
        )}

        {/* Raffle Closed Message */}
        {raffle.status === "closed" && (
          <div className="bg-slate-800/60 border border-yellow-500/50 rounded-xl p-6 text-center">
            <Clock className="w-12 h-12 text-yellow-400 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-white mb-2">Sales Closed</h2>
            <p className="text-gray-400">
              Ticket sales have ended. Winner will be announced soon!
            </p>
          </div>
        )}

        {/* Recent Entries */}
        {tickets.length > 0 && (
          <div className="bg-slate-800/60 border border-cyan-500/30 rounded-xl p-6">
            <h2 className="text-lg font-bold text-white mb-4">Recent Entries</h2>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {tickets.slice(0, 20).map((ticket, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    ticket.is_paid 
                      ? "bg-green-500/10 border border-green-500/30" 
                      : "bg-slate-900/50 border border-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-cyan-400 font-mono">#{ticket.ticket_number}</span>
                    <span className="text-white">{ticket.buyer_name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400 text-sm">{ticket.quantity} ticket{ticket.quantity > 1 ? 's' : ''}</span>
                    {ticket.is_paid ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <Clock className="w-4 h-4 text-yellow-400" />
                    )}
                  </div>
                </div>
              ))}
            </div>
            {tickets.length > 20 && (
              <p className="text-center text-gray-500 text-sm mt-3">
                +{tickets.length - 20} more entries
              </p>
            )}
          </div>
        )}

        {/* Back to Home */}
        <div className="text-center pt-4">
          <Link to="/" className="text-cyan-400 hover:text-cyan-300">
            ← Back to Nor'easters
          </Link>
        </div>
      </div>
    </div>
  );
}
