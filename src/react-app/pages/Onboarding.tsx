import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/react-app/contexts/AuthContext";
import { Users, UserPlus } from "lucide-react";
import { apiFetch } from "@/react-app/lib/api";

interface Player {
  first_name: string;
  last_name: string;
  birth_date: string;
  grade: string;
  is_female: boolean;
}

const BLANK_PLAYER: Player = { first_name: "", last_name: "", birth_date: "", grade: "", is_female: false };

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoConsent, setPhotoConsent] = useState(false);

  const [familyData, setFamilyData] = useState({
    name: "",
    email: user?.email || "",
    phone: "",
    address: "",
    emergency_contact_name: "",
    emergency_contact_relationship: "",
    emergency_contact_phone: "",
  });

  const [players, setPlayers] = useState<Player[]>([{ ...BLANK_PLAYER }]);

  useEffect(() => {
    if (user?.email) {
      setFamilyData((prev) => ({ ...prev, email: user.email ?? "" }));
    }
  }, [user]);

  const updatePlayer = (index: number, updates: Partial<Player>) => {
    setPlayers((prev) => prev.map((p, i) => (i === index ? { ...p, ...updates } : p)));
  };

  const handleNextStep = () => {
    if (!familyData.name.trim()) {
      setError("Family Name is required.");
      return;
    }
    setError(null);
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const completePlayers = players.filter((p) => p.first_name.trim() && p.last_name.trim());
    if (completePlayers.length === 0) {
      setError("At least one player with a first and last name is required.");
      return;
    }
    if (!photoConsent) {
      setError("Photo consent is required to complete registration.");
      return;
    }

    setLoading(true);
    try {
      const familyRes = await apiFetch("/api/portal/families", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(familyData),
      });

      let familyId: number;
      if (familyRes.status === 409) {
        const data = await familyRes.json().catch(() => ({}));
        if (data.id) {
          familyId = data.id;
        } else {
          throw new Error(data.error ?? "Failed to create family record.");
        }
      } else if (!familyRes.ok) {
        const data = await familyRes.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to create family record.");
      } else {
        const data = await familyRes.json();
        familyId = data.id;
      }

      for (const player of completePlayers) {
        const playerRes = await apiFetch("/api/portal/players", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...player, family_id: familyId }),
        });
        if (!playerRes.ok) {
          const d = await playerRes.json().catch(() => ({}));
          throw new Error(d.error ?? `Failed to save player ${player.first_name}.`);
        }
      }

      const putRes = await apiFetch(`/api/portal/families/${familyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...familyData, onboarding_completed: true, photo_consent: photoConsent }),
      });
      if (!putRes.ok) {
        const d = await putRes.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to complete onboarding.");
      }

      navigate("/portal");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete onboarding. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 font-[Oswald] mb-2">Welcome to the Portal!</h1>
          <p className="text-gray-500">Let's get your family information set up</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center mb-8">
          <div className={`flex items-center gap-2 ${step >= 1 ? "text-blue-600" : "text-gray-400"}`}>
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${step >= 1 ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-400"}`}>1</div>
            <span className="text-sm font-medium hidden sm:inline">Family Info</span>
          </div>
          <div className={`w-12 h-1 mx-2 ${step >= 2 ? "bg-blue-600" : "bg-gray-200"}`} />
          <div className={`flex items-center gap-2 ${step >= 2 ? "text-blue-600" : "text-gray-400"}`}>
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${step >= 2 ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-400"}`}>2</div>
            <span className="text-sm font-medium hidden sm:inline">Player(s)</span>
          </div>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900 font-[Oswald] flex items-center gap-2 mb-4">
                <Users className="w-5 h-5" />
                Step 1: Family Information
              </h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Family Name *</label>
                <input
                  type="text"
                  value={familyData.name}
                  onChange={(e) => setFamilyData({ ...familyData, name: e.target.value })}
                  placeholder="Smith Family"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={familyData.email}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={familyData.phone}
                    onChange={(e) => setFamilyData({ ...familyData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input
                  type="text"
                  value={familyData.address}
                  onChange={(e) => setFamilyData({ ...familyData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact Name</label>
                  <input
                    type="text"
                    value={familyData.emergency_contact_name}
                    onChange={(e) => setFamilyData({ ...familyData, emergency_contact_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Relationship</label>
                  <select
                    value={familyData.emergency_contact_relationship}
                    onChange={(e) => setFamilyData({ ...familyData, emergency_contact_relationship: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select...</option>
                    <option value="Spouse">Spouse</option>
                    <option value="Parent">Parent</option>
                    <option value="Grandparent">Grandparent</option>
                    <option value="Sibling">Sibling</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact Phone</label>
                  <input
                    type="tel"
                    value={familyData.emergency_contact_phone}
                    onChange={(e) => setFamilyData({ ...familyData, emergency_contact_phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Next: Add Players →
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900 font-[Oswald] flex items-center gap-2 mb-4">
                <UserPlus className="w-5 h-5" />
                Step 2: Player(s)
              </h2>

              {players.map((player, index) => (
                <div key={index} className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-gray-900">Player {index + 1}</h3>
                    {players.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setPlayers((prev) => prev.filter((_, i) => i !== index))}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                      <input
                        type="text"
                        value={player.first_name}
                        onChange={(e) => updatePlayer(index, { first_name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                      <input
                        type="text"
                        value={player.last_name}
                        onChange={(e) => updatePlayer(index, { last_name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Birth Date</label>
                      <input
                        type="date"
                        value={player.birth_date}
                        onChange={(e) => updatePlayer(index, { birth_date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Grade</label>
                      <select
                        value={player.grade}
                        onChange={(e) => updatePlayer(index, { grade: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Select grade</option>
                        <option value="Pre-K">Pre-K</option>
                        <option value="K">K</option>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((g) => (
                          <option key={g} value={String(g)}>{g}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                      <select
                        value={player.is_female ? "female" : "male"}
                        onChange={(e) => updatePlayer(index, { is_female: e.target.value === "female" })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() => setPlayers((prev) => [...prev, { ...BLANK_PLAYER }])}
                className="w-full py-2 border-2 border-dashed border-gray-300 text-gray-500 rounded-lg hover:border-blue-500 hover:text-blue-600 transition-colors"
              >
                + Add Another Player
              </button>

              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={photoConsent}
                    onChange={(e) => setPhotoConsent(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">
                    <span className="font-medium">Photo Consent *</span> — I consent to photos of my player(s) being used in Cape Ann Nor'easters communications, website, and social media.
                  </span>
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setError(null); setStep(1); }}
                  className="flex-1 px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  ← Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Setting up..." : "Complete Setup"}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
