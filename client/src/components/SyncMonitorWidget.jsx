import { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';

const SyncMonitorWidget = () => {
  const [online, setOnline] = useState(navigator.onLine);
  const [queueLength, setQueueLength] = useState(0);
  const [lastSync, setLastSync] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const interval = setInterval(() => {
      try {
        if (window.AndroidCRM && typeof window.AndroidCRM.getCallMonitorStatus === 'function') {
          const statusRaw = window.AndroidCRM.getCallMonitorStatus();
          const parsed = JSON.parse(statusRaw);
          setQueueLength(parsed.offlineQueueLength || 0);
          if (parsed.offlineQueueLength === 0) {
            setLastSync(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
          }
        }
      } catch (e) {
        console.error('Error fetching sync status:', e);
      }
    }, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between text-xs">
      <div className="flex items-center gap-2">
        {online ? (
          <span className="flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
            <Wifi className="h-3.5 w-3.5" /> ONLINE
          </span>
        ) : (
          <span className="flex items-center gap-1 font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-md border border-red-200 animate-pulse">
            <WifiOff className="h-3.5 w-3.5" /> OFFLINE
          </span>
        )}
        <span className="text-gray-500 font-medium">Last Sync: {lastSync}</span>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-gray-600">
          Pending Events: <strong className={queueLength > 0 ? 'text-amber-600 font-bold' : 'text-gray-900 font-bold'}>{queueLength}</strong>
        </span>
      </div>
    </div>
  );
};

export default SyncMonitorWidget;
