import { useState, useEffect, useMemo } from "react";
import { PortalLayout } from "@/react-app/components/layout/PortalLayout";
import { 
  ArrowLeft, Mail, MessageSquare, Phone, Search, 
  ChevronUp, ChevronDown, CheckSquare, Square, Filter, X
} from "lucide-react";
import { useNavigate } from "react-router";

interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "coach" | "player" | "prospect";
  status?: string;
  age?: number;
  team_id?: number;
  team_name?: string;
  family_id?: number;
  family_name?: string;
  position?: string;
}

interface Team {
  id: number;
  name: string;
}

type SortField = "name" | "role" | "status" | "age" | "team_name" | "family_name";
type SortDir = "asc" | "desc";

export default function PortalContacts() {
  const navigate = useNavigate();
  
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [familyFilter, setFamilyFilter] = useState<string>("all");
  const [ageMin, setAgeMin] = useState<string>("");
  const [ageMax, setAgeMax] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  
  // Sorting
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  
  // Compose modal
  const [showCompose, setShowCompose] = useState(false);
  const [composeType, setComposeType] = useState<"email" | "text" | "message">("email");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    loadContacts();
    loadTeams();
  }, []);

  async function loadContacts() {
    setLoading(true);
    try {
      const res = await fetch("/api/portal/contacts", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setContacts(data);
      }
    } catch (err) {
      console.error("Failed to load contacts:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadTeams() {
    try {
      const res = await fetch("/api/portal/teams", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setTeams(data);
      }
    } catch (err) {
      console.error("Failed to load teams:", err);
    }
  }

  // Get unique families from contacts
  const families = useMemo(() => {
    const familyMap = new Map<number, string>();
    contacts.forEach(c => {
      if (c.family_id && c.family_name) {
        familyMap.set(c.family_id, c.family_name);
      }
    });
    return Array.from(familyMap.entries()).map(([id, name]) => ({ id, name }));
  }, [contacts]);

  // Filtered and sorted contacts
  const filteredContacts = useMemo(() => {
    let result = [...contacts];
    
    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(c => 
        c.name.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term) ||
        c.phone?.includes(term) ||
        c.team_name?.toLowerCase().includes(term) ||
        c.family_name?.toLowerCase().includes(term)
      );
    }
    
    // Role filter
    if (roleFilter !== "all") {
      result = result.filter(c => c.role === roleFilter);
    }
    
    // Status filter
    if (statusFilter !== "all") {
      result = result.filter(c => c.status === statusFilter);
    }
    
    // Team filter
    if (teamFilter !== "all") {
      result = result.filter(c => c.team_id === parseInt(teamFilter));
    }
    
    // Family filter
    if (familyFilter !== "all") {
      result = result.filter(c => c.family_id === parseInt(familyFilter));
    }
    
    // Age filter
    if (ageMin) {
      result = result.filter(c => c.age && c.age >= parseInt(ageMin));
    }
    if (ageMax) {
      result = result.filter(c => c.age && c.age <= parseInt(ageMax));
    }
    
    // Sort
    result.sort((a, b) => {
      let aVal = a[sortField] ?? "";
      let bVal = b[sortField] ?? "";
      
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      return sortDir === "asc" ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
    
    return result;
  }, [contacts, searchTerm, roleFilter, statusFilter, teamFilter, familyFilter, ageMin, ageMax, sortField, sortDir]);

  // Selection helpers
  const allSelected = filteredContacts.length > 0 && filteredContacts.every(c => selectedIds.has(c.id));
  
  function toggleSelect(id: string) {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  }
  
  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredContacts.map(c => c.id)));
    }
  }
  
  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }
  
  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return null;
    return sortDir === "asc" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />;
  }

  // Get selected contacts
  const selectedContacts = filteredContacts.filter(c => selectedIds.has(c.id));
  const selectedEmails = selectedContacts.filter(c => c.email).map(c => c.email);
  const selectedPhones = selectedContacts.filter(c => c.phone).map(c => c.phone);
  
  function openCompose(type: "email" | "text" | "message") {
    setComposeType(type);
    setShowCompose(true);
    setSendResult(null);
    setSubject("");
    setMessage("");
  }
  
  async function handleSend() {
    if (composeType === "email") {
      if (!subject.trim() || !message.trim()) {
        setSendResult({ success: false, message: "Please enter a subject and message." });
        return;
      }
      
      setSending(true);
      try {
        const res = await fetch("/api/portal/contacts/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            emails: selectedEmails,
            subject,
            content: message,
          }),
        });
        
        if (res.ok) {
          const data = await res.json();
          setSendResult({ success: true, message: `Email sent to ${data.sent_count} recipient(s).` });
          setSubject("");
          setMessage("");
        } else {
          const error = await res.json();
          setSendResult({ success: false, message: error.error || "Failed to send email." });
        }
      } catch (err) {
        setSendResult({ success: false, message: "Failed to send email." });
      } finally {
        setSending(false);
      }
    } else if (composeType === "text") {
      // Open SMS app with numbers
      const smsLink = `sms:${selectedPhones.join(",")}${message ? `?body=${encodeURIComponent(message)}` : ""}`;
      window.open(smsLink, "_blank");
      setShowCompose(false);
    } else {
      // Team message board - redirect
      navigate("/portal/coaches/messages");
    }
  }
  
  function clearFilters() {
    setSearchTerm("");
    setRoleFilter("all");
    setStatusFilter("all");
    setTeamFilter("all");
    setFamilyFilter("all");
    setAgeMin("");
    setAgeMax("");
  }
  
  const hasActiveFilters = roleFilter !== "all" || statusFilter !== "all" || teamFilter !== "all" || familyFilter !== "all" || ageMin || ageMax;

  const roleLabel = (role: string) => {
    switch (role) {
      case "coach": return "Coach";
      case "player": return "Player/Parent";
      case "prospect": return "Recruit";
      default: return role;
    }
  };

  return (
    <PortalLayout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate("/portal")}
            className="p-2 rounded-lg border border-[#00c4ff]/30 text-[#00c4ff] hover:bg-[rgba(0,196,255,0.15)] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-white font-[Oswald] tracking-wide">
              Contacts
            </h1>
            <p className="text-gray-400 mt-1">View and message your team contacts</p>
          </div>
        </div>

        {/* Search & Actions Bar */}
        <div className="bg-[rgba(18,26,36,0.8)] rounded-xl border border-[#00c4ff]/20 p-4 mb-6 shadow-[0_0_15px_rgba(0,196,255,0.1)]">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search contacts..."
                className="w-full pl-10 pr-4 py-2 rounded-lg bg-[rgba(0,0,0,0.3)] border border-[#00c4ff]/20 text-white placeholder-gray-500 focus:outline-none focus:border-[#00c4ff]/50"
              />
            </div>
            
            {/* Filter toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                showFilters || hasActiveFilters
                  ? "bg-[#00c4ff]/20 border-[#00c4ff] text-[#00c4ff]"
                  : "border-[#00c4ff]/30 text-gray-400 hover:text-white"
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
              {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-[#00c4ff]" />}
            </button>
            
            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => openCompose("email")}
                disabled={selectedEmails.length === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00c4ff] text-black font-semibold hover:bg-[#00e5ff] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Mail className="w-4 h-4" />
                Email ({selectedEmails.length})
              </button>
              <button
                onClick={() => openCompose("text")}
                disabled={selectedPhones.length === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#00c4ff]/30 text-[#00c4ff] hover:bg-[rgba(0,196,255,0.15)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Phone className="w-4 h-4" />
                Text ({selectedPhones.length})
              </button>
              <button
                onClick={() => openCompose("message")}
                disabled={selectedIds.size === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#00c4ff]/30 text-[#00c4ff] hover:bg-[rgba(0,196,255,0.15)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <MessageSquare className="w-4 h-4" />
                Message
              </button>
            </div>
          </div>
          
          {/* Filter Row */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-[#00c4ff]/10 flex flex-wrap items-center gap-4">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 rounded-lg bg-[rgba(0,0,0,0.3)] border border-[#00c4ff]/20 text-white focus:outline-none focus:border-[#00c4ff]/50"
              >
                <option value="all">All Roles</option>
                <option value="coach">Coaches</option>
                <option value="player">Players/Parents</option>
                <option value="prospect">Recruits</option>
              </select>
              
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-lg bg-[rgba(0,0,0,0.3)] border border-[#00c4ff]/20 text-white focus:outline-none focus:border-[#00c4ff]/50"
              >
                <option value="all">All Statuses</option>
                <option value="Full Time">Full Time</option>
                <option value="Alternate">Alternate</option>
                <option value="Hot">Hot</option>
                <option value="Warm">Warm</option>
                <option value="Cold">Cold</option>
              </select>
              
              <select
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                className="px-3 py-2 rounded-lg bg-[rgba(0,0,0,0.3)] border border-[#00c4ff]/20 text-white focus:outline-none focus:border-[#00c4ff]/50"
              >
                <option value="all">All Teams</option>
                {teams.map(team => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
              
              <select
                value={familyFilter}
                onChange={(e) => setFamilyFilter(e.target.value)}
                className="px-3 py-2 rounded-lg bg-[rgba(0,0,0,0.3)] border border-[#00c4ff]/20 text-white focus:outline-none focus:border-[#00c4ff]/50"
              >
                <option value="all">All Families</option>
                {families.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-sm">Age:</span>
                <input
                  type="number"
                  value={ageMin}
                  onChange={(e) => setAgeMin(e.target.value)}
                  placeholder="Min"
                  className="w-16 px-2 py-2 rounded-lg bg-[rgba(0,0,0,0.3)] border border-[#00c4ff]/20 text-white placeholder-gray-500 focus:outline-none focus:border-[#00c4ff]/50"
                />
                <span className="text-gray-500">-</span>
                <input
                  type="number"
                  value={ageMax}
                  onChange={(e) => setAgeMax(e.target.value)}
                  placeholder="Max"
                  className="w-16 px-2 py-2 rounded-lg bg-[rgba(0,0,0,0.3)] border border-[#00c4ff]/20 text-white placeholder-gray-500 focus:outline-none focus:border-[#00c4ff]/50"
                />
              </div>
              
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-sm text-gray-400 hover:text-white flex items-center gap-1"
                >
                  <X className="w-4 h-4" />
                  Clear
                </button>
              )}
            </div>
          )}
        </div>

        {/* Contacts Table */}
        <div className="bg-[rgba(18,26,36,0.8)] rounded-xl border border-[#00c4ff]/20 shadow-[0_0_15px_rgba(0,196,255,0.1)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#00c4ff]/20">
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={toggleSelectAll}
                      className="text-[#00c4ff] hover:text-white transition-colors"
                    >
                      {allSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                    </button>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-sm font-semibold text-gray-400 cursor-pointer hover:text-white"
                    onClick={() => handleSort("name")}
                  >
                    <div className="flex items-center gap-1">
                      Name <SortIcon field="name" />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-sm font-semibold text-gray-400 cursor-pointer hover:text-white"
                    onClick={() => handleSort("role")}
                  >
                    <div className="flex items-center gap-1">
                      Role <SortIcon field="role" />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-sm font-semibold text-gray-400 cursor-pointer hover:text-white"
                    onClick={() => handleSort("team_name")}
                  >
                    <div className="flex items-center gap-1">
                      Team <SortIcon field="team_name" />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-sm font-semibold text-gray-400 cursor-pointer hover:text-white"
                    onClick={() => handleSort("status")}
                  >
                    <div className="flex items-center gap-1">
                      Status <SortIcon field="status" />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-sm font-semibold text-gray-400 cursor-pointer hover:text-white"
                    onClick={() => handleSort("age")}
                  >
                    <div className="flex items-center gap-1">
                      Age <SortIcon field="age" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-400">
                    Contact
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                      Loading contacts...
                    </td>
                  </tr>
                ) : filteredContacts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                      No contacts found
                    </td>
                  </tr>
                ) : (
                  filteredContacts.map((contact) => (
                    <tr 
                      key={contact.id} 
                      className={`border-b border-[#00c4ff]/10 hover:bg-[rgba(0,196,255,0.05)] transition-colors ${
                        selectedIds.has(contact.id) ? "bg-[rgba(0,196,255,0.1)]" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleSelect(contact.id)}
                          className="text-[#00c4ff] hover:text-white transition-colors"
                        >
                          {selectedIds.has(contact.id) ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-white font-medium">{contact.name}</div>
                        {contact.family_name && (
                          <div className="text-xs text-gray-500">{contact.family_name} family</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          contact.role === "coach" ? "bg-blue-500/20 text-blue-400" :
                          contact.role === "player" ? "bg-green-500/20 text-green-400" :
                          "bg-yellow-500/20 text-yellow-400"
                        }`}>
                          {roleLabel(contact.role)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {contact.team_name || "-"}
                      </td>
                      <td className="px-4 py-3">
                        {contact.status && (
                          <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                            contact.status === "Full Time" ? "bg-green-500/20 text-green-400" :
                            contact.status === "Alternate" ? "bg-yellow-500/20 text-yellow-400" :
                            contact.status === "Hot" ? "bg-red-500/20 text-red-400" :
                            contact.status === "Warm" ? "bg-orange-500/20 text-orange-400" :
                            "bg-gray-500/20 text-gray-400"
                          }`}>
                            {contact.status}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {contact.age || "-"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1 text-sm">
                          {contact.email && (
                            <a href={`mailto:${contact.email}`} className="text-[#00c4ff] hover:underline truncate max-w-[180px]">
                              {contact.email}
                            </a>
                          )}
                          {contact.phone && (
                            <a href={`tel:${contact.phone}`} className="text-gray-400 hover:text-white">
                              {contact.phone}
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {contact.email && (
                            <a
                              href={`mailto:${contact.email}`}
                              className="p-1.5 rounded border border-[#00c4ff]/30 text-[#00c4ff] hover:bg-[rgba(0,196,255,0.15)] transition-colors"
                              title="Email"
                            >
                              <Mail className="w-4 h-4" />
                            </a>
                          )}
                          {contact.phone && (
                            <>
                              <a
                                href={`tel:${contact.phone}`}
                                className="p-1.5 rounded border border-[#00c4ff]/30 text-[#00c4ff] hover:bg-[rgba(0,196,255,0.15)] transition-colors"
                                title="Call"
                              >
                                <Phone className="w-4 h-4" />
                              </a>
                              <a
                                href={`sms:${contact.phone}`}
                                className="p-1.5 rounded border border-[#00c4ff]/30 text-[#00c4ff] hover:bg-[rgba(0,196,255,0.15)] transition-colors"
                                title="Text"
                              >
                                <MessageSquare className="w-4 h-4" />
                              </a>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Footer with count */}
          <div className="px-4 py-3 border-t border-[#00c4ff]/20 flex items-center justify-between">
            <div className="text-sm text-gray-400">
              {selectedIds.size > 0 ? (
                <span>{selectedIds.size} of {filteredContacts.length} selected</span>
              ) : (
                <span>{filteredContacts.length} contact{filteredContacts.length !== 1 ? "s" : ""}</span>
              )}
            </div>
          </div>
        </div>

        {/* Compose Modal */}
        {showCompose && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[rgba(18,26,36,0.95)] rounded-xl border border-[#00c4ff]/30 shadow-[0_0_30px_rgba(0,196,255,0.2)] w-full max-w-lg">
              <div className="p-6 border-b border-[#00c4ff]/20 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white font-[Oswald]">
                  {composeType === "email" ? "Send Email" : composeType === "text" ? "Send Text" : "Team Message"}
                </h2>
                <button
                  onClick={() => setShowCompose(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6">
                {sendResult && (
                  <div className={`mb-4 p-3 rounded-lg border text-sm ${
                    sendResult.success 
                      ? "bg-green-500/10 border-green-500/30 text-green-400"
                      : "bg-red-500/10 border-red-500/30 text-red-400"
                  }`}>
                    {sendResult.message}
                  </div>
                )}
                
                {composeType === "message" ? (
                  <div className="text-center py-4">
                    <MessageSquare className="w-12 h-12 text-[#00c4ff] mx-auto mb-4" />
                    <p className="text-gray-400 mb-4">Post a message on the team message board for your contacts to see.</p>
                    <button
                      onClick={handleSend}
                      className="px-6 py-3 rounded-lg bg-[#00c4ff] text-black font-semibold hover:bg-[#00e5ff] transition-colors"
                    >
                      Go to Message Board
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-sm text-gray-400">
                      Sending to {composeType === "email" ? selectedEmails.length : selectedPhones.length} recipient(s)
                    </div>
                    
                    {composeType === "email" && (
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Subject</label>
                        <input
                          type="text"
                          value={subject}
                          onChange={(e) => setSubject(e.target.value)}
                          placeholder="Enter email subject..."
                          className="w-full px-4 py-3 rounded-lg bg-[rgba(0,0,0,0.3)] border border-[#00c4ff]/20 text-white placeholder-gray-500 focus:outline-none focus:border-[#00c4ff]/50"
                        />
                      </div>
                    )}
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Message</label>
                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder={composeType === "email" ? "Type your message..." : "Type your text message..."}
                        rows={composeType === "email" ? 6 : 3}
                        className="w-full px-4 py-3 rounded-lg bg-[rgba(0,0,0,0.3)] border border-[#00c4ff]/20 text-white placeholder-gray-500 focus:outline-none focus:border-[#00c4ff]/50 resize-none"
                      />
                    </div>
                    
                    <div className="flex justify-end gap-3 pt-2">
                      <button
                        onClick={() => setShowCompose(false)}
                        className="px-4 py-2 rounded-lg border border-[#00c4ff]/30 text-gray-400 hover:text-white transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSend}
                        disabled={sending}
                        className="px-6 py-2 rounded-lg bg-[#00c4ff] text-black font-semibold hover:bg-[#00e5ff] transition-colors disabled:opacity-50"
                      >
                        {sending ? "Sending..." : composeType === "email" ? "Send Email" : "Open Text App"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
