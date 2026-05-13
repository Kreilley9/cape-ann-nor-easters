import { useState, useEffect } from "react";
import { Plus, X, Edit2, Search, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useNavigate } from "react-router";
import { PortalLayout } from "@/react-app/components/layout/PortalLayout";
import { useRoles } from "@/react-app/contexts/RoleContext";

interface Player {
  id: number;
  first_name: string;
  last_name: string;
  family_name?: string;
  jersey_number?: string;
  birth_date?: string;
  family_id?: number;
  status?: string;
  grade?: string;
  zorts_expiration_date?: string;
}

interface Family {
  id: number;
  name: string;
  email?: string;
  phone?: string;
}

type SortField = 'name' | 'jersey' | 'status' | 'age' | 'birthDate' | 'zortsExp';
type SortDirection = 'asc' | 'desc';

export default function PortalPlayers() {
  const navigate = useNavigate();
  const { isAdmin: isAdminRole, isCoach } = useRoles();
  const canManagePlayers = isAdminRole || isCoach;
  const [players, setPlayers] = useState<Player[]>([]);
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [ageFilter, setAgeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deleteConfirmPlayer, setDeleteConfirmPlayer] = useState<Player | null>(null);
  const [showCreatePlayerModal, setShowCreatePlayerModal] = useState(false);
  const [showEditPlayerModal, setShowEditPlayerModal] = useState(false);
  const [families, setFamilies] = useState<Family[]>([]);
  const [editingPlayer, setEditingPlayer] = useState<any>(null);
  const [showCreateFamily, setShowCreateFamily] = useState(false);
  const [newPlayerForm, setNewPlayerForm] = useState({
    family_id: 0,
    first_name: "",
    last_name: "",
    jersey_number: "",
    birth_date: "",
    status: "",
    uniform_size: "",
    zorts_expiration_date: "",
    zorts_id: "",
    grade: "",
    address_1: "",
    address_2: "",
    town: "",
    state: "",
    zip_code: "",
    parent_1_name: "",
    parent_1_phone: "",
    parent_1_email: "",
    parent_2_name: "",
    parent_2_phone: "",
    parent_2_email: "",
  });
  const [newFamilyForm, setNewFamilyForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
  });

  const calculateAge = (birthDate: string): number => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    let filtered = [...players];

    // Apply search filter
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (player) =>
          player.first_name.toLowerCase().includes(query) ||
          player.last_name.toLowerCase().includes(query) ||
          (player.family_name && player.family_name.toLowerCase().includes(query))
      );
    }

    // Apply age filter
    if (ageFilter !== 'all') {
      filtered = filtered.filter((player) => {
        if (!player.birth_date) return false;
        const age = calculateAge(player.birth_date);
        return age.toString() === ageFilter;
      });
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((player) => player.status === statusFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'name':
          aValue = `${a.last_name} ${a.first_name}`.toLowerCase();
          bValue = `${b.last_name} ${b.first_name}`.toLowerCase();
          break;
        case 'jersey':
          aValue = a.jersey_number ? parseInt(a.jersey_number) || 999 : 999;
          bValue = b.jersey_number ? parseInt(b.jersey_number) || 999 : 999;
          break;
        case 'status':
          aValue = (a.status || '').toLowerCase();
          bValue = (b.status || '').toLowerCase();
          break;
        case 'age':
          aValue = a.birth_date ? calculateAge(a.birth_date) : 999;
          bValue = b.birth_date ? calculateAge(b.birth_date) : 999;
          break;
        case 'birthDate':
          aValue = a.birth_date || '';
          bValue = b.birth_date || '';
          break;
        case 'zortsExp':
          aValue = a.zorts_expiration_date || '9999-12-31';
          bValue = b.zorts_expiration_date || '9999-12-31';
          break;
        default:
          aValue = 0;
          bValue = 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredPlayers(filtered);
  }, [searchQuery, players, sortField, sortDirection, ageFilter, statusFilter]);

  const loadData = async () => {
    try {
      await loadPlayers();
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  const loadPlayers = async () => {
    try {
      const response = await fetch("/api/portal/players/all", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setPlayers(data);
        setFilteredPlayers(data);
      }
    } catch (error) {
      console.error("Error loading players:", error);
    }
  };

  const loadFamilies = async () => {
    try {
      const response = await fetch("/api/portal/families", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setFamilies(data);
      }
    } catch (error) {
      console.error("Error loading families:", error);
    }
  };

  const handleCreatePlayer = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch("/api/portal/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(newPlayerForm),
      });

      if (response.ok) {
        setShowCreatePlayerModal(false);
        setNewPlayerForm({
          family_id: 0,
          first_name: "",
          last_name: "",
          jersey_number: "",
          birth_date: "",
          status: "",
          uniform_size: "",
          zorts_expiration_date: "",
          zorts_id: "",
          grade: "",
          address_1: "",
          address_2: "",
          town: "",
          state: "",
          zip_code: "",
          parent_1_name: "",
          parent_1_phone: "",
          parent_1_email: "",
          parent_2_name: "",
          parent_2_phone: "",
          parent_2_email: "",
        });
        await loadPlayers();
      }
    } catch (error) {
      console.error("Error creating player:", error);
    }
  };

  const handleEditPlayerClick = async (player: Player) => {
    try {
      await loadFamilies();

      // Fetch complete player details
      const response = await fetch(`/api/portal/players/${player.id}`, {
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Failed to load player details");
      }
      
      const fullPlayer = await response.json();

      setEditingPlayer({
        id: fullPlayer.id,
        family_id: fullPlayer.family_id || 0,
        first_name: fullPlayer.first_name,
        last_name: fullPlayer.last_name,
        jersey_number: fullPlayer.jersey_number || "",
        birth_date: fullPlayer.birth_date || "",
        status: fullPlayer.status || "",
        uniform_size: fullPlayer.uniform_size || "",
        zorts_expiration_date: fullPlayer.zorts_expiration_date || "",
        zorts_id: fullPlayer.zorts_id || "",
        grade: fullPlayer.grade || "",
        address_1: fullPlayer.address_1 || "",
        address_2: fullPlayer.address_2 || "",
        town: fullPlayer.town || "",
        state: fullPlayer.state || "",
        zip_code: fullPlayer.zip_code || "",
        parent_1_name: fullPlayer.parent_1_name || "",
        parent_1_phone: fullPlayer.parent_1_phone || "",
        parent_1_email: fullPlayer.parent_1_email || "",
        parent_2_name: fullPlayer.parent_2_name || "",
        parent_2_phone: fullPlayer.parent_2_phone || "",
        parent_2_email: fullPlayer.parent_2_email || "",
      });
      setShowEditPlayerModal(true);
    } catch (error) {
      console.error("Error loading player details:", error);
    }
  };

  const handleUpdatePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlayer) return;

    try {
      const response = await fetch(`/api/portal/players/${editingPlayer.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(editingPlayer),
      });

      if (response.ok) {
        setShowEditPlayerModal(false);
        setEditingPlayer(null);
        await loadPlayers();
      }
    } catch (error) {
      console.error("Error updating player:", error);
    }
  };

  const handleCreateFamily = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch("/api/portal/families", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(newFamilyForm),
      });

      if (response.ok) {
        const { id } = await response.json();
        setShowCreateFamily(false);
        setNewFamilyForm({
          name: "",
          email: "",
          phone: "",
          address: "",
          emergency_contact_name: "",
          emergency_contact_phone: "",
        });

        await loadFamilies();
        setNewPlayerForm({ ...newPlayerForm, family_id: id });
      }
    } catch (error) {
      console.error("Error creating family:", error);
    }
  };

  const handleDeletePlayer = async (player: Player) => {
    setDeleteConfirmPlayer(player);
  };

  const confirmDeletePlayer = async () => {
    if (!deleteConfirmPlayer) return;

    try {
      const response = await fetch(`/api/portal/players/${deleteConfirmPlayer.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (response.ok) {
        setDeleteConfirmPlayer(null);
        await loadPlayers();
      }
    } catch (error) {
      console.error("Error deleting player:", error);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-4 h-4 opacity-40" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-4 h-4" /> 
      : <ArrowDown className="w-4 h-4" />;
  };

  const uniqueAges = Array.from(
    new Set(
      players
        .filter(p => p.birth_date)
        .map(p => calculateAge(p.birth_date!))
    )
  ).sort((a, b) => a - b);
  const uniqueStatuses = Array.from(new Set(players.map(p => p.status).filter(Boolean))).sort();

  useEffect(() => {
    if (showCreatePlayerModal) {
      loadFamilies();
    }
  }, [showCreatePlayerModal]);

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white font-[Oswald]">All Players</h1>
          {canManagePlayers && (
            <button
              onClick={() => setShowCreatePlayerModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#00c4ff] hover:bg-[#00a3d9] shadow-lg shadow-[#00c4ff]/20 text-white rounded-lg font-medium transition-colors"
            >
              <Plus className="w-5 h-5" />
              New Player
            </button>
          )}
        </div>

        {/* Search and Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              placeholder="Search by name or family..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
            />
          </div>

          <div>
            <select
              value={ageFilter}
              onChange={(e) => setAgeFilter(e.target.value)}
              className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
            >
              <option value="all">All Ages</option>
              {uniqueAges.map((age) => (
                <option key={age} value={age.toString()}>
                  Age {age}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
            >
              <option value="all">All Status</option>
              {uniqueStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Players table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-[#00c4ff]/20">
                <tr>
                  <th 
                    className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('jersey')}
                  >
                    <div className="flex items-center gap-1">
                      # {getSortIcon('jersey')}
                    </div>
                  </th>
                  <th 
                    className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-1">
                      Name {getSortIcon('name')}
                    </div>
                  </th>
                  <th 
                    className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center gap-1">
                      Status {getSortIcon('status')}
                    </div>
                  </th>
                  <th 
                    className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('age')}
                  >
                    <div className="flex items-center gap-1">
                      Age {getSortIcon('age')}
                    </div>
                  </th>
                  <th 
                    className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('birthDate')}
                  >
                    <div className="flex items-center gap-1">
                      Birth Date {getSortIcon('birthDate')}
                    </div>
                  </th>
                  <th 
                    className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('zortsExp')}
                  >
                    <div className="flex items-center gap-1">
                      ZORTS Exp {getSortIcon('zortsExp')}
                    </div>
                  </th>
                  {canManagePlayers && (
                    <th className="py-3 px-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#00c4ff]/10">
                {filteredPlayers.map((player) => (
                  <tr key={player.id} className="hover:bg-white/5">
                    <td className="py-3 px-4 text-sm font-medium text-gray-900 font-[Oswald]">
                      {player.jersey_number || "-"}
                    </td>
                    <td 
                      className="py-3 px-4 text-sm text-[#00c4ff] hover:text-[#00c4ff] cursor-pointer font-medium"
                      onClick={() => navigate(`/portal/players/${player.id}`)}
                    >
                      {player.first_name} {player.last_name}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500">
                      {player.status || "-"}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500">
                      {player.birth_date ? calculateAge(player.birth_date) : "-"}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500">
                      {player.birth_date
                        ? player.birth_date
                        : "-"}
                    </td>
                    <td className={`py-3 px-4 text-sm ${
                      player.zorts_expiration_date 
                        ? (() => {
                            const expDate = new Date(player.zorts_expiration_date);
                            const today = new Date();
                            const oneMonthFromNow = new Date();
                            oneMonthFromNow.setMonth(today.getMonth() + 1);
                            
                            if (expDate < today) {
                              return 'bg-red-100 text-red-800 font-semibold';
                            } else if (expDate < oneMonthFromNow) {
                              return 'bg-yellow-100 text-yellow-800 font-semibold';
                            }
                            return 'text-gray-500';
                          })()
                        : 'text-gray-500'
                    }`}>
                      {player.zorts_expiration_date || "-"}
                    </td>
                    {canManagePlayers && (
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditPlayerClick(player)}
                            className="p-1 text-gray-500 hover:text-[#00c4ff]"
                            title="Edit player"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeletePlayer(player)}
                            className="p-1 text-gray-500 hover:text-red-600"
                            title="Delete player"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredPlayers.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <p>No players found.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Player Modal */}
      {showCreatePlayerModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[rgba(18,26,36,0.98)] border border-[#00c4ff]/30 rounded-xl shadow-xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white font-[Oswald]">Create Player</h2>
              <button
                onClick={() => setShowCreatePlayerModal(false)}
                className="text-gray-500 hover:text-gray-500"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleCreatePlayer} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newPlayerForm.first_name}
                    onChange={(e) =>
                      setNewPlayerForm({ ...newPlayerForm, first_name: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newPlayerForm.last_name}
                    onChange={(e) =>
                      setNewPlayerForm({ ...newPlayerForm, last_name: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">Family *</label>
                  <button
                    type="button"
                    onClick={() => setShowCreateFamily(true)}
                    className="text-sm text-[#00c4ff] hover:text-blue-700 font-medium"
                  >
                    + New Family
                  </button>
                </div>
                <select
                  required
                  value={newPlayerForm.family_id}
                  onChange={(e) =>
                    setNewPlayerForm({ ...newPlayerForm, family_id: Number(e.target.value) })
                  }
                  className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                >
                  <option value={0}>Select a family</option>
                  {families.map((family) => (
                    <option key={family.id} value={family.id}>
                      {family.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Jersey #
                  </label>
                  <input
                    type="text"
                    value={newPlayerForm.jersey_number}
                    onChange={(e) =>
                      setNewPlayerForm({ ...newPlayerForm, jersey_number: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Birth Date
                  </label>
                  <input
                    type="date"
                    value={newPlayerForm.birth_date}
                    onChange={(e) =>
                      setNewPlayerForm({ ...newPlayerForm, birth_date: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Grade</label>
                  <select
                    value={newPlayerForm.grade}
                    onChange={(e) =>
                      setNewPlayerForm({ ...newPlayerForm, grade: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                  >
                    <option value="">Select</option>
                    <option value="Preschool">Preschool</option>
                    <option value="Kindergarten">Kindergarten</option>
                    <option value="1st">1st</option>
                    <option value="2nd">2nd</option>
                    <option value="3rd">3rd</option>
                    <option value="4th">4th</option>
                    <option value="5th">5th</option>
                    <option value="6th">6th</option>
                    <option value="7th">7th</option>
                    <option value="8th">8th</option>
                    <option value="9th">9th</option>
                    <option value="10th">10th</option>
                    <option value="11th">11th</option>
                    <option value="12th">12th</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Status</label>
                  <select
                    value={newPlayerForm.status}
                    onChange={(e) =>
                      setNewPlayerForm({ ...newPlayerForm, status: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                  >
                    <option value="">Select</option>
                    <option value="Full Time">Full Time</option>
                    <option value="Alternate">Alternate</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Uniform Size
                  </label>
                  <select
                    value={newPlayerForm.uniform_size}
                    onChange={(e) =>
                      setNewPlayerForm({ ...newPlayerForm, uniform_size: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                  >
                    <option value="">Select</option>
                    <option value="YXS">YXS</option>
                    <option value="YS">YS</option>
                    <option value="YM">YM</option>
                    <option value="YL">YL</option>
                    <option value="YXL">YXL</option>
                    <option value="AS">AS</option>
                    <option value="AM">AM</option>
                    <option value="AL">AL</option>
                    <option value="AXL">AXL</option>
                    <option value="AXXL">AXXL</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    ZORTS ID
                  </label>
                  <input
                    type="text"
                    value={newPlayerForm.zorts_id}
                    onChange={(e) =>
                      setNewPlayerForm({ ...newPlayerForm, zorts_id: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    ZORTS Expiration
                  </label>
                  <input
                    type="date"
                    value={newPlayerForm.zorts_expiration_date}
                    onChange={(e) =>
                      setNewPlayerForm({ ...newPlayerForm, zorts_expiration_date: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                  />
                </div>
              </div>

              <div className="border-t border-[#00c4ff]/20 pt-4 mt-2">
                <h3 className="text-lg font-semibold text-white font-[Oswald] mb-4">Address</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Address Line 1
                    </label>
                    <input
                      type="text"
                      value={newPlayerForm.address_1}
                      onChange={(e) =>
                        setNewPlayerForm({ ...newPlayerForm, address_1: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Address Line 2
                    </label>
                    <input
                      type="text"
                      value={newPlayerForm.address_2}
                      onChange={(e) =>
                        setNewPlayerForm({ ...newPlayerForm, address_2: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">Town</label>
                      <input
                        type="text"
                        value={newPlayerForm.town}
                        onChange={(e) =>
                          setNewPlayerForm({ ...newPlayerForm, town: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">State</label>
                      <input
                        type="text"
                        value={newPlayerForm.state}
                        onChange={(e) =>
                          setNewPlayerForm({ ...newPlayerForm, state: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                        maxLength={2}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">
                        Zip Code
                      </label>
                      <input
                        type="text"
                        value={newPlayerForm.zip_code}
                        onChange={(e) =>
                          setNewPlayerForm({ ...newPlayerForm, zip_code: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-[#00c4ff]/20 pt-4 mt-2">
                <h3 className="text-lg font-semibold text-white font-[Oswald] mb-4">Parent 1 Contact</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Name</label>
                    <input
                      type="text"
                      value={newPlayerForm.parent_1_name}
                      onChange={(e) =>
                        setNewPlayerForm({ ...newPlayerForm, parent_1_name: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">Phone</label>
                      <input
                        type="tel"
                        value={newPlayerForm.parent_1_phone}
                        onChange={(e) =>
                          setNewPlayerForm({ ...newPlayerForm, parent_1_phone: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">Email</label>
                      <input
                        type="email"
                        value={newPlayerForm.parent_1_email}
                        onChange={(e) =>
                          setNewPlayerForm({ ...newPlayerForm, parent_1_email: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-[#00c4ff]/20 pt-4 mt-2">
                <h3 className="text-lg font-semibold text-white font-[Oswald] mb-4">Parent 2 Contact</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Name</label>
                    <input
                      type="text"
                      value={newPlayerForm.parent_2_name}
                      onChange={(e) =>
                        setNewPlayerForm({ ...newPlayerForm, parent_2_name: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">Phone</label>
                      <input
                        type="tel"
                        value={newPlayerForm.parent_2_phone}
                        onChange={(e) =>
                          setNewPlayerForm({ ...newPlayerForm, parent_2_phone: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">Email</label>
                      <input
                        type="email"
                        value={newPlayerForm.parent_2_email}
                        onChange={(e) =>
                          setNewPlayerForm({ ...newPlayerForm, parent_2_email: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreatePlayerModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-[#00c4ff] hover:bg-[#00a3d9] shadow-lg shadow-[#00c4ff]/20 text-white rounded-lg font-medium transition-colors"
                >
                  Create Player
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Player Modal */}
      {showEditPlayerModal && editingPlayer && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[rgba(18,26,36,0.98)] border border-[#00c4ff]/30 rounded-xl shadow-xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white font-[Oswald]">Edit Player</h2>
              <button
                onClick={() => setShowEditPlayerModal(false)}
                className="text-gray-500 hover:text-gray-500"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleUpdatePlayer} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingPlayer.first_name}
                    onChange={(e) =>
                      setEditingPlayer({ ...editingPlayer, first_name: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingPlayer.last_name}
                    onChange={(e) =>
                      setEditingPlayer({ ...editingPlayer, last_name: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Family *</label>
                <select
                  required
                  value={editingPlayer.family_id}
                  onChange={(e) =>
                    setEditingPlayer({ ...editingPlayer, family_id: Number(e.target.value) })
                  }
                  className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                >
                  <option value={0}>Select a family</option>
                  {families.map((family) => (
                    <option key={family.id} value={family.id}>
                      {family.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Jersey #
                  </label>
                  <input
                    type="text"
                    value={editingPlayer.jersey_number}
                    onChange={(e) =>
                      setEditingPlayer({ ...editingPlayer, jersey_number: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Birth Date
                  </label>
                  <input
                    type="date"
                    value={editingPlayer.birth_date}
                    onChange={(e) =>
                      setEditingPlayer({ ...editingPlayer, birth_date: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Grade</label>
                  <select
                    value={editingPlayer.grade}
                    onChange={(e) =>
                      setEditingPlayer({ ...editingPlayer, grade: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                  >
                    <option value="">Select</option>
                    <option value="Preschool">Preschool</option>
                    <option value="Kindergarten">Kindergarten</option>
                    <option value="1st">1st</option>
                    <option value="2nd">2nd</option>
                    <option value="3rd">3rd</option>
                    <option value="4th">4th</option>
                    <option value="5th">5th</option>
                    <option value="6th">6th</option>
                    <option value="7th">7th</option>
                    <option value="8th">8th</option>
                    <option value="9th">9th</option>
                    <option value="10th">10th</option>
                    <option value="11th">11th</option>
                    <option value="12th">12th</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Status</label>
                  <select
                    value={editingPlayer.status}
                    onChange={(e) =>
                      setEditingPlayer({ ...editingPlayer, status: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                  >
                    <option value="">Select</option>
                    <option value="Full Time">Full Time</option>
                    <option value="Alternate">Alternate</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Uniform Size
                  </label>
                  <select
                    value={editingPlayer.uniform_size}
                    onChange={(e) =>
                      setEditingPlayer({ ...editingPlayer, uniform_size: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                  >
                    <option value="">Select</option>
                    <option value="YXS">YXS</option>
                    <option value="YS">YS</option>
                    <option value="YM">YM</option>
                    <option value="YL">YL</option>
                    <option value="YXL">YXL</option>
                    <option value="AS">AS</option>
                    <option value="AM">AM</option>
                    <option value="AL">AL</option>
                    <option value="AXL">AXL</option>
                    <option value="AXXL">AXXL</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    ZORTS ID
                  </label>
                  <input
                    type="text"
                    value={editingPlayer.zorts_id}
                    onChange={(e) =>
                      setEditingPlayer({ ...editingPlayer, zorts_id: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    ZORTS Expiration
                  </label>
                  <input
                    type="date"
                    value={editingPlayer.zorts_expiration_date}
                    onChange={(e) =>
                      setEditingPlayer({ ...editingPlayer, zorts_expiration_date: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                  />
                </div>
              </div>

              <div className="border-t border-[#00c4ff]/20 pt-4 mt-2">
                <h3 className="text-lg font-semibold text-white font-[Oswald] mb-4">Address</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Address Line 1
                    </label>
                    <input
                      type="text"
                      value={editingPlayer.address_1}
                      onChange={(e) =>
                        setEditingPlayer({ ...editingPlayer, address_1: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Address Line 2
                    </label>
                    <input
                      type="text"
                      value={editingPlayer.address_2}
                      onChange={(e) =>
                        setEditingPlayer({ ...editingPlayer, address_2: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">Town</label>
                      <input
                        type="text"
                        value={editingPlayer.town}
                        onChange={(e) =>
                          setEditingPlayer({ ...editingPlayer, town: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">State</label>
                      <input
                        type="text"
                        value={editingPlayer.state}
                        onChange={(e) =>
                          setEditingPlayer({ ...editingPlayer, state: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                        maxLength={2}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">
                        Zip Code
                      </label>
                      <input
                        type="text"
                        value={editingPlayer.zip_code}
                        onChange={(e) =>
                          setEditingPlayer({ ...editingPlayer, zip_code: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-[#00c4ff]/20 pt-4 mt-2">
                <h3 className="text-lg font-semibold text-white font-[Oswald] mb-4">Parent 1 Contact</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Name</label>
                    <input
                      type="text"
                      value={editingPlayer.parent_1_name}
                      onChange={(e) =>
                        setEditingPlayer({ ...editingPlayer, parent_1_name: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">Phone</label>
                      <input
                        type="tel"
                        value={editingPlayer.parent_1_phone}
                        onChange={(e) =>
                          setEditingPlayer({ ...editingPlayer, parent_1_phone: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">Email</label>
                      <input
                        type="email"
                        value={editingPlayer.parent_1_email}
                        onChange={(e) =>
                          setEditingPlayer({ ...editingPlayer, parent_1_email: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-[#00c4ff]/20 pt-4 mt-2">
                <h3 className="text-lg font-semibold text-white font-[Oswald] mb-4">Parent 2 Contact</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Name</label>
                    <input
                      type="text"
                      value={editingPlayer.parent_2_name}
                      onChange={(e) =>
                        setEditingPlayer({ ...editingPlayer, parent_2_name: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">Phone</label>
                      <input
                        type="tel"
                        value={editingPlayer.parent_2_phone}
                        onChange={(e) =>
                          setEditingPlayer({ ...editingPlayer, parent_2_phone: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">Email</label>
                      <input
                        type="email"
                        value={editingPlayer.parent_2_email}
                        onChange={(e) =>
                          setEditingPlayer({ ...editingPlayer, parent_2_email: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditPlayerModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-[#00c4ff] hover:bg-[#00a3d9] shadow-lg shadow-[#00c4ff]/20 text-white rounded-lg font-medium transition-colors"
                >
                  Update Player
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmPlayer && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[rgba(18,26,36,0.98)] border border-[#00c4ff]/30 rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white font-[Oswald]">Confirm Delete</h2>
              <button
                onClick={() => setDeleteConfirmPlayer(null)}
                className="text-gray-500 hover:text-gray-500"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <p className="text-gray-500 mb-6">
              Are you sure you want to delete{" "}
              <strong>
                {deleteConfirmPlayer.first_name} {deleteConfirmPlayer.last_name}
              </strong>
              ? This will remove them from all teams and delete all their attendance records. This action cannot be undone.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmPlayer(null)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeletePlayer}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
              >
                Delete Player
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Family Modal */}
      {showCreateFamily && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-[rgba(18,26,36,0.98)] border border-[#00c4ff]/30 rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white font-[Oswald]">Create Family</h2>
              <button
                onClick={() => setShowCreateFamily(false)}
                className="text-gray-500 hover:text-gray-500"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleCreateFamily} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  Family Name *
                </label>
                <input
                  type="text"
                  required
                  value={newFamilyForm.name}
                  onChange={(e) => setNewFamilyForm({ ...newFamilyForm, name: e.target.value })}
                  className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                  placeholder="e.g., Smith Family"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Email</label>
                <input
                  type="email"
                  value={newFamilyForm.email}
                  onChange={(e) => setNewFamilyForm({ ...newFamilyForm, email: e.target.value })}
                  className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Phone</label>
                <input
                  type="tel"
                  value={newFamilyForm.phone}
                  onChange={(e) => setNewFamilyForm({ ...newFamilyForm, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-[#00c4ff]/30 rounded-lg bg-[rgba(10,15,20,0.5)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-[#00c4ff]"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateFamily(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-[#00c4ff] hover:bg-[#00a3d9] shadow-lg shadow-[#00c4ff]/20 text-white rounded-lg font-medium transition-colors"
                >
                  Create Family
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PortalLayout>
  );
}
