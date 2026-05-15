import { useState, useEffect } from "react";
import { PortalLayout } from "@/react-app/components/layout/PortalLayout";
import { useRoles } from "@/react-app/contexts/RoleContext";
import { formatDate } from "@/react-app/utils/dateFormat";
import { ShoppingBag, Download, CheckCircle, Package, Lock } from "lucide-react";
import { apiFetch } from "@/react-app/lib/api";

interface UniformOrder {
  id: number;
  player_id: number;
  first_name: string;
  last_name: string;
  team_name: string;
  status: string;
  jersey_material: string;
  jersey_type: string;
  jersey_size: string;
  jersey_number: string;
  jersey_name: string;
  jersey_color: string;
  shorts_size: string;
  shorts_material: string;
  is_female: number;
  leggings_size: string;
  fleece_hoodie_size: string;
  fleece_hoodie_color: string;
  fleece_joggers_size: string;
  fleece_joggers_color: string;
  backpack_size: string;
  has_flag_sets: number;
  duffle_bag_size: string;
  drawstring_bags_qty: number;
  arm_sleeves_qty: number;
  bomber_jacket_qty: number;
  order_total: number;
  comments: string;
  created_at: string;
}

interface ConsolidatedItem {
  description: string;
  quantity: number;
  details: string[];
}

