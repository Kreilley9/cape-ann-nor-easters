import { useState, useEffect } from "react";
import { useParams, Link } from "react-router";
import { Ticket, CheckCircle, Clock, DollarSign, Plus, RefreshCw, User } from "lucide-react";

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
  total_collected: number | null;
}

interface RaffleTicket {
  id: number;
  ticket_number: string;
  buyer_name: string;
  quantity: number;
  amount_paid: number;
  is_paid: number;
  created_at: string;
}

interface PricingOption {
  amount: number;
  tickets: number;
}

export default function RaffleSeller() {
  const { id } = useParams();
  const [raffle, setRaffle] = useState<Raffle | null>(null);
  const [tickets, setTickets] = useState<RaffleTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // New ticket form
  const [showAddForm, setShowAddForm] = useState(false);
  const [buyerName, setBuyerName] = useState("");
  const [selectedOption, setSelectedOption] = useState<PricingOption | null>(null);
  const [markAsPaid, setMarkAsPaid] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Filter
  const [filter, setFilter] = useState<"all" | "paid" | "unpaid">("all");

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const res = await fetch(`/api/seller/raffles/${id}`);
      if (!res.ok) {
        setError("Raffle not found");
        setLoading(false);
        return;
      }

      const data = await res.json();
      setRaffle(data.raffle);
      setTickets(data.tickets);
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

  const handleAddTicket = async () => {
    if (!selectedOption || !buyerName.trim()) return;
    
    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/raffles/${id}/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyer_name: buyerName.trim(),
          quantity: selectedOption.tickets,
          amount: selectedOption.amount,
          seller_name: "In-Person Sale"
        })
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to add ticket");
        return;
      }

      const result = await res.json();
      
      // If mark as paid, immediately mark it
      if (markAsPaid) {
        // Need to find the ticket ID - reload and mark the newest one
        await loadData();
        const newTicket = tickets.find(t => t.ticket_number === result.ticketNumber);
        if (newTicket) {
          await markTicketPaid(newTicket.id);
        }
      }

      // Reset form
      setBuyerName("");
      setSelectedOption(null);
      setShowAddForm(false);
      await loadData();
    } catch (err) {
      alert("Failed to add ticket");
    } finally {
      setSubmitting(false);
    }
  };

  const markTicketPaid = async (ticketId: number) => {
    try {
      await fetch(`/api/seller/raffle-tickets/${ticketId}/paid`, {
        method: "PATCH"
      });
      await loadData();
    } catch (err) {
      alert("Failed to mark as paid");
    }
  };

  const filteredTickets = tickets.filter(t => {
    if (filter === "paid") return t.is_paid;
    if (filter === "unpaid") return !t.is_paid;
    return true;
  });

  const totalCollected = tickets.filter(t => t.is_paid).reduce((sum, t) => sum + t.amount_paid, 0);
  const unpaidCount = tickets.filter(t => !t.is_paid).length;

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="bg-slate-800/80 border-b border-cyan-500/30 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white">{raffle.title}</h1>
              <p className="text-cyan-400 text-sm">Seller Mode</p>
            </div>
            <button
              onClick={loadData}
              className="p-2 text-cyan-400 hover:bg-cyan-500/20 rounded-lg transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-800/60 border border-cyan-500/30 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-white">{tickets.length}</div>
            <div className="text-xs text-gray-400">Tickets</div>
          </div>
          <div className="bg-slate-800/60 border border-green-500/30 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-green-400">${totalCollected}</div>
            <div className="text-xs text-gray-400">Collected</div>
          </div>
          <div className="bg-slate-800/60 border border-yellow-500/30 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-yellow-400">{unpaidCount}</div>
            <div className="text-xs text-gray-400">Unpaid</div>
          </div>
        </div>

        {/* Add Ticket Button */}
        {raffle.status === "open" && !showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:from-cyan-400 hover:to-blue-500 transition-all"
          >
            <Plus className="w-5 h-5" />
            Add Ticket Sale
          </button>
        )}

        {/* Add Ticket Form */}
        {showAddForm && (
          <div className="bg-slate-800/60 border border-cyan-500/30 rounded-xl p-4">
            <h2 className="text-lg font-bold text-white mb-4">New Ticket Sale</h2>

            {/* Name Input */}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Buyer Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  placeholder="Enter buyer's name"
                  className="w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-cyan-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400"
                  autoFocus
                />
              </div>
            </div>

            {/* Quick Select Pricing */}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Select Amount</label>
              <div className="grid grid-cols-3 gap-2">
                {pricingOptions.map((option) => (
                  <button
                    key={option.amount}
                    onClick={() => setSelectedOption(option)}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      selectedOption?.amount === option.amount
                        ? "border-cyan-400 bg-cyan-500/20 text-white"
                        : "border-slate-600 bg-slate-900/50 text-gray-300"
                    }`}
                  >
                    <div className="text-lg font-bold">${option.amount}</div>
                    <div className="text-sm text-cyan-400">{option.tickets} tickets</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Mark as Paid Toggle */}
            <label className="flex items-center gap-3 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={markAsPaid}
                onChange={(e) => setMarkAsPaid(e.target.checked)}
                className="w-5 h-5 rounded border-cyan-500/30 bg-slate-900/50 text-cyan-500 focus:ring-cyan-500"
              />
              <span className="text-white">Mark as paid (cash collected)</span>
            </label>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setBuyerName("");
                  setSelectedOption(null);
                }}
                className="flex-1 py-3 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddTicket}
                disabled={!buyerName.trim() || !selectedOption || submitting}
                className="flex-1 py-3 bg-cyan-500 text-white font-bold rounded-lg disabled:opacity-50 hover:bg-cyan-400 transition-colors"
              >
                {submitting ? "Adding..." : selectedOption ? `Add - $${selectedOption.amount}` : "Select Amount"}
              </button>
            </div>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex gap-2">
          {(["all", "unpaid", "paid"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/50"
                  : "bg-slate-800/60 text-gray-400 border border-slate-700"
              }`}
            >
              {f === "all" ? `All (${tickets.length})` : f === "unpaid" ? `Unpaid (${unpaidCount})` : `Paid (${tickets.length - unpaidCount})`}
            </button>
          ))}
        </div>

        {/* Ticket List */}
        <div className="space-y-2">
          {filteredTickets.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {filter === "all" ? "No tickets yet" : `No ${filter} tickets`}
            </div>
          ) : (
            filteredTickets.map((ticket) => (
              <div
                key={ticket.id}
                className={`flex items-center justify-between p-4 rounded-xl ${
                  ticket.is_paid
                    ? "bg-green-500/10 border border-green-500/30"
                    : "bg-slate-800/60 border border-yellow-500/30"
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-cyan-400 font-mono">#{ticket.ticket_number}</span>
                    {ticket.is_paid ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <Clock className="w-4 h-4 text-yellow-400" />
                    )}
                  </div>
                  <div className="text-white font-medium">{ticket.buyer_name}</div>
                  <div className="text-gray-400 text-sm">
                    {ticket.quantity} ticket{ticket.quantity > 1 ? 's' : ''} • ${ticket.amount_paid}
                  </div>
                </div>
                
                {!ticket.is_paid && (
                  <button
                    onClick={() => markTicketPaid(ticket.id)}
                    className="px-4 py-2 bg-green-500 text-white font-medium rounded-lg hover:bg-green-400 transition-colors flex items-center gap-2"
                  >
                    <DollarSign className="w-4 h-4" />
                    Paid
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Back Link */}
        <div className="text-center pt-4 pb-8">
          <Link to={`/raffle/${id}`} className="text-cyan-400 hover:text-cyan-300">
            View Public Page →
          </Link>
        </div>
      </div>
    </div>
  );
}
