import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { PortalLayout } from "@/react-app/components/layout/PortalLayout";
import { useRoles } from "@/react-app/contexts/RoleContext";
import { ArrowLeft, Bell, Mail, Smartphone, Save, Loader2 } from "lucide-react";
import { apiFetch } from "@/react-app/lib/api";

interface NotificationPreferences {
  notification_email: string;
  notification_phone: string;
  schedule_changes_email: boolean;
  schedule_changes_text: boolean;
  rsvp_requests_email: boolean;
  rsvp_requests_text: boolean;
  team_messages_email: boolean;
  team_messages_text: boolean;
  coach_messages_email: boolean;
  coach_messages_text: boolean;
  documents_email: boolean;
  documents_text: boolean;
  payment_reminders_email: boolean;
  payment_reminders_text: boolean;
}

const defaultPreferences: NotificationPreferences = {
  notification_email: "",
  notification_phone: "",
  schedule_changes_email: false,
  schedule_changes_text: false,
  rsvp_requests_email: false,
  rsvp_requests_text: false,
  team_messages_email: false,
  team_messages_text: false,
  coach_messages_email: false,
  coach_messages_text: false,
  documents_email: false,
  documents_text: false,
  payment_reminders_email: false,
  payment_reminders_text: false,
};

interface NotificationOption {
  key: string;
  label: string;
  description: string;
  emailKey: keyof NotificationPreferences;
  textKey: keyof NotificationPreferences;
  visibleTo: ("admin" | "coach" | "parent")[];
}

const notificationOptions: NotificationOption[] = [
  {
    key: "schedule_changes",
    label: "Schedule Changes",
    description: "New events, updates, or cancellations for your teams",
    emailKey: "schedule_changes_email",
    textKey: "schedule_changes_text",
    visibleTo: ["admin", "coach", "parent"],
  },
  {
    key: "rsvp_requests",
    label: "RSVP Requests",
    description: "When you're invited to an event and need to respond",
    emailKey: "rsvp_requests_email",
    textKey: "rsvp_requests_text",
    visibleTo: ["admin", "coach", "parent"],
  },
  {
    key: "team_messages",
    label: "Team Messages",
    description: "New messages posted to your team message boards",
    emailKey: "team_messages_email",
    textKey: "team_messages_text",
    visibleTo: ["admin", "coach", "parent"],
  },
  {
    key: "coach_messages",
    label: "Coaches Portal Messages",
    description: "New messages in the coaches-only message board",
    emailKey: "coach_messages_email",
    textKey: "coach_messages_text",
    visibleTo: ["admin", "coach"],
  },
  {
    key: "documents",
    label: "New Documents",
    description: "When new documents are uploaded to your teams",
    emailKey: "documents_email",
    textKey: "documents_text",
    visibleTo: ["admin", "coach", "parent"],
  },
  {
    key: "payment_reminders",
    label: "Payment Reminders",
    description: "Reminders about upcoming or overdue payments",
    emailKey: "payment_reminders_email",
    textKey: "payment_reminders_text",
    visibleTo: ["admin", "coach", "parent"],
  },
];

