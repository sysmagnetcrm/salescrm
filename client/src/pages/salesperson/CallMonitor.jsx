import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Activity, RefreshCw, Smartphone, ShieldCheck, Server, Phone, PhoneCall,
  PhoneIncoming, PhoneMissed, Clock, Mic, MicOff, CheckCircle2, AlertCircle,
  ChevronDown, X, FileText, Radio, Wifi, WifiOff, Play, Upload, Sparkles,
  PhoneOff, Settings2, ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';

// ─── Helper formatters ─────────────────────────────────────────────────────────
const formatDuration = (secs) => {
  if (!secs && secs !== 0) return '00:00';
  const s = Math.floor(secs);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

const timeAgo = (dateStr) => {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(dateStr).toLocaleDateString();
};

const statusColor = {
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
  'no-answer': 'bg-amber-50 text-amber-700 border-amber-200/60',
  busy: 'bg-orange-50 text-orange-700 border-orange-200/60',
  cancelled: 'bg-slate-100 text-slate-600 border-slate-200/60',
  failed: 'bg-rose-50 text-rose-700 border-rose-200/60',
  connected: 'bg-sky-50 text-sky-700 border-sky-200/60',
  initiated: 'bg-indigo-50 text-indigo-700 border-indigo-200/60',
  ringing: 'bg-yellow-50 text-yellow-700 border-yellow-200/60',
};

const DISPOSITIONS = [
  { value: 'interested', label: 'Interested' },
  { value: 'callback', label: 'Callback Requested' },
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'wrong_number', label: 'Wrong Number' },
  { value: 'busy', label: 'Busy - Try Later' },
  { value: 'converted', label: 'Converted' },
  { value: 'follow_up', label: 'Follow Up' },
];

