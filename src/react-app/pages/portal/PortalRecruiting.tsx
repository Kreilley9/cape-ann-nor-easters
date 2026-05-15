import { useState, useEffect } from "react";
import { useAuth } from "@/react-app/contexts/AuthContext";
import { useNavigate } from "react-router";
import { PortalLayout } from "@/react-app/components/layout/PortalLayout";
import { formatDate } from "@/react-app/utils/dateFormat";
import {
  Loader2,
  Plus,
  Search,
  UserPlus,
  Calendar,
  Phone,
  Mail,
  AlertCircle,
  SlidersHorizontal,
  ArrowUpDown,
} from "lucide-react";
import { apiFetch } from "@/react-app/lib/api";

interface Prospect {
  id: number;
  first_name: string;
  last_name: string;
  birth_date: string | null;
  age_group: string | null;
  email: string | null;
  phone: string | null;
  parent_name: string | null;
  parent_email: string | null;
  parent_phone: string | null;
  status: string | null;
  interest_level: string | null;
  next_follow_up_date: string | null;
  source: string | null;
  current_team: string | null;
  position: string | null;
  notes: string | null;
  rating: number | null;
}

export default function PortalRecruiting() {
  const { user, isPending } = useAuth();
  const navigate = useNavigate();
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterInterestLevel, setFilterInterestLevel] = useState<string>("");
  const [filterRating, setFilterRating] = useState<string>("");
  const [filterPosition, setFilterPosition] = useState<string>("");
  const [filterBirthYear, setFilterBirthYear] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("name");
  const [newProspect, setNewProspect] = useState({
    first_name: "",
    last_name: "",
    birth_date: "",
    age_group: "",
    parent_name: "",
    parent_email: "",
    parent_phone: "",
    status: "New",
    interest_level: "Medium",
    next_follow_up_date: "",
    source: "",
    position: "",
    notes: "",
    rating: "",
  });

  useEffect(() => {
    if (!isPending && !user) {
      navigate("/");
    }
  }, [user, isPending, navigate]);

  useEffect(() => {
    if (user) {
      loadProspects();
    }
  }, [user]);

  const loadProspects = async () => {
    try {
      const response = await apiFetch("/api/portal/prospects", {
      });
      if (response.ok) {
        const data = await response.json();
        setProspects(data);
      }
    } catch (error) {
      console.error("Error loading prospects:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProspect = async () => {
    try {
      const prospectData = {
        ...newProspect,
        rating: newProspect.rating ? parseInt(newProspect.rating) : null,
      };
      
      const response = await apiFetch("/api/portal/prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prospectData),
      });

      if (response.ok) {
        setShowCreateModal(false);
        setNewProspect({
          first_name: "",
          last_name: "",
          birth_date: "",
          age_group: "",
          parent_name: "",
          parent_email: "",
          parent_phone: "",
          status: "New",
          interest_level: "Medium",
          next_follow_up_date: "",
          source: "",
          position: "",
          notes: "",
          rating: "",
        });
        loadProspects();
      }
    } catch (error) {
      console.error("Error creating prospect:", error);
    }
  };

  const filteredProspects = prospects
    .filter((prospect) => {
      const search = searchTerm.toLowerCase();
      const matchesSearch =
        prospect.first_name.toLowerCase().includes(search) ||
        prospect.last_name.toLowerCase().includes(search) ||
        prospect.parent_name?.toLowerCase().includes(search) ||
        prospect.age_group?.toLowerCase().includes(search);

      const matchesStatus = !filterStatus || prospect.status === filterStatus;
      const matchesInterest = !filterInterestLevel || prospect.interest_level === filterInterestLevel;
      const matchesRating = !filterRating || 
        (filterRating === "unrated" ? !prospect.rating : prospect.rating?.toString() === filterRating);
      const matchesPosition = !filterPosition || prospect.position?.toLowerCase().includes(filterPosition.toLowerCase());
      const matchesBirthYear = !filterBirthYear || 
        (prospect.birth_date && new Date(prospect.birth_date).getFullYear().toString() === filterBirthYear);

      return matchesSearch && matchesStatus && matchesInterest && matchesRating && matchesPosition && matchesBirthYear;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "name":
          return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
        case "age":
          if (!a.birth_date && !b.birth_date) return 0;
          if (!a.birth_date) return 1;
          if (!b.birth_date) return -1;
          return new Date(a.birth_date).getTime() - new Date(b.birth_date).getTime();
        case "interest":
          const interestOrder = { "High": 0, "Medium": 1, "Low": 2 };
          const aInterest = interestOrder[a.interest_level as keyof typeof interestOrder] ?? 3;
          const bInterest = interestOrder[b.interest_level as keyof typeof interestOrder] ?? 3;
          return aInterest - bInterest;
        case "status":
          const statusOrder = { "Committed": 0, "In Discussion": 1, "Contacted": 2, "New": 3, "Not Interested": 4 };
          const aStatus = statusOrder[a.status as keyof typeof statusOrder] ?? 5;
          const bStatus = statusOrder[b.status as keyof typeof statusOrder] ?? 5;
          return aStatus - bStatus;
        case "rating":
          const aRating = a.rating ?? 0;
          const bRating = b.rating ?? 0;
          return bRating - aRating; // Higher ratings first
        case "position":
          const aPosition = a.position || "";
          const bPosition = b.position || "";
          return aPosition.localeCompare(bPosition);
        case "follow-up":
          if (!a.next_follow_up_date && !b.next_follow_up_date) return 0;
          if (!a.next_follow_up_date) return 1;
          if (!b.next_follow_up_date) return -1;
          return new Date(a.next_follow_up_date).getTime() - new Date(b.next_follow_up_date).getTime();
        default:
          return 0;
      }
    });

  // Separate overdue and upcoming follow-ups
  const today = new Date().toISOString().split("T")[0];
  const overdueProspects = filteredProspects.filter(
    (p) => p.next_follow_up_date && p.next_follow_up_date < today
  );
  const upcomingProspects = filteredProspects.filter(
    (p) => !p.next_follow_up_date || p.next_follow_up_date >= today
  );

  if (isPending || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  const getInterestBadgeColor = (level: string | null) => {
    switch (level) {
      case "High":
        return "bg-green-100 text-green-800";
      case "Medium":
        return "bg-yellow-100 text-yellow-800";
      case "Low":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusBadgeColor = (status: string | null) => {
    switch (status) {
      case "New":
        return "bg-blue-100 text-blue-800";
      case "Contacted":
        return "bg-purple-100 text-purple-800";
      case "In Discussion":
        return "bg-orange-100 text-orange-800";
      case "Committed":
        return "bg-green-100 text-green-800";
      case "Not Interested":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <PortalLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white font-[Oswald]">Recruiting</h1>
            <p className="text-gray-500 mt-1">Track and manage potential players</p>
          </div>
          <button onClick={() => setShowCreateModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Prospect
          </button>
        </div>

        {/* Search */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="Search prospects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Filters and Sort */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-3 py-2 rounded-lg border flex items-center gap-2 text-sm ${
                showFilters ? "bg-blue-50 border-blue-300 text-blue-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
              {(filterStatus || filterInterestLevel || filterRating || filterPosition || filterBirthYear) && (
                <span className="bg-blue-600 text-white rounded-full px-2 py-0.5 text-xs">
                  {[filterStatus, filterInterestLevel, filterRating, filterPosition, filterBirthYear].filter(Boolean).length}
                </span>
              )}
            </button>

            <div className="flex items-center gap-2 text-sm">
              <ArrowUpDown className="w-4 h-4 text-gray-500" />
              <span className="text-gray-500">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="name">Name</option>
                <option value="age">Birth Year (Youngest First)</option>
                <option value="interest">Interest Level</option>
                <option value="status">Status</option>
                <option value="rating">Player Rating</option>
                <option value="position">Position</option>
                <option value="follow-up">Follow-up Date</option>
              </select>
            </div>
          </div>

          {/* Filter Options */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-[#00c4ff]/20 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Statuses</option>
                  <option value="New">New</option>
                  <option value="Contacted">Contacted</option>
                  <option value="In Discussion">In Discussion</option>
                  <option value="Committed">Committed</option>
                  <option value="Not Interested">Not Interested</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Interest Level</label>
                <select
                  value={filterInterestLevel}
                  onChange={(e) => setFilterInterestLevel(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Levels</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Player Rating</label>
                <select
                  value={filterRating}
                  onChange={(e) => setFilterRating(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Ratings</option>
                  <option value="5">⭐⭐⭐⭐⭐ 5 - Excellent</option>
                  <option value="4">⭐⭐⭐⭐ 4 - Very Good</option>
                  <option value="3">⭐⭐⭐ 3 - Good</option>
                  <option value="2">⭐⭐ 2 - Average</option>
                  <option value="1">⭐ 1 - Developing</option>
                  <option value="unrated">Not Rated</option>
                </select>
              </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Position</label>
                  <input
                    type="text"
                    placeholder="e.g., Forward, Defender, Goalie"
                    value={filterPosition}
                    onChange={(e) => setFilterPosition(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Birth Year</label>
                  <input
                    type="number"
                    placeholder="e.g., 2015"
                    value={filterBirthYear}
                    onChange={(e) => setFilterBirthYear(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="2000"
                    max={new Date().getFullYear()}
                  />
                </div>
              </div>

              {(filterStatus || filterInterestLevel || filterRating || filterPosition || filterBirthYear) && (
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      setFilterStatus("");
                      setFilterInterestLevel("");
                      setFilterRating("");
                      setFilterPosition("");
                      setFilterBirthYear("");
                    }}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Clear all filters
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Overdue Follow-ups */}
        {overdueProspects.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <h2 className="text-lg font-bold text-red-900">
                Overdue Follow-ups ({overdueProspects.length})
              </h2>
            </div>
            <div className="space-y-2">
              {overdueProspects.map((prospect) => (
                <div
                  key={prospect.id}
                  onClick={() => navigate(`/portal/prospects/${prospect.id}`)}
                  className="bg-white rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 font-[Oswald]">
                        {prospect.first_name} {prospect.last_name}
                      </h3>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {prospect.age_group && (
                          <span className="text-sm text-gray-500">{prospect.age_group}</span>
                        )}
                        {prospect.position && (
                          <span className="text-sm text-gray-500">• {prospect.position}</span>
                        )}
                        {prospect.birth_date && (
                          <span className="text-sm text-gray-500">
                            • Age: {Math.floor((new Date().getTime() - new Date(prospect.birth_date).getTime()) / (1000 * 60 * 60 * 24 * 365.25))}
                          </span>
                        )}
                        {prospect.rating && (
                          <span className="text-sm text-yellow-600 font-medium">
                            • {"⭐".repeat(prospect.rating)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-sm font-medium text-red-600">
                        Follow-up: {formatDate(prospect.next_follow_up_date!)}
                      </span>
                      <div className="flex gap-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(prospect.status)}`}>
                          {prospect.status || "New"}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getInterestBadgeColor(prospect.interest_level)}`}>
                          {prospect.interest_level || "Medium"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Prospects List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : upcomingProspects.length === 0 && overdueProspects.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <UserPlus className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 font-[Oswald] mb-2">No prospects yet</h3>
            <p className="text-gray-500 mb-4">Start building your recruiting pipeline</p>
            <button onClick={() => setShowCreateModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add First Prospect
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="divide-y divide-[#00c4ff]/10">
              {upcomingProspects.map((prospect) => (
                <div
                  key={prospect.id}
                  onClick={() => navigate(`/portal/prospects/${prospect.id}`)}
                  className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 font-[Oswald] text-lg">
                        {prospect.first_name} {prospect.last_name}
                      </h3>
                      <div className="flex flex-wrap gap-3 mt-2">
                        {prospect.age_group && (
                          <span className="text-sm text-gray-500">{prospect.age_group}</span>
                        )}
                        {prospect.position && (
                          <span className="text-sm text-gray-500">• {prospect.position}</span>
                        )}
                        {prospect.birth_date && (
                          <span className="text-sm text-gray-500">
                            • Age: {Math.floor((new Date().getTime() - new Date(prospect.birth_date).getTime()) / (1000 * 60 * 60 * 24 * 365.25))}
                          </span>
                        )}
                        {prospect.current_team && (
                          <span className="text-sm text-gray-500">• {prospect.current_team}</span>
                        )}
                        {prospect.rating && (
                          <span className="text-sm text-yellow-600 font-medium">
                            • {"⭐".repeat(prospect.rating)}
                          </span>
                        )}
                      </div>
                      {prospect.parent_name && (
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                          <span>Parent: {prospect.parent_name}</span>
                          {prospect.parent_phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {prospect.parent_phone}
                            </span>
                          )}
                          {prospect.parent_email && (
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {prospect.parent_email}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 ml-4">
                      {prospect.next_follow_up_date && (
                        <span className="text-sm text-gray-500 flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDate(prospect.next_follow_up_date)}
                        </span>
                      )}
                      <div className="flex gap-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(prospect.status)}`}>
                          {prospect.status || "New"}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getInterestBadgeColor(prospect.interest_level)}`}>
                          {prospect.interest_level || "Medium"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Create Prospect Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[rgba(18,26,36,0.98)] border border-[#00c4ff]/30 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-[#00c4ff]/20">
              <h2 className="text-xl font-bold text-white font-[Oswald]">Add New Prospect</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={newProspect.first_name}
                    onChange={(e) => setNewProspect({ ...newProspect, first_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    value={newProspect.last_name}
                    onChange={(e) => setNewProspect({ ...newProspect, last_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Birth Date</label>
                  <input
                    type="date"
                    value={newProspect.birth_date}
                    onChange={(e) => setNewProspect({ ...newProspect, birth_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Age Group</label>
                  <select
                    value={newProspect.age_group}
                    onChange={(e) => setNewProspect({ ...newProspect, age_group: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select...</option>
                    <option value="5U">5U</option>
                    <option value="6U">6U</option>
                    <option value="7U">7U</option>
                    <option value="8U">8U</option>
                    <option value="9U">9U</option>
                    <option value="10U">10U</option>
                    <option value="11U">11U</option>
                    <option value="12U">12U</option>
                    <option value="13U">13U</option>
                    <option value="14U">14U</option>
                    <option value="15U">15U</option>
                    <option value="16U">16U</option>
                    <option value="17U">17U</option>
                    <option value="18U">18U</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Parent Name</label>
                <input
                  type="text"
                  value={newProspect.parent_name}
                  onChange={(e) => setNewProspect({ ...newProspect, parent_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Parent Email</label>
                  <input
                    type="email"
                    value={newProspect.parent_email}
                    onChange={(e) => setNewProspect({ ...newProspect, parent_email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Parent Phone</label>
                  <input
                    type="tel"
                    value={newProspect.parent_phone}
                    onChange={(e) => setNewProspect({ ...newProspect, parent_phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Status</label>
                  <select
                    value={newProspect.status}
                    onChange={(e) => setNewProspect({ ...newProspect, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="New">New</option>
                    <option value="Contacted">Contacted</option>
                    <option value="In Discussion">In Discussion</option>
                    <option value="Committed">Committed</option>
                    <option value="Not Interested">Not Interested</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Interest Level</label>
                  <select
                    value={newProspect.interest_level}
                    onChange={(e) => setNewProspect({ ...newProspect, interest_level: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Player Rating</label>
                  <select
                    value={newProspect.rating}
                    onChange={(e) => setNewProspect({ ...newProspect, rating: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Not rated</option>
                    <option value="1">⭐ 1 - Developing</option>
                    <option value="2">⭐⭐ 2 - Average</option>
                    <option value="3">⭐⭐⭐ 3 - Good</option>
                    <option value="4">⭐⭐⭐⭐ 4 - Very Good</option>
                    <option value="5">⭐⭐⭐⭐⭐ 5 - Excellent</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Position</label>
                  <input
                    type="text"
                    value={newProspect.position}
                    onChange={(e) => setNewProspect({ ...newProspect, position: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Source</label>
                  <input
                    type="text"
                    placeholder="e.g., Tryout, Referral, Camp"
                    value={newProspect.source}
                    onChange={(e) => setNewProspect({ ...newProspect, source: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Next Follow-up Date</label>
                <input
                  type="date"
                  value={newProspect.next_follow_up_date}
                  onChange={(e) => setNewProspect({ ...newProspect, next_follow_up_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Notes</label>
                <textarea
                  value={newProspect.notes}
                  onChange={(e) => setNewProspect({ ...newProspect, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="p-6 border-t border-[#00c4ff]/20 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewProspect({
                    first_name: "",
                    last_name: "",
                    birth_date: "",
                    age_group: "",
                    parent_name: "",
                    parent_email: "",
                    parent_phone: "",
                    status: "New",
                    interest_level: "Medium",
                    next_follow_up_date: "",
                    source: "",
                    position: "",
                    notes: "",
                    rating: "",
                  });
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProspect}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!newProspect.first_name || !newProspect.last_name}
              >
                Add Prospect
              </button>
            </div>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}
