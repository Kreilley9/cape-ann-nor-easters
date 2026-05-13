import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@getmocha/users-service/react";
import { Users, UserPlus } from "lucide-react";

interface Player {
  first_name: string;
  last_name: string;
  birth_date: string;
  grade: string;
}

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [familyData, setFamilyData] = useState({
    name: "",
    email: user?.email || "",
    phone: "",
    address: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
  });

  const [players, setPlayers] = useState<Player[]>([
    {
      first_name: "",
      last_name: "",
      birth_date: "",
      grade: "",
    },
  ]);

  useEffect(() => {
    if (user?.email) {
      setFamilyData((prev) => ({ ...prev, email: user.email }));
    }
  }, [user]);

  const addPlayer = () => {
    setPlayers([
      ...players,
      {
        first_name: "",
        last_name: "",
        birth_date: "",
        grade: "",
      },
    ]);
  };

  const removePlayer = (index: number) => {
    setPlayers(players.filter((_, i) => i !== index));
  };

  const updatePlayer = (index: number, field: keyof Player, value: string) => {
    const updated = [...players];
    updated[index][field] = value;
    setPlayers(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Create family
      const familyResponse = await fetch("/api/portal/families", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...familyData,
          user_id: user?.id,
        }),
      });

      if (!familyResponse.ok) {
        throw new Error("Failed to create family");
      }

      const family = await familyResponse.json();

      // Create players
      for (const player of players) {
        if (player.first_name && player.last_name) {
          await fetch("/api/portal/players", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              ...player,
              family_id: family.id,
            }),
          });
        }
      }

      // Mark onboarding as completed
      await fetch(`/api/portal/families/${family.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...familyData,
          onboarding_completed: 1,
        }),
      });

      // Create user role for parent if it doesn't exist
      await fetch("/api/portal/user-roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          user_id: user?.id,
          email: familyData.email,
          name: familyData.name,
          role: "parent",
          family_id: family.id,
        }),
      });

      navigate("/portal");
    } catch (error) {
      console.error("Error completing onboarding:", error);
      alert("Failed to complete onboarding. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white font-[Oswald] mb-2">Welcome to the Portal!</h1>
          <p className="text-gray-400">Let's get your family information set up</p>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full ${step >= 1 ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-400"}`}>
              1
            </div>
            <div className={`w-16 h-1 ${step >= 2 ? "bg-blue-600" : "bg-gray-200"}`} />
            <div className={`flex items-center justify-center w-8 h-8 rounded-full ${step >= 2 ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-400"}`}>
              2
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-white font-[Oswald] flex items-center gap-2 mb-4">
                <Users className="w-5 h-5" />
                Family Information
              </h2>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Family Name *
                </label>
                <input
                  type="text"
                  required
                  value={familyData.name}
                  onChange={(e) => setFamilyData({ ...familyData, name: e.target.value })}
                  placeholder="Smith Family"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={familyData.email}
                    onChange={(e) => setFamilyData({ ...familyData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={familyData.phone}
                    onChange={(e) => setFamilyData({ ...familyData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={familyData.address}
                  onChange={(e) => setFamilyData({ ...familyData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Emergency Contact Name
                  </label>
                  <input
                    type="text"
                    value={familyData.emergency_contact_name}
                    onChange={(e) => setFamilyData({ ...familyData, emergency_contact_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Emergency Contact Phone
                  </label>
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
                  onClick={() => setStep(2)}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Next: Add Players
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-white font-[Oswald] flex items-center gap-2 mb-4">
                <UserPlus className="w-5 h-5" />
                Player Information
              </h2>

              {players.map((player, index) => (
                <div key={index} className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-white font-[Oswald]">Player {index + 1}</h3>
                    {players.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePlayer(index)}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">
                        First Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={player.first_name}
                        onChange={(e) => updatePlayer(index, "first_name", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">
                        Last Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={player.last_name}
                        onChange={(e) => updatePlayer(index, "last_name", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">
                        Birth Date
                      </label>
                      <input
                        type="date"
                        value={player.birth_date}
                        onChange={(e) => updatePlayer(index, "birth_date", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">
                        Grade
                      </label>
                      <select
                        value={player.grade}
                        onChange={(e) => updatePlayer(index, "grade", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Select grade</option>
                        <option value="Pre-K">Pre-K</option>
                        <option value="K">K</option>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((grade) => (
                          <option key={grade} value={grade}>{grade}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={addPlayer}
                className="w-full py-2 border-2 border-dashed border-gray-300 text-gray-400 rounded-lg hover:border-blue-500 hover:text-blue-600"
              >
                + Add Another Player
              </button>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Back
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
