import { useState, useEffect } from 'react';
import { Smartphone, RefreshCw, ShieldCheck, CheckCircle2, AlertCircle, Phone, Volume2, Clock, Users, Activity } from 'lucide-react';
import toast from 'react-hot-toast';

const formatSeconds = (sec) => {
  if (!sec || sec <= 0) return '0m 0s';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
};

const AdminTelephonyMonitor = () => {
  const [data, setData] = useState({
    summary: {
      totalBdes: 1,
      activeBdesToday: 1,
      totalCallsToday: 4,
      totalTalkTimeSeconds: 242,
      recordedCallsToday: 4
    },
    fleet: [
      {
        id: '1',
        name: 'Academy BDE One',
        email: 'bde1@academysales.com',
        phone: '9000000002',
        branch: 'Kochi',
        deviceModel: 'Xiaomi 14 Civi (HyperOS 2)',
        callTracking: 'PASS',
        recordingAccess: 'PASS',
        syncStatus: 'PASS',
        totalCallsToday: 4,
        connectedCallsToday: 3,
        recordedCallsToday: 4,
        totalTalkSecondsToday: 242,
        lastCallAt: new Date().toISOString()
      }
    ]
  });

  const [loading, setLoading] = useState(false);

  const fetchFleetStatus = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/calls/fleet-status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await res.json();
      if (result.success) {
        setData(result);
        toast.success('Fleet status updated');
      }
    } catch (e) {
      console.error('Error fetching fleet status:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFleetStatus();
  }, []);

  const getStatusBadge = (status) => {
    if (status === 'PASS') {
      return <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">PASS</span>;
    }
    if (status === 'SYNC_PENDING') {
      return <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-300">PENDING SYNC</span>;
    }
    return <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-blue-100 text-blue-800 border border-blue-300">AVAILABLE</span>;
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="h-7 w-7 text-primary-600" />
            Admin Telephony Fleet Monitor
          </h1>
          <p className="text-sm text-gray-500">
            Real-time health, background service tracking, and recording compliance across BDE devices
          </p>
        </div>
        <button
          onClick={fetchFleetStatus}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 shadow-sm"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Fleet Metrics
        </button>
      </div>

      {/* Fleet Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-200 space-y-1">
          <span className="text-xs font-semibold text-gray-500 block">Total Active BDEs</span>
          <span className="text-2xl font-bold text-gray-900">{data.summary.activeBdesToday} / {data.summary.totalBdes}</span>
        </div>
        <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-200 space-y-1">
          <span className="text-xs font-semibold text-gray-500 block">Total Calls Today</span>
          <span className="text-2xl font-bold text-gray-900">{data.summary.totalCallsToday}</span>
        </div>
        <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-200 space-y-1">
          <span className="text-xs font-semibold text-gray-500 block">Recorded Calls</span>
          <span className="text-2xl font-bold text-emerald-600">{data.summary.recordedCallsToday}</span>
        </div>
        <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-200 space-y-1">
          <span className="text-xs font-semibold text-gray-500 block">Fleet Talk Duration</span>
          <span className="text-2xl font-bold font-mono text-sky-600">{formatSeconds(data.summary.totalTalkTimeSeconds)}</span>
        </div>
      </div>

      {/* Fleet Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-200 font-bold text-sm text-gray-800 flex justify-between items-center">
          <span>BDE Device & Telephony Health Status</span>
          <span className="text-xs text-gray-500 font-normal">Reference Device: Xiaomi 14 Civi (HyperOS 2)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase font-bold tracking-wider">
              <tr>
                <th className="p-3.5">BDE Salesperson</th>
                <th className="p-3.5">Target Device</th>
                <th className="p-3.5 text-center">Call Tracking</th>
                <th className="p-3.5 text-center">Recording Access</th>
                <th className="p-3.5 text-center">Sync State</th>
                <th className="p-3.5 text-right">Calls Today</th>
                <th className="p-3.5 text-right">Talk Duration</th>
                <th className="p-3.5 text-right">Last Call</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium text-gray-800">
              {data.fleet.map((bde) => (
                <tr key={bde.id} className="hover:bg-gray-50/60">
                  <td className="p-3.5 font-bold">
                    <div>{bde.name}</div>
                    <span className="text-[11px] text-gray-400 font-normal">{bde.phone} ({bde.branch})</span>
                  </td>
                  <td className="p-3.5 font-mono text-gray-600">{bde.deviceModel}</td>
                  <td className="p-3.5 text-center">{getStatusBadge(bde.callTracking)}</td>
                  <td className="p-3.5 text-center">{getStatusBadge(bde.recordingAccess)}</td>
                  <td className="p-3.5 text-center">{getStatusBadge(bde.syncStatus)}</td>
                  <td className="p-3.5 text-right font-bold">{bde.totalCallsToday}</td>
                  <td className="p-3.5 text-right font-mono font-bold text-sky-700">{formatSeconds(bde.totalTalkSecondsToday)}</td>
                  <td className="p-3.5 text-right text-gray-500">
                    {bde.lastCallAt ? new Date(bde.lastCallAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminTelephonyMonitor;
