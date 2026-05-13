import { useState, useEffect } from "react";
import { PortalLayout } from "@/react-app/components/layout/PortalLayout";
import { 
  Database, Table, Search, Edit2, Trash2, Plus, Save, X, 
  ChevronLeft, ChevronRight, RefreshCw
} from "lucide-react";

interface TableInfo {
  name: string;
  count: number;
}

interface ColumnInfo {
  name: string;
  type: string;
}

export default function PortalDatabaseAdmin() {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const pageSize = 25;

  // Edit modal state
  const [editingRow, setEditingRow] = useState<any | null>(null);
  const [editFormData, setEditFormData] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  // Add modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addFormData, setAddFormData] = useState<Record<string, any>>({});

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Lookup data for dropdowns
  const [families, setFamilies] = useState<Array<{ id: number; name: string }>>([]);
  const [teams, setTeams] = useState<Array<{ id: number; name: string }>>([]);
  const [seasons, setSeasons] = useState<Array<{ id: number; name: string }>>([]);
  const [players, setPlayers] = useState<Array<{ id: number; name: string }>>([]);
  const [events, setEvents] = useState<Array<{ id: number; name: string }>>([]);
  const [payments, setPayments] = useState<Array<{ id: number; name: string }>>([]);
  const [surveys, setSurveys] = useState<Array<{ id: number; name: string }>>([]);
  const [raffles, setRaffles] = useState<Array<{ id: number; name: string }>>([]);
  const [newsPosts, setNewsPosts] = useState<Array<{ id: number; name: string }>>([]);

  useEffect(() => {
    loadTables();
  }, []);

  useEffect(() => {
    if (selectedTable) {
      loadTableData();
      loadLookupData();
    }
  }, [selectedTable, page]);

  const loadTables = async () => {
    try {
      const response = await fetch("/api/portal/admin/tables", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setTables(data.tables);
      }
    } catch (error) {
      console.error("Error loading tables:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadTableData = async () => {
    setTableLoading(true);
    try {
      const response = await fetch(
        `/api/portal/admin/tables/${selectedTable}?page=${page}&pageSize=${pageSize}&search=${encodeURIComponent(searchQuery)}`,
        { credentials: "include" }
      );
      if (response.ok) {
        const data = await response.json();
        setColumns(data.columns);
        setRows(data.rows);
        setTotalRows(data.total);
      }
    } catch (error) {
      console.error("Error loading table data:", error);
    } finally {
      setTableLoading(false);
    }
  };

  const loadLookupData = async () => {
    try {
      // Load families
      const familiesRes = await fetch("/api/portal/families", { credentials: "include" });
      if (familiesRes.ok) setFamilies(await familiesRes.json());

      // Load teams
      const teamsRes = await fetch("/api/portal/teams", { credentials: "include" });
      if (teamsRes.ok) setTeams(await teamsRes.json());

      // Load seasons
      const seasonsRes = await fetch("/api/portal/seasons", { credentials: "include" });
      if (seasonsRes.ok) setSeasons(await seasonsRes.json());

      // Load players
      const playersRes = await fetch("/api/portal/players/all", { credentials: "include" });
      if (playersRes.ok) {
        const playersData = await playersRes.json();
        setPlayers(playersData.map((p: any) => ({ id: p.id, name: `${p.first_name} ${p.last_name}` })));
      }

      // Load events
      const eventsRes = await fetch("/api/portal/events", { credentials: "include" });
      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        setEvents(eventsData.map((e: any) => ({ id: e.id, name: e.title })));
      }

      // Load payments
      const paymentsRes = await fetch("/api/portal/payments", { credentials: "include" });
      if (paymentsRes.ok) {
        const paymentsData = await paymentsRes.json();
        setPayments(paymentsData.map((p: any) => ({ id: p.id, name: p.description })));
      }

      // Load surveys
      const surveysRes = await fetch("/api/portal/surveys", { credentials: "include" });
      if (surveysRes.ok) {
        const surveysData = await surveysRes.json();
        setSurveys(surveysData.map((s: any) => ({ id: s.id, name: s.title })));
      }

      // Load raffles
      const rafflesRes = await fetch("/api/portal/raffles", { credentials: "include" });
      if (rafflesRes.ok) {
        const rafflesData = await rafflesRes.json();
        setRaffles(rafflesData.map((r: any) => ({ id: r.id, name: r.title })));
      }

      // Load news posts
      const newsRes = await fetch("/api/portal/news", { credentials: "include" });
      if (newsRes.ok) {
        const newsData = await newsRes.json();
        setNewsPosts(newsData.map((n: any) => ({ id: n.id, name: n.title })));
      }
    } catch (error) {
      console.error("Error loading lookup data:", error);
    }
  };

  const getDropdownOptions = (columnName: string): Array<{ id: number | string; name: string }> | null => {
    const mapping: Record<string, Array<{ id: number | string; name: string }>> = {
      family_id: families,
      team_id: teams,
      season_id: seasons,
      player_id: players,
      event_id: events,
      payment_id: payments,
      survey_id: surveys,
      raffle_id: raffles,
      news_post_id: newsPosts,
    };
    return mapping[columnName] || null;
  };

  const renderFormField = (col: ColumnInfo, value: any, onChange: (value: string) => void, disabled = false) => {
    const dropdownOptions = getDropdownOptions(col.name);
    
    if (dropdownOptions) {
      return (
        <select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`w-full px-3 py-2 bg-[#0a0f14] border border-[#00c4ff]/30 rounded-lg text-white focus:outline-none focus:border-[#00c4ff] ${
            disabled ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          <option value="">Select {col.name.replace(/_/g, " ")}</option>
          {dropdownOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      );
    }

    return (
      <textarea
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={1}
        className={`w-full px-3 py-2 bg-[#0a0f14] border border-[#00c4ff]/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#00c4ff] resize-y ${
          disabled ? "opacity-50 cursor-not-allowed" : ""
        }`}
      />
    );
  };

  const handleSearch = () => {
    setPage(1);
    loadTableData();
  };

  const openEditModal = (row: any) => {
    setEditingRow(row);
    setEditFormData({ ...row });
  };

  const closeEditModal = () => {
    setEditingRow(null);
    setEditFormData({});
  };

  const saveEdit = async () => {
    if (!editingRow) return;
    setSaving(true);
    try {
      const response = await fetch(
        `/api/portal/admin/tables/${selectedTable}/${editingRow.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(editFormData),
        }
      );
      if (response.ok) {
        setMessage({ type: "success", text: "Row updated successfully" });
        closeEditModal();
        loadTableData();
      } else {
        const error = await response.json();
        setMessage({ type: "error", text: error.error || "Failed to update row" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Error updating row" });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const openAddModal = () => {
    const initialData: Record<string, any> = {};
    columns.forEach((col) => {
      if (col.name !== "id" && !col.name.endsWith("_at")) {
        initialData[col.name] = "";
      }
    });
    setAddFormData(initialData);
    setShowAddModal(true);
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    setAddFormData({});
  };

  const saveAdd = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/portal/admin/tables/${selectedTable}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(addFormData),
      });
      if (response.ok) {
        setMessage({ type: "success", text: "Row created successfully" });
        closeAddModal();
        loadTableData();
      } else {
        const error = await response.json();
        setMessage({ type: "error", text: error.error || "Failed to create row" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Error creating row" });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const deleteRow = async (id: number) => {
    try {
      const response = await fetch(`/api/portal/admin/tables/${selectedTable}/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (response.ok) {
        setMessage({ type: "success", text: "Row deleted successfully" });
        setDeletingId(null);
        loadTableData();
      } else {
        const error = await response.json();
        setMessage({ type: "error", text: error.error || "Failed to delete row" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Error deleting row" });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const totalPages = Math.ceil(totalRows / pageSize);

  const filteredTables = tables.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const truncateValue = (value: any, maxLen = 50) => {
    if (value === null || value === undefined) return <span className="text-gray-500 italic">null</span>;
    const str = String(value);
    if (str.length > maxLen) return str.substring(0, maxLen) + "...";
    return str;
  };

  if (loading) {
    return (
      <PortalLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#00c4ff]"></div>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Database className="w-8 h-8 text-[#00c4ff]" />
          <h1
            className="text-2xl md:text-3xl font-bold text-white"
            style={{ fontFamily: "Oswald, sans-serif" }}
          >
            DATABASE ADMIN
          </h1>
        </div>

        {message && (
          <div
            className={`mb-6 p-4 rounded-lg border ${
              message.type === "success"
                ? "bg-green-900/30 border-green-500/50 text-green-300"
                : "bg-red-900/30 border-red-500/50 text-red-300"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Table List Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-[rgba(18,26,36,0.8)] border border-[#00c4ff]/30 rounded-xl p-4 shadow-[0_0_15px_rgba(0,196,255,0.1)]">
              <h2 className="text-lg font-bold text-white mb-4" style={{ fontFamily: "Oswald, sans-serif" }}>
                TABLES
              </h2>
              <div className="space-y-1 max-h-[60vh] overflow-y-auto">
                {filteredTables.map((table) => (
                  <button
                    key={table.name}
                    onClick={() => {
                      setSelectedTable(table.name);
                      setPage(1);
                      setSearchQuery("");
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-all ${
                      selectedTable === table.name
                        ? "bg-[#00c4ff]/20 border border-[#00c4ff]/50 text-white"
                        : "text-gray-300 hover:bg-[#00c4ff]/10 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Table className="w-4 h-4 text-[#00c4ff]" />
                      <span className="text-sm truncate">{table.name}</span>
                    </div>
                    <span className="text-xs text-gray-500">{table.count}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Table Data Panel */}
          <div className="lg:col-span-3">
            <div className="bg-[rgba(18,26,36,0.8)] border border-[#00c4ff]/30 rounded-xl p-4 shadow-[0_0_15px_rgba(0,196,255,0.1)]">
              {selectedTable ? (
                <>
                  {/* Header */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                    <h2 className="text-lg font-bold text-white" style={{ fontFamily: "Oswald, sans-serif" }}>
                      {selectedTable.toUpperCase()}
                      <span className="text-gray-400 text-sm font-normal ml-2">({totalRows} rows)</span>
                    </h2>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                          placeholder="Search..."
                          className="pl-9 pr-3 py-2 bg-[#0a0f14] border border-[#00c4ff]/30 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#00c4ff] w-48"
                        />
                      </div>
                      <button
                        onClick={loadTableData}
                        className="p-2 bg-[#0a0f14] border border-[#00c4ff]/30 rounded-lg text-[#00c4ff] hover:bg-[#00c4ff]/10"
                        title="Refresh"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={openAddModal}
                        className="flex items-center gap-1 px-3 py-2 bg-[#00c4ff] text-[#0a0f14] font-bold rounded-lg hover:bg-[#00a3d9] text-sm"
                      >
                        <Plus className="w-4 h-4" />
                        Add Row
                      </button>
                    </div>
                  </div>

                  {/* Table */}
                  {tableLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#00c4ff]"></div>
                    </div>
                  ) : rows.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[#00c4ff]/30">
                            {columns.map((col) => (
                              <th
                                key={col.name}
                                className="px-3 py-2 text-left text-gray-400 font-medium whitespace-nowrap"
                              >
                                {col.name}
                              </th>
                            ))}
                            <th className="px-3 py-2 text-right text-gray-400 font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row, idx) => (
                            <tr
                              key={row.id || idx}
                              className="border-b border-[#00c4ff]/10 hover:bg-[#00c4ff]/5"
                            >
                              {columns.map((col) => (
                                <td key={col.name} className="px-3 py-2 text-gray-300 whitespace-nowrap">
                                  {truncateValue(row[col.name])}
                                </td>
                              ))}
                              <td className="px-3 py-2 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => openEditModal(row)}
                                    className="p-1.5 text-[#00c4ff] hover:bg-[#00c4ff]/10 rounded"
                                    title="Edit"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  {deletingId === row.id ? (
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => deleteRow(row.id)}
                                        className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                                      >
                                        Confirm
                                      </button>
                                      <button
                                        onClick={() => setDeletingId(null)}
                                        className="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setDeletingId(row.id)}
                                      className="p-1.5 text-red-400 hover:bg-red-400/10 rounded"
                                      title="Delete"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-400">
                      No rows found
                    </div>
                  )}

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#00c4ff]/20">
                      <span className="text-sm text-gray-400">
                        Page {page} of {totalPages}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setPage(Math.max(1, page - 1))}
                          disabled={page === 1}
                          className="p-2 bg-[#0a0f14] border border-[#00c4ff]/30 rounded-lg text-[#00c4ff] hover:bg-[#00c4ff]/10 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setPage(Math.min(totalPages, page + 1))}
                          disabled={page === totalPages}
                          className="p-2 bg-[#0a0f14] border border-[#00c4ff]/30 rounded-lg text-[#00c4ff] hover:bg-[#00c4ff]/10 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <Database className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Select a table from the sidebar to view and edit data</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editingRow && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#121a24] border border-[#00c4ff]/30 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-[0_0_30px_rgba(0,196,255,0.2)]">
            <div className="flex items-center justify-between p-4 border-b border-[#00c4ff]/30">
              <h3 className="text-lg font-bold text-white" style={{ fontFamily: "Oswald, sans-serif" }}>
                EDIT ROW (ID: {editingRow.id})
              </h3>
              <button onClick={closeEditModal} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh] space-y-3">
              {columns.map((col) => (
                <div key={col.name}>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    {col.name} <span className="text-gray-600">({col.type})</span>
                  </label>
                  {col.name === "id" ? (
                    <input
                      type="text"
                      value={editFormData[col.name] ?? ""}
                      disabled
                      className="w-full px-3 py-2 bg-[#0a0f14]/50 border border-gray-600 rounded-lg text-gray-500 cursor-not-allowed"
                    />
                  ) : col.name === "family_name" ? (
                    <input
                      type="text"
                      value={editFormData[col.name] ?? ""}
                      disabled
                      className="w-full px-3 py-2 bg-[#0a0f14]/50 border border-gray-600 rounded-lg text-gray-500 cursor-not-allowed"
                    />
                  ) : (
                    renderFormField(
                      col,
                      editFormData[col.name],
                      (value) => setEditFormData({ ...editFormData, [col.name]: value })
                    )
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-[#00c4ff]/30">
              <button
                onClick={closeEditModal}
                className="px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-[#00c4ff] text-[#0a0f14] font-bold rounded-lg hover:bg-[#00a3d9] disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#121a24] border border-[#00c4ff]/30 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-[0_0_30px_rgba(0,196,255,0.2)]">
            <div className="flex items-center justify-between p-4 border-b border-[#00c4ff]/30">
              <h3 className="text-lg font-bold text-white" style={{ fontFamily: "Oswald, sans-serif" }}>
                ADD NEW ROW
              </h3>
              <button onClick={closeAddModal} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh] space-y-3">
              {columns
                .filter((col) => col.name !== "id" && !col.name.endsWith("_at") && col.name !== "family_name")
                .map((col) => (
                  <div key={col.name}>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      {col.name} <span className="text-gray-600">({col.type})</span>
                    </label>
                    {renderFormField(
                      col,
                      addFormData[col.name],
                      (value) => setAddFormData({ ...addFormData, [col.name]: value })
                    )}
                  </div>
                ))}
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-[#00c4ff]/30">
              <button
                onClick={closeAddModal}
                className="px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={saveAdd}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-[#00c4ff] text-[#0a0f14] font-bold rounded-lg hover:bg-[#00a3d9] disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                {saving ? "Creating..." : "Create Row"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}
