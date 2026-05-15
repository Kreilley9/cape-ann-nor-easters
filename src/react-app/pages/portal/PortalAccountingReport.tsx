import { useState, useEffect } from "react";
import { Link } from "react-router";
import { PortalLayout } from "@/react-app/components/layout/PortalLayout";
import { useRoles } from "@/react-app/contexts/RoleContext";
import { formatDate, formatDateTime } from "@/react-app/utils/dateFormat";
import { DollarSign, Filter, Download, ArrowLeft, TrendingUp, TrendingDown, Calculator, Mail, X, Send, CheckCircle, AlertCircle } from "lucide-react";
import { apiFetch } from "@/react-app/lib/api";

interface PaymentRecord {
  id: number;
  player_id: number;
  payment_id: number;
  amount: number;
  status: string;
  paid_at: string | null;
  waived_at: string | null;
  waived_by_name: string | null;
  waiver_reason: string | null;
  first_name: string;
  last_name: string;
  jersey_number: string | null;
  family_id: number | null;
  family_name: string | null;
  team_id: number;
  team_name: string;
  description: string;
  due_date: string | null;
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

export default function PortalAccountingReport() {
  const { isAdmin, isCoach } = useRoles();
  const [loading, setLoading] = useState(true);
  const [allPayments, setAllPayments] = useState<PaymentRecord[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);

  // Filter states
  const [filterTeam, setFilterTeam] = useState<number | "">("");
  const [filterFamily, setFilterFamily] = useState<number | "">("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(true);

  // Email modal states
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailResult, setEmailResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [paymentsRes, teamsRes, familiesRes] = await Promise.all([
        apiFetch("/api/portal/all-player-payments", { }),
        apiFetch("/api/portal/teams/all", { }),
        apiFetch("/api/portal/families", { }),
      ]);

      const paymentsData = await paymentsRes.json();
      const teamsData = await teamsRes.json();
      const familiesData = await familiesRes.json();

      setAllPayments(paymentsData);
      setTeams(teamsData);
      setFamilies(familiesData);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  }

  // Apply filters
  const filteredPayments = allPayments.filter((p) => {
    if (filterTeam && p.team_id !== filterTeam) return false;
    if (filterFamily && p.family_id !== filterFamily) return false;
    if (filterDateFrom && p.due_date && p.due_date < filterDateFrom) return false;
    if (filterDateTo && p.due_date && p.due_date > filterDateTo) return false;
    return true;
  });

  // Calculate totals
  const totalDues = filteredPayments.reduce((sum, p) => sum + p.amount, 0);
  const paidPayments = filteredPayments.filter(p => p.status === "paid");
  const totalPaid = paidPayments.reduce((sum, p) => sum + p.amount, 0);
  const waivedPayments = filteredPayments.filter(p => p.status === "waived");
  const totalWaived = waivedPayments.reduce((sum, p) => sum + p.amount, 0);
  const pendingPayments = filteredPayments.filter(p => p.status === "pending");
  const totalOutstanding = pendingPayments.reduce((sum, p) => sum + p.amount, 0);

  // Group by team for summary
  const byTeam = filteredPayments.reduce((acc, p) => {
    const key = p.team_name || "No Team";
    if (!acc[key]) acc[key] = { dues: 0, paid: 0, waived: 0, outstanding: 0 };
    acc[key].dues += p.amount;
    if (p.status === "paid") acc[key].paid += p.amount;
    if (p.status === "waived") acc[key].waived += p.amount;
    if (p.status === "pending") acc[key].outstanding += p.amount;
    return acc;
  }, {} as Record<string, { dues: number; paid: number; waived: number; outstanding: number }>);

  // Group by family for summary
  const byFamily = filteredPayments.reduce((acc, p) => {
    const key = p.family_name || "No Family";
    if (!acc[key]) acc[key] = { dues: 0, paid: 0, waived: 0, outstanding: 0 };
    acc[key].dues += p.amount;
    if (p.status === "paid") acc[key].paid += p.amount;
    if (p.status === "waived") acc[key].waived += p.amount;
    if (p.status === "pending") acc[key].outstanding += p.amount;
    return acc;
  }, {} as Record<string, { dues: number; paid: number; waived: number; outstanding: number }>);

  function clearFilters() {
    setFilterTeam("");
    setFilterFamily("");
    setFilterDateFrom("");
    setFilterDateTo("");
  }

  function exportCSV() {
    const headers = ["Player", "Family", "Team", "Description", "Due Date", "Amount", "Status", "Paid Date", "Waived By", "Waiver Reason"];
    const rows = filteredPayments.map(p => [
      `${p.first_name} ${p.last_name}`,
      p.family_name || "",
      p.team_name || "",
      p.description,
      p.due_date || "",
      p.amount.toFixed(2),
      p.status,
      p.paid_at ? formatDateTime(p.paid_at) : "",
      p.waived_by_name || "",
      p.waiver_reason || ""
    ]);

    const csv = [headers.join(","), ...rows.map(r => r.map(c => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `accounting-report-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  }

  async function sendEmailReport() {
    if (!emailAddress.trim()) return;
    
    setSendingEmail(true);
    setEmailResult(null);
    
    try {
      const res = await apiFetch("/api/portal/accounting/send-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailAddress.trim(),
          summary: {
            totalDues,
            totalPaid,
            totalWaived,
            totalOutstanding,
            itemCount: filteredPayments.length,
            paidCount: paidPayments.length,
            waivedCount: waivedPayments.length,
            pendingCount: pendingPayments.length,
          },
          byTeam,
          byFamily,
          filters: {
            team: filterTeam ? teams.find(t => t.id === filterTeam)?.name : null,
            family: filterFamily ? families.find(f => f.id === filterFamily)?.name : null,
            dateFrom: filterDateFrom || null,
            dateTo: filterDateTo || null,
          }
        }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setEmailResult({ success: true, message: "Report sent successfully!" });
        setTimeout(() => {
          setShowEmailModal(false);
          setEmailResult(null);
          setEmailAddress("");
        }, 2000);
      } else {
        setEmailResult({ success: false, message: data.error || "Failed to send report" });
      }
    } catch (error) {
      setEmailResult({ success: false, message: "Failed to send report. Please try again." });
    } finally {
      setSendingEmail(false);
    }
  }

  if (!isAdmin && !isCoach) {
    return (
      <PortalLayout>
        <div className="p-8 text-center text-gray-400">
          You don't have permission to view this page.
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link
              to="/portal/payments"
              className="p-2 rounded-lg border border-[#00c4ff]/30 hover:bg-[#00c4ff]/10 text-[#00c4ff] transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white font-['Oswald']">Accounting Report</h1>
              <p className="text-gray-400 text-sm">Complete financial overview</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#00c4ff]/30 text-[#00c4ff] hover:bg-[#00c4ff]/10 transition-colors"
            >
              <Filter className="h-4 w-4" />
              Filters
            </button>
            <button
              onClick={() => setShowEmailModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#00c4ff]/30 text-[#00c4ff] hover:bg-[#00c4ff]/10 transition-colors"
            >
              <Mail className="h-4 w-4" />
              Email Report
            </button>
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00c4ff] text-gray-900 font-medium hover:bg-[#00c4ff]/80 transition-colors"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="p-4 rounded-xl bg-[rgba(18,26,36,0.8)] border border-[#00c4ff]/30 shadow-[0_0_15px_rgba(0,196,255,0.1)]">
            <div className="flex items-center gap-3 mb-2">
              <Calculator className="h-5 w-5 text-blue-400" />
              <span className="text-gray-400 text-sm">Total Dues</span>
            </div>
            <p className="text-2xl font-bold text-white">${totalDues.toFixed(2)}</p>
            <p className="text-gray-400 text-xs">{filteredPayments.length} items</p>
          </div>

          <div className="p-4 rounded-xl bg-[rgba(18,26,36,0.8)] border border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.1)]">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="h-5 w-5 text-green-400" />
              <span className="text-gray-400 text-sm">Total Paid</span>
            </div>
            <p className="text-2xl font-bold text-green-400">${totalPaid.toFixed(2)}</p>
            <p className="text-gray-400 text-xs">{paidPayments.length} payments</p>
          </div>

          <div className="p-4 rounded-xl bg-[rgba(18,26,36,0.8)] border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.1)]">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="h-5 w-5 text-purple-400" />
              <span className="text-gray-400 text-sm">Total Waived</span>
            </div>
            <p className="text-2xl font-bold text-purple-400">${totalWaived.toFixed(2)}</p>
            <p className="text-gray-400 text-xs">{waivedPayments.length} waivers</p>
          </div>

          <div className="p-4 rounded-xl bg-[rgba(18,26,36,0.8)] border border-orange-500/30 shadow-[0_0_15px_rgba(249,115,22,0.1)]">
            <div className="flex items-center gap-3 mb-2">
              <TrendingDown className="h-5 w-5 text-orange-400" />
              <span className="text-gray-400 text-sm">Outstanding</span>
            </div>
            <p className="text-2xl font-bold text-orange-400">${totalOutstanding.toFixed(2)}</p>
            <p className="text-gray-400 text-xs">{pendingPayments.length} pending</p>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="p-4 rounded-xl bg-[rgba(18,26,36,0.8)] border border-[#00c4ff]/30 shadow-[0_0_15px_rgba(0,196,255,0.1)] mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-medium">Filter Results</h3>
              <button onClick={clearFilters} className="text-[#00c4ff] text-sm hover:underline">
                Clear All
              </button>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-gray-400 text-sm mb-1">Team</label>
                <select
                  value={filterTeam}
                  onChange={(e) => setFilterTeam(e.target.value ? Number(e.target.value) : "")}
                  className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white"
                >
                  <option value="">All Teams</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1">Family</label>
                <select
                  value={filterFamily}
                  onChange={(e) => setFilterFamily(e.target.value ? Number(e.target.value) : "")}
                  className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white"
                >
                  <option value="">All Families</option>
                  {families.map((family) => (
                    <option key={family.id} value={family.id}>{family.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1">Due Date From</label>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-1">Due Date To</label>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white"
                />
              </div>
            </div>
          </div>
        )}

        {/* Summary by Team */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div className="p-4 rounded-xl bg-[rgba(18,26,36,0.8)] border border-[#00c4ff]/30 shadow-[0_0_15px_rgba(0,196,255,0.1)]">
            <h3 className="text-white font-['Oswald'] text-lg mb-4">By Team</h3>
            {Object.keys(byTeam).length === 0 ? (
              <p className="text-gray-400 text-sm">No data</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(byTeam).map(([team, data]) => (
                  <div key={team} className="flex items-center justify-between border-b border-gray-700 pb-2">
                    <span className="text-white font-medium">{team}</span>
                    <div className="flex gap-4 text-sm">
                      <span className="text-gray-400">Dues: ${data.dues.toFixed(2)}</span>
                      <span className="text-green-400">Paid: ${data.paid.toFixed(2)}</span>
                      <span className="text-orange-400">Out: ${data.outstanding.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 rounded-xl bg-[rgba(18,26,36,0.8)] border border-[#00c4ff]/30 shadow-[0_0_15px_rgba(0,196,255,0.1)]">
            <h3 className="text-white font-['Oswald'] text-lg mb-4">By Family</h3>
            {Object.keys(byFamily).length === 0 ? (
              <p className="text-gray-400 text-sm">No data</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {Object.entries(byFamily).map(([family, data]) => (
                  <div key={family} className="flex items-center justify-between border-b border-gray-700 pb-2">
                    <span className="text-white font-medium">{family}</span>
                    <div className="flex gap-4 text-sm">
                      <span className="text-gray-400">Dues: ${data.dues.toFixed(2)}</span>
                      <span className="text-green-400">Paid: ${data.paid.toFixed(2)}</span>
                      <span className="text-orange-400">Out: ${data.outstanding.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Detailed Table */}
        <div className="rounded-xl bg-[rgba(18,26,36,0.8)] border border-[#00c4ff]/30 shadow-[0_0_15px_rgba(0,196,255,0.1)] overflow-hidden">
          <div className="p-4 border-b border-gray-700">
            <h3 className="text-white font-['Oswald'] text-lg">Transaction Details</h3>
            <p className="text-gray-400 text-sm">{filteredPayments.length} records</p>
          </div>
          
          {loading ? (
            <div className="p-8 text-center text-gray-400">Loading...</div>
          ) : filteredPayments.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No payment records found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-gray-400 text-sm font-medium">Player</th>
                    <th className="px-4 py-3 text-left text-gray-400 text-sm font-medium">Family</th>
                    <th className="px-4 py-3 text-left text-gray-400 text-sm font-medium">Team</th>
                    <th className="px-4 py-3 text-left text-gray-400 text-sm font-medium">Description</th>
                    <th className="px-4 py-3 text-left text-gray-400 text-sm font-medium">Due Date</th>
                    <th className="px-4 py-3 text-right text-gray-400 text-sm font-medium">Amount</th>
                    <th className="px-4 py-3 text-center text-gray-400 text-sm font-medium">Status</th>
                    <th className="px-4 py-3 text-left text-gray-400 text-sm font-medium">Date Resolved</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {filteredPayments.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-800/30">
                      <td className="px-4 py-3 text-white">
                        {p.first_name} {p.last_name}
                        {p.jersey_number && <span className="text-gray-400 ml-2">#{p.jersey_number}</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-300">{p.family_name || "-"}</td>
                      <td className="px-4 py-3 text-gray-300">{p.team_name || "-"}</td>
                      <td className="px-4 py-3 text-gray-300">{p.description}</td>
                      <td className="px-4 py-3 text-gray-300">{p.due_date ? formatDate(p.due_date) : "-"}</td>
                      <td className="px-4 py-3 text-right text-white font-medium">${p.amount.toFixed(2)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                          p.status === "paid" ? "bg-green-500/20 text-green-400" :
                          p.status === "waived" ? "bg-purple-500/20 text-purple-400" :
                          "bg-orange-500/20 text-orange-400"
                        }`}>
                          {p.status === "paid" ? "Paid" : p.status === "waived" ? "Waived" : "Pending"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-300 text-sm">
                        {p.paid_at ? formatDateTime(p.paid_at) : 
                         p.waived_at ? (
                           <span>
                             {formatDateTime(p.waived_at)}
                             {p.waived_by_name && <span className="block text-xs text-gray-400">by {p.waived_by_name}</span>}
                           </span>
                         ) : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Email Report Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[rgba(18,26,36,0.95)] border border-[#00c4ff]/30 rounded-xl shadow-[0_0_30px_rgba(0,196,255,0.2)] w-full max-w-lg">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h2 className="text-xl font-bold text-white font-['Oswald']">Email Accounting Report</h2>
              <button
                onClick={() => {
                  setShowEmailModal(false);
                  setEmailResult(null);
                  setEmailAddress("");
                }}
                className="p-1 hover:bg-gray-700 rounded"
              >
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Report Preview */}
              <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700">
                <h4 className="text-white text-sm font-medium mb-2">Report Summary</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total Dues:</span>
                    <span className="text-white">${totalDues.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total Paid:</span>
                    <span className="text-green-400">${totalPaid.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total Waived:</span>
                    <span className="text-purple-400">${totalWaived.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Outstanding:</span>
                    <span className="text-orange-400">${totalOutstanding.toFixed(2)}</span>
                  </div>
                </div>
                {(filterTeam || filterFamily || filterDateFrom || filterDateTo) && (
                  <div className="mt-2 pt-2 border-t border-gray-600">
                    <span className="text-gray-400 text-xs">Filters applied: </span>
                    <span className="text-[#00c4ff] text-xs">
                      {[
                        filterTeam && teams.find(t => t.id === filterTeam)?.name,
                        filterFamily && families.find(f => f.id === filterFamily)?.name,
                        filterDateFrom && `From: ${filterDateFrom}`,
                        filterDateTo && `To: ${filterDateTo}`,
                      ].filter(Boolean).join(", ")}
                    </span>
                  </div>
                )}
              </div>

              {/* Email Input */}
              <div>
                <label className="block text-gray-400 text-sm mb-1">Send to Email Address</label>
                <input
                  type="email"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                  placeholder="Enter email address"
                  className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:border-[#00c4ff] focus:outline-none"
                />
              </div>

              {/* Result Message */}
              {emailResult && (
                <div className={`flex items-center gap-2 p-3 rounded-lg ${
                  emailResult.success 
                    ? "bg-green-500/20 border border-green-500/30 text-green-400"
                    : "bg-red-500/20 border border-red-500/30 text-red-400"
                }`}>
                  {emailResult.success ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <AlertCircle className="h-5 w-5" />
                  )}
                  {emailResult.message}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 p-4 border-t border-gray-700">
              <button
                onClick={() => {
                  setShowEmailModal(false);
                  setEmailResult(null);
                  setEmailAddress("");
                }}
                className="px-4 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={sendEmailReport}
                disabled={sendingEmail || !emailAddress.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00c4ff] text-gray-900 font-medium hover:bg-[#00c4ff]/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sendingEmail ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-gray-900 border-t-transparent rounded-full" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Send Report
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