export default function PortalUniformOrders() {
  const { isAdmin, isCoach } = useRoles();
  const canManageOrders = isAdmin;
  const canViewOrders = isAdmin || isCoach;
  
  const [orders, setOrders] = useState<UniformOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [selectedOrders, setSelectedOrders] = useState<number[]>([]);

  useEffect(() => {
    loadOrders();
  }, [statusFilter]);

  async function loadOrders() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append("status", statusFilter);
      
      const res = await apiFetch(`/api/portal/uniform-orders?${params}`, {
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (error) {
      console.error("Error loading orders:", error);
    } finally {
      setLoading(false);
    }
  }

  function consolidateOrders(ordersToConsolidate: UniformOrder[]): ConsolidatedItem[] {
    const items: { [key: string]: ConsolidatedItem } = {};

    ordersToConsolidate.forEach(order => {
      const playerName = `${order.first_name} ${order.last_name}`;

      // Jerseys
      if (order.jersey_size) {
        const colors = order.jersey_color === "Both (Blue & White)" 
          ? ["Blue", "White"]
          : [order.jersey_color];

        colors.forEach(color => {
          const key = `Jersey ${order.jersey_material} ${order.jersey_type} ${order.jersey_size} ${color}`;
          if (!items[key]) {
            items[key] = { description: key, quantity: 0, details: [] };
          }
          items[key].quantity += 1;
          items[key].details.push(`${playerName} #${order.jersey_number} ${order.jersey_name}`);
        });
      }

      // Shorts
      if (order.shorts_size) {
        const key = `Shorts ${order.shorts_material} ${order.shorts_size}`;
        if (!items[key]) {
          items[key] = { description: key, quantity: 0, details: [] };
        }
        items[key].quantity += 1;
        items[key].details.push(playerName);
      }

      // Leggings
      if (order.leggings_size) {
        const key = `Leggings ${order.leggings_size}`;
        if (!items[key]) {
          items[key] = { description: key, quantity: 0, details: [] };
        }
        items[key].quantity += 1;
        items[key].details.push(playerName);
      }

      // Fleece Hoodie
      if (order.fleece_hoodie_size) {
        const key = `Fleece Hoodie ${order.fleece_hoodie_color} ${order.fleece_hoodie_size}`;
        if (!items[key]) {
          items[key] = { description: key, quantity: 0, details: [] };
        }
        items[key].quantity += 1;
        items[key].details.push(playerName);
      }

      // Fleece Joggers
      if (order.fleece_joggers_size) {
        const key = `Fleece Joggers ${order.fleece_joggers_color} ${order.fleece_joggers_size}`;
        if (!items[key]) {
          items[key] = { description: key, quantity: 0, details: [] };
        }
        items[key].quantity += 1;
        items[key].details.push(playerName);
      }

      // Backpack
      if (order.backpack_size && order.backpack_size !== "null") {
        const key = `Backpack ${order.backpack_size}`;
        if (!items[key]) {
          items[key] = { description: key, quantity: 0, details: [] };
        }
        items[key].quantity += 1;
        items[key].details.push(playerName);
      }

      // Flag Sets
      if (order.has_flag_sets) {
        const key = "Flag Set";
        if (!items[key]) {
          items[key] = { description: key, quantity: 0, details: [] };
        }
        items[key].quantity += 1;
        items[key].details.push(playerName);
      }

      // Duffle Bag
      if (order.duffle_bag_size && order.duffle_bag_size !== "null") {
        const key = `Duffle Bag ${order.duffle_bag_size}`;
        if (!items[key]) {
          items[key] = { description: key, quantity: 0, details: [] };
        }
        items[key].quantity += 1;
        items[key].details.push(playerName);
      }

      // Drawstring Bags
      if (order.drawstring_bags_qty > 0) {
        const key = "Drawstring Bag";
        if (!items[key]) {
          items[key] = { description: key, quantity: 0, details: [] };
        }
        items[key].quantity += order.drawstring_bags_qty;
        items[key].details.push(`${playerName} (${order.drawstring_bags_qty}x)`);
      }

      // Arm Sleeves
      if (order.arm_sleeves_qty > 0) {
        const key = "Arm Sleeves";
        if (!items[key]) {
          items[key] = { description: key, quantity: 0, details: [] };
        }
        items[key].quantity += order.arm_sleeves_qty;
        items[key].details.push(`${playerName} (${order.arm_sleeves_qty}x)`);
      }

      // Bomber Jacket
      if (order.bomber_jacket_qty > 0) {
        const key = "Bomber Jacket";
        if (!items[key]) {
          items[key] = { description: key, quantity: 0, details: [] };
        }
        items[key].quantity += order.bomber_jacket_qty;
        items[key].details.push(`${playerName} (${order.bomber_jacket_qty}x)`);
      }
    });

    return Object.values(items).sort((a, b) => 
      a.description.localeCompare(b.description)
    );
  }

  function exportToCSV() {
    const ordersToExport = selectedOrders.length > 0
      ? orders.filter(o => selectedOrders.includes(o.id))
      : orders;

    // Main order rows
    let csv = "LINE,MATERIAL,JERSEY TYPE,TOP SIZE,#,JERSEY NAME,SHORTS SIZE,SHORTS MATERIAL,Mark if Female,FULL FLEECE HOODIE (Size),FLEECE JOGGERS (Size),FLEECE BACK (Size),FLAG (Yes),COMMENTS\n";
    
    ordersToExport.forEach((order, idx) => {
      const line = idx + 1;
      const material = order.jersey_material || "";
      const jerseyType = order.jersey_type || "";
      const topSize = order.jersey_size || "";
      const jerseyNumber = order.jersey_number || "";
      const jerseyName = order.jersey_name || "";
      const shortsSize = order.shorts_size || "";
      const shortsMaterial = order.shorts_material || "";
      const isFemale = order.is_female ? "X" : "";
      const fleeceHoodie = order.fleece_hoodie_size || "";
      const fleeceJoggers = order.fleece_joggers_size || "";
      const backpack = order.backpack_size && order.backpack_size !== "null" ? order.backpack_size : "";
      const flag = order.has_flag_sets ? "Yes" : "";
      const comments = order.comments || "";

      csv += `${line},"${material}","${jerseyType}","${topSize}","${jerseyNumber}","${jerseyName}","${shortsSize}","${shortsMaterial}","${isFemale}","${fleeceHoodie}","${fleeceJoggers}","${backpack}","${flag}","${comments}"\n`;
    });

    // Add blank row
    csv += "\n";

    // Additional items section
    csv += "Additional add on items:\n";
    csv += "Items,MOQ,Price Per Item\n";

    // Aggregate additional items
    const duffleBags = { M: 0, L: 0 };
    let drawstringBags = 0;
    let armSleeves = 0;
    let bomberJackets = 0;

    ordersToExport.forEach(order => {
      if (order.duffle_bag_size === "M/L") {
        duffleBags.M += 1;
        duffleBags.L += 1;
      } else if (order.duffle_bag_size === "M") {
        duffleBags.M += 1;
      } else if (order.duffle_bag_size === "L") {
        duffleBags.L += 1;
      }
      drawstringBags += order.drawstring_bags_qty || 0;
      armSleeves += order.arm_sleeves_qty || 0;
      bomberJackets += order.bomber_jacket_qty || 0;
    });

    if (duffleBags.M > 0 || duffleBags.L > 0) {
      const duffleDesc = [];
      if (duffleBags.M > 0) duffleDesc.push(`M (${duffleBags.M})`);
      if (duffleBags.L > 0) duffleDesc.push(`L (${duffleBags.L})`);
      csv += `"Duffle Bags (${duffleDesc.join(", ")})",1,"$55/$60"\n`;
    }
    if (drawstringBags > 0) {
      csv += `"Drawstring Bags",5,$12\n`;
    }
    if (armSleeves > 0) {
      csv += `"Arm Sleeves","1 (sold in pairs)","12 / pair"\n`;
    }
    if (bomberJackets > 0) {
      csv += `"Bomber Jackets",10,$75\n`;
    }

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `uniform-order-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  }

  async function markAsOrdered() {
    const ordersToMark = selectedOrders.length > 0
      ? selectedOrders
      : orders.map(o => o.id);

    if (!confirm(`Mark ${ordersToMark.length} order(s) as ordered? This will clear them from the pending queue.`)) {
      return;
    }

    try {
      await Promise.all(
        ordersToMark.map(id =>
          apiFetch(`/api/portal/uniform-orders/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "ordered" }),
          })
        )
      );
      setSelectedOrders([]);
      loadOrders();
    } catch (error) {
      console.error("Error marking orders:", error);
      alert("Failed to update orders");
    }
  }

  function toggleOrderSelection(id: number) {
    setSelectedOrders(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  function toggleSelectAll() {
    if (selectedOrders.length === orders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(orders.map(o => o.id));
    }
  }

  const consolidated = consolidateOrders(
    selectedOrders.length > 0
      ? orders.filter(o => selectedOrders.includes(o.id))
      : orders
  );

  if (loading) {
    return (
      <PortalLayout>
        <div className="p-8">Loading...</div>
      </PortalLayout>
    );
  }

  // Only admins and coaches can view this page
  if (!canViewOrders) {
    return (
      <PortalLayout>
        <div className="max-w-2xl mx-auto py-16 text-center">
          <Lock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Access Restricted</h2>
          <p className="text-gray-500">
            This page is only available to administrators and coaches.
          </p>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-8 h-8 text-[#00c4ff]" />
            <div>
              <h1 className="text-2xl font-bold text-white font-[Oswald]">Uniform Orders</h1>
              <p className="text-sm text-gray-400">
                Manage and consolidate uniform orders
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-lg bg-[rgba(18,26,36,0.8)] text-white focus:ring-2 focus:ring-[#00c4ff]"
            >
              <option value="">All Orders</option>
              <option value="pending">Pending</option>
              <option value="ordered">Ordered</option>
            </select>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="bg-[rgba(18,26,36,0.8)] border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-xl p-4">
          <p className="text-sm text-gray-300">
            Uniform orders run through Shruumz, pricing listed is the most up to date information available, but is subject to change.
          </p>
        </div>

        {/* Actions */}
        {orders.length > 0 && (
          <div className="bg-[rgba(18,26,36,0.8)] border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm font-medium text-white">
                <input
                  type="checkbox"
                  checked={selectedOrders.length === orders.length}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 text-[#00c4ff] rounded"
                />
                Select All ({selectedOrders.length}/{orders.length})
              </label>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={exportToCSV}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 border border-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)] text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Export to CSV
              </button>
              {statusFilter === "pending" && canManageOrders && (
                <button
                  onClick={markAsOrdered}
                  disabled={selectedOrders.length === 0 && orders.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-[#00c4ff] border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] text-white rounded-lg hover:bg-[rgba(0,196,255,0.8)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle className="w-4 h-4" />
                  Mark as Ordered
                </button>
              )}
            </div>
          </div>
        )}

        {/* Consolidated View */}
        {consolidated.length > 0 && (
          <div className="bg-[rgba(18,26,36,0.8)] border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-xl overflow-hidden">
            <div className="px-6 py-4 bg-[rgba(0,196,255,0.1)] border-b border-[#00c4ff]/20">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-[#00c4ff]" />
                <h2 className="font-semibold text-white font-[Oswald]">
                  Consolidated Order Summary
                  {selectedOrders.length > 0 && ` (${selectedOrders.length} selected)`}
                </h2>
              </div>
            </div>

            <div className="divide-y divide-[#00c4ff]/10">
              {consolidated.map((item, idx) => (
                <div key={idx} className="px-6 py-4 hover:bg-[rgba(0,196,255,0.05)]">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-white font-[Oswald]">
                        {item.description}
                      </div>
                      <div className="text-sm text-gray-400 mt-1">
                        {item.details.join(", ")}
                      </div>
                    </div>
                    <div className="ml-4 text-right">
                      <div className="text-2xl font-bold text-[#00c4ff]">
                        {item.quantity}
                      </div>
                      <div className="text-xs text-gray-400">qty</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Individual Orders */}
        <div className="bg-[rgba(18,26,36,0.8)] border border-[#00c4ff] shadow-[0_0_8px_rgba(0,196,255,0.5)] rounded-xl overflow-hidden">
          <div className="px-6 py-4 bg-[rgba(0,196,255,0.1)] border-b border-[#00c4ff]/20">
            <h2 className="font-semibold text-white font-[Oswald]">Individual Orders</h2>
          </div>

          {orders.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-400">
              No {statusFilter} orders found
            </div>
          ) : (
            <div className="divide-y divide-[#00c4ff]/10">
              {orders.map(order => (
                <div key={order.id} className="px-6 py-4 hover:bg-[rgba(0,196,255,0.05)]">
                  <div className="flex items-start gap-4">
                    <input
                      type="checkbox"
                      checked={selectedOrders.includes(order.id)}
                      onChange={() => toggleOrderSelection(order.id)}
                      className="mt-1 w-4 h-4 text-[#00c4ff] rounded"
                    />

                    <div className="flex-1 grid md:grid-cols-3 gap-4">
                      <div>
                        <div className="font-medium text-white font-[Oswald]">
                          {order.first_name} {order.last_name}
                        </div>
                        <div className="text-sm text-gray-400">
                          {order.team_name || "No team"}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {formatDate(order.created_at)}
                        </div>
                      </div>

                      <div className="text-sm">
                        <div className="font-medium text-gray-300 mb-1">Items:</div>
                        <div className="space-y-0.5 text-gray-400">
                          {order.jersey_size && (
                            <div>
                              Jersey: {order.jersey_material} {order.jersey_type} {order.jersey_size} {order.jersey_color}
                              {order.jersey_number && ` #${order.jersey_number}`}
                              {order.jersey_name && ` (${order.jersey_name})`}
                            </div>
                          )}
                          {order.shorts_size && (
                            <div>Shorts: {order.shorts_material} {order.shorts_size}</div>
                          )}
                          {order.leggings_size && (
                            <div>Leggings: {order.leggings_size}</div>
                          )}
                          {order.fleece_hoodie_size && (
                            <div>Hoodie: {order.fleece_hoodie_color} {order.fleece_hoodie_size}</div>
                          )}
                          {order.fleece_joggers_size && (
                            <div>Joggers: {order.fleece_joggers_color} {order.fleece_joggers_size}</div>
                          )}
                          {order.has_flag_sets === 1 && <div>Flag Set</div>}
                          {order.backpack_size && order.backpack_size !== "null" && (
                            <div>Backpack: {order.backpack_size}</div>
                          )}
                          {order.duffle_bag_size && order.duffle_bag_size !== "null" && (
                            <div>Duffle Bag: {order.duffle_bag_size}</div>
                          )}
                          {order.drawstring_bags_qty > 0 && (
                            <div>Drawstring Bags: {order.drawstring_bags_qty}</div>
                          )}
                          {order.arm_sleeves_qty > 0 && (
                            <div>Arm Sleeves: {order.arm_sleeves_qty}</div>
                          )}
                          {order.bomber_jacket_qty > 0 && (
                            <div>Bomber Jacket: {order.bomber_jacket_qty}</div>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-2xl font-bold text-[#00c4ff] font-[Oswald]">
                          ${order.order_total.toFixed(2)}
                        </div>
                        <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-2 ${
                          order.status === "ordered"
                            ? "bg-green-500/20 text-green-300 border border-green-500/50"
                            : "bg-yellow-500/20 text-yellow-300 border border-yellow-500/50"
                        }`}>
                          {order.status}
                        </div>
                        {order.comments && (
                          <div className="text-xs text-gray-400 mt-2">
                            Note: {order.comments}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PortalLayout>
  );
}
