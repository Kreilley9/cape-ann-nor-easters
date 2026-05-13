import { useState, useEffect } from "react";
import { PortalLayout } from "@/react-app/components/layout/PortalLayout";
import {
  Loader2, Plus, Edit, Trophy, QrCode, DollarSign, 
  Ticket, Users, CheckCircle, X, RefreshCw
} from "lucide-react";

interface Raffle {
  id: number;
  title: string;
  description: string | null;
  status: "draft" | "open" | "closed" | "completed";
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
  total_collected: number;
  ticket_count?: number;
  paid_total?: number;
  created_at: string;
}

interface RaffleSeller {
  id: number;
  raffle_id: number;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  created_at: string;
}

interface RaffleTicket {
  id: number;
  ticket_number: string;
  buyer_name: string;
  quantity: number;
  amount_paid: number;
  is_paid: number;
  seller_name: string | null;
  created_at: string;
}

export default function PortalRaffles() {
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRaffle, setEditingRaffle] = useState<Raffle | null>(null);
  const [selectedRaffle, setSelectedRaffle] = useState<Raffle | null>(null);
  const [tickets, setTickets] = useState<RaffleTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectingWinner, setSelectingWinner] = useState(false);
  const [_sellers, setSellers] = useState<RaffleSeller[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    status: "draft" as "draft" | "open" | "closed" | "completed",
    tickets_for_1: "",
    tickets_for_5: "",
    tickets_for_10: "",
    tickets_for_25: "",
    tickets_for_50: "",
    tickets_for_100: "",
    sales_close_at: "",
    winner_select_at: "",
  });

  useEffect(() => {
    loadRaffles();
  }, []);

  const loadRaffles = async () => {
    try {
      const res = await fetch("/api/portal/raffles", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setRaffles(data);
      }
    } catch (error) {
      console.error("Error loading raffles:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadTickets = async (raffleId: number) => {
    setLoadingTickets(true);
    try {
      const res = await fetch(`/api/portal/raffles/${raffleId}/tickets`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setTickets(data);
      }
    } catch (error) {
      console.error("Error loading tickets:", error);
    } finally {
      setLoadingTickets(false);
    }
  };

  const loadSellers = async (raffleId: number) => {
    try {
      const res = await fetch(`/api/portal/raffles/${raffleId}/sellers`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setSellers(data);
      }
    } catch (error) {
      console.error("Error loading sellers:", error);
    }
  };

  const selectRaffle = async (raffle: Raffle) => {
    setSelectedRaffle(raffle);
    await loadTickets(raffle.id);
    await loadSellers(raffle.id);
  };

  const openCreateModal = () => {
    setEditingRaffle(null);
    setFormData({
      title: "",
      description: "",
      status: "draft",
      tickets_for_1: "",
      tickets_for_5: "",
      tickets_for_10: "",
      tickets_for_25: "",
      tickets_for_50: "",
      tickets_for_100: "",
      sales_close_at: "",
      winner_select_at: "",
    });
    setShowModal(true);
  };

  const openEditModal = (raffle: Raffle) => {
    setEditingRaffle(raffle);
    setFormData({
      title: raffle.title,
      description: raffle.description || "",
      status: raffle.status,
      tickets_for_1: raffle.tickets_for_1?.toString() || "",
      tickets_for_5: raffle.tickets_for_5?.toString() || "",
      tickets_for_10: raffle.tickets_for_10?.toString() || "",
      tickets_for_25: raffle.tickets_for_25?.toString() || "",
      tickets_for_50: raffle.tickets_for_50?.toString() || "",
      tickets_for_100: raffle.tickets_for_100?.toString() || "",
      sales_close_at: raffle.sales_close_at?.slice(0, 16) || "",
      winner_select_at: raffle.winner_select_at?.slice(0, 16) || "",
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const payload = {
        title: formData.title,
        description: formData.description || undefined,
        status: formData.status,
        tickets_for_1: formData.tickets_for_1 ? parseInt(formData.tickets_for_1) : undefined,
        tickets_for_5: formData.tickets_for_5 ? parseInt(formData.tickets_for_5) : undefined,
        tickets_for_10: formData.tickets_for_10 ? parseInt(formData.tickets_for_10) : undefined,
        tickets_for_25: formData.tickets_for_25 ? parseInt(formData.tickets_for_25) : undefined,
        tickets_for_50: formData.tickets_for_50 ? parseInt(formData.tickets_for_50) : undefined,
        tickets_for_100: formData.tickets_for_100 ? parseInt(formData.tickets_for_100) : undefined,
        sales_close_at: formData.sales_close_at || undefined,
        winner_select_at: formData.winner_select_at || undefined,
      };

      const url = editingRaffle 
        ? `/api/portal/raffles/${editingRaffle.id}`
        : "/api/portal/raffles";
      const method = editingRaffle ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setShowModal(false);
        loadRaffles();
        if (selectedRaffle && editingRaffle?.id === selectedRaffle.id) {
          const updated = await fetch(`/api/portal/raffles/${selectedRaffle.id}`, { credentials: "include" });
          if (updated.ok) setSelectedRaffle(await updated.json());
        }
      } else {
        const error = await res.json().catch(() => ({ error: "Failed to save raffle" }));
        alert(error.error || `Failed to ${editingRaffle ? 'update' : 'create'} raffle. Please try again.`);
        console.error("Error saving raffle:", error);
      }
    } catch (error) {
      console.error("Error submitting raffle:", error);
      alert(`Failed to ${editingRaffle ? 'update' : 'create'} raffle. Please try again.`);
    }
  };

  const markTicketPaid = async (ticketId: number) => {
    const res = await fetch(`/api/portal/raffle-tickets/${ticketId}/paid`, {
      method: "PATCH",
      credentials: "include",
    });
    if (res.ok && selectedRaffle) {
      loadTickets(selectedRaffle.id);
      loadRaffles();
    }
  };

  const selectWinner = async () => {
    if (!selectedRaffle) return;
    setSelectingWinner(true);
    
    // Dramatic delay for effect
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const res = await fetch(`/api/portal/raffles/${selectedRaffle.id}/select-winner`, {
      method: "POST",
      credentials: "include",
    });
    
    if (res.ok) {
      const data = await res.json();
      alert(`🎉 Winner: ${data.winner.buyer_name}\nTicket #${data.winner.ticket_number}`);
      loadRaffles();
      // Refresh selected raffle
      const updated = await fetch(`/api/portal/raffles/${selectedRaffle.id}`, { credentials: "include" });
      if (updated.ok) setSelectedRaffle(await updated.json());
    } else {
      const error = await res.json();
      alert(error.error || "Error selecting winner");
    }
    setSelectingWinner(false);
  };

  const getQRCodeUrl = (raffleId: number) => {
    const baseUrl = window.location.origin;
    const raffleUrl = `${baseUrl}/raffle/${raffleId}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(raffleUrl)}`;
  };

  const getSellerUrl = (raffleId: number) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/raffle/${raffleId}/seller`;
  };

  const statusColors: Record<string, string> = {
    draft: "bg-gray-500",
    open: "bg-emerald-500",
    closed: "bg-amber-500",
    completed: "bg-violet-500",
  };

  const paidTotal = tickets.filter(t => t.is_paid).reduce((sum, t) => sum + t.amount_paid, 0);
  const prizePool = paidTotal * 0.5;

  return (
    <PortalLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white font-[Oswald] tracking-wide">
            50/50 Raffles
          </h1>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-[#00c4ff] text-white rounded-lg hover:bg-[#00a0d4] transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Raffle
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#00c4ff] animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Raffle List */}
            <div className="lg:col-span-1 space-y-3">
              <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">All Raffles</h2>
              {raffles.length === 0 ? (
                <div className="text-center py-8 text-gray-500 rounded-xl border border-[#00c4ff]/20" style={{ background: "rgba(18, 26, 36, 0.8)" }}>
                  <Ticket className="w-12 h-12 mx-auto mb-2 text-gray-600" />
                  <p>No raffles yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {raffles.map((raffle) => (
                    <button
                      key={raffle.id}
                      onClick={() => selectRaffle(raffle)}
                      className={`w-full text-left p-4 rounded-xl border transition-all ${
                        selectedRaffle?.id === raffle.id
                          ? "border-[#00c4ff] bg-[#00c4ff]/10"
                          : "border-[#00c4ff]/20 hover:border-[#00c4ff]/40"
                      }`}
                      style={{ background: "rgba(18, 26, 36, 0.8)" }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-medium text-white">{raffle.title}</h3>
                          <p className="text-sm text-gray-400">{raffle.ticket_count || 0} tickets</p>
                        </div>
                        <span className={`px-2 py-0.5 text-xs text-white rounded capitalize ${statusColors[raffle.status]}`}>
                          {raffle.status}
                        </span>
                      </div>
                      {raffle.winner_name && (
                        <p className="mt-2 text-sm text-emerald-400">
                          <Trophy className="inline w-4 h-4 mr-1" />
                          Winner: {raffle.winner_name}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Raffle Detail */}
            <div className="lg:col-span-2">
              {selectedRaffle ? (
                <div className="space-y-4">
                  {/* Raffle Header */}
                  <div className="p-6 rounded-xl border border-[#00c4ff]/20" style={{ background: "rgba(18, 26, 36, 0.8)" }}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-xl font-bold text-white">{selectedRaffle.title}</h2>
                        {selectedRaffle.description && (
                          <p className="text-gray-400 mt-1">{selectedRaffle.description}</p>
                        )}
                        <span className={`inline-block mt-2 px-2 py-0.5 text-xs text-white rounded capitalize ${statusColors[selectedRaffle.status]}`}>
                          {selectedRaffle.status}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowQRModal(true)}
                          className="p-2 text-gray-400 hover:text-white transition-colors"
                          title="Show QR Code"
                        >
                          <QrCode className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => openEditModal(selectedRaffle)}
                          className="p-2 text-gray-400 hover:text-white transition-colors"
                          title="Edit Raffle"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4 mt-6">
                      <div className="text-center p-3 rounded-lg bg-white/5">
                        <Users className="w-5 h-5 text-[#00c4ff] mx-auto mb-1" />
                        <p className="text-2xl font-bold text-white">{tickets.length}</p>
                        <p className="text-xs text-gray-400">Tickets Sold</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-white/5">
                        <DollarSign className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                        <p className="text-2xl font-bold text-white">${paidTotal.toFixed(2)}</p>
                        <p className="text-xs text-gray-400">Total Collected</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                        <Trophy className="w-5 h-5 text-amber-400 mx-auto mb-1" />
                        <p className="text-2xl font-bold text-amber-400">${prizePool.toFixed(2)}</p>
                        <p className="text-xs text-gray-400">Prize Pool (50%)</p>
                      </div>
                    </div>

                    {/* Pricing */}
                    <div className="mt-6">
                      <p className="text-sm text-gray-400 mb-2">Ticket Pricing</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedRaffle.tickets_for_1 && <span className="px-2 py-1 text-sm bg-white/5 rounded text-gray-300">$1 = {selectedRaffle.tickets_for_1} tickets</span>}
                        {selectedRaffle.tickets_for_5 && <span className="px-2 py-1 text-sm bg-white/5 rounded text-gray-300">$5 = {selectedRaffle.tickets_for_5} tickets</span>}
                        {selectedRaffle.tickets_for_10 && <span className="px-2 py-1 text-sm bg-white/5 rounded text-gray-300">$10 = {selectedRaffle.tickets_for_10} tickets</span>}
                        {selectedRaffle.tickets_for_25 && <span className="px-2 py-1 text-sm bg-white/5 rounded text-gray-300">$25 = {selectedRaffle.tickets_for_25} tickets</span>}
                        {selectedRaffle.tickets_for_50 && <span className="px-2 py-1 text-sm bg-white/5 rounded text-gray-300">$50 = {selectedRaffle.tickets_for_50} tickets</span>}
                        {selectedRaffle.tickets_for_100 && <span className="px-2 py-1 text-sm bg-white/5 rounded text-gray-300">$100 = {selectedRaffle.tickets_for_100} tickets</span>}
                      </div>
                    </div>

                    {/* Winner Selection */}
                    {selectedRaffle.status === "open" && tickets.some(t => t.is_paid) && (
                      <div className="mt-6 pt-6 border-t border-[#00c4ff]/20">
                        <button
                          onClick={selectWinner}
                          disabled={selectingWinner}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50"
                        >
                          {selectingWinner ? (
                            <>
                              <RefreshCw className="w-5 h-5 animate-spin" />
                              Selecting Winner...
                            </>
                          ) : (
                            <>
                              <Trophy className="w-5 h-5" />
                              Select Winner
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {/* Winner Display */}
                    {selectedRaffle.winner_name && (
                      <div className="mt-6 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                        <div className="flex items-center gap-3">
                          <Trophy className="w-8 h-8 text-emerald-400" />
                          <div>
                            <p className="text-sm text-emerald-400">Winner</p>
                            <p className="text-xl font-bold text-white">{selectedRaffle.winner_name}</p>
                            <p className="text-sm text-gray-400">Ticket #{selectedRaffle.winning_ticket_number}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Ticket List */}
                  <div className="p-6 rounded-xl border border-[#00c4ff]/20" style={{ background: "rgba(18, 26, 36, 0.8)" }}>
                    <h3 className="font-medium text-white mb-4">Tickets</h3>
                    {loadingTickets ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="w-6 h-6 text-[#00c4ff] animate-spin" />
                      </div>
                    ) : tickets.length === 0 ? (
                      <p className="text-center py-8 text-gray-500">No tickets purchased yet</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-[#00c4ff]/20">
                              <th className="text-left py-2 px-2 text-sm font-medium text-gray-400">Ticket #</th>
                              <th className="text-left py-2 px-2 text-sm font-medium text-gray-400">Name</th>
                              <th className="text-left py-2 px-2 text-sm font-medium text-gray-400">Qty</th>
                              <th className="text-left py-2 px-2 text-sm font-medium text-gray-400">Amount</th>
                              <th className="text-left py-2 px-2 text-sm font-medium text-gray-400">Status</th>
                              <th className="text-right py-2 px-2 text-sm font-medium text-gray-400">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tickets.map((ticket) => (
                              <tr key={ticket.id} className="border-b border-[#00c4ff]/10">
                                <td className="py-2 px-2 text-white font-mono">{ticket.ticket_number}</td>
                                <td className="py-2 px-2 text-white">{ticket.buyer_name}</td>
                                <td className="py-2 px-2 text-gray-300">{ticket.quantity}</td>
                                <td className="py-2 px-2 text-gray-300">${ticket.amount_paid.toFixed(2)}</td>
                                <td className="py-2 px-2">
                                  {ticket.is_paid ? (
                                    <span className="flex items-center gap-1 text-emerald-400 text-sm">
                                      <CheckCircle className="w-4 h-4" /> Paid
                                    </span>
                                  ) : (
                                    <span className="text-amber-400 text-sm">Pending</span>
                                  )}
                                </td>
                                <td className="py-2 px-2 text-right">
                                  {!ticket.is_paid && (
                                    <button
                                      onClick={() => markTicketPaid(ticket.id)}
                                      className="text-sm text-[#00c4ff] hover:underline"
                                    >
                                      Mark Paid
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-16 text-gray-500 rounded-xl border border-[#00c4ff]/20" style={{ background: "rgba(18, 26, 36, 0.8)" }}>
                  <Ticket className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                  <p className="text-lg">Select a raffle to view details</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Create/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
            <div className="w-full max-w-lg rounded-xl border border-[#00c4ff]/20 max-h-[90vh] overflow-y-auto" style={{ background: "rgba(18, 26, 36, 0.95)" }}>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-white">
                    {editingRaffle ? "Edit Raffle" : "Create Raffle"}
                  </h2>
                  <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Title</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-[#00c4ff]/20 text-white focus:border-[#00c4ff] focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-[#00c4ff]/20 text-white focus:border-[#00c4ff] focus:outline-none"
                      rows={2}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-[#00c4ff]/20 text-white focus:border-[#00c4ff] focus:outline-none"
                    >
                      <option value="draft" className="bg-gray-800 text-white">Draft</option>
                      <option value="open" className="bg-gray-800 text-white">Open</option>
                      <option value="closed" className="bg-gray-800 text-white">Closed</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">$1 = tickets</label>
                      <input
                        type="number"
                        step="1"
                        value={formData.tickets_for_1}
                        onChange={(e) => setFormData({ ...formData, tickets_for_1: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-[#00c4ff]/20 text-white focus:border-[#00c4ff] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">$5 = tickets</label>
                      <input
                        type="number"
                        step="1"
                        value={formData.tickets_for_5}
                        onChange={(e) => setFormData({ ...formData, tickets_for_5: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-[#00c4ff]/20 text-white focus:border-[#00c4ff] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">$10 = tickets</label>
                      <input
                        type="number"
                        step="1"
                        value={formData.tickets_for_10}
                        onChange={(e) => setFormData({ ...formData, tickets_for_10: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-[#00c4ff]/20 text-white focus:border-[#00c4ff] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">$25 = tickets</label>
                      <input
                        type="number"
                        step="1"
                        value={formData.tickets_for_25}
                        onChange={(e) => setFormData({ ...formData, tickets_for_25: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-[#00c4ff]/20 text-white focus:border-[#00c4ff] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">$50 = tickets</label>
                      <input
                        type="number"
                        step="1"
                        value={formData.tickets_for_50}
                        onChange={(e) => setFormData({ ...formData, tickets_for_50: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-[#00c4ff]/20 text-white focus:border-[#00c4ff] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">$100 = tickets</label>
                      <input
                        type="number"
                        step="1"
                        value={formData.tickets_for_100}
                        onChange={(e) => setFormData({ ...formData, tickets_for_100: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-[#00c4ff]/20 text-white focus:border-[#00c4ff] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Sales Close At</label>
                      <input
                        type="datetime-local"
                        value={formData.sales_close_at}
                        onChange={(e) => setFormData({ ...formData, sales_close_at: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-[#00c4ff]/20 text-white focus:border-[#00c4ff] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Winner Selection</label>
                      <input
                        type="datetime-local"
                        value={formData.winner_select_at}
                        onChange={(e) => setFormData({ ...formData, winner_select_at: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-[#00c4ff]/20 text-white focus:border-[#00c4ff] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="flex-1 px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-white/5 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 bg-[#00c4ff] text-white rounded-lg hover:bg-[#00a0d4] transition-colors"
                    >
                      {editingRaffle ? "Update" : "Create"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* QR Code Modal */}
        {showQRModal && selectedRaffle && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
            <div className="w-full max-w-md rounded-xl border border-[#00c4ff]/20 p-6" style={{ background: "rgba(18, 26, 36, 0.95)" }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">QR Code</h2>
                <button onClick={() => setShowQRModal(false)} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="text-center space-y-4">
                <img 
                  src={getQRCodeUrl(selectedRaffle.id)} 
                  alt="QR Code" 
                  className="mx-auto rounded-lg bg-white p-2"
                />
                <p className="text-gray-400 text-sm">Scan to purchase tickets</p>
                
                <div className="space-y-2 pt-4">
                  <p className="text-sm text-gray-400">Public Link:</p>
                  <input
                    readOnly
                    value={`${window.location.origin}/raffle/${selectedRaffle.id}`}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-[#00c4ff]/20 text-white text-sm"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm text-gray-400">Seller Link:</p>
                  <input
                    readOnly
                    value={getSellerUrl(selectedRaffle.id)}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-[#00c4ff]/20 text-white text-sm"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
