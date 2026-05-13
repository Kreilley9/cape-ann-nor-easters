import { useState, useEffect } from "react";
import { PortalLayout } from "@/react-app/components/layout/PortalLayout";

interface NotificationLog {
  id: number;
  user_id: string;
  notification_type: string;
  delivery_method: string;
  recipient: string;
  status: string;
  error_message: string | null;
  created_at: string;
}

export function PortalNotificationTest() {
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("Test message from Nor'easters");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  const loadLogs = async () => {
    setLogsLoading(true);
    try {
      const response = await fetch("/api/portal/admin/tables/notification_logs/rows", {
        credentials: "include",
      });
      
      if (response.ok) {
        const data = await response.json();
        setLogs(data.rows.sort((a: NotificationLog, b: NotificationLog) => b.id - a.id));
      }
    } catch (error) {
      console.error("Failed to load logs:", error);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const handleTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/test-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phone, message }),
      });

      const data = await response.json();
      setResult(data);
      
      // Reload logs after test
      setTimeout(loadLogs, 500);
    } catch (error) {
      setResult({ success: false, error: String(error) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PortalLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white font-['Oswald']" style={{ textShadow: '0 0 20px rgba(0,196,255,0.5)' }}>
            SMS Notification Testing
          </h1>
          <p className="text-gray-400 mt-1">Test SMS delivery and view notification logs</p>
        </div>

        {/* Test Form */}
        <div className="bg-[rgba(18,26,36,0.8)] border-2 border-[#00c4ff] rounded-lg p-6" style={{ boxShadow: '0 0 20px rgba(0,196,255,0.3)' }}>
          <h2 className="text-xl font-bold text-white font-['Oswald'] mb-4">Send Test SMS</h2>
          
          <form onSubmit={handleTest} className="space-y-4">
            <div>
              <label className="block text-gray-400 mb-2">Phone Number</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="9784083408 or +19784083408"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white"
                required
              />
            </div>

            <div>
              <label className="block text-gray-400 mb-2">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white"
                rows={3}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-[#00c4ff] text-gray-900 font-bold rounded hover:bg-[#00a8e0] disabled:opacity-50"
              style={{ boxShadow: '0 0 15px rgba(0,196,255,0.5)' }}
            >
              {loading ? "Sending..." : "Send Test SMS"}
            </button>
          </form>

          {result && (
            <div className={`mt-4 p-4 rounded ${result.success ? 'bg-green-900/30 border border-green-500' : 'bg-red-900/30 border border-red-500'}`}>
              <h3 className="font-bold text-white mb-2">{result.success ? "✓ Success" : "✗ Failed"}</h3>
              <pre className="text-sm text-gray-300 overflow-x-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Notification Logs */}
        <div className="bg-[rgba(18,26,36,0.8)] border-2 border-[#00c4ff] rounded-lg p-6" style={{ boxShadow: '0 0 20px rgba(0,196,255,0.3)' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white font-['Oswald']">Notification Logs</h2>
            <button
              onClick={loadLogs}
              className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
            >
              Refresh
            </button>
          </div>

          {logsLoading ? (
            <p className="text-gray-400">Loading logs...</p>
          ) : logs.length === 0 ? (
            <p className="text-gray-400">No notification logs yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-2 px-3 text-gray-400">Time</th>
                    <th className="text-left py-2 px-3 text-gray-400">Type</th>
                    <th className="text-left py-2 px-3 text-gray-400">Method</th>
                    <th className="text-left py-2 px-3 text-gray-400">Recipient</th>
                    <th className="text-left py-2 px-3 text-gray-400">Status</th>
                    <th className="text-left py-2 px-3 text-gray-400">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-gray-800">
                      <td className="py-2 px-3 text-gray-300">
                        {new Date(log.created_at).toLocaleString('en-US', { timeZone: 'America/New_York' })}
                      </td>
                      <td className="py-2 px-3 text-gray-300">{log.notification_type}</td>
                      <td className="py-2 px-3 text-gray-300">{log.delivery_method}</td>
                      <td className="py-2 px-3 text-gray-300">{log.recipient}</td>
                      <td className="py-2 px-3">
                        <span className={`px-2 py-1 rounded text-xs ${log.status === 'success' ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-red-400 text-xs max-w-md truncate" title={log.error_message || ''}>
                        {log.error_message || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </PortalLayout>
  );
}
