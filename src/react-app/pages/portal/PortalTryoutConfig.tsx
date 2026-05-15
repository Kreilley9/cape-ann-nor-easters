import { useState, useEffect } from "react";
import { Save, Calendar, Settings } from "lucide-react";
import { formatDateTime } from "@/react-app/utils/dateFormat";
import { apiFetch } from "@/react-app/lib/api";

export default function PortalTryoutConfig() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({
    is_enabled: false,
    tryout_date: "",
    title: "Upcoming Tryouts",
    description: "Sign up for our upcoming tryout session"
  });

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await apiFetch("/api/portal/tryout-config", {
      });
      if (response.ok) {
        const data = await response.json();
        if (data) {
          setConfig({
            is_enabled: !!data.is_enabled,
            tryout_date: data.tryout_date ? data.tryout_date.split('T')[0] : "",
            title: data.title || "Upcoming Tryouts",
            description: data.description || "Sign up for our upcoming tryout session"
          });
        }
      }
    } catch (error) {
      console.error("Error loading config:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await apiFetch("/api/portal/tryout-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
      });

      if (!response.ok) {
        throw new Error("Failed to save configuration");
      }

      alert("Tryout configuration saved successfully!");
    } catch (error) {
      console.error("Error saving config:", error);
      alert("Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#00c4ff]/30 border-t-[#00c4ff] rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white font-[Oswald] tracking-wide">
            Tryout Sign Up Configuration
          </h1>
          <p className="text-gray-400 mt-2">
            Control the tryout signup button on the homepage
          </p>
        </div>
      </div>

      {/* Configuration Card */}
      <div className="bg-[rgba(18,26,36,0.8)] rounded-xl border border-[#00c4ff]/30 p-8 shadow-lg">
        <div className="space-y-6">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between p-4 bg-[rgba(10,15,20,0.5)] rounded-lg border border-[#00c4ff]/20">
            <div className="flex items-center gap-3">
              <Settings className="w-5 h-5 text-[#00c4ff]" />
              <div>
                <h3 className="font-semibold text-white">Enable Tryout Sign Up</h3>
                <p className="text-sm text-gray-400">Show the tryout button on the homepage</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.is_enabled}
                onChange={(e) => setConfig({ ...config, is_enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#00c4ff]/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00c4ff]"></div>
            </label>
          </div>

          {/* Tryout Date */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Tryout Date & Time
            </label>
            <input
              type="datetime-local"
              value={config.tryout_date}
              onChange={(e) => setConfig({ ...config, tryout_date: e.target.value })}
              className="w-full px-4 py-3 bg-[rgba(10,15,20,0.5)] border border-[#00c4ff]/30 rounded-lg text-white focus:outline-none focus:border-[#00c4ff] focus:ring-2 focus:ring-[#00c4ff]/20"
            />
            <p className="text-xs text-gray-500 mt-1">
              This date will be displayed on the homepage tryout button
            </p>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Button Title
            </label>
            <input
              type="text"
              value={config.title}
              onChange={(e) => setConfig({ ...config, title: e.target.value })}
              className="w-full px-4 py-3 bg-[rgba(10,15,20,0.5)] border border-[#00c4ff]/30 rounded-lg text-white focus:outline-none focus:border-[#00c4ff] focus:ring-2 focus:ring-[#00c4ff]/20"
              placeholder="e.g., Upcoming Tryouts"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Description
            </label>
            <textarea
              value={config.description}
              onChange={(e) => setConfig({ ...config, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 bg-[rgba(10,15,20,0.5)] border border-[#00c4ff]/30 rounded-lg text-white focus:outline-none focus:border-[#00c4ff] focus:ring-2 focus:ring-[#00c4ff]/20 resize-none"
              placeholder="Brief description to display on the button"
            />
          </div>

          {/* Save Button */}
          <div className="pt-4 border-t border-[#00c4ff]/20">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-[#00c4ff] text-white font-semibold rounded-lg hover:bg-[#00a3d9] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-[#00c4ff]/20"
            >
              {saving ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save Configuration
                </>
              )}
            </button>
          </div>
        </div>

        {/* Preview */}
        {config.is_enabled && config.tryout_date && (
          <div className="mt-8 p-6 bg-[rgba(0,196,255,0.1)] border border-[#00c4ff]/30 rounded-lg">
            <h4 className="text-sm font-semibold text-gray-400 mb-3">Homepage Preview:</h4>
            <div className="bg-[#00c4ff] text-white rounded-xl p-6 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black font-[Oswald] mb-1">{config.title}</h3>
                  <p className="text-white/90 text-sm mb-2">{config.description}</p>
                  <p className="text-white/80 text-sm">
                    📅 {formatDateTime(config.tryout_date)}
                  </p>
                </div>
                <div className="text-sm font-semibold px-4 py-2 bg-white text-[#00c4ff] rounded-lg">
                  Sign Up →
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
