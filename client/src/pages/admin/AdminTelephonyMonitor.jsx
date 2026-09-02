import { useState, useEffect } from 'react';
import {
  Smartphone, RefreshCw, ShieldCheck, CheckCircle2, AlertCircle,
  Phone, Volume2, Clock, Users, Activity, Wifi, WifiOff,
  Mic, PhoneCall, TrendingUp, Radio, PhoneMissed
} from 'lucide-react';
import { callAPI } from '../../services/api';
import toast from 'react-hot-toast';

const formatSeconds = (sec) => {
  if (!sec || sec <= 0) return '0:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
};

const timeAgo = (iso) => {
  if (!iso) return 'Never';
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
};

const Badge = ({ status }) => {
  const map = {
    PASS:         'bg-emerald-100 text-emerald-800 border-emerald-200',
    SYNC_PENDING: 'bg-amber-100 text-amber-800 border-amber-200',
    AVAILABLE:    'bg-blue-100 text-blue-800 border-blue-200',
    RESTRICTED:   'bg-red-100 text-red-700 border-red-200',
  };
  return (
    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${map[status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
      {status === 'SYNC_PENDING' ? 'PENDING' : status}
    </span>
  );
};

// Radial progress ring (pure SVG, no recharts dependency)
const MiniRing = ({ pct, color, size = 36 }) => {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F1F5F9" strokeWidth={5} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={5}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
      />
    </svg>
  );
};

// BDE Fleet Card
const BdeCard = ({ bde }) => {
  const connPct = bde.totalCallsToday > 0 ? Math.round((bde.connectedCallsToday / bde.totalCallsToday) * 100) : 0;
  const recPct  = bde.totalCallsToday > 0 ? Math.round((bde.recordedCallsToday  / bde.totalCallsToday) * 100) : 0;
  const isActive = bde.totalCallsToday > 0;

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all hover:shadow-md ${isActive ? 'border-emerald-200' : 'border-gray-100'}`}>
      {/* Card Header */}
      <div className={`px-4 pt-4 pb-3 ${isActive ? 'bg-gradient-to-r from-emerald-50 to-teal-50' : 'bg-gray-50'}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-black text-gray-900 truncate">{bde.name}</h3>
              <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded-full ${isActive ? 'bg-emerald-200 text-emerald-800' : 'bg-gray-200 text-gray-600'}`}>
                {isActive ? '● ACTIVE' : '○ IDLE'}
              </span>
            </div>
            <p className="text-[10px] text-gray-500 mt-0.5">{bde.phone} · {bde.branch}</p>
          </div>
          <div className="shrink-0 p-2 rounded-xl bg-white/70 border border-white shadow-sm">
            <Smartphone className="h-4 w-4 text-gray-500" />
          </div>
        </div>
        <p className="text-[10px] text-gray-400 mt-1.5 font-mono truncate">{bde.deviceModel || 'Device model not reported'}</p>
      </div>

      {/* Stats grid */}
      <div className="p-4 grid grid-cols-3 gap-3">
        {/* Calls today */}
        <div className="text-center">
          <div className="text-xl font-black text-gray-900 tabular-nums">{bde.totalCallsToday}</div>
          <div className="text-[9px] text-gray-400 font-medium mt-0.5">CALLS TODAY</div>
        </div>
        {/* Talk time */}
        <div className="text-center">
          <div className="text-xl font-black text-sky-600 tabular-nums font-mono">{formatSeconds(bde.totalTalkSecondsToday)}</div>
          <div className="text-[9px] text-gray-400 font-medium mt-0.5">TALK TIME</div>
        </div>
        {/* Recordings */}
        <div className="text-center">
          <div className="text-xl font-black text-violet-600 tabular-nums">{bde.recordedCallsToday}</div>
          <div className="text-[9px] text-gray-400 font-medium mt-0.5">RECORDED</div>
        </div>
      </div>

      {/* Progress rings */}
      <div className="px-4 pb-4 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <MiniRing pct={connPct} color="#10B981" size={38} />
          <div>
            <div className="text-xs font-bold text-emerald-700">{connPct}%</div>
            <div className="text-[9px] text-gray-400">Connect</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <MiniRing pct={recPct} color="#8B5CF6" size={38} />
          <div>
            <div className="text-xs font-bold text-violet-700">{recPct}%</div>
            <div className="text-[9px] text-gray-400">Recorded</div>
          </div>
        </div>

        {/* Status badges */}
        <div className="ml-auto flex flex-col gap-1 items-end">
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-gray-400">Tracking</span>
            <Badge status={bde.callTracking} />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-gray-400">Recording</span>
            <Badge status={bde.recordingAccess} />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-gray-400">Sync</span>
            <Badge status={bde.syncStatus} />
          </div>
        </div>
      </div>

      {/* Footer: last call */}
      <div className="border-t border-gray-50 px-4 py-2 flex items-center justify-between">
        <span className="text-[10px] text-gray-400">Last call: <span className="font-semibold text-gray-600">{timeAgo(bde.lastCallAt)}</span></span>
        <span className="text-[10px] text-gray-400">{bde.email}</span>
      </div>
    </div>
  );
};

const AdminTelephonyMonitor = () => {
  const [data, setData] = useState({ summary: {}, fleet: [] });
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchFleetStatus = async () => {
    setLoading(true);
    try {
      const result = await callAPI.getFleetStatus();
      if (result.data?.success) {
        setData(result.data);
        setLastUpdated(new Date());
      } else {
        toast.error('Fleet data unavailable');
      }
    } catch (e) {
      console.error('Error fetching fleet status:', e);
      toast.error('Failed to load fleet status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFleetStatus();
    const iv = setInterval(fetchFleetStatus, 30000); // auto-refresh every 30s
    return () => clearInterval(iv);
  }, []);

  const { summary = {}, fleet = [] } = data;
  const activePct = summary.totalBdes > 0
    ? Math.round((summary.activeBdesToday / summary.totalBdes) * 100)
    : 0;
  const recPct = summary.totalCallsToday > 0
    ? Math.round(((summary.recordedCallsToday || 0) / summary.totalCallsToday) * 100)
    : 0;

  return (
    <div className="space-y-6 pb-12">
      {/* ── Hero Header ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-5 md:p-7 text-white shadow-2xl border border-indigo-500/20">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-indigo-400/10 blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/20 rounded-2xl border border-indigo-400/30">
              <Activity className="h-6 w-6 text-indigo-300" />
            </div>
            <div>
              <h1 className="text-xl font-black">Fleet Telephony Monitor</h1>
              <p className="text-indigo-300 text-xs mt-0.5">Real-time BDE device health · Call tracking · Recording compliance</p>
            </div>
          </div>
          <button
            onClick={fetchFleetStatus}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-indigo-200 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl transition-all self-start sm:self-auto"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Refreshing...' : 'Refresh Fleet'}
          </button>
        </div>

        {/* Summary stat strip */}
        <div className="relative mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total BDEs', value: summary.totalBdes || 0, sub: 'enrolled', color: 'text-white' },
            { label: 'Active Today', value: `${summary.activeBdesToday || 0} / ${summary.totalBdes || 0}`, sub: `${activePct}% active`, color: 'text-emerald-300' },
            { label: 'Fleet Calls Today', value: summary.totalCallsToday || 0, sub: 'total SIM calls', color: 'text-sky-300' },
            { label: 'Recorded Calls', value: summary.recordedCallsToday || 0, sub: `${recPct}% recording rate`, color: 'text-violet-300' },
          ].map(s => (
            <div key={s.label} className="bg-white/10 rounded-xl px-4 py-3 border border-white/10">
              <div className={`text-lg font-black tabular-nums ${s.color}`}>{s.value}</div>
              <div className="text-[10px] text-indigo-300 font-medium">{s.label}</div>
              <div className="text-[9px] text-indigo-400">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Fleet Talk Time */}
        <div className="relative mt-3 bg-white/10 rounded-xl px-4 py-3 border border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-sky-300" />
            <span className="text-xs font-bold text-indigo-200">Total Fleet Talk Time Today</span>
          </div>
          <span className="text-lg font-black font-mono text-sky-300">{formatSeconds(summary.totalTalkTimeSeconds)}</span>
        </div>

        {lastUpdated && (
          <p className="relative mt-2 text-[10px] text-indigo-400">
            Last updated: {lastUpdated.toLocaleTimeString()} · Auto-refreshes every 30s
          </p>
        )}
      </div>

      {/* ── BDE Cards Grid ── */}
      {loading && fleet.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-56 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : fleet.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <Users className="h-12 w-12 mb-3 text-gray-300" />
          <p className="text-sm font-medium">No active BDEs found</p>
          <p className="text-xs mt-1">BDEs will appear here once they have made calls</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {fleet.map(bde => <BdeCard key={bde.id} bde={bde} />)}
        </div>
      )}

      {/* ── Summary Compliance Table (compact) ── */}
      {fleet.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-indigo-500" />
              <h2 className="text-sm font-bold text-gray-800">Compliance Matrix</h2>
            </div>
            <span className="text-xs text-gray-400">{fleet.length} BDEs</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500 uppercase font-bold tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3 text-left">BDE</th>
                  <th className="px-4 py-3 text-center">Call Tracking</th>
                  <th className="px-4 py-3 text-center">Recording</th>
                  <th className="px-4 py-3 text-center">Sync</th>
                  <th className="px-4 py-3 text-right">Calls</th>
                  <th className="px-4 py-3 text-right">Connected</th>
                  <th className="px-4 py-3 text-right">Recorded</th>
                  <th className="px-4 py-3 text-right">Talk Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {fleet.map(bde => (
                  <tr key={bde.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-bold text-gray-900">{bde.name}</div>
                      <div className="text-gray-400 text-[10px]">{bde.branch}</div>
                    </td>
                    <td className="px-4 py-3 text-center"><Badge status={bde.callTracking} /></td>
                    <td className="px-4 py-3 text-center"><Badge status={bde.recordingAccess} /></td>
                    <td className="px-4 py-3 text-center"><Badge status={bde.syncStatus} /></td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">{bde.totalCallsToday}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-600">{bde.connectedCallsToday}</td>
                    <td className="px-4 py-3 text-right font-bold text-violet-600">{bde.recordedCallsToday}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-sky-600">{formatSeconds(bde.totalTalkSecondsToday)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminTelephonyMonitor;
