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
    PASS:         'bg-emerald-50 text-emerald-700 border-emerald-200/60',
    SYNC_PENDING: 'bg-amber-50 text-amber-700 border-amber-200/60',
    AVAILABLE:    'bg-sky-50 text-sky-700 border-sky-200/60',
    RESTRICTED:   'bg-rose-50 text-rose-700 border-rose-200/60',
  };
  return (
    <span className={`px-2 py-0.5 text-[9px] font-extrabold tracking-wider uppercase rounded-full border ${map[status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
      {status === 'SYNC_PENDING' ? 'Pending' : status}
    </span>
  );
};

const MiniRing = ({ pct, color, size = 36 }) => {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F8FAFC" strokeWidth={5} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={5}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
      />
    </svg>
  );
};

// BDE Fleet Card - Luxury Aesthetic
const BdeCard = ({ bde }) => {
  const connPct = bde.totalCallsToday > 0 ? Math.round((bde.connectedCallsToday / bde.totalCallsToday) * 100) : 0;
  const recPct  = bde.totalCallsToday > 0 ? Math.round((bde.recordedCallsToday  / bde.totalCallsToday) * 100) : 0;
  const isActive = bde.totalCallsToday > 0;

  return (
    <div className={`bg-white/90 backdrop-blur-md rounded-3xl border shadow-sm overflow-hidden transition-all hover:shadow-md ${isActive ? 'border-amber-200/60' : 'border-slate-100'}`}>
      {/* Card Header */}
      <div className={`px-5 pt-5 pb-3.5 ${isActive ? 'bg-gradient-to-r from-amber-50/70 via-rose-50/30 to-slate-50' : 'bg-slate-50/50'}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-slate-900 truncate">{bde.name}</h3>
              <span className={`px-2 py-0.5 text-[9px] font-extrabold uppercase rounded-full ${isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200/70 text-slate-600'}`}>
                {isActive ? '● Active' : '○ Idle'}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">{bde.phone} · {bde.branch}</p>
          </div>
          <div className="shrink-0 p-2.5 rounded-2xl bg-white/80 border border-slate-100 shadow-sm">
            <Smartphone className="h-4 w-4 text-slate-500" />
          </div>
        </div>
        <p className="text-[10px] text-slate-400 mt-1.5 font-mono truncate">{bde.deviceModel || 'Device model unassigned'}</p>
      </div>

      {/* Stats grid */}
      <div className="p-5 grid grid-cols-3 gap-3">
        <div className="text-center">
          <div className="text-xl font-extrabold text-slate-900 tabular-nums">{bde.totalCallsToday}</div>
          <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Calls</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-mono font-extrabold text-sky-700 tabular-nums">{formatSeconds(bde.totalTalkSecondsToday)}</div>
          <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Talk Time</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-extrabold text-purple-700 tabular-nums">{bde.recordedCallsToday}</div>
          <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Recorded</div>
        </div>
      </div>

      {/* Progress rings */}
      <div className="px-5 pb-5 flex items-center gap-4 border-b border-slate-100/70">
        <div className="flex items-center gap-2">
          <MiniRing pct={connPct} color="#10B981" size={38} />
          <div>
            <div className="text-xs font-bold text-emerald-700">{connPct}%</div>
            <div className="text-[9px] text-slate-400">Connect</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <MiniRing pct={recPct} color="#8B5CF6" size={38} />
          <div>
            <div className="text-xs font-bold text-purple-700">{recPct}%</div>
            <div className="text-[9px] text-slate-400">Recorded</div>
          </div>
        </div>

        <div className="ml-auto flex flex-col gap-1 items-end">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-slate-400">Tracking</span>
            <Badge status={bde.callTracking} />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-slate-400">Recording</span>
            <Badge status={bde.recordingAccess} />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-slate-400">Sync</span>
            <Badge status={bde.syncStatus} />
          </div>
        </div>
      </div>

      <div className="px-5 py-2.5 flex items-center justify-between text-[10px] text-slate-400">
        <span>Last call: <span className="font-semibold text-slate-600">{timeAgo(bde.lastCallAt)}</span></span>
        <span className="truncate max-w-[150px]">{bde.email}</span>
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
    const iv = setInterval(fetchFleetStatus, 30000);
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
    <div className="space-y-6 pb-12 bg-slate-50/30 min-h-screen">
      {/* ── Luxury Header ── */}
      <div className="relative overflow-hidden bg-gradient-to-r from-amber-50/80 via-rose-50/30 to-slate-50 rounded-3xl p-6 md:p-8 text-slate-900 shadow-sm border border-amber-100/60 backdrop-blur-md">
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-amber-100/70 text-amber-900 rounded-2xl border border-amber-200/50 shadow-sm">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Fleet Telephony Monitor</h1>
              <p className="text-slate-500 text-xs mt-0.5 font-medium">BDE Device Health · Live Status · Media Compliance</p>
            </div>
          </div>
          <button
            onClick={fetchFleetStatus}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white/80 hover:bg-white border border-slate-200/80 rounded-2xl shadow-sm transition-all self-start sm:self-auto"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Refreshing...' : 'Refresh Fleet'}
          </button>
        </div>

        {/* Summary stat strip */}
        <div className="relative mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Enrolled BDEs', value: summary.totalBdes || 0, sub: 'active personnel', color: 'text-slate-900', bg: 'bg-white/80' },
            { label: 'Active Personnel Today', value: `${summary.activeBdesToday || 0} / ${summary.totalBdes || 0}`, sub: `${activePct}% active`, color: 'text-emerald-700', bg: 'bg-emerald-50/60' },
            { label: 'Fleet Calls Today', value: summary.totalCallsToday || 0, sub: 'cellular calls', color: 'text-sky-700', bg: 'bg-sky-50/60' },
            { label: 'Recorded Calls', value: summary.recordedCallsToday || 0, sub: `${recPct}% captured`, color: 'text-purple-700', bg: 'bg-purple-50/60' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-2xl px-5 py-3.5 border border-slate-100/80 shadow-sm backdrop-blur-sm`}>
              <div className={`text-xl font-extrabold tabular-nums ${s.color}`}>{s.value}</div>
              <div className="text-[10px] text-slate-500 font-medium mt-0.5">{s.label}</div>
              <div className="text-[9px] text-slate-400">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Fleet Talk Time */}
        <div className="relative mt-4 bg-white/80 rounded-2xl px-5 py-3.5 border border-slate-100/80 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Clock className="h-4 w-4 text-amber-700" />
            <span className="text-xs font-bold text-slate-800">Accumulated Fleet Talk Time Today</span>
          </div>
          <span className="text-lg font-mono font-extrabold text-amber-800 tabular-nums">{formatSeconds(summary.totalTalkTimeSeconds)}</span>
        </div>

        {lastUpdated && (
          <p className="relative mt-2.5 text-[10px] text-slate-400">
            Last synced: {lastUpdated.toLocaleTimeString()} · Auto-refreshes every 30s
          </p>
        )}
      </div>

      {/* ── BDE Cards Grid ── */}
      {loading && fleet.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-56 bg-slate-100/70 rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : fleet.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white/90 rounded-3xl border border-slate-100 shadow-sm">
          <Users className="h-12 w-12 mb-3 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">No active BDE personnel found</p>
          <p className="text-xs text-slate-400 mt-1">BDEs will appear here once call logs are registered</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {fleet.map(bde => <BdeCard key={bde.id} bde={bde} />)}
        </div>
      )}

      {/* ── Summary Compliance Matrix ── */}
      {fleet.length > 0 && (
        <div className="bg-white/90 backdrop-blur-md rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="h-4 w-4 text-amber-700" />
              <h2 className="text-sm font-bold text-slate-800">Compliance Matrix</h2>
            </div>
            <span className="text-xs text-slate-400 font-semibold">{fleet.length} BDE Personnel</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50/70 text-slate-400 uppercase font-bold tracking-wider text-[9px]">
                <tr>
                  <th className="px-5 py-3.5 text-left">BDE</th>
                  <th className="px-5 py-3.5 text-center">Tracking</th>
                  <th className="px-5 py-3.5 text-center">Recording</th>
                  <th className="px-5 py-3.5 text-center">Sync</th>
                  <th className="px-5 py-3.5 text-right">Calls</th>
                  <th className="px-5 py-3.5 text-right">Connected</th>
                  <th className="px-5 py-3.5 text-right">Recorded</th>
                  <th className="px-5 py-3.5 text-right">Talk Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/70">
                {fleet.map(bde => (
                  <tr key={bde.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-slate-900">{bde.name}</div>
                      <div className="text-slate-400 text-[10px]">{bde.branch}</div>
                    </td>
                    <td className="px-5 py-3.5 text-center"><Badge status={bde.callTracking} /></td>
                    <td className="px-5 py-3.5 text-center"><Badge status={bde.recordingAccess} /></td>
                    <td className="px-5 py-3.5 text-center"><Badge status={bde.syncStatus} /></td>
                    <td className="px-5 py-3.5 text-right font-bold text-slate-900">{bde.totalCallsToday}</td>
                    <td className="px-5 py-3.5 text-right font-bold text-emerald-700">{bde.connectedCallsToday}</td>
                    <td className="px-5 py-3.5 text-right font-bold text-purple-700">{bde.recordedCallsToday}</td>
                    <td className="px-5 py-3.5 text-right font-mono font-bold text-sky-700">{formatSeconds(bde.totalTalkSecondsToday)}</td>
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
