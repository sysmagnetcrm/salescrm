import { useState, useEffect } from 'react';
import { Activity, RefreshCw, Smartphone, ShieldCheck, AlertCircle, CheckCircle2, Server } from 'lucide-react';
import toast from 'react-hot-toast';

const CallMonitor = () => {
  const [monitorStatus, setMonitorStatus] = useState({
    serviceRunning: true,
    offlineQueueLength: 0,
    isDefaultDialer: true,
    hasActiveCall: false
  });
  const [loading, setLoading] = useState(false);

  const fetchStatus = () => {
    try {
      if (window.AndroidCRM && typeof window.AndroidCRM.getCallMonitorStatus === 'function') {
        const raw = window.AndroidCRM.getCallMonitorStatus();
        const parsed = JSON.parse(raw);
        setMonitorStatus(parsed);
      }
    } catch (e) {
      console.error('Error fetching Android CRM monitor status:', e);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleService = () => {
    if (!window.AndroidCRM) {
      toast.error('Android CRM Bridge available only inside Android app environment.');
      return;
    }
    if (monitorStatus.serviceRunning) {
      window.AndroidCRM.stopCallAgentService();
      toast.success('CallAgentService stopped');
    } else {
      window.AndroidCRM.startCallAgentService();
      toast.success('CallAgentService started');
    }
    setTimeout(fetchStatus, 500);
  };

  const handleForceSync = () => {
    if (!window.AndroidCRM) {
      toast.error('Android CRM Bridge available only inside Android app environment.');
      return;
    }
    setLoading(true);
    const token = localStorage.getItem('token') || '';
    const baseUrl = window.location.origin;
    window.AndroidCRM.forceSyncQueue(baseUrl, token);
    toast.success('Offline queue sync triggered');
    setTimeout(() => {
      fetchStatus();
      setLoading(false);
    }, 1500);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="h-7 w-7 text-primary-600" />
            Live Telecom Call Monitor
          </h1>
          <p className="text-sm text-gray-500">
            Real-time Android Telecom Foreground Service status and offline synchronization queue
          </p>
        </div>
        <button
          onClick={fetchStatus}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 shadow-sm"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh Status
        </button>
      </div>

      {/* Grid Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Service Agent Status Card */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl ${monitorStatus.serviceRunning ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                <Smartphone className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm">CallAgentService</h3>
                <p className="text-xs text-gray-400">Foreground SIM Monitor</p>
              </div>
            </div>
            <span className={`px-2.5 py-1 text-xs font-extrabold rounded-full ${monitorStatus.serviceRunning ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
              {monitorStatus.serviceRunning ? 'RUNNING' : 'STOPPED'}
            </span>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">
            Persistent Android Telecom service tracking physical SIM calls and measuring authoritative duration.
          </p>
          <button
            onClick={handleToggleService}
            className={`w-full py-2 text-xs font-bold rounded-lg transition-colors border ${
              monitorStatus.serviceRunning
                ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            {monitorStatus.serviceRunning ? 'Stop Background Agent' : 'Start Background Agent'}
          </button>
        </div>

        {/* Offline Event Queue Card */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-purple-50 text-purple-600">
                <Server className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Offline Queue</h3>
                <p className="text-xs text-gray-400">Local Event Storage</p>
              </div>
            </div>
            <span className="px-3 py-1 text-xs font-black rounded-full bg-purple-100 text-purple-900">
              {monitorStatus.offlineQueueLength} PENDING
            </span>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">
            Events captured during network outages are saved locally and synced automatically with exponential backoff.
          </p>
          <button
            onClick={handleForceSync}
            disabled={loading}
            className="w-full py-2 text-xs font-bold rounded-lg bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-colors flex items-center justify-center gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Syncing Queue...' : 'Force Sync Pending Events'}
          </button>
        </div>

        {/* Role & Dialer Status Card */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl ${monitorStatus.isDefaultDialer ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm">RoleManager Dialer</h3>
                <p className="text-xs text-gray-400">InCallService Privilege</p>
              </div>
            </div>
            <span className={`px-2.5 py-1 text-xs font-extrabold rounded-full ${monitorStatus.isDefaultDialer ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
              {monitorStatus.isDefaultDialer ? 'GRANTED' : 'STANDARD'}
            </span>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">
            {monitorStatus.isDefaultDialer
              ? 'Default dialer role held. Provides native InCallService UI & direct call lifecycle control.'
              : 'App operates with standard call permissions. Default dialer role recommended for complete call control.'}
          </p>
          {!monitorStatus.isDefaultDialer && window.AndroidCRM && (
            <button
              onClick={() => window.AndroidCRM.requestDefaultDialer()}
              className="w-full py-2 text-xs font-bold rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
            >
              Request Default Dialer Role
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CallMonitor;
