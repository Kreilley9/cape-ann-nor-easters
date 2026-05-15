import { useState, useEffect } from "react";
import { Link } from "react-router";
import { PortalLayout } from "@/react-app/components/layout/PortalLayout";
import { useRoles } from "@/react-app/contexts/RoleContext";
import { formatDate } from "@/react-app/utils/dateFormat";
import { DollarSign, Plus, X, Users, Trash2, CheckCircle2, Edit2, TrendingUp, Clock, Ban, FileText } from "lucide-react";
import { apiFetch } from "@/react-app/lib/api";

interface Payment {
  id: number;
  team_id: number;
  team_name: string;
  description: string;
  due_date: string | null;
  notes: string | null;
  payment_type: 'fixed' | 'split';
  total_amount: number;
  created_at: string;
}

interface PlayerPayment {
  id: number;
  payment_id: number;
  player_id: number;
  amount: number;
  status: string;
  paid_at: string | null;
  waived_at: string | null;
  waived_by_name: string | null;
  waiver_reason: string | null;
  first_name: string;
  last_name: string;
  jersey_number?: string | null;
  family_name?: string | null;
  description?: string;
  due_date?: string | null;
  team_name?: string;
  notes?: string;
}

interface Team {
  id: number;
  name: string;
  age_group: string;
}

interface Player {
  id: number;
  first_name: string;
  last_name: string;
  jersey_number: string | null;
  family_name: string | null;
}

