import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { PortalLayout } from "@/react-app/components/layout/PortalLayout";
import { useRoles } from "@/react-app/contexts/RoleContext";
import { ShoppingBag, Check } from "lucide-react";
import { apiFetch } from "@/react-app/lib/api";

interface Player {
  id: number;
  first_name: string;
  last_name: string;
  team_id?: number;
  team_name?: string;
}

interface OrderForm {
  player_id: number | null;
  team_id: number | null;
  jersey_material: string;
  jersey_type: string;
  jersey_size: string;
  jersey_number: string;
  jersey_name: string;
  jersey_color: string;
  shorts_size: string;
  shorts_material: string;
  is_female: boolean;
  leggings_size: string;
  fleece_hoodie_size: string;
  fleece_hoodie_color: string;
  fleece_joggers_size: string;
  fleece_joggers_color: string;
  backpack_size: string;
  has_flag_sets: boolean;
  duffle_bag_size: string;
  drawstring_bags_qty: number;
  arm_sleeves_qty: number;
  bomber_jacket_qty: number;
  comments: string;
}

// Pricing constants from the spreadsheet
const PRICING = {
  top_compression: 34, // Compression (Tight)
  top_drifit: 20, // Drifit (Loose)
  bottom_compression: 24, // Compression (Tight)
  bottom_drifit: 20, // Drifit (Loose)
  flags: 12,
  hoodie: 35,
  sweatpants: 29,
  hoodie_sweatpants_combo: 60, // Discount when both ordered
  leggings: 29,
  backpack: 50,
  duffle_bag_m: 55,
  duffle_bag_l: 60,
  drawstring_bag: 12,
  arm_sleeves: 12,
  bomber_jacket: 75,
};

const JERSEY_MATERIALS = ["Drifit", "Compression"];
const JERSEY_TYPES = [
  "Sleeveless with Hoodie",
  "Sleeveless",
  "Shortsleeve with Hoodie",
  "Shortsleeves",
  "Longsleeve",
];
const COLORS = ["Blue", "White", "Both (Blue & White)"];

const ADULT_SIZES = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL++"];
const YOUTH_SIZES = ["YXS", "YS", "YM", "YL", "YXL"];
const TODDLER_SIZES = ["2T", "3T", "4T", "5T", "6T"];
const ALL_SIZES = [...TODDLER_SIZES, ...YOUTH_SIZES, ...ADULT_SIZES];

const BACKPACK_SIZES = ["S", "M", "L"];
const DUFFLE_SIZES = ["M", "L"];

