import { useState, useEffect } from "react";
import { Link } from "react-router";
import { PortalLayout } from "@/react-app/components/layout/PortalLayout";
import { useRoles } from "@/react-app/contexts/RoleContext";
import { formatDate } from "@/react-app/utils/dateFormat";
import { DollarSign, Filter, Download, ArrowLeft, Search, X, Mail, Send, CheckCircle, AlertCircle } from "lucide-react";
import { apiFetch } from "@/react-app/lib/api";

interface OutstandingDue {
  id: number;
  player_id: number;
  payment_id: number;
  amount: number;
  status: string;
  first_name: string;
  last_name: string;
  jersey_number: string | null;
  family_id: number | null;
  family_name: string | null;
  team_id: number;
  team_name: string;
  description: string;
  due_date: string | null;
  created_at: string;
}

interface Team {
  id: number;
  name: string;
  age_group: string;
}

interface Family {
  id: number;
  name: string;
}

interface Player {
  id: number;
  first_name: string;
  last_name: string;
}

export default function PortalOutstandingDues() {
  const { isAdmin, isCoach } = useRoles();
  const [loading, setLoading] = useState(true);
  const [outstandingDues, setOutstandingDues] = useState<OutstandingDue[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);

  // Filter states
  const [filterTeam, setFilterTeam] = useState<number | "">("");
  const [filterFamily, setFilterFamily] = useState<number | "">("");
  const [filterPlayer, setFilterPlayer] = useState<number | "">("");
  const [filterEvent, setFilterEvent] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(true);

  // Email modal states
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailPreview, setEmailPreview] = useState<any[]>([]);
  const [selectedFamilies, setSelectedFamilies] = useState<number[]>([]);
  const [customMessage, setCustomMessage] = useState("");
  const [includeDetails, setIncludeDetails] = useState(true);
  const [sendingEmails, setSendingEmails] = useState(false);
  const [emailResult, setEmailResult] = useState<{ success: boolean; sent: number; errors: number } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [duesRes, teamsRes, familiesRes, playersRes] = await Promise.all([
        apiFetch("/api/portal/all-player-payments", { }),
        apiFetch("/api/portal/teams/all", { }),
        apiFetch("/api/portal/families", { }),
        apiFetch("/api/portal/players/all", { }),
      ]);

      const allPayments = await duesRes.json();
      const teamsData = await teamsRes.json();
      const familiesData = await familiesRes.json();
      const playersData = await playersRes.json();

      // Filter to only pending (outstanding) dues
      const pending = allPayments.filter((p: OutstandingDue) => p.status === "pending");
      setOutstandingDues(pending);
      setTeams(teamsData);
      setFamilies(familiesData);
      setPlayers(playersData);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  }

  // Apply filters
  const filteredDues = outstandingDues.filter((due) => {
    if (filterTeam && due.team_id !== filterTeam) return false;
    if (filterFamily && due.family_id !== filterFamily) return false;
    if (filterPlayer && due.player_id !== filterPlayer) return false;
    if (filterEvent && !due.description.toLowerCase().includes(filterEvent.toLowerCase())) return false;
    if (filterDateFrom && due.due_date && due.due_date < filterDateFrom) return false;
    if (filterDateTo && due.due_date && due.due_date > filterDateTo) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName = `${due.first_name} ${due.last_name}`.toLowerCase().includes(query);
      const matchesFamily = due.family_name?.toLowerCase().includes(query);
      const matchesDesc = due.description.toLowerCase().includes(query);
      if (!matchesName && !matchesFamily && !matchesDesc) return false;
    }
    return true;
  });

  // Calculate totals
  const totalAmount = filteredDues.reduce((sum, due) => sum + due.amount, 0);
  const totalCount = filteredDues.length;

  // Group by various dimensions for summary
  const byTeam = filteredDues.reduce((acc, due) => {
    const key = due.team_name;
    if (!acc[key]) acc[key] = { count: 0, amount: 0 };
    acc[key].count++;
    acc[key].amount += due.amount;
    return acc;
  }, {} as Record<string, { count: number; amount: number }>);

  const byFamily = filteredDues.reduce((acc, due) => {
    const key = due.family_name || "No Family";
    if (!acc[key]) acc[key] = { count: 0, amount: 0 };
    acc[key].count++;
    acc[key].amount += due.amount;
    return acc;
  }, {} as Record<string, { count: number; amount: number }>);

  function clearFilters() {
    setFilterTeam("");
    setFilterFamily("");
    setFilterPlayer("");
    setFilterEvent("");
    setFilterDateFrom("");
    setFilterDateTo("");
    setSearchQuery("");
  }

  function exportCSV() {
    const headers = ["Player", "Family", "Team", "Description", "Due Date", "Amount"];
    const rows = filteredDues.map((due) => [
      `${due.first_name} ${due.last_name}`,
      due.family_name || "",
      due.team_name,
      due.description,
      due.due_date || "",
      due.amount.toFixed(2),
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `outstanding-dues-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function openEmailModal() {
    setShowEmailModal(true);
    setEmailResult(null);
    setCustomMessage("");
    setIncludeDetails(true);
    
    try {
      const params = new URLSearchParams();
      if (filterTeam) params.append("team_id", filterTeam.toString());
      if (filterFamily) params.append("family_id", filterFamily.toString());
      
      const res = await apiFetch(`/api/portal/outstanding-dues/email-preview?${params}`, {
      });
      const data = await res.json();
      setEmailPreview(data);
      setSelectedFamilies(data.map((f: any) => f.family_id));
    } catch (error) {
      console.error("Error loading email preview:", error);
    }
  }

  async function sendReminders() {
    if (selectedFamilies.length === 0) return;
    
    setSendingEmails(true);
    setEmailResult(null);
    
    try {
      const res = await apiFetch("/api/portal/outstanding-dues/send-reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          family_ids: selectedFamilies,
          team_id: filterTeam || undefined,
          custom_message: customMessage || undefined,
          include_details: includeDetails,
        }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setEmailResult({ success: true, sent: data.sent_count, errors: data.error_count });
      } else {
        setEmailResult({ success: false, sent: 0, errors: 1 });
      }
    } catch (error) {
      console.error("Error sending reminders:", error);
      setEmailResult({ success: false, sent: 0, errors: 1 });
    } finally {
      setSendingEmails(false);
    }
  }

  function toggleFamilySelection(familyId: number) {
    setSelectedFamilies(prev => 
      prev.includes(familyId) 
        ? prev.filter(id => id !== familyId)
        : [...prev, familyId]
    );
  }

  function selectAllFamilies() {
    setSelectedFamilies(emailPreview.map((f: any) => f.family_id));
  }

  function deselectAllFamilies() {
    setSelectedFamilies([]);
  }

  const hasActiveFilters = filterTeam || filterFamily || filterPlayer || filterEvent || filterDateFrom || filterDateTo || searchQuery;

  if (!isAdmin && !isCoach) {
    return (
      <PortalLayout>
        <div className="text-center py-12">
          <p className="text-gray-400">You don't have access to this report.</p>
        </div>
      </PortalLayout>
    );
  }

  if (loading) {
    return (
      <PortalLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading report...</div>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/portal/payments"
              className="p-2 rounded-lg border border-[#00c4ff]/30 text-[#00c4ff] hover:bg-[rgba(0,196,255,0.1)] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-white font-[Oswald] mb-2">Outstanding Dues Report</h1>
              <p className="text-gray-400">
                {totalCount} outstanding {totalCount === 1 ? "due" : "dues"} totaling ${totalAmount.toFixed(2)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors border ${
                showFilters
                  ? "bg-[rgba(0,196,255,0.2)] border-[#00c4ff] text-[#00c4ff]"
                  : "border-[#00c4ff]/30 text-gray-300 hover:bg-[rgba(0,196,255,0.1)]"
              }`}
            >
              <Filter className="w-5 h-5" />
              Filters
            </button>
            <button
              onClick={openEmailModal}
              className="flex items-center gap-2 px-4 py-2 border border-[#00c4ff]/30 text-[#00c4ff] hover:bg-[rgba(0,196,255,0.1)] rounded-lg font-medium transition-colors"
            >
              <Mail className="w-5 h-5" />
              Send Reminders
            </button>
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-[#00c4ff] hover:bg-[#00a3d9] shadow-lg shadow-[#00c4ff]/20 text-white rounded-lg font-medium transition-colors"
            >
              <Download className="w-5 h-5" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-[rgba(18,26,36,0.8)] border border-[#00c4ff]/30 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white font-[Oswald]">Filter Results</h3>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 text-sm text-[#00c4ff] hover:text-[#00a3d9]"
                >
                  <X className="w-4 h-4" />
                  Clear All
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {/* Search */}
              <div className="lg:col-span-2">
                <label className="block text-sm text-gray-400 mb-1">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name, family, or description..."
                    className="w-full pl-10 pr-4 py-2 bg-[rgba(0,0,0,0.3)] border border-[#00c4ff]/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#00c4ff]"
                  />
                </div>
              </div>

              {/* Team Filter */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Team</label>
                <select
                  value={filterTeam}
                  onChange={(e) => setFilterTeam(e.target.value ? parseInt(e.target.value) : "")}
                  className="w-full px-4 py-2 bg-[rgba(0,0,0,0.3)] border border-[#00c4ff]/30 rounded-lg text-white focus:outline-none focus:border-[#00c4ff]"
                >
                  <option value="">All Teams</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name} {team.age_group && `(${team.age_group})`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Family Filter */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Family</label>
                <select
                  value={filterFamily}
                  onChange={(e) => setFilterFamily(e.target.value ? parseInt(e.target.value) : "")}
                  className="w-full px-4 py-2 bg-[rgba(0,0,0,0.3)] border border-[#00c4ff]/30 rounded-lg text-white focus:outline-none focus:border-[#00c4ff]"
                >
                  <option value="">All Families</option>
                  {families.map((family) => (
                    <option key={family.id} value={family.id}>
                      {family.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Player Filter */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Player</label>
                <select
                  value={filterPlayer}
                  onChange={(e) => setFilterPlayer(e.target.value ? parseInt(e.target.value) : "")}
                  className="w-full px-4 py-2 bg-[rgba(0,0,0,0.3)] border border-[#00c4ff]/30 rounded-lg text-white focus:outline-none focus:border-[#00c4ff]"
                >
                  <option value="">All Players</option>
                  {players.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.first_name} {player.last_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Event Filter */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Event/Description</label>
                <input
                  type="text"
                  value={filterEvent}
                  onChange={(e) => setFilterEvent(e.target.value)}
                  placeholder="Filter by event..."
                  className="w-full px-4 py-2 bg-[rgba(0,0,0,0.3)] border border-[#00c4ff]/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#00c4ff]"
                />
              </div>

              {/* Date From */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Due Date From</label>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="w-full px-4 py-2 bg-[rgba(0,0,0,0.3)] border border-[#00c4ff]/30 rounded-lg text-white focus:outline-none focus:border-[#00c4ff]"
                />
              </div>

              {/* Date To */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Due Date To</label>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="w-full px-4 py-2 bg-[rgba(0,0,0,0.3)] border border-[#00c4ff]/30 rounded-lg text-white focus:outline-none focus:border-[#00c4ff]"
                />
              </div>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* By Team */}
          <div className="bg-[rgba(18,26,36,0.8)] border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-xl">
            <div className="p-4 border-b border-[#00c4ff]/50">
              <h3 className="text-lg font-semibold text-white font-[Oswald]">By Team</h3>
            </div>
            <div className="divide-y divide-[#00c4ff]/30 max-h-64 overflow-y-auto">
              {Object.entries(byTeam).length === 0 ? (
                <div className="p-4 text-center text-gray-400">No results</div>
              ) : (
                Object.entries(byTeam)
                  .sort((a, b) => b[1].amount - a[1].amount)
                  .map(([team, stats]) => (
                    <div key={team} className="p-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-white">{team}</p>
                        <p className="text-sm text-gray-400">{stats.count} dues</p>
                      </div>
                      <p className="text-lg font-semibold text-orange-400">${stats.amount.toFixed(2)}</p>
                    </div>
                  ))
              )}
            </div>
          </div>

          {/* By Family */}
          <div className="bg-[rgba(18,26,36,0.8)] border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-xl">
            <div className="p-4 border-b border-[#00c4ff]/50">
              <h3 className="text-lg font-semibold text-white font-[Oswald]">By Family</h3>
            </div>
            <div className="divide-y divide-[#00c4ff]/30 max-h-64 overflow-y-auto">
              {Object.entries(byFamily).length === 0 ? (
                <div className="p-4 text-center text-gray-400">No results</div>
              ) : (
                Object.entries(byFamily)
                  .sort((a, b) => b[1].amount - a[1].amount)
                  .map(([family, stats]) => (
                    <div key={family} className="p-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-white">{family}</p>
                        <p className="text-sm text-gray-400">{stats.count} dues</p>
                      </div>
                      <p className="text-lg font-semibold text-orange-400">${stats.amount.toFixed(2)}</p>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>

        {/* Detailed List */}
        <div className="bg-[rgba(18,26,36,0.8)] border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-xl">
          <div className="p-4 border-b border-[#00c4ff]/50 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white font-[Oswald]">Detailed List</h3>
            <p className="text-sm text-gray-400">
              Showing {filteredDues.length} of {outstandingDues.length} outstanding dues
            </p>
          </div>

          {/* Table Header */}
          <div className="hidden md:grid grid-cols-12 gap-4 p-4 border-b border-[#00c4ff]/30 text-sm font-medium text-gray-400">
            <div className="col-span-3">Player</div>
            <div className="col-span-2">Family</div>
            <div className="col-span-2">Team</div>
            <div className="col-span-3">Description</div>
            <div className="col-span-1">Due Date</div>
            <div className="col-span-1 text-right">Amount</div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-[#00c4ff]/30 max-h-[500px] overflow-y-auto">
            {filteredDues.length === 0 ? (
              <div className="p-8 text-center">
                <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white font-[Oswald] mb-2">No Outstanding Dues</h3>
                <p className="text-gray-400">
                  {hasActiveFilters
                    ? "No dues match your current filters."
                    : "All dues have been paid or waived."}
                </p>
              </div>
            ) : (
              filteredDues.map((due) => (
                <div
                  key={due.id}
                  className="p-4 hover:bg-[rgba(0,196,255,0.05)] transition-colors"
                >
                  {/* Mobile Layout */}
                  <div className="md:hidden space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-white">
                        {due.first_name} {due.last_name}
                        {due.jersey_number && ` #${due.jersey_number}`}
                      </p>
                      <p className="text-lg font-semibold text-orange-400">${due.amount.toFixed(2)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-sm text-gray-400">
                      {due.family_name && <span>{due.family_name}</span>}
                      <span>•</span>
                      <span>{due.team_name}</span>
                    </div>
                    <p className="text-sm text-gray-300">{due.description}</p>
                    {due.due_date && (
                      <p className="text-sm text-gray-400">Due: {formatDate(due.due_date)}</p>
                    )}
                  </div>

                  {/* Desktop Layout */}
                  <div className="hidden md:grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-3">
                      <p className="font-medium text-white">
                        {due.first_name} {due.last_name}
                      </p>
                      {due.jersey_number && (
                        <p className="text-sm text-gray-400">#{due.jersey_number}</p>
                      )}
                    </div>
                    <div className="col-span-2 text-gray-300">
                      {due.family_name || <span className="text-gray-500">—</span>}
                    </div>
                    <div className="col-span-2 text-gray-300">{due.team_name}</div>
                    <div className="col-span-3 text-gray-300">{due.description}</div>
                    <div className="col-span-1 text-gray-400">
                      {due.due_date ? formatDate(due.due_date) : <span className="text-gray-500">—</span>}
                    </div>
                    <div className="col-span-1 text-right">
                      <p className="text-lg font-semibold text-orange-400">${due.amount.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer with Total */}
          {filteredDues.length > 0 && (
            <div className="p-4 border-t border-[#00c4ff]/50 flex items-center justify-between bg-[rgba(0,196,255,0.05)]">
              <p className="text-gray-400">
                {filteredDues.length} {filteredDues.length === 1 ? "item" : "items"}
              </p>
              <div className="text-right">
                <p className="text-sm text-gray-400">Total Outstanding</p>
                <p className="text-2xl font-bold text-orange-400 font-[Oswald]">${totalAmount.toFixed(2)}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Email Reminder Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[rgba(18,26,36,0.95)] border border-[#00c4ff]/30 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-6 border-b border-[#00c4ff]/30 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white font-[Oswald]">Send Payment Reminders</h2>
                <p className="text-sm text-gray-400 mt-1">
                  Email families about their outstanding dues
                </p>
              </div>
              <button
                onClick={() => setShowEmailModal(false)}
                className="p-2 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Result Message */}
              {emailResult && (
                <div className={`p-4 rounded-lg flex items-center gap-3 ${
                  emailResult.success 
                    ? "bg-green-500/20 border border-green-500/30" 
                    : "bg-red-500/20 border border-red-500/30"
                }`}>
                  {emailResult.success ? (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-400" />
                  )}
                  <p className={emailResult.success ? "text-green-300" : "text-red-300"}>
                    {emailResult.success 
                      ? `Successfully sent ${emailResult.sent} reminder${emailResult.sent !== 1 ? "s" : ""}${emailResult.errors > 0 ? ` (${emailResult.errors} failed)` : ""}`
                      : "Failed to send reminders. Please try again."}
                  </p>
                </div>
              )}

              {/* Recipients Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-gray-400">Recipients</label>
                  <div className="flex gap-2">
                    <button
                      onClick={selectAllFamilies}
                      className="text-xs text-[#00c4ff] hover:text-[#00a3d9]"
                    >
                      Select All
                    </button>
                    <span className="text-gray-500">|</span>
                    <button
                      onClick={deselectAllFamilies}
                      className="text-xs text-[#00c4ff] hover:text-[#00a3d9]"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>
                
                {emailPreview.length === 0 ? (
                  <p className="text-gray-500 text-sm">No families with valid email addresses found.</p>
                ) : (
                  <div className="border border-[#00c4ff]/20 rounded-lg max-h-48 overflow-y-auto">
                    {emailPreview.map((family: any) => (
                      <label
                        key={family.family_id}
                        className="flex items-center gap-3 p-3 hover:bg-[rgba(0,196,255,0.05)] cursor-pointer border-b border-[#00c4ff]/10 last:border-b-0"
                      >
                        <input
                          type="checkbox"
                          checked={selectedFamilies.includes(family.family_id)}
                          onChange={() => toggleFamilySelection(family.family_id)}
                          className="w-4 h-4 rounded border-[#00c4ff]/30 bg-transparent text-[#00c4ff] focus:ring-[#00c4ff]/50"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium truncate">{family.family_name || "Unknown Family"}</p>
                          <p className="text-xs text-gray-500 truncate">{family.email}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-orange-400 font-semibold">${family.total_outstanding.toFixed(2)}</p>
                          <p className="text-xs text-gray-500">{family.dues_count} due{family.dues_count !== 1 ? "s" : ""}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-2">
                  {selectedFamilies.length} of {emailPreview.length} families selected
                </p>
              </div>

              {/* Options */}
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeDetails}
                    onChange={(e) => setIncludeDetails(e.target.checked)}
                    className="w-4 h-4 rounded border-[#00c4ff]/30 bg-transparent text-[#00c4ff] focus:ring-[#00c4ff]/50"
                  />
                  <span className="text-gray-300">Include itemized breakdown in email</span>
                </label>
              </div>

              {/* Custom Message */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Custom Message (optional)
                </label>
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="Add a personal note to include in the email..."
                  rows={3}
                  className="w-full bg-[rgba(0,196,255,0.05)] border border-[#00c4ff]/30 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#00c4ff]/50 placeholder-gray-500 resize-none"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-[#00c4ff]/30 flex items-center justify-between">
              <button
                onClick={() => setShowEmailModal(false)}
                className="px-4 py-2 border border-[#00c4ff]/30 text-gray-300 hover:bg-[rgba(0,196,255,0.1)] rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={sendReminders}
                disabled={sendingEmails || selectedFamilies.length === 0}
                className="flex items-center gap-2 px-6 py-2 bg-[#00c4ff] hover:bg-[#00a3d9] disabled:bg-gray-600 disabled:cursor-not-allowed shadow-lg shadow-[#00c4ff]/20 text-white rounded-lg font-medium transition-colors"
              >
                {sendingEmails ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send {selectedFamilies.length} Email{selectedFamilies.length !== 1 ? "s" : ""}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}