// ─── Post-Call Annotation Modal ────────────────────────────────────────────────
const PostCallModal = ({ callEvent, onClose, onSave }) => {
  const [disposition, setDisposition] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!callEvent?.callId) { onClose(); return; }
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(`/api/calls/${callEvent.callId}`, { disposition, notes }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Call outcome saved!');
      if (onSave) onSave({ disposition, notes });
      onClose();
    } catch (e) {
      toast.error('Failed to save call notes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-slate-900/30 backdrop-blur-md">
      <div className="bg-white/95 backdrop-blur-xl w-full max-w-md rounded-3xl shadow-2xl border border-amber-100/60 overflow-hidden">
        <div className="bg-gradient-to-r from-amber-50/90 via-rose-50/50 to-slate-50 p-6 border-b border-amber-100/40">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-100/60 text-amber-800">
                <FileText className="h-4 w-4" />
              </div>
              <span className="font-bold text-sm text-slate-800">Log Call Outcome</span>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-full bg-slate-100/80 hover:bg-slate-200 text-slate-500 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-slate-500 text-xs">
            {callEvent?.leadName || 'Unknown Lead'} · {callEvent?.phone} ·{' '}
            <span className="font-semibold text-slate-700">{formatDuration(callEvent?.durationSeconds)}</span>
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 p-3.5 bg-slate-50/70 rounded-2xl border border-slate-100">
            <div className="p-2 bg-emerald-100/60 text-emerald-700 rounded-xl">
              <Phone className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-800 truncate">
                {callEvent?.status === 'completed' ? 'Call Completed' : callEvent?.status}
              </p>
              <p className="text-xs text-slate-400">
                Duration: {formatDuration(callEvent?.durationSeconds)}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Call Disposition</label>
            <div className="relative">
              <select
                value={disposition}
                onChange={e => setDisposition(e.target.value)}
                className="w-full appearance-none border border-slate-200/80 rounded-2xl px-4 py-3 text-sm bg-white/80 focus:outline-none focus:ring-2 focus:ring-amber-300 text-slate-700 transition-all shadow-sm"
              >
                <option value="">Select outcome...</option>
                {DISPOSITIONS.map(d => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="What was discussed? Any follow-up needed?"
              className="w-full border border-slate-200/80 rounded-2xl px-4 py-3 text-sm bg-white/80 focus:outline-none focus:ring-2 focus:ring-amber-300 text-slate-700 resize-none transition-all shadow-sm"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 text-xs font-bold text-slate-600 bg-slate-100/80 rounded-2xl hover:bg-slate-200/80 transition-colors"
            >
              Skip
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-3 text-xs font-bold text-slate-900 bg-gradient-to-r from-amber-200 via-amber-300 to-amber-200 rounded-2xl hover:brightness-105 transition-all shadow-sm disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Outcome'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Live Call Banner with Dismiss & End Call Buttons ─────────────────────────
const LiveCallBanner = ({ activeCall, onDismiss }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!activeCall?.connectedAt) return;
    const start = new Date(activeCall.connectedAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [activeCall?.connectedAt]);

  if (!activeCall) return null;

  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-amber-50/95 via-emerald-50/90 to-teal-50/95 rounded-3xl p-5 text-slate-800 shadow-md border border-emerald-200/70 backdrop-blur-md">
      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-emerald-100 text-emerald-800 shadow-sm shrink-0">
            <PhoneCall className="h-5 w-5 animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-bold tracking-wider text-emerald-800 uppercase">
                {activeCall.status === 'connected' ? 'Live Call in Progress' : 'Dialing / Initiating Call...'}
              </p>
              <span className="px-2 py-0.5 text-[9px] font-extrabold rounded-full bg-emerald-200/80 text-emerald-900 animate-pulse">
                ACTIVE
              </span>
            </div>
            <p className="font-bold text-base text-slate-900 truncate">{activeCall.leadName || activeCall.phone}</p>
            <p className="text-xs text-slate-500">{activeCall.phone}</p>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-4">
          <div className="text-right">
            <div className="text-2xl font-mono font-extrabold text-slate-900 tabular-nums">{formatDuration(elapsed)}</div>
            <div className="flex items-center justify-end gap-1.5 mt-0.5">
              <Radio className="h-3 w-3 text-emerald-600 animate-pulse" />
              <span className="text-xs font-semibold text-emerald-700">Recording</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onDismiss}
              className="inline-flex items-center gap-1 px-3 py-2 text-xs font-bold rounded-2xl bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300/60 shadow-sm transition-all"
              title="Close or End Call Section"
            >
              <PhoneOff className="h-3.5 w-3.5" />
              <span>Close / End Call</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────
const CallMonitor = () => {
  const [monitorStatus, setMonitorStatus] = useState({
    serviceRunning: false,
    offlineQueueLength: 0,
    isDefaultDialer: false,
    hasActiveCall: false,
  });
  const [activeCall, setActiveCall] = useState(null);
  const [callHistory, setCallHistory] = useState([]);
  const [postCallEvent, setPostCallEvent] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [dialerMode, setDialerMode] = useState(() => localStorage.getItem('crm_dialer_mode') || 'internal');
  const isAndroid = typeof window !== 'undefined' && !!window.AndroidCRM;

  const fetchNativeStatus = useCallback(() => {
    if (!window.AndroidCRM?.getCallMonitorStatus) return;
    try {
      const parsed = JSON.parse(window.AndroidCRM.getCallMonitorStatus());
      setMonitorStatus(parsed);
    } catch (e) { /* silent */ }
  }, []);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.get('/api/calls?limit=10&page=1', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCallHistory(data?.data?.callLogs || data?.data || []);
    } catch (e) {
      try {
        const token = localStorage.getItem('token');
        const { data } = await axios.get('/api/calls', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const logs = Array.isArray(data?.data) ? data.data : [];
        setCallHistory(logs.slice(0, 10));
      } catch (_) {}
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const handleDialerModeChange = (newMode) => {
    setDialerMode(newMode);
    localStorage.setItem('crm_dialer_mode', newMode);
    if (window.AndroidCRM?.setDialerMode) {
      window.AndroidCRM.setDialerMode(newMode);
    }
    toast.success(`Switched to ${newMode === 'system' ? 'System Phone App' : 'CRM Default Dialer'} mode`);
  };

  const handleDismissActiveCall = () => {
    if (activeCall?.callId && window.AndroidCRM?.endCall) {
      try { window.AndroidCRM.endCall(activeCall.callId); } catch (_) {}
    }
    setActiveCall(null);
    localStorage.removeItem('pendingCallLog');
    const rawUser = localStorage.getItem('user');
    const user = rawUser ? JSON.parse(rawUser) : null;
    const userId = user?.id || user?._id || 'default';
    localStorage.removeItem(`pendingCallLog_${userId}`);
    toast.success('Call section closed');
  };

  useEffect(() => {
    window.onNativeCallStateChange = (callId, status, durationSecs) => {
      if (status === 'connected') {
        setActiveCall(prev => ({ ...prev, callId, connectedAt: new Date().toISOString(), status }));
      } else if (['completed', 'no-answer', 'busy', 'cancelled', 'failed'].includes(status)) {
        const endedCall = { ...activeCall, callId, status, durationSeconds: Number(durationSecs) };
        setActiveCall(null);
        localStorage.removeItem('pendingCallLog');
        if (status === 'completed' && durationSecs > 0) {
          setPostCallEvent(endedCall);
        }
        setTimeout(fetchHistory, 1500);
      }
    };

    const handleCrmCallStarted = (e) => {
      if (e?.detail) {
        setActiveCall({
          callId: e.detail.callId,
          leadId: e.detail.leadId,
          leadName: e.detail.leadName,
          phone: e.detail.phone,
          connectedAt: null,
          status: 'ringing'
        });
      }
    };

    const handleCrmCallError = (e) => {
      const msg = e?.detail?.message || 'Call failed. Please verify phone permissions.';
      toast.error(msg, { duration: 5000 });
      setActiveCall(null);
      localStorage.removeItem('pendingCallLog');
    };

    const handleCrmCallEvent = (e) => {
      try {
        const ev = typeof e.detail === 'string' ? JSON.parse(e.detail) : e.detail;
        if (!ev) return;
        if (ev.eventType === 'CALL_ACTIVE' || ev.state === 'CONNECTED') {
          setActiveCall({
            callId: ev.callId,
            leadId: ev.leadId,
            leadName: ev.leadName,
            phone: ev.phone,
            connectedAt: ev.extra?.connectedAt || new Date().toISOString(),
            status: 'connected',
          });
        } else if (ev.eventType === 'CALL_DISCONNECTED' || ev.state === 'DISCONNECTED') {
          const ended = {
            callId: ev.callId,
            leadId: ev.leadId,
            leadName: ev.leadName,
            phone: ev.phone,
            status: ev.extra?.status || 'completed',
            durationSeconds: Number(ev.extra?.durationSeconds || 0),
          };
          setActiveCall(null);
          localStorage.removeItem('pendingCallLog');
          if (ended.status === 'completed' && ended.durationSeconds > 0) {
            setPostCallEvent(ended);
          }
          setTimeout(fetchHistory, 1500);
        } else if (ev.eventType === 'CALL_DIALING' || ev.state === 'DIALING') {
          setActiveCall({
            callId: ev.callId,
            leadId: ev.leadId,
            leadName: ev.leadName,
            phone: ev.phone,
            connectedAt: null,
            status: 'ringing',
          });
        }
      } catch (_) {}
    };

    window.addEventListener('crmCallStarted', handleCrmCallStarted);
    window.addEventListener('crmCallError', handleCrmCallError);
    window.addEventListener('crmCallEvent', handleCrmCallEvent);

    return () => {
      window.removeEventListener('crmCallStarted', handleCrmCallStarted);
      window.removeEventListener('crmCallError', handleCrmCallError);
      window.removeEventListener('crmCallEvent', handleCrmCallEvent);
    };
  }, [activeCall, fetchHistory]);

  useEffect(() => {
    fetchNativeStatus();
    fetchHistory();
    const iv = setInterval(() => { fetchNativeStatus(); }, 4000);
    return () => clearInterval(iv);
  }, [fetchNativeStatus, fetchHistory]);

  const handleToggleService = () => {
    if (!window.AndroidCRM) { toast.error('Android app required'); return; }
    if (monitorStatus.serviceRunning) {
      window.AndroidCRM.stopCallAgentService?.();
      toast.success('Service stopped');
    } else {
      window.AndroidCRM.startCallAgentService?.();
      toast.success('Service started');
    }
    setTimeout(fetchNativeStatus, 600);
  };

  const handleForceSync = () => {
    if (!window.AndroidCRM) { toast.error('Android app required'); return; }
    setSyncLoading(true);
    const token = localStorage.getItem('token') || '';
    const baseUrl = window.location.origin;
    window.AndroidCRM.forceSyncQueue?.(baseUrl, token);
    toast.success('Queue sync triggered');
    setTimeout(() => { fetchNativeStatus(); setSyncLoading(false); }, 1800);
  };

  return (
    <div className="space-y-6 pb-12 bg-slate-50/30 min-h-screen">
      {/* ── Minimal Luxury Header ── */}
      <div className="relative overflow-hidden bg-gradient-to-r from-amber-50/80 via-rose-50/30 to-slate-50 rounded-3xl p-6 md:p-8 shadow-sm border border-amber-100/60 backdrop-blur-md">
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3.5 rounded-2xl bg-amber-100/70 text-amber-900 shadow-sm border border-amber-200/50">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Call Monitor</h1>
                {activeCall && (
                  <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200/60 animate-pulse">
                    LIVE
                  </span>
                )}
              </div>
              <p className="text-slate-500 text-xs mt-0.5 font-medium">Telecom Service · Real-Time Tracking · Automatic Recording</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { fetchNativeStatus(); fetchHistory(); }}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white/80 hover:bg-white border border-slate-200/80 rounded-2xl shadow-sm transition-all"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ── Live Call Banner with Dismiss Button ── */}
      {activeCall && (
        <LiveCallBanner
          activeCall={activeCall}
          onDismiss={handleDismissActiveCall}
        />
      )}

      {/* ── Dialer Mode Switch Card ── */}
      <div className="bg-white/90 backdrop-blur-md rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-amber-100/70 text-amber-900">
              <Settings2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Dialer Usage Mode</h3>
              <p className="text-xs text-slate-400">Choose preferred dialer for placing calls</p>
            </div>
          </div>
          <div className="inline-flex p-1 bg-slate-100/80 rounded-2xl border border-slate-200/60 self-start sm:self-auto">
            <button
              onClick={() => handleDialerModeChange('internal')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                dialerMode === 'internal'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Internal CRM Dialer
            </button>
            <button
              onClick={() => handleDialerModeChange('system')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                dialerMode === 'system'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              System Phone App
            </button>
          </div>
        </div>

        {dialerMode === 'internal' ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-amber-50/60 border border-amber-100/80 rounded-2xl p-4">
            <div className="space-y-1">
              <p className="font-bold text-amber-900 flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-amber-700" />
                CRM In-App Dialer Mode Active
              </p>
              <p className="text-amber-800/80 text-[11px] leading-relaxed">
                Places calls directly inside CRM with live call duration and dual-channel call recording. Requires Default Dialer role.
              </p>
            </div>
            {!monitorStatus.isDefaultDialer && isAndroid && (
              <button
                onClick={() => window.AndroidCRM?.requestDefaultDialer?.()}
                className="shrink-0 px-3.5 py-2 text-xs font-bold bg-amber-200 text-amber-900 rounded-xl hover:bg-amber-300 transition-colors shadow-sm"
              >
                Grant Default Dialer Role
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3 text-xs bg-sky-50/60 border border-sky-100/80 rounded-2xl p-4">
            <Smartphone className="h-5 w-5 text-sky-700 shrink-0" />
            <div>
              <p className="font-bold text-sky-900">System Phone App Mode Active</p>
              <p className="text-sky-800/80 text-[11px] leading-relaxed">
                Calls will open your phone's default phone app directly. Foreground Call Monitor will still capture call start & duration.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Status Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* CallAgentService */}
        <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4 hover:border-slate-200 transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-2xl ${monitorStatus.serviceRunning ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                <Smartphone className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Call Agent</h3>
                <p className="text-xs text-slate-400">Foreground Service</p>
              </div>
            </div>
            <span className={`px-2.5 py-1 text-[10px] font-extrabold tracking-wider uppercase rounded-full ${monitorStatus.serviceRunning ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' : 'bg-rose-50 text-rose-700 border border-rose-200/60'}`}>
              {monitorStatus.serviceRunning ? 'Active' : 'Stopped'}
            </span>
          </div>
          <button
            onClick={handleToggleService}
            disabled={!isAndroid}
            className={`w-full py-2.5 text-xs font-bold rounded-2xl transition-all border ${
              monitorStatus.serviceRunning
                ? 'bg-rose-50/70 text-rose-700 border-rose-200/60 hover:bg-rose-100/80'
                : 'bg-emerald-50/70 text-emerald-700 border-emerald-200/60 hover:bg-emerald-100/80'
            } disabled:opacity-40 disabled:cursor-not-allowed shadow-sm`}
          >
            {monitorStatus.serviceRunning ? 'Stop Service' : 'Start Service'}
          </button>
        </div>

        {/* Offline Queue */}
        <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4 hover:border-slate-200 transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-2xl ${monitorStatus.offlineQueueLength > 0 ? 'bg-amber-50 text-amber-600' : 'bg-purple-50 text-purple-600'}`}>
                {monitorStatus.offlineQueueLength > 0 ? <WifiOff className="h-5 w-5" /> : <Wifi className="h-5 w-5" />}
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Offline Queue</h3>
                <p className="text-xs text-slate-400">Pending Sync</p>
              </div>
            </div>
            <span className={`px-2.5 py-1 text-[10px] font-extrabold tracking-wider uppercase rounded-full ${monitorStatus.offlineQueueLength > 0 ? 'bg-amber-50 text-amber-700 border border-amber-200/60' : 'bg-purple-50 text-purple-700 border border-purple-200/60'}`}>
              {monitorStatus.offlineQueueLength} Pending
            </span>
          </div>
          <button
            onClick={handleForceSync}
            disabled={syncLoading || !isAndroid}
            className="w-full py-2.5 text-xs font-bold rounded-2xl bg-purple-50/70 text-purple-700 border border-purple-200/60 hover:bg-purple-100/80 transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncLoading ? 'animate-spin' : ''}`} />
            {syncLoading ? 'Syncing...' : 'Force Sync'}
          </button>
        </div>

        {/* Default Dialer Role */}
        <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4 hover:border-slate-200 transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-2xl ${monitorStatus.isDefaultDialer ? 'bg-sky-50 text-sky-600' : 'bg-amber-50 text-amber-500'}`}>
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Dialer Role</h3>
                <p className="text-xs text-slate-400">InCallService</p>
              </div>
            </div>
            <span className={`px-2.5 py-1 text-[10px] font-extrabold tracking-wider uppercase rounded-full ${monitorStatus.isDefaultDialer ? 'bg-sky-50 text-sky-700 border border-sky-200/60' : 'bg-amber-50 text-amber-700 border border-amber-200/60'}`}>
              {monitorStatus.isDefaultDialer ? 'Granted' : 'Optional'}
            </span>
          </div>
          {!monitorStatus.isDefaultDialer ? (
            <button
              onClick={() => window.AndroidCRM?.requestDefaultDialer?.()}
              disabled={!isAndroid}
              className="w-full py-2.5 text-xs font-bold rounded-2xl bg-amber-50/70 text-amber-700 border border-amber-200/60 hover:bg-amber-100/80 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >
              Request Default Role
            </button>
          ) : (
            <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50/70 border border-emerald-100 rounded-2xl px-3 py-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Active
            </div>
          )}
        </div>
      </div>

      {/* ── Call History ── */}
      <div className="bg-white/90 backdrop-blur-md rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100/80">
          <div className="flex items-center gap-2.5">
            <Clock className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-bold text-slate-800">Recent Calls</h2>
            <span className="px-2.5 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600 font-semibold">{callHistory.length}</span>
          </div>
          <button
            onClick={fetchHistory}
            disabled={historyLoading}
            className="text-xs text-amber-700 font-semibold hover:text-amber-800 flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className={`h-3 w-3 ${historyLoading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {historyLoading ? (
          <div className="flex items-center justify-center py-14 text-slate-400 text-sm">
            <RefreshCw className="h-4 w-4 animate-spin mr-2" /> Loading call logs...
          </div>
        ) : callHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-slate-400">
            <PhoneMissed className="h-10 w-10 mb-3 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">No recent calls</p>
            <p className="text-xs text-slate-400 mt-1">Calls will appear here after being logged</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100/70">
            {callHistory.map((call, idx) => (
              <div key={call.id || idx} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50/60 transition-colors">
                <div className={`p-2.5 rounded-2xl shrink-0 ${
                  call.callDirection === 'inbound'
                    ? 'bg-sky-50 text-sky-600'
                    : call.callStatus === 'completed'
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-amber-50 text-amber-600'
                }`}>
                  {call.callDirection === 'inbound'
                    ? <PhoneIncoming className="h-4 w-4" />
                    : call.callStatus === 'completed'
                    ? <Phone className="h-4 w-4" />
                    : <PhoneMissed className="h-4 w-4" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-slate-900 truncate">
                      {call.Lead?.name || call.phoneNumber || 'Unknown'}
                    </p>
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${statusColor[call.callStatus] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                      {call.callStatus}
                    </span>
                    {call.recordingStatus === 'available' && (
                      <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-purple-50 text-purple-700 border border-purple-200/60">
                        <Mic className="h-2.5 w-2.5" /> REC
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">
                    {call.phoneNumber} · {timeAgo(call.startedAt || call.createdAt)}
                    {call.disposition && <span className="ml-1.5 text-amber-700 font-medium">· {call.disposition}</span>}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-sm font-mono font-bold text-slate-800 tabular-nums">{formatDuration(call.durationSeconds)}</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">{call.callDirection}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Luxury Info Card ── */}
      <div className="bg-gradient-to-r from-amber-50/70 via-rose-50/40 to-slate-50 border border-amber-100/60 rounded-3xl p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-amber-100/70 text-amber-900 rounded-2xl shrink-0 border border-amber-200/50">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">Dual Dialer Support & Audio Recording</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Choose between <strong>CRM Default Dialer</strong> for in-app calls or <strong>System Phone App</strong> for standard phone dialing.
              When using CRM Default Dialer, recording uses{' '}
              <code className="bg-amber-100/60 px-1.5 py-0.5 rounded-md text-amber-900 font-mono text-[11px]">VOICE_RECOGNITION</code> →{' '}
              <code className="bg-amber-100/60 px-1.5 py-0.5 rounded-md text-amber-900 font-mono text-[11px]">VOICE_COMMUNICATION</code> →{' '}
              <code className="bg-amber-100/60 px-1.5 py-0.5 rounded-md text-amber-900 font-mono text-[11px]">MIC</code> audio fallback chain.
            </p>
          </div>
        </div>
      </div>

      {/* ── Post-Call Annotation Modal ── */}
      {postCallEvent && (
        <PostCallModal
          callEvent={postCallEvent}
          onClose={() => setPostCallEvent(null)}
          onSave={() => { setPostCallEvent(null); fetchHistory(); }}
        />
      )}
    </div>
  );
};

export default CallMonitor;
