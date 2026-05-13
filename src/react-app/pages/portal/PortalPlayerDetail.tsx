import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { PortalLayout } from "@/react-app/components/layout/PortalLayout";
import { ArrowLeft, Upload, Calendar, DollarSign, ShoppingBag } from "lucide-react";
import { formatDate, formatTime } from "@/react-app/utils/dateFormat";
import { PhoneLink, TextLink, EmailLink, ContactLinksRow } from "@/react-app/components/ContactLinks";

interface Player {
  id: number;
  family_id: number;
  family_name?: string;
  first_name: string;
  last_name: string;
  birth_date?: string;
  grade?: string;
  jersey_number?: string;
  status?: string;
  uniform_size?: string;
  zorts_id?: string;
  zorts_expiration_date?: string;
  address_1?: string;
  address_2?: string;
  town?: string;
  state?: string;
  zip_code?: string;
  parent_1_name?: string;
  parent_1_phone?: string;
  parent_1_email?: string;
  parent_2_name?: string;
  parent_2_phone?: string;
  parent_2_email?: string;
  notes?: string;
  photo_url?: string;
  photo_key?: string;
}

interface Event {
  id: number;
  title: string;
  event_type: string;
  start_at: string;
  location?: string;
  rsvp_status?: string;
}

interface Payment {
  id: number;
  description: string;
  amount: number;
  due_date?: string;
  paid_at?: string;
  status: string;
}

interface UniformOrder {
  id: number;
  submitted_at: string;
  created_at: string;
  jersey_material?: string;
  jersey_type?: string;
  jersey_size?: string;
  jersey_number?: string;
  jersey_name?: string;
  jersey_color?: string;
  shorts_material?: string;
  shorts_size?: string;
  fleece_hoodie_size?: string;
  fleece_hoodie_color?: string;
  fleece_joggers_size?: string;
  fleece_joggers_color?: string;
  backpack_size?: string;
  has_flag_sets?: number;
  order_total: number;
  status: string;
}