export default function PortalPayments() {
  const { isAdmin, isCoach, isParent } = useRoles();
  const canManage = isAdmin || isCoach;
  
  const [payments, setPayments] = useState<Payment[]>([]);
  const [familyPayments, setFamilyPayments] = useState<PlayerPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamPlayers, setTeamPlayers] = useState<Player[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<number | null>(null);
  const [playerPayments, setPlayerPayments] = useState<PlayerPayment[]>([]);
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<number | null>(null);
  const [allPlayerPayments, setAllPlayerPayments] = useState<PlayerPayment[]>([]);
  const [showWaiveModal, setShowWaiveModal] = useState(false);
  const [waivingPayment, setWaivingPayment] = useState<PlayerPayment | null>(null);
  const [waiverReason, setWaiverReason] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);

  const [newPayment, setNewPayment] = useState({
    team_id: 0,
    description: "",
    due_date: "",
    notes: "",
    payment_type: "fixed" as "fixed" | "split",
    amount: "",
    player_ids: [] as number[],
  });

  useEffect(() => {
    loadData();
  }, [isParent, canManage]);

  async function loadData() {
    try {
      if (isParent && !canManage) {
        // Parent view - load family payments
        await loadFamilyPayments();
      } else {
        // Admin/Coach view - load all payments
        await loadPayments();
        await loadTeams();
        await loadAllPlayerPayments();
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadFamilyPayments() {
    const res = await apiFetch("/api/portal/payments", {
    });
    const data = await res.json();
    setFamilyPayments(data);
  }

  async function loadPayments() {
    const res = await apiFetch("/api/portal/payments", {
    });
    const data = await res.json();
    setPayments(data);
  }

  async function loadAllPlayerPayments() {
    try {
      const res = await apiFetch("/api/portal/all-player-payments", {
      });
      const data = await res.json();
      setAllPlayerPayments(data);
    } catch (error) {
      console.error("Error loading all player payments:", error);
    }
  }

  async function loadTeams() {
    const res = await apiFetch("/api/portal/teams/all", {
    });
    const data = await res.json();
    setTeams(data);
  }

  async function loadTeamRoster(teamId: number) {
    const res = await apiFetch(`/api/portal/teams/${teamId}/roster`, {
    });
    const data = await res.json();
    setTeamPlayers(data);
  }

  async function loadPlayerPayments(paymentId: number) {
    const res = await apiFetch(`/api/portal/payments/${paymentId}/players`, {
    });
    const data = await res.json();
    setPlayerPayments(data);
    setSelectedPayment(paymentId);
  }

  async function handleCreatePayment(e: React.FormEvent) {
    e.preventDefault();

    if (newPayment.player_ids.length === 0) {
      alert("Please select at least one player");
      return;
    }

    setSavingPayment(true);
    try {
      const res = await apiFetch("/api/portal/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newPayment,
          amount: parseFloat(newPayment.amount),
          team_id: parseInt(newPayment.team_id as unknown as string),
        }),
      });

      if (res.ok) {
        setShowCreateModal(false);
        resetForm();
        await loadPayments();
        await loadAllPlayerPayments();
      }
    } finally {
      setSavingPayment(false);
    }
  }

  async function handleMarkPaid(playerPaymentId: number, currentStatus: string) {
    const newStatus = currentStatus === "paid" ? "pending" : "paid";
    
    const res = await apiFetch(`/api/portal/player-payments/${playerPaymentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });

    if (res.ok && selectedPayment) {
      await loadPlayerPayments(selectedPayment);
      await loadAllPlayerPayments();
    }
  }

  function handleWaivePayment(playerPayment: PlayerPayment) {
    setWaivingPayment(playerPayment);
    setWaiverReason("");
    setShowWaiveModal(true);
  }

  async function submitWaiver() {
    if (!waivingPayment) return;

    const res = await apiFetch(`/api/portal/player-payments/${waivingPayment.id}/waive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ waiver_reason: waiverReason }),
    });

    if (res.ok) {
      setShowWaiveModal(false);
      setWaivingPayment(null);
      setWaiverReason("");
      if (selectedPayment) {
        await loadPlayerPayments(selectedPayment);
      }
      await loadAllPlayerPayments();
    }
  }

  async function handleDeletePayment(paymentId: number) {
    if (!confirm("Are you sure you want to delete this payment? This will remove all player payment records.")) {
      return;
    }

    const res = await apiFetch(`/api/portal/payments/${paymentId}`, {
      method: "DELETE",
    });

    if (res.ok) {
      setSelectedPayment(null);
      setPlayerPayments([]);
      await loadPayments();
      await loadAllPlayerPayments();
    }
  }

  async function handleEditPayment(payment: Payment) {
    setEditingPayment(payment);
    await loadTeamRoster(payment.team_id);
    
    const res = await apiFetch(`/api/portal/payments/${payment.id}/players`, {
    });
    const players = await res.json();
    const playerIds = players.map((p: PlayerPayment) => p.player_id);
    
    setNewPayment({
      team_id: payment.team_id,
      description: payment.description,
      due_date: payment.due_date || "",
      notes: payment.notes || "",
      payment_type: payment.payment_type,
      amount: payment.payment_type === 'fixed' 
        ? (payment.total_amount / playerIds.length).toFixed(2)
        : payment.total_amount.toFixed(2),
      player_ids: playerIds,
    });
    
    setShowEditModal(true);
  }

  async function handleUpdatePayment(e: React.FormEvent) {
    e.preventDefault();
    if (!editingPayment) return;

    if (newPayment.player_ids.length === 0) {
      alert("Please select at least one player");
      return;
    }

    setSavingPayment(true);
    try {
      const res = await apiFetch(`/api/portal/payments/${editingPayment.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newPayment,
          amount: parseFloat(newPayment.amount),
          team_id: parseInt(newPayment.team_id as unknown as string),
        }),
      });

      if (res.ok) {
        setShowEditModal(false);
        setEditingPayment(null);
        resetForm();
        await loadPayments();
        await loadAllPlayerPayments();
        if (selectedPayment === editingPayment.id) {
          await loadPlayerPayments(editingPayment.id);
        }
      }
    } finally {
      setSavingPayment(false);
    }
  }

  function resetForm() {
    setNewPayment({
      team_id: 0,
      description: "",
      due_date: "",
      notes: "",
      payment_type: "fixed",
      amount: "",
      player_ids: [],
    });
    setTeamPlayers([]);
  }

  function togglePlayer(playerId: number) {
    setNewPayment((prev) => ({
      ...prev,
      player_ids: prev.player_ids.includes(playerId)
        ? prev.player_ids.filter((id) => id !== playerId)
        : [...prev.player_ids, playerId],
    }));
  }

  function selectAllPlayers() {
    setNewPayment((prev) => ({
      ...prev,
      player_ids: teamPlayers.map((p) => p.id),
    }));
  }

  function clearAllPlayers() {
    setNewPayment((prev) => ({
      ...prev,
      player_ids: [],
    }));
  }

  const calculatePreview = () => {
    const amount = parseFloat(newPayment.amount);
    const count = newPayment.player_ids.length;
    
    if (!amount || !count) return null;

    if (newPayment.payment_type === 'fixed') {
      return { perPlayer: amount, total: amount * count };
    } else {
      return { perPlayer: amount / count, total: amount };
    }
  };

  const preview = calculatePreview();

  // Calculate stats for admin/coach view
  const totalDuesAmount = allPlayerPayments
    .filter(pp => pp.status === 'pending')
    .reduce((sum, pp) => sum + pp.amount, 0);
  
  const totalDuesCount = allPlayerPayments.filter(pp => pp.status === 'pending').length;
  const totalPaidAmount = allPlayerPayments
    .filter(pp => pp.status === 'paid')
    .reduce((sum, pp) => sum + pp.amount, 0);
  const totalPaidCount = allPlayerPayments.filter(pp => pp.status === 'paid').length;
  const totalWaivedAmount = allPlayerPayments
    .filter(pp => pp.status === 'waived')
    .reduce((sum, pp) => sum + pp.amount, 0);
  const totalWaivedCount = allPlayerPayments.filter(pp => pp.status === 'waived').length;

  // Team breakdown
  const teamStats = teams.map(team => {
    const teamPayments = payments.filter(p => p.team_id === team.id);
    const teamPlayerPayments = allPlayerPayments.filter(pp => 
      teamPayments.some(p => p.id === pp.payment_id)
    );
    
    const duesAmount = teamPlayerPayments
      .filter(pp => pp.status === 'pending')
      .reduce((sum, pp) => sum + pp.amount, 0);
    const duesCount = teamPlayerPayments.filter(pp => pp.status === 'pending').length;
    
    return {
      team_id: team.id,
      team_name: team.name,
      age_group: team.age_group,
      duesAmount,
      duesCount,
    };
  }).filter(stat => stat.duesCount > 0);

  const filteredPayments = selectedTeamFilter 
    ? payments.filter(p => p.team_id === selectedTeamFilter)
    : payments;

  if (loading) {
    return (
      <PortalLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading payments...</div>
        </div>
      </PortalLayout>
    );
  }

  // PARENT VIEW - simplified family-only view
  if (isParent && !canManage) {
    const familyDues = familyPayments.filter(pp => pp.status === 'pending');
    const familyPaid = familyPayments.filter(pp => pp.status === 'paid');
    const totalOwed = familyDues.reduce((sum, pp) => sum + pp.amount, 0);
    const totalPaid = familyPaid.reduce((sum, pp) => sum + pp.amount, 0);

    return (
      <PortalLayout>
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-white font-[Oswald] mb-2">Your Family's Payments</h1>
            <p className="text-gray-500">View dues and payment history for your players</p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[rgba(18,26,36,0.8)] border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-xl p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 bg-[rgba(255,165,0,0.2)] border border-orange-500 rounded-lg">
                  <Clock className="w-6 h-6 text-orange-400" />
                </div>
                <span className="text-sm font-medium text-orange-400">Outstanding</span>
              </div>
              <p className="text-3xl font-bold text-white font-[Oswald] mb-1">
                ${totalOwed.toFixed(2)}
              </p>
              <p className="text-sm text-gray-400">{familyDues.length} pending {familyDues.length === 1 ? 'due' : 'dues'}</p>
            </div>

            <div className="bg-[rgba(18,26,36,0.8)] border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-xl p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 bg-[rgba(0,255,0,0.2)] border border-green-500 rounded-lg">
                  <CheckCircle2 className="w-6 h-6 text-green-400" />
                </div>
                <span className="text-sm font-medium text-green-400">Paid</span>
              </div>
              <p className="text-3xl font-bold text-white font-[Oswald] mb-1">
                ${totalPaid.toFixed(2)}
              </p>
              <p className="text-sm text-gray-400">{familyPaid.length} {familyPaid.length === 1 ? 'payment' : 'payments'} made</p>
            </div>
          </div>

          {/* Outstanding Dues */}
          {familyDues.length > 0 && (
            <div className="bg-[rgba(18,26,36,0.8)] border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-xl">
              <div className="p-6 border-b border-[#00c4ff]/50">
                <h2 className="text-lg font-semibold text-white font-[Oswald]">Outstanding Dues</h2>
                <p className="text-sm text-gray-400 mt-1">Payments that are currently due</p>
              </div>
              <div className="divide-y divide-[#00c4ff]/30">
                {familyDues.map((pp) => {
                  const venmoNote = `Nor'easters - ${pp.description} - ${pp.first_name} ${pp.last_name}`;
                  const venmoUrl = `https://venmo.com/u/kevinreilley?txn=pay&amount=${pp.amount.toFixed(2)}&note=${encodeURIComponent(venmoNote)}`;
                  return (
                    <div key={pp.id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-white font-[Oswald]">{pp.description}</h3>
                          <p className="text-sm text-gray-400 mt-1">
                            {pp.first_name} {pp.last_name}
                            {pp.team_name && <span className="ml-2 text-gray-400">• {pp.team_name}</span>}
                          </p>
                          {pp.due_date && (
                            <p className="text-sm text-orange-400 mt-1">
                              Due: {pp.due_date}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-orange-400">${pp.amount.toFixed(2)}</p>
                          <span className="text-xs px-2 py-1 rounded-full bg-[rgba(255,165,0,0.2)] border border-orange-500 text-orange-400">Pending</span>
                        </div>
                      </div>
                      <a
                        href={venmoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 w-full py-2.5 bg-[#008CFF] text-white font-semibold rounded-lg hover:bg-[#0070CC] shadow-lg shadow-[#008CFF]/30 transition-colors flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M19.27 3c.8 1.32 1.16 2.68 1.16 4.4 0 5.48-4.68 12.6-8.48 17.6H5.04L2 3.76 8.12 3.2l1.6 12.84c1.48-2.4 3.32-6.16 3.32-8.76 0-1.64-.28-2.76-.68-3.68L19.27 3z"/>
                        </svg>
                        Pay with Venmo
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Payment History */}
          <div className="bg-[rgba(18,26,36,0.8)] border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-xl">
            <div className="p-6 border-b border-[#00c4ff]/50">
              <h2 className="text-lg font-semibold text-white font-[Oswald]">Payment History</h2>
              <p className="text-sm text-gray-400 mt-1">Completed payments</p>
            </div>
            <div className="divide-y divide-[#00c4ff]/30">
              {familyPaid.length === 0 ? (
                <div className="p-6 text-center text-gray-400">
                  No payment history yet
                </div>
              ) : (
                familyPaid.map((pp) => (
                  <div key={pp.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium text-white font-[Oswald]">{pp.description}</h3>
                        <p className="text-sm text-gray-400 mt-1">
                          {pp.first_name} {pp.last_name}
                          {pp.team_name && <span className="ml-2 text-gray-400">• {pp.team_name}</span>}
                        </p>
                        {pp.paid_at && (
                          <p className="text-sm text-gray-400 mt-1">
                            Paid: {formatDate(pp.paid_at)}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold text-white font-[Oswald]">${pp.amount.toFixed(2)}</p>
                        <div className="flex items-center gap-1 text-green-400 mt-1">
                          <CheckCircle2 className="w-4 h-4" />
                          <span className="text-xs font-medium">Paid</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {familyPayments.length === 0 && (
            <div className="bg-[rgba(18,26,36,0.8)] border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-xl p-8 text-center">
              <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white font-[Oswald] mb-2">No payments yet</h3>
              <p className="text-gray-400">When dues are assigned to your players, they'll appear here.</p>
            </div>
          )}
        </div>
      </PortalLayout>
    );
  }

  // ADMIN/COACH VIEW - full management interface
  return (
    <PortalLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white font-[Oswald] mb-2">Dues & Payments</h1>
            <p className="text-gray-500">Track team fees and player payments</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/portal/outstanding-dues"
              className="flex items-center gap-2 px-4 py-2 border border-[#00c4ff]/30 text-[#00c4ff] hover:bg-[rgba(0,196,255,0.1)] rounded-lg font-medium transition-colors"
            >
              <FileText className="w-5 h-5" />
              Outstanding
            </Link>
            <Link
              to="/portal/accounting"
              className="flex items-center gap-2 px-4 py-2 border border-[#00c4ff]/30 text-[#00c4ff] hover:bg-[rgba(0,196,255,0.1)] rounded-lg font-medium transition-colors"
            >
              <TrendingUp className="w-5 h-5" />
              Accounting
            </Link>
            {isAdmin && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[#00c4ff] hover:bg-[#00a3d9] shadow-lg shadow-[#00c4ff]/20 text-white rounded-lg font-medium transition-colors"
              >
                <Plus className="w-5 h-5" />
                Create Dues
              </button>
            )}
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-[rgba(18,26,36,0.8)] border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-[rgba(255,165,0,0.2)] border border-orange-500 rounded-lg">
                <DollarSign className="w-6 h-6 text-orange-400" />
              </div>
              <span className="text-sm font-medium text-orange-400">Outstanding</span>
            </div>
            <p className="text-3xl font-bold text-white font-[Oswald] mb-1">
              ${totalDuesAmount.toFixed(2)}
            </p>
            <p className="text-sm text-gray-400">{totalDuesCount} pending dues</p>
          </div>

          <div className="bg-[rgba(18,26,36,0.8)] border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-[rgba(0,255,0,0.2)] border border-green-500 rounded-lg">
                <CheckCircle2 className="w-6 h-6 text-green-400" />
              </div>
              <span className="text-sm font-medium text-green-400">Collected</span>
            </div>
            <p className="text-3xl font-bold text-white font-[Oswald] mb-1">
              ${totalPaidAmount.toFixed(2)}
            </p>
            <p className="text-sm text-gray-400">{totalPaidCount} payments received</p>
          </div>

          <div className="bg-[rgba(18,26,36,0.8)] border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-[rgba(147,51,234,0.2)] border border-purple-500 rounded-lg">
                <Ban className="w-6 h-6 text-purple-400" />
              </div>
              <span className="text-sm font-medium text-purple-400">Waived</span>
            </div>
            <p className="text-3xl font-bold text-white font-[Oswald] mb-1">
              ${totalWaivedAmount.toFixed(2)}
            </p>
            <p className="text-sm text-gray-400">{totalWaivedCount} fees waived</p>
          </div>

          <div className="bg-[rgba(18,26,36,0.8)] border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-[rgba(0,196,255,0.2)] border border-[#00c4ff] rounded-lg">
                <TrendingUp className="w-6 h-6 text-[#00c4ff]" />
              </div>
              <span className="text-sm font-medium text-[#00c4ff]">Total</span>
            </div>
            <p className="text-3xl font-bold text-white font-[Oswald] mb-1">
              ${(totalDuesAmount + totalPaidAmount + totalWaivedAmount).toFixed(2)}
            </p>
            <p className="text-sm text-gray-400">
              {totalDuesAmount + totalPaidAmount + totalWaivedAmount > 0 
                ? ((totalPaidAmount / (totalDuesAmount + totalPaidAmount + totalWaivedAmount)) * 100).toFixed(0)
                : 0}% collected
            </p>
          </div>
        </div>

        {/* Team Breakdown */}
        {teamStats.length > 0 && (
          <div className="bg-[rgba(18,26,36,0.8)] border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-xl">
            <div className="p-6 border-b border-[#00c4ff]/50">
              <h2 className="text-lg font-semibold text-white font-[Oswald]">Dues by Team</h2>
            </div>
            <div className="divide-y divide-[#00c4ff]/30">
              {teamStats.map((stat) => (
                <div 
                  key={stat.team_id}
                  className={`p-4 flex items-center justify-between hover:bg-[rgba(0,196,255,0.1)] cursor-pointer transition-colors ${
                    selectedTeamFilter === stat.team_id ? 'bg-[rgba(0,196,255,0.15)]' : ''
                  }`}
                  onClick={() => setSelectedTeamFilter(
                    selectedTeamFilter === stat.team_id ? null : stat.team_id
                  )}
                >
                  <div>
                    <h3 className="font-semibold text-white font-[Oswald]">
                      {stat.team_name}
                      {stat.age_group && <span className="text-gray-400 ml-2">({stat.age_group})</span>}
                    </h3>
                    <p className="text-sm text-gray-400">{stat.duesCount} pending dues</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-orange-400">
                      ${stat.duesAmount.toFixed(2)}
                    </p>
                    {selectedTeamFilter === stat.team_id && (
                      <p className="text-xs text-[#00c4ff] mt-1">Filtering below</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {selectedTeamFilter && (
              <div className="p-4 bg-[rgba(0,196,255,0.1)] border-t border-[#00c4ff]/50">
                <button
                  onClick={() => setSelectedTeamFilter(null)}
                  className="text-sm text-[#00c4ff] hover:text-[#00a3d9] font-medium"
                >
                  Clear team filter
                </button>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Payments List */}
          <div className="bg-[rgba(18,26,36,0.8)] border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-xl">
            <div className="p-6 border-b border-[#00c4ff]/50">
              <h2 className="text-lg font-semibold text-white font-[Oswald]">
                All Dues & Payments
                {selectedTeamFilter && (
                  <span className="ml-2 text-sm font-normal text-[#00c4ff]">
                    (Filtered by team)
                  </span>
                )}
              </h2>
            </div>
            <div className="divide-y divide-[#00c4ff]/30">
              {filteredPayments.length === 0 ? (
                <div className="p-6 text-center text-gray-400">
                  {selectedTeamFilter ? 'No dues for this team' : 'No dues created yet'}
                </div>
              ) : (
                filteredPayments.map((payment) => (
                  <div
                    key={payment.id}
                    className={`p-4 hover:bg-[rgba(0,196,255,0.1)] transition-colors ${
                      selectedPayment === payment.id ? "bg-[rgba(0,196,255,0.15)]" : ""
                    }`}
                  >
                    <div 
                      className="cursor-pointer"
                      onClick={() => loadPlayerPayments(payment.id)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-white font-[Oswald]">{payment.description}</h3>
                          <p className="text-sm text-gray-400">{payment.team_name}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-white font-[Oswald]">${payment.total_amount.toFixed(2)}</p>
                          <span className="text-xs px-2 py-1 rounded-full bg-[rgba(100,100,100,0.3)] border border-gray-500 text-gray-300">
                            {payment.payment_type === 'fixed' ? 'Fixed' : 'Split'}
                          </span>
                        </div>
                      </div>
                      {payment.due_date && (
                        <p className="text-sm text-gray-400">
                          Due: {payment.due_date}
                        </p>
                      )}
                      {payment.notes && (
                        <p className="text-sm text-gray-400 mt-1">{payment.notes}</p>
                      )}
                    </div>
                    {isAdmin && (
                      <div className="flex gap-2 mt-3 pt-3 border-t border-[#00c4ff]/30">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditPayment(payment);
                          }}
                          className="flex items-center gap-1 px-3 py-1 text-sm text-[#00c4ff] hover:bg-[rgba(0,196,255,0.2)] rounded transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePayment(payment.id);
                          }}
                          className="flex items-center gap-1 px-3 py-1 text-sm text-red-400 hover:bg-[rgba(255,0,0,0.2)] rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Player Payments Detail */}
          <div className="bg-[rgba(18,26,36,0.8)] border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-xl">
            <div className="p-6 border-b border-[#00c4ff]/50">
              <h2 className="text-lg font-semibold text-white font-[Oswald]">Player Details</h2>
            </div>
            <div className="divide-y divide-[#00c4ff]/30">
              {!selectedPayment ? (
                <div className="p-6 text-center text-gray-400">
                  Select an item to view player details
                </div>
              ) : playerPayments.length === 0 ? (
                <div className="p-6 text-center text-gray-400">
                  No players in this item
                </div>
              ) : (
                playerPayments.map((pp) => (
                  <div key={pp.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-white font-[Oswald]">
                        {pp.first_name} {pp.last_name}
                        {pp.jersey_number && ` #${pp.jersey_number}`}
                      </p>
                      {pp.family_name && (
                        <p className="text-sm text-gray-400">{pp.family_name}</p>
                      )}
                      <p className="text-sm font-semibold text-white font-[Oswald] mt-1">
                        ${pp.amount.toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {pp.status === "paid" ? "Payment" : pp.status === "waived" ? "Waived" : "Dues"}
                      </p>
                      {pp.status === "waived" && pp.waiver_reason && (
                        <p className="text-xs text-purple-400 mt-1">Reason: {pp.waiver_reason}</p>
                      )}
                      {pp.status === "waived" && pp.waived_by_name && (
                        <p className="text-xs text-gray-500 mt-0.5">by {pp.waived_by_name}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {pp.status === "paid" ? (
                        <div className="flex items-center gap-2 text-green-400">
                          <CheckCircle2 className="w-5 h-5" />
                          <span className="text-sm font-medium">Paid</span>
                        </div>
                      ) : pp.status === "waived" ? (
                        <div className="flex items-center gap-2 text-purple-400">
                          <Ban className="w-5 h-5" />
                          <span className="text-sm font-medium">Waived</span>
                        </div>
                      ) : (
                        <span className="text-sm text-orange-400 font-medium">Pending</span>
                      )}
                      {isAdmin && pp.status === "pending" && (
                        <>
                          <button
                            onClick={() => handleMarkPaid(pp.id, pp.status)}
                            className="px-3 py-1 text-sm rounded-lg font-medium transition-colors border bg-green-600 border-green-500 text-white hover:bg-green-700"
                          >
                            Mark Paid
                          </button>
                          <button
                            onClick={() => handleWaivePayment(pp)}
                            className="px-3 py-1 text-sm rounded-lg font-medium transition-colors border bg-purple-600 border-purple-500 text-white hover:bg-purple-700"
                          >
                            Waive
                          </button>
                        </>
                      )}
                      {isAdmin && pp.status === "paid" && (
                        <button
                          onClick={() => handleMarkPaid(pp.id, pp.status)}
                          className="px-3 py-1 text-sm rounded-lg font-medium transition-colors border bg-[rgba(100,100,100,0.3)] border-gray-500 text-gray-300 hover:bg-[rgba(100,100,100,0.4)]"
                        >
                          Mark Unpaid
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Create Payment Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[rgba(18,26,36,0.98)] border border-[#00c4ff]/30 rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white font-[Oswald]">Create Dues</h2>
              <button
                onClick={() => { setShowCreateModal(false); resetForm(); }}
                className="text-gray-500 hover:text-gray-500"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleCreatePayment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Team *</label>
                <select
                  required
                  value={newPayment.team_id}
                  onChange={(e) => {
                    const teamId = parseInt(e.target.value);
                    setNewPayment({ ...newPayment, team_id: teamId, player_ids: [] });
                    if (teamId) loadTeamRoster(teamId);
                  }}
                  className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                >
                  <option value="">Select team...</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name} {team.age_group && `(${team.age_group})`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Description *</label>
                <input
                  type="text"
                  required
                  value={newPayment.description}
                  onChange={(e) => setNewPayment({ ...newPayment, description: e.target.value })}
                  className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                  placeholder="e.g., Winter Season Fee, Tournament Entry"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Payment Type *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewPayment({ ...newPayment, payment_type: "fixed" })}
                    className={`p-3 border-2 rounded-lg transition-colors ${
                      newPayment.payment_type === "fixed"
                        ? "border-blue-600 bg-blue-50"
                        : "border-gray-300 hover:border-gray-400"
                    }`}
                  >
                    <div className="font-semibold text-white font-[Oswald]">Fixed Amount</div>
                    <div className="text-sm text-gray-500">Each player pays the same</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewPayment({ ...newPayment, payment_type: "split" })}
                    className={`p-3 border-2 rounded-lg transition-colors ${
                      newPayment.payment_type === "split"
                        ? "border-blue-600 bg-blue-50"
                        : "border-gray-300 hover:border-gray-400"
                    }`}
                  >
                    <div className="font-semibold text-white font-[Oswald]">Split Total</div>
                    <div className="text-sm text-gray-500">Divide total among players</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  {newPayment.payment_type === 'fixed' ? 'Amount Per Player *' : 'Total Amount *'}
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="number"
                    required
                    step="0.01"
                    min="0"
                    value={newPayment.amount}
                    onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Due Date</label>
                <input
                  type="date"
                  value={newPayment.due_date}
                  onChange={(e) => setNewPayment({ ...newPayment, due_date: e.target.value })}
                  className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Notes</label>
                <textarea
                  value={newPayment.notes}
                  onChange={(e) => setNewPayment({ ...newPayment, notes: e.target.value })}
                  className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                  rows={2}
                  placeholder="Optional payment notes"
                />
              </div>

              {newPayment.team_id > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Select Players * ({newPayment.player_ids.length} selected)
                    </label>
                    <div className="flex gap-2">
                      <button type="button" onClick={selectAllPlayers} className="text-sm text-blue-600 hover:text-blue-700">
                        Select All
                      </button>
                      <button type="button" onClick={clearAllPlayers} className="text-sm text-gray-500 hover:text-gray-700">
                        Clear
                      </button>
                    </div>
                  </div>
                  <div className="border border-gray-300 rounded-lg p-3 max-h-48 overflow-y-auto">
                    {teamPlayers.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-2">No players on this team</p>
                    ) : (
                      <div className="space-y-2">
                        {teamPlayers.map((player) => (
                          <label key={player.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                            <input
                              type="checkbox"
                              checked={newPayment.player_ids.includes(player.id)}
                              onChange={() => togglePlayer(player.id)}
                              className="w-4 h-4 text-blue-600 rounded"
                            />
                            <span className="text-sm text-white font-[Oswald]">
                              {player.first_name} {player.last_name}
                              {player.jersey_number && ` #${player.jersey_number}`}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {preview && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-5 h-5 text-blue-600" />
                    <span className="font-semibold text-white font-[Oswald]">Payment Summary</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Per Player:</p>
                      <p className="text-lg font-semibold text-white font-[Oswald]">${preview.perPlayer.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Total:</p>
                      <p className="text-lg font-semibold text-white font-[Oswald]">${preview.total.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowCreateModal(false); resetForm(); }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPayment}
                  className="flex-1 px-4 py-2 bg-[#00c4ff] hover:bg-[#00a3d9] shadow-lg shadow-[#00c4ff]/20 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingPayment ? "Saving..." : "Create Dues"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Waive Payment Modal */}
      {showWaiveModal && waivingPayment && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[rgba(18,26,36,0.98)] border border-[#00c4ff]/30 rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white font-[Oswald]">Waive Fee</h2>
              <button
                onClick={() => { setShowWaiveModal(false); setWaivingPayment(null); }}
                className="text-gray-500 hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="mb-6 p-4 bg-[rgba(147,51,234,0.1)] border border-purple-500/30 rounded-lg">
              <p className="text-white font-[Oswald] font-medium">
                {waivingPayment.first_name} {waivingPayment.last_name}
              </p>
              <p className="text-gray-400 text-sm mt-1">{waivingPayment.description}</p>
              <p className="text-purple-400 font-semibold text-lg mt-2">
                ${waivingPayment.amount.toFixed(2)}
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Reason for Waiver (optional)
              </label>
              <textarea
                value={waiverReason}
                onChange={(e) => setWaiverReason(e.target.value)}
                className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                rows={3}
                placeholder="e.g., Financial hardship, scholarship, volunteer credit..."
              />
            </div>

            <p className="text-sm text-gray-400 mb-6">
              This will mark the fee as waived and send an email notification to the family.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => { setShowWaiveModal(false); setWaivingPayment(null); }}
                className="flex-1 px-4 py-2 border border-gray-500 text-gray-300 rounded-lg font-medium hover:bg-[rgba(100,100,100,0.2)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitWaiver}
                className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Ban className="w-4 h-4" />
                Waive Fee
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Payment Modal */}
      {showEditModal && editingPayment && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[rgba(18,26,36,0.98)] border border-[#00c4ff]/30 rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white font-[Oswald]">Edit Dues</h2>
              <button
                onClick={() => { setShowEditModal(false); setEditingPayment(null); resetForm(); }}
                className="text-gray-500 hover:text-gray-500"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleUpdatePayment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Team *</label>
                <select
                  required
                  value={newPayment.team_id}
                  onChange={(e) => {
                    const teamId = parseInt(e.target.value);
                    setNewPayment({ ...newPayment, team_id: teamId, player_ids: [] });
                    if (teamId) loadTeamRoster(teamId);
                  }}
                  className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                >
                  <option value="">Select team...</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name} {team.age_group && `(${team.age_group})`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Description *</label>
                <input
                  type="text"
                  required
                  value={newPayment.description}
                  onChange={(e) => setNewPayment({ ...newPayment, description: e.target.value })}
                  className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Payment Type *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewPayment({ ...newPayment, payment_type: "fixed" })}
                    className={`p-3 border-2 rounded-lg transition-colors ${
                      newPayment.payment_type === "fixed"
                        ? "border-blue-600 bg-blue-50"
                        : "border-gray-300 hover:border-gray-400"
                    }`}
                  >
                    <div className="font-semibold text-white font-[Oswald]">Fixed Amount</div>
                    <div className="text-sm text-gray-500">Each player pays the same</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewPayment({ ...newPayment, payment_type: "split" })}
                    className={`p-3 border-2 rounded-lg transition-colors ${
                      newPayment.payment_type === "split"
                        ? "border-blue-600 bg-blue-50"
                        : "border-gray-300 hover:border-gray-400"
                    }`}
                  >
                    <div className="font-semibold text-white font-[Oswald]">Split Total</div>
                    <div className="text-sm text-gray-500">Divide total among players</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  {newPayment.payment_type === 'fixed' ? 'Amount Per Player *' : 'Total Amount *'}
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="number"
                    required
                    step="0.01"
                    min="0"
                    value={newPayment.amount}
                    onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Due Date</label>
                <input
                  type="date"
                  value={newPayment.due_date}
                  onChange={(e) => setNewPayment({ ...newPayment, due_date: e.target.value })}
                  className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Notes</label>
                <textarea
                  value={newPayment.notes}
                  onChange={(e) => setNewPayment({ ...newPayment, notes: e.target.value })}
                  className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                  rows={2}
                />
              </div>

              {newPayment.team_id > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Select Players * ({newPayment.player_ids.length} selected)
                    </label>
                    <div className="flex gap-2">
                      <button type="button" onClick={selectAllPlayers} className="text-sm text-blue-600 hover:text-blue-700">
                        Select All
                      </button>
                      <button type="button" onClick={clearAllPlayers} className="text-sm text-gray-500 hover:text-gray-700">
                        Clear
                      </button>
                    </div>
                  </div>
                  <div className="border border-gray-300 rounded-lg p-3 max-h-48 overflow-y-auto">
                    {teamPlayers.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-2">No players on this team</p>
                    ) : (
                      <div className="space-y-2">
                        {teamPlayers.map((player) => (
                          <label key={player.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                            <input
                              type="checkbox"
                              checked={newPayment.player_ids.includes(player.id)}
                              onChange={() => togglePlayer(player.id)}
                              className="w-4 h-4 text-blue-600 rounded"
                            />
                            <span className="text-sm text-white font-[Oswald]">
                              {player.first_name} {player.last_name}
                              {player.jersey_number && ` #${player.jersey_number}`}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {preview && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-5 h-5 text-blue-600" />
                    <span className="font-semibold text-white font-[Oswald]">Payment Summary</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Per Player:</p>
                      <p className="text-lg font-semibold text-white font-[Oswald]">${preview.perPlayer.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Total:</p>
                      <p className="text-lg font-semibold text-white font-[Oswald]">${preview.total.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setEditingPayment(null); resetForm(); }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPayment}
                  className="flex-1 px-4 py-2 bg-[#00c4ff] hover:bg-[#00a3d9] shadow-lg shadow-[#00c4ff]/20 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingPayment ? "Saving..." : "Update Dues"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}