export default function PortalUniformOrder() {
  const navigate = useNavigate();
  const { isAdmin, isCoach } = useRoles();
  const canSeeAllPlayers = isAdmin || isCoach;
  
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState<OrderForm>({
    player_id: null,
    team_id: null,
    jersey_material: "",
    jersey_type: "",
    jersey_size: "",
    jersey_number: "",
    jersey_name: "",
    jersey_color: "",
    shorts_size: "",
    shorts_material: "",
    is_female: false,
    leggings_size: "",
    fleece_hoodie_size: "",
    fleece_hoodie_color: "",
    fleece_joggers_size: "",
    fleece_joggers_color: "",
    backpack_size: "",
    has_flag_sets: false,
    duffle_bag_size: "",
    drawstring_bags_qty: 0,
    arm_sleeves_qty: 0,
    bomber_jacket_qty: 0,
    comments: "",
  });

  useEffect(() => {
    loadPlayers();
  }, [canSeeAllPlayers]);

  async function loadPlayers() {
    try {
      // Parents see only their family's players, admins/coaches see all
      const endpoint = canSeeAllPlayers 
        ? "/api/portal/players/all" 
        : "/api/portal/my-players";
      
      const res = await apiFetch(endpoint, {
      });
      if (res.ok) {
        const data = await res.json();
        setPlayers(data);
      } else {
        console.error("Failed to load players:", res.status, await res.text());
      }
    } catch (error) {
      console.error("Error loading players:", error);
    } finally {
      setLoading(false);
    }
  }

  function calculateTotal(): {
    jersey: number;
    shorts: number;
    addons: number;
    items: number;
    total: number;
  } {
    let jersey = 0;
    let shorts = 0;
    let addons = 0;
    let items = 0;

    // Jersey pricing based on material
    if (form.jersey_size && form.jersey_material) {
      jersey = form.jersey_material === "Compression" 
        ? PRICING.top_compression 
        : PRICING.top_drifit;
      
      // Double the price if ordering both colors
      if (form.jersey_color === "Both (Blue & White)") {
        jersey *= 2;
      }
    }

    // Shorts pricing based on material
    if (form.shorts_size && form.shorts_material) {
      shorts = form.shorts_material === "Compression"
        ? PRICING.bottom_compression
        : PRICING.bottom_drifit;
    }

    // Add-ons
    if (form.leggings_size) addons += PRICING.leggings;
    if (form.backpack_size) addons += PRICING.backpack;
    if (form.has_flag_sets) addons += PRICING.flags;

    // Hoodie & Sweatpants with combo discount
    if (form.fleece_hoodie_size && form.fleece_joggers_size) {
      addons += PRICING.hoodie_sweatpants_combo;
    } else {
      if (form.fleece_hoodie_size) addons += PRICING.hoodie;
      if (form.fleece_joggers_size) addons += PRICING.sweatpants;
    }

    // Additional items
    if (form.duffle_bag_size === "M") items += PRICING.duffle_bag_m;
    if (form.duffle_bag_size === "L") items += PRICING.duffle_bag_l;
    items += form.drawstring_bags_qty * PRICING.drawstring_bag;
    items += form.arm_sleeves_qty * PRICING.arm_sleeves;
    items += form.bomber_jacket_qty * PRICING.bomber_jacket;

    return { jersey, shorts, addons, items, total: jersey + shorts + addons + items };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!form.player_id || form.player_id === null) {
      alert("Please select a player");
      return;
    }

    const totals = calculateTotal();
    setSubmitting(true);

    try {
      const res = await apiFetch("/api/portal/uniform-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          combo_total: totals.jersey + totals.shorts,
          addons_total: totals.addons,
          items_total: totals.items,
          order_total: totals.total,
        }),
      });

      if (res.ok) {
        setSuccess(true);
      } else {
        const err = await res.json();
        alert(err.error || "Failed to submit order");
      }
    } catch (error) {
      console.error("Error submitting order:", error);
      alert("Failed to submit order");
    } finally {
      setSubmitting(false);
    }
  }

  const totals = calculateTotal();

  if (loading) {
    return (
      <PortalLayout>
        <div className="p-8">Loading...</div>
      </PortalLayout>
    );
  }

  if (success) {
    return (
      <PortalLayout>
        <div className="p-8 max-w-2xl mx-auto">
          <div className="bg-green-50 rounded-xl p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-green-800 mb-2">
              Order Request Submitted!
            </h2>
            <p className="text-green-700 mb-6">
              Your uniform order request has been submitted successfully. A coach will place the order through Shruumz, and the final amount (estimated at ${totals.total.toFixed(2)}) will be added to your account once the order is finalized.
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => {
                  setSuccess(false);
                  setForm({
                    player_id: null,
                    team_id: null,
                    jersey_material: "",
                    jersey_type: "",
                    jersey_size: "",
                    jersey_number: "",
                    jersey_name: "",
                    jersey_color: "",
                    shorts_size: "",
                    shorts_material: "",
                    is_female: false,
                    leggings_size: "",
                    fleece_hoodie_size: "",
                    fleece_hoodie_color: "",
                    fleece_joggers_size: "",
                    fleece_joggers_color: "",
                    backpack_size: "",
                    has_flag_sets: false,
                    duffle_bag_size: "",
                    drawstring_bags_qty: 0,
                    arm_sleeves_qty: 0,
                    bomber_jacket_qty: 0,
                    comments: "",
                  });
                }}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Submit Another Request
              </button>
              <button
                onClick={() => navigate("/portal")}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="p-8 max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <ShoppingBag className="w-8 h-8 text-[#00c4ff]" />
          <h1 className="text-2xl font-bold text-white font-[Oswald]">
            Uniform Order Request Form
          </h1>
        </div>

        {/* Disclaimer */}
        <div className="bg-[rgba(18,26,36,0.8)] border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-xl p-4 mb-6">
          <h3 className="font-semibold text-white mb-2">Important Information:</h3>
          <ul className="text-sm text-gray-300 space-y-1 list-disc list-inside">
            <li>This is an order request form, not a final order</li>
            <li>Prices shown are estimates and subject to change</li>
            <li>All orders will be placed by a coach through Shruumz</li>
            <li>Once your order is finalized, the actual amount owed will appear in your account</li>
          </ul>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Player Selection */}
          <div className="bg-[rgba(18,26,36,0.8)] border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white font-[Oswald] mb-4">
              Select Player
            </h2>
            <select
              value={form.player_id ?? ""}
              onChange={(e) => {
                const playerId = e.target.value ? parseInt(e.target.value, 10) : null;
                const player = players.find((p) => p.id === playerId);
                setForm({
                  ...form,
                  player_id: playerId,
                  team_id: player?.team_id || null,
                  jersey_name: player
                    ? `${player.first_name} ${player.last_name}`.toUpperCase()
                    : "",
                });
              }}
              className="w-full px-4 py-3 border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-lg bg-[rgba(18,26,36,0.8)] text-white focus:ring-2 focus:ring-[#00c4ff] focus:border-transparent"
              required
            >
              <option value="">Select a player...</option>
              {players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.first_name} {player.last_name}
                  {player.team_name && ` - ${player.team_name}`}
                </option>
              ))}
            </select>
          </div>

          {/* Jersey/Top Section */}
          <div className="bg-[rgba(18,26,36,0.8)] border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white font-[Oswald] mb-4">
              Jersey / Top
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Material
                </label>
                <select
                  value={form.jersey_material}
                  onChange={(e) =>
                    setForm({ ...form, jersey_material: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-lg bg-[rgba(18,26,36,0.8)] text-white focus:ring-2 focus:ring-[#00c4ff]"
                >
                  <option value="">Select material...</option>
                  {JERSEY_MATERIALS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Jersey Type
                </label>
                <select
                  value={form.jersey_type}
                  onChange={(e) =>
                    setForm({ ...form, jersey_type: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-lg bg-[rgba(18,26,36,0.8)] text-white focus:ring-2 focus:ring-[#00c4ff]"
                >
                  <option value="">Select type...</option>
                  {JERSEY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Size
                </label>
                <select
                  value={form.jersey_size}
                  onChange={(e) =>
                    setForm({ ...form, jersey_size: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-lg bg-[rgba(18,26,36,0.8)] text-white focus:ring-2 focus:ring-[#00c4ff]"
                >
                  <option value="">Select size...</option>
                  <optgroup label="Toddler">
                    {TODDLER_SIZES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Youth">
                    {YOUTH_SIZES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Adult">
                    {ADULT_SIZES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Color
                </label>
                <select
                  value={form.jersey_color}
                  onChange={(e) =>
                    setForm({ ...form, jersey_color: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-lg bg-[rgba(18,26,36,0.8)] text-white focus:ring-2 focus:ring-[#00c4ff]"
                >
                  <option value="">Select color...</option>
                  {COLORS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Jersey Number
                </label>
                <input
                  type="text"
                  value={form.jersey_number}
                  onChange={(e) =>
                    setForm({ ...form, jersey_number: e.target.value })
                  }
                  placeholder="e.g., 7"
                  className="w-full px-4 py-2 border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-lg bg-[rgba(18,26,36,0.8)] text-white focus:ring-2 focus:ring-[#00c4ff]"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Name on Jersey
                </label>
                <input
                  type="text"
                  value={form.jersey_name}
                  onChange={(e) =>
                    setForm({ ...form, jersey_name: e.target.value.toUpperCase() })
                  }
                  placeholder="e.g., PLAYMAKER"
                  className="w-full px-4 py-2 border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-lg bg-[rgba(18,26,36,0.8)] text-white focus:ring-2 focus:ring-[#00c4ff] uppercase"
                />
              </div>
            </div>
          </div>

          {/* Shorts Section */}
          <div className="bg-[rgba(18,26,36,0.8)] border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white font-[Oswald] mb-4">Shorts</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Size
                </label>
                <select
                  value={form.shorts_size}
                  onChange={(e) =>
                    setForm({ ...form, shorts_size: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-lg bg-[rgba(18,26,36,0.8)] text-white focus:ring-2 focus:ring-[#00c4ff]"
                >
                  <option value="">Select size...</option>
                  <optgroup label="Toddler">
                    {TODDLER_SIZES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Youth">
                    {YOUTH_SIZES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Adult">
                    {ADULT_SIZES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Material
                </label>
                <select
                  value={form.shorts_material}
                  onChange={(e) =>
                    setForm({ ...form, shorts_material: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-lg bg-[rgba(18,26,36,0.8)] text-white focus:ring-2 focus:ring-[#00c4ff]"
                >
                  <option value="">Select material...</option>
                  {JERSEY_MATERIALS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_female}
                    onChange={(e) =>
                      setForm({ ...form, is_female: e.target.checked })
                    }
                    className="w-5 h-5 rounded border-[#00c4ff] text-[#00c4ff] focus:ring-[#00c4ff]"
                  />
                  <span className="text-sm font-medium text-gray-300">
                    Female Cut
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Add-ons Section */}
          <div className="bg-[rgba(18,26,36,0.8)] border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white font-[Oswald] mb-4">
              Add-ons
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Full Leggings - ${PRICING.leggings}
                </label>
                <select
                  value={form.leggings_size}
                  onChange={(e) =>
                    setForm({ ...form, leggings_size: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-lg bg-[rgba(18,26,36,0.8)] text-white focus:ring-2 focus:ring-[#00c4ff]"
                >
                  <option value="">None</option>
                  {ALL_SIZES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Hoodie Size - ${PRICING.hoodie}
                  {form.fleece_joggers_size && " (Combo with Sweatpants: $60)"}
                </label>
                <select
                  value={form.fleece_hoodie_size}
                  onChange={(e) =>
                    setForm({ ...form, fleece_hoodie_size: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-lg bg-[rgba(18,26,36,0.8)] text-white focus:ring-2 focus:ring-[#00c4ff]"
                >
                  <option value="">None</option>
                  {ALL_SIZES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Hoodie Color
                </label>
                <select
                  value={form.fleece_hoodie_color}
                  onChange={(e) =>
                    setForm({ ...form, fleece_hoodie_color: e.target.value })
                  }
                  disabled={!form.fleece_hoodie_size}
                  className="w-full px-4 py-2 border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-lg bg-[rgba(18,26,36,0.8)] text-white focus:ring-2 focus:ring-[#00c4ff] disabled:opacity-50"
                >
                  <option value="">Select color...</option>
                  {COLORS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Sweatpants Size - ${PRICING.sweatpants}
                  {form.fleece_hoodie_size && " (Combo with Hoodie: $60)"}
                </label>
                <select
                  value={form.fleece_joggers_size}
                  onChange={(e) =>
                    setForm({ ...form, fleece_joggers_size: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-lg bg-[rgba(18,26,36,0.8)] text-white focus:ring-2 focus:ring-[#00c4ff]"
                >
                  <option value="">None</option>
                  {ALL_SIZES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Sweatpants Color
                </label>
                <select
                  value={form.fleece_joggers_color}
                  onChange={(e) =>
                    setForm({ ...form, fleece_joggers_color: e.target.value })
                  }
                  disabled={!form.fleece_joggers_size}
                  className="w-full px-4 py-2 border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-lg bg-[rgba(18,26,36,0.8)] text-white focus:ring-2 focus:ring-[#00c4ff] disabled:opacity-50"
                >
                  <option value="">Select color...</option>
                  {COLORS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Backpack - ${PRICING.backpack}
                </label>
                <select
                  value={form.backpack_size}
                  onChange={(e) =>
                    setForm({ ...form, backpack_size: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-lg bg-[rgba(18,26,36,0.8)] text-white focus:ring-2 focus:ring-[#00c4ff]"
                >
                  <option value="">None</option>
                  {BACKPACK_SIZES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.has_flag_sets}
                    onChange={(e) =>
                      setForm({ ...form, has_flag_sets: e.target.checked })
                    }
                    className="w-5 h-5 rounded border-[#00c4ff] text-[#00c4ff] focus:ring-[#00c4ff]"
                  />
                  <span className="text-sm font-medium text-gray-300">
                    Flag Set - ${PRICING.flags}
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Additional Items Section */}
          <div className="bg-[rgba(18,26,36,0.8)] border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white font-[Oswald] mb-4">
              Additional Items
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Duffle Bag - M: ${PRICING.duffle_bag_m} / L: $
                  {PRICING.duffle_bag_l}
                </label>
                <select
                  value={form.duffle_bag_size}
                  onChange={(e) =>
                    setForm({ ...form, duffle_bag_size: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-lg bg-[rgba(18,26,36,0.8)] text-white focus:ring-2 focus:ring-[#00c4ff]"
                >
                  <option value="">None</option>
                  {DUFFLE_SIZES.map((s) => (
                    <option key={s} value={s}>
                      {s} - ${s === "M" ? PRICING.duffle_bag_m : PRICING.duffle_bag_l}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Drawstring Bags - ${PRICING.drawstring_bag} each (min 5)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.drawstring_bags_qty}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      drawstring_bags_qty: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full px-4 py-2 border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-lg bg-[rgba(18,26,36,0.8)] text-white focus:ring-2 focus:ring-[#00c4ff]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Arm Sleeves - ${PRICING.arm_sleeves}/pair
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.arm_sleeves_qty}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      arm_sleeves_qty: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full px-4 py-2 border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-lg bg-[rgba(18,26,36,0.8)] text-white focus:ring-2 focus:ring-[#00c4ff]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Bomber Jackets - ${PRICING.bomber_jacket} each (min 10)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.bomber_jacket_qty}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      bomber_jacket_qty: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full px-4 py-2 border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-lg bg-[rgba(18,26,36,0.8)] text-white focus:ring-2 focus:ring-[#00c4ff]"
                />
              </div>
            </div>
          </div>

          {/* Comments */}
          <div className="bg-[rgba(18,26,36,0.8)] border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white font-[Oswald] mb-4">
              Comments
            </h2>
            <textarea
              value={form.comments}
              onChange={(e) => setForm({ ...form, comments: e.target.value })}
              rows={3}
              placeholder="Any special requests or notes..."
              className="w-full px-4 py-2 border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-lg bg-[rgba(18,26,36,0.8)] text-white placeholder-gray-500 focus:ring-2 focus:ring-[#00c4ff]"
            />
          </div>

          {/* Order Summary */}
          <div className="bg-[rgba(0,196,255,0.1)] border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white font-[Oswald] mb-4">
              Estimated Cost
            </h2>
            <div className="space-y-2 text-sm text-gray-300">
              {totals.jersey > 0 && (
                <div className="flex justify-between">
                  <span>Jersey ({form.jersey_material})</span>
                  <span>${totals.jersey.toFixed(2)}</span>
                </div>
              )}
              {totals.shorts > 0 && (
                <div className="flex justify-between">
                  <span>Shorts ({form.shorts_material})</span>
                  <span>${totals.shorts.toFixed(2)}</span>
                </div>
              )}
              {totals.addons > 0 && (
                <div className="flex justify-between">
                  <span>Add-ons</span>
                  <span>${totals.addons.toFixed(2)}</span>
                </div>
              )}
              {totals.items > 0 && (
                <div className="flex justify-between">
                  <span>Additional Items</span>
                  <span>${totals.items.toFixed(2)}</span>
                </div>
              )}
              {form.fleece_hoodie_size && form.fleece_joggers_size && (
                <div className="flex justify-between text-green-400 text-xs">
                  <span>✓ Hoodie + Sweatpants Combo Discount</span>
                  <span>-$4</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold pt-2 border-t border-[#00c4ff]/30 text-white">
                <span>Estimated Total</span>
                <span>${totals.total.toFixed(2)}</span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2 mb-3">
              This is an estimate. Final pricing will be determined when the order is placed through Shruumz.
            </p>
            <button
              type="submit"
              disabled={submitting || !form.player_id || form.player_id === null}
              className="w-full mt-4 px-6 py-3 bg-[#00c4ff] border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] text-white rounded-lg font-medium hover:bg-[rgba(0,196,255,0.8)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {submitting ? "Submitting..." : 
               !form.player_id ? "Select a player to continue" : "Submit Order Request"}
            </button>
          </div>
        </form>
      </div>
    </PortalLayout>
  );
}