export default function PortalPlayerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [player, setPlayer] = useState<Player | null>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [pastEvents, setPastEvents] = useState<Event[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [uniformOrders, setUniformOrders] = useState<UniformOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    loadPlayerData();
  }, [id]);

  useEffect(() => {
    if (player?.photo_key) {
      setPhotoUrl(`/api/portal/players/${id}/photo`);
    }
  }, [player, id]);

  async function loadPlayerData() {
    try {
      setLoading(true);
      
      // Load player details
      const playerRes = await fetch(`/api/portal/players/${id}`, {
        credentials: "include"
      });
      if (playerRes.ok) {
        const playerData = await playerRes.json();
        setPlayer(playerData);
      }

      // Load upcoming events
      const upcomingRes = await fetch(`/api/portal/players/${id}/events/upcoming`, {
        credentials: "include"
      });
      if (upcomingRes.ok) {
        const eventsData = await upcomingRes.json();
        setUpcomingEvents(eventsData);
      }

      // Load past events
      const pastRes = await fetch(`/api/portal/players/${id}/events/past`, {
        credentials: "include"
      });
      if (pastRes.ok) {
        const eventsData = await pastRes.json();
        setPastEvents(eventsData);
      }

      // Load payments
      const paymentsRes = await fetch(`/api/portal/players/${id}/payments`, {
        credentials: "include"
      });
      if (paymentsRes.ok) {
        const paymentsData = await paymentsRes.json();
        setPayments(paymentsData);
      }

      // Load uniform orders
      const ordersRes = await fetch(`/api/portal/players/${id}/uniform-orders`, {
        credentials: "include"
      });
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setUniformOrders(ordersData);
      }
    } catch (error) {
      console.error("Error loading player data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handlePhotoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check if it's an image
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    // Check file size (limit to 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be smaller than 5MB");
      return;
    }

    try {
      setUploading(true);

      const formData = new FormData();
      formData.append("photo", file);

      const response = await fetch(`/api/portal/players/${id}/photo`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (response.ok) {
        // Reload player data to get updated photo_key
        await loadPlayerData();
        // Update photo URL with cache buster
        setPhotoUrl(`/api/portal/players/${id}/photo?t=${Date.now()}`);
      } else {
        const error = await response.json();
        alert(error.error || "Failed to upload photo");
      }
    } catch (error) {
      console.error("Error uploading photo:", error);
      alert("Failed to upload photo");
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <PortalLayout>
        <div className="p-8">Loading player details...</div>
      </PortalLayout>
    );
  }

  if (!player) {
    return (
      <PortalLayout>
        <div className="p-8">Player not found</div>
      </PortalLayout>
    );
  }

  const totalOwed = payments
    .filter(p => p.status !== "paid")
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <PortalLayout>
      <div className="p-8 max-w-7xl mx-auto">
        <button
          onClick={() => navigate("/portal/players")}
          className="mb-4 flex items-center gap-2 text-gray-500 hover:text-white font-[Oswald] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Players
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Photo and Basic Info */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-[#00c4ff]/20">
                <h3 className="text-lg font-semibold text-white font-[Oswald]">Photo</h3>
              </div>
              <div className="p-6 flex flex-col items-center space-y-4">
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt={`${player.first_name} ${player.last_name}`}
                    className="w-48 h-48 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-48 h-48 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500">
                    No Photo
                  </div>
                )}
                <label className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2 cursor-pointer">
                  <Upload className="w-4 h-4" />
                  {uploading ? "Uploading..." : "Upload Photo"}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-[#00c4ff]/20">
                <h3 className="text-lg font-semibold text-white font-[Oswald]">Quick Stats</h3>
              </div>
              <div className="p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Status</span>
                  <span className="font-medium">{player.status || "Active"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Jersey</span>
                  <span className="font-medium">{player.jersey_number || "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Grade</span>
                  <span className="font-medium">{player.grade || "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Money Owed</span>
                  <span className={`font-medium ${totalOwed > 0 ? "text-red-500" : ""}`}>
                    ${totalOwed.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Detailed Info */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-[#00c4ff]/20">
                <h3 className="text-lg font-semibold text-white font-[Oswald]">Player Information</h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">First Name</label>
                    <p className="mt-1">{player.first_name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Last Name</label>
                    <p className="mt-1">{player.last_name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Birth Date</label>
                    <p className="mt-1">{player.birth_date || "—"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Family</label>
                    <p className="mt-1">{player.family_name || "—"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Uniform Size</label>
                    <p className="mt-1">{player.uniform_size || "—"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">ZORTS ID</label>
                    <p className="mt-1">{player.zorts_id || "—"}</p>
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-gray-500">ZORTS Expiration</label>
                    <p className="mt-1">{player.zorts_expiration_date || "—"}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-[#00c4ff]/20">
                <h3 className="text-lg font-semibold text-white font-[Oswald]">Address</h3>
              </div>
              <div className="p-6">
                <div className="space-y-2">
                  <p>{player.address_1 || "—"}</p>
                  {player.address_2 && <p>{player.address_2}</p>}
                  <p>
                    {player.town && player.state && player.zip_code
                      ? `${player.town}, ${player.state} ${player.zip_code}`
                      : "—"}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-[#00c4ff]/20">
                <h3 className="text-lg font-semibold text-white font-[Oswald]">Parent Contact Information</h3>
              </div>
              <div className="p-6">
                <div className="space-y-6">
                  {player.parent_1_name && (
                    <div>
                      <h4 className="font-medium mb-3">Parent 1: {player.parent_1_name}</h4>
                      <div className="space-y-2">
                        {player.parent_1_phone && (
                          <div className="flex items-center gap-4">
                            <PhoneLink phone={player.parent_1_phone} />
                            <TextLink phone={player.parent_1_phone} />
                          </div>
                        )}
                        {player.parent_1_email && (
                          <EmailLink email={player.parent_1_email} />
                        )}
                      </div>
                      {(player.parent_1_phone || player.parent_1_email) && (
                        <div className="mt-3">
                          <ContactLinksRow phone={player.parent_1_phone} email={player.parent_1_email} />
                        </div>
                      )}
                    </div>
                  )}
                  {player.parent_2_name && (
                    <div>
                      <h4 className="font-medium mb-3">Parent 2: {player.parent_2_name}</h4>
                      <div className="space-y-2">
                        {player.parent_2_phone && (
                          <div className="flex items-center gap-4">
                            <PhoneLink phone={player.parent_2_phone} />
                            <TextLink phone={player.parent_2_phone} />
                          </div>
                        )}
                        {player.parent_2_email && (
                          <EmailLink email={player.parent_2_email} />
                        )}
                      </div>
                      {(player.parent_2_phone || player.parent_2_email) && (
                        <div className="mt-3">
                          <ContactLinksRow phone={player.parent_2_phone} email={player.parent_2_email} />
                        </div>
                      )}
                    </div>
                  )}
                  {!player.parent_1_name && !player.parent_2_name && <p className="text-gray-500">—</p>}
                </div>
              </div>
            </div>

            {player.notes && (
              <div className="bg-white rounded-lg shadow">
                <div className="p-6 border-b border-[#00c4ff]/20">
                  <h3 className="text-lg font-semibold text-white font-[Oswald]">Notes</h3>
                </div>
                <div className="p-6">
                  <p className="text-sm whitespace-pre-wrap">{player.notes}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Events Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-[#00c4ff]/20">
              <h3 className="text-lg font-semibold text-white font-[Oswald] flex items-center">
                <Calendar className="mr-2 h-5 w-5" />
                Upcoming Events
              </h3>
            </div>
            <div className="p-6">
              {upcomingEvents.length > 0 ? (
                <div className="space-y-3">
                  {upcomingEvents.map((event) => (
                    <div key={event.id} className="border-l-4 border-blue-500 pl-3 py-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium">{event.title}</h4>
                          <p className="text-sm text-gray-500">
                            {formatDate(event.start_at)} at{" "}
                            {formatTime(event.start_at)}
                          </p>
                          {event.location && (
                            <p className="text-sm text-gray-500">{event.location}</p>
                          )}
                        </div>
                        {event.rsvp_status && (
                          <span className={`text-xs px-2 py-1 rounded ${
                            event.rsvp_status === 'yes' ? 'bg-green-100 text-green-800' :
                            event.rsvp_status === 'no' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {event.rsvp_status}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No upcoming events</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-[#00c4ff]/20">
              <h3 className="text-lg font-semibold text-white font-[Oswald] flex items-center">
                <Calendar className="mr-2 h-5 w-5" />
                Past Events
              </h3>
            </div>
            <div className="p-6">
              {pastEvents.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {pastEvents.map((event) => (
                    <div key={event.id} className="border-l-4 border-gray-300 pl-3 py-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium">{event.title}</h4>
                          <p className="text-sm text-gray-500">
                            {formatDate(event.start_at)}
                          </p>
                          {event.location && (
                            <p className="text-sm text-gray-500">{event.location}</p>
                          )}
                        </div>
                        {event.rsvp_status && (
                          <span className={`text-xs px-2 py-1 rounded ${
                            event.rsvp_status === 'yes' ? 'bg-green-100 text-green-800' :
                            event.rsvp_status === 'no' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {event.rsvp_status}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No past events</p>
              )}
            </div>
          </div>
        </div>

        {/* Payments Section */}
        <div className="bg-white rounded-lg shadow mt-6">
          <div className="p-6 border-b border-[#00c4ff]/20">
            <h3 className="text-lg font-semibold text-white font-[Oswald] flex items-center">
              <DollarSign className="mr-2 h-5 w-5" />
              Payments & Fees
            </h3>
          </div>
          <div className="p-6">
            {payments.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-4">Description</th>
                      <th className="text-left py-2 px-4">Amount</th>
                      <th className="text-left py-2 px-4">Due Date</th>
                      <th className="text-left py-2 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment) => (
                      <tr key={payment.id} className="border-b">
                        <td className="py-2 px-4">{payment.description}</td>
                        <td className="py-2 px-4">${payment.amount.toFixed(2)}</td>
                        <td className="py-2 px-4">
                          {payment.due_date ? formatDate(payment.due_date) : "—"}
                        </td>
                        <td className="py-2 px-4">
                          <span className={`text-xs px-2 py-1 rounded ${
                            payment.status === 'paid' ? 'bg-green-100 text-green-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {payment.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500">No payment records</p>
            )}
          </div>
        </div>

        {/* Uniform Orders Section */}
        <div className="bg-white rounded-lg shadow mt-6">
          <div className="p-6 border-b border-[#00c4ff]/20">
            <h3 className="text-lg font-semibold text-white font-[Oswald] flex items-center">
              <ShoppingBag className="mr-2 h-5 w-5" />
              Uniform Order History
            </h3>
          </div>
          <div className="p-6">
            {uniformOrders.length > 0 ? (
              <div className="space-y-4">
                {uniformOrders.map((order) => (
                  <div key={order.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-medium">Order #{order.id}</h4>
                        <p className="text-sm text-gray-500">
                          {formatDate(order.submitted_at || order.created_at)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-lg">${order.order_total.toFixed(2)}</p>
                        <span className={`text-xs px-2 py-1 rounded ${
                          order.status === 'ordered' ? 'bg-blue-100 text-blue-800' :
                          order.status === 'received' ? 'bg-green-100 text-green-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {order.status}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {order.jersey_material && (
                        <div>
                          <span className="font-medium">Jersey:</span> {order.jersey_material} {order.jersey_type} - Size {order.jersey_size}
                          {order.jersey_color && ` (${order.jersey_color})`}
                        </div>
                      )}
                      {order.shorts_material && (
                        <div>
                          <span className="font-medium">Shorts:</span> {order.shorts_material} - Size {order.shorts_size}
                        </div>
                      )}
                      {order.fleece_hoodie_size && (
                        <div>
                          <span className="font-medium">Fleece Hoodie:</span> Size {order.fleece_hoodie_size}
                          {order.fleece_hoodie_color && ` (${order.fleece_hoodie_color})`}
                        </div>
                      )}
                      {order.fleece_joggers_size && (
                        <div>
                          <span className="font-medium">Fleece Joggers:</span> Size {order.fleece_joggers_size}
                          {order.fleece_joggers_color && ` (${order.fleece_joggers_color})`}
                        </div>
                      )}
                      {order.backpack_size && (
                        <div>
                          <span className="font-medium">Backpack:</span> Size {order.backpack_size}
                        </div>
                      )}
                      {order.has_flag_sets === 1 && (
                        <div>
                          <span className="font-medium">Flag Sets</span>
                        </div>
                      )}
                      {order.jersey_number && (
                        <div>
                          <span className="font-medium">Number:</span> {order.jersey_number}
                        </div>
                      )}
                      {order.jersey_name && (
                        <div>
                          <span className="font-medium">Name:</span> {order.jersey_name}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No uniform orders on record</p>
            )}
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}