export default function PortalNotificationSettings() {
  const navigate = useNavigate();
  const { isAdmin, isCoach, isParent } = useRoles();
  
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const res = await apiFetch("/api/portal/notification-preferences", {
      });
      if (res.ok) {
        const data = await res.json();
        if (data.preferences) {
          // Convert 0/1 to boolean
          const prefs: NotificationPreferences = {
            notification_email: data.preferences.notification_email || "",
            notification_phone: data.preferences.notification_phone || "",
            schedule_changes_email: !!data.preferences.schedule_changes_email,
            schedule_changes_text: !!data.preferences.schedule_changes_text,
            rsvp_requests_email: !!data.preferences.rsvp_requests_email,
            rsvp_requests_text: !!data.preferences.rsvp_requests_text,
            team_messages_email: !!data.preferences.team_messages_email,
            team_messages_text: !!data.preferences.team_messages_text,
            coach_messages_email: !!data.preferences.coach_messages_email,
            coach_messages_text: !!data.preferences.coach_messages_text,
            documents_email: !!data.preferences.documents_email,
            documents_text: !!data.preferences.documents_text,
            payment_reminders_email: !!data.preferences.payment_reminders_email,
            payment_reminders_text: !!data.preferences.payment_reminders_text,
          };
          setPreferences(prefs);
        }
      }
    } catch (err) {
      console.error("Failed to load preferences:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    
    try {
      const res = await apiFetch("/api/portal/notification-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferences),
      });
      
      if (res.ok) {
        setMessage({ type: "success", text: "Notification preferences saved!" });
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed to save preferences" });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Failed to save preferences" });
    } finally {
      setSaving(false);
    }
  };

  const togglePreference = (key: keyof NotificationPreferences) => {
    if (typeof preferences[key] === "boolean") {
      setPreferences(prev => ({ ...prev, [key]: !prev[key] }));
    }
  };

  const canSeeOption = (option: NotificationOption): boolean => {
    if (isAdmin && option.visibleTo.includes("admin")) return true;
    if (isCoach && option.visibleTo.includes("coach")) return true;
    if (isParent && option.visibleTo.includes("parent")) return true;
    return false;
  };

  const visibleOptions = notificationOptions.filter(canSeeOption);

  if (loading) {
    return (
      <PortalLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-[#00c4ff]" />
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg border border-[#00c4ff]/30 bg-[rgba(18,26,36,0.8)] text-[#00c4ff] hover:bg-[#00c4ff]/10 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-white font-['Oswald']">
              Notification Settings
            </h1>
            <p className="text-gray-400 mt-1">
              Choose how and when you want to be notified
            </p>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`p-4 rounded-lg mb-6 ${
              message.type === "success"
                ? "bg-green-500/20 border border-green-500/50 text-green-400"
                : "bg-red-500/20 border border-red-500/50 text-red-400"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Text Notifications Coming Soon Notice */}
        <div className="bg-amber-500/20 border border-amber-500/50 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <Smartphone className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-amber-400 font-semibold mb-1">Text Notifications Coming Soon</h3>
              <p className="text-amber-300/90 text-sm">
                We're currently setting up our text messaging service. For now, only email notifications are available. 
                Text notifications will be enabled in the near future.
              </p>
            </div>
          </div>
        </div>

        {/* Contact Info */}
        <div className="bg-[rgba(18,26,36,0.8)] border border-[#00c4ff]/30 rounded-lg p-6 mb-6 shadow-[0_0_15px_rgba(0,196,255,0.1)]">
          <h2 className="text-xl font-bold text-white font-['Oswald'] mb-4 flex items-center gap-2">
            <Bell className="w-5 h-5 text-[#00c4ff]" />
            Contact Information
          </h2>
          <p className="text-gray-400 text-sm mb-4">
            Enter the email and phone number where you'd like to receive notifications.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-400 text-sm mb-2">
                <Mail className="w-4 h-4 inline mr-2" />
                Email Address
              </label>
              <input
                type="email"
                value={preferences.notification_email}
                onChange={(e) => setPreferences(prev => ({ ...prev, notification_email: e.target.value }))}
                placeholder="your@email.com"
                className="w-full px-4 py-2 rounded-lg border border-[#00c4ff]/30 bg-[rgba(18,26,36,0.9)] text-white placeholder-gray-500 focus:outline-none focus:border-[#00c4ff] focus:ring-1 focus:ring-[#00c4ff]"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-2">
                <Smartphone className="w-4 h-4 inline mr-2" />
                Phone Number (coming soon)
              </label>
              <input
                type="tel"
                value={preferences.notification_phone}
                onChange={(e) => setPreferences(prev => ({ ...prev, notification_phone: e.target.value }))}
                placeholder="(555) 123-4567"
                disabled
                className="w-full px-4 py-2 rounded-lg border border-[#00c4ff]/30 bg-[rgba(18,26,36,0.5)] text-gray-500 placeholder-gray-600 cursor-not-allowed"
              />
              <p className="text-amber-400 text-xs mt-1">Text notifications coming soon</p>
            </div>
          </div>
        </div>

        {/* Notification Preferences */}
        <div className="bg-[rgba(18,26,36,0.8)] border border-[#00c4ff]/30 rounded-lg p-6 shadow-[0_0_15px_rgba(0,196,255,0.1)]">
          <h2 className="text-xl font-bold text-white font-['Oswald'] mb-4">
            Notification Preferences
          </h2>
          <p className="text-gray-400 text-sm mb-6">
            Select which events you want to be notified about and how.
          </p>

          {/* Header Row */}
          <div className="hidden md:grid grid-cols-[1fr,80px,80px] gap-4 pb-3 border-b border-[#00c4ff]/20 mb-4">
            <div className="text-gray-400 text-sm font-medium">Event Type</div>
            <div className="text-center text-gray-400 text-sm font-medium flex items-center justify-center gap-1">
              <Mail className="w-4 h-4" /> Email
            </div>
            <div className="text-center text-gray-400 text-sm font-medium flex items-center justify-center gap-1">
              <Smartphone className="w-4 h-4" /> Text
            </div>
          </div>

          {/* Options */}
          <div className="space-y-4">
            {visibleOptions.map((option) => (
              <div
                key={option.key}
                className="grid grid-cols-1 md:grid-cols-[1fr,80px,80px] gap-4 py-3 border-b border-[#00c4ff]/10 last:border-0"
              >
                <div>
                  <div className="text-white font-medium">{option.label}</div>
                  <div className="text-gray-400 text-sm">{option.description}</div>
                </div>
                
                {/* Mobile labels */}
                <div className="md:hidden flex gap-6">
                  <label className="flex items-center gap-2 text-gray-400">
                    <input
                      type="checkbox"
                      checked={preferences[option.emailKey] as boolean}
                      onChange={() => togglePreference(option.emailKey)}
                      className="w-5 h-5 rounded border-[#00c4ff]/30 bg-[rgba(18,26,36,0.9)] text-[#00c4ff] focus:ring-[#00c4ff] focus:ring-offset-0"
                    />
                    <Mail className="w-4 h-4" /> Email
                  </label>
                  <label className="flex items-center gap-2 text-gray-500 cursor-not-allowed">
                    <input
                      type="checkbox"
                      checked={preferences[option.textKey] as boolean}
                      onChange={() => togglePreference(option.textKey)}
                      disabled
                      className="w-5 h-5 rounded border-gray-600 bg-[rgba(18,26,36,0.5)] text-gray-600 cursor-not-allowed"
                    />
                    <Smartphone className="w-4 h-4" /> Text
                  </label>
                </div>

                {/* Desktop checkboxes */}
                <div className="hidden md:flex justify-center">
                  <input
                    type="checkbox"
                    checked={preferences[option.emailKey] as boolean}
                    onChange={() => togglePreference(option.emailKey)}
                    className="w-5 h-5 rounded border-[#00c4ff]/30 bg-[rgba(18,26,36,0.9)] text-[#00c4ff] focus:ring-[#00c4ff] focus:ring-offset-0 cursor-pointer"
                  />
                </div>
                <div className="hidden md:flex justify-center">
                  <input
                    type="checkbox"
                    checked={preferences[option.textKey] as boolean}
                    onChange={() => togglePreference(option.textKey)}
                    disabled
                    className="w-5 h-5 rounded border-gray-600 bg-[rgba(18,26,36,0.5)] text-gray-600 cursor-not-allowed"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-[#00c4ff] text-[#0a1929] font-semibold rounded-lg hover:bg-[#00a0cc] transition-colors disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            Save Preferences
          </button>
        </div>

        {/* Note about text messages */}
        <p className="text-gray-500 text-sm mt-4 text-center">
          Note: Email notifications are active now. Text message notifications will be available soon.
        </p>
      </div>
    </PortalLayout>
  );
}