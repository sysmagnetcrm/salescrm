import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Activity, RefreshCw, Smartphone, ShieldCheck, Server, Phone, PhoneCall,
  PhoneIncoming, PhoneMissed, Clock, Mic, MicOff, CheckCircle2, AlertCircle,
  ChevronDown, X, FileText, Radio, Wifi, WifiOff, Play, Upload
} from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';

// ─── Helper formatters ─────────────────────────────────────────────────────────
const formatDuration = (secs) => {
  if (!secs && secs !== 0) return '--:--';
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
  completed: 'bg-emerald-100 text-emerald-800',
  'no-answer': 'bg-amber-100 text-amber-800',
  busy: 'bg-orange-100 text-orange-800',
  cancelled: 'bg-gray-100 text-gray-700',
  failed: 'bg-red-100 text-red-700',
  connected: 'bg-blue-100 text-blue-800',
  initiated: 'bg-indigo-100 text-indigo-700',
  ringing: 'bg-yellow-100 text-yellow-800',
};

const DISPOSITIONS = [
  { value: 'interested', label: '✅ Interested' },
  { value: 'callback', label: '📞 Callback Requested' },
  { value: 'not_interested', label: '❌ Not Interested' },
  { value: 'wrong_number', label: '🚫 Wrong Number' },
  { value: 'busy', label: '⏳ Busy – Try Later' },
  { value: 'converted', label: '🏆 Converted' },
  { value: 'follow_up', label: '🔄 Follow Up' },
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-5 text-white">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-white/20">
                <FileText className="h-4 w-4" />
              </div>
              <span className="font-bold text-sm">Log Call Outcome</span>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30">
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-indigo-100 text-xs">
            {callEvent?.leadName || 'Unknown Lead'} · {callEvent?.phone} ·{' '}
            <span className="font-bold">{formatDuration(callEvent?.durationSeconds)}</span>
          </p>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Call outcome summary strip */}
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
              <Phone className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-800 truncate">
                {callEvent?.status === 'completed' ? '✅ Call Completed' : `⚠️ ${callEvent?.status}`}
              </p>
              <p className="text-xs text-gray-400">
                Duration: {formatDuration(callEvent?.durationSeconds)} · {callEvent?.status}
              </p>
            </div>
          </div>

          {/* Disposition select */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Call Disposition</label>
            <div className="relative">
              <select
                value={disposition}
                onChange={e => setDisposition(e.target.value)}
                className="w-full appearance-none border border-gray-200 rounded-xl px-4 py-2.5 pr-8 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 text-gray-700"
              >
                <option value="">Select outcome...</option>
                {DISPOSITIONS.map(d => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Notes textarea */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="What was discussed? Any follow-up needed?"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 text-gray-700 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 text-xs font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
            >
              Skip
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Outcome'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Live Call Banner ─────────────────────────────────────────────────────────
const LiveCallBanner = ({ activeCall }) => {
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
    <div className="relative overflow-hidden bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 rounded-2xl p-4 text-white shadow-lg">
      {/* Pulse ring */}
      <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full bg-white/10 animate-ping" />
      <div className="absolute -top-2 -right-2 w-16 h-16 rounded-full bg-white/10" />

      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-white/20 backdrop-blur-sm">
            <PhoneCall className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <p className="text-xs font-semibold text-emerald-100">LIVE CALL IN PROGRESS</p>
            <p className="font-bold text-sm">{activeCall.leadName || activeCall.phone}</p>
            <p className="text-xs text-emerald-100">{activeCall.phone}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-mono font-black tabular-nums">{formatDuration(elapsed)}</div>
          <div className="flex items-center justify-end gap-1 mt-0.5">
            <Radio className="h-3 w-3 animate-pulse" />
            <span className="text-xs text-emerald-100">Recording</span>
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
  const [activeCall, setActiveCall] = useState(null);   // live call from JS bridge
  const [callHistory, setCallHistory] = useState([]);   // recent calls from server
  const [postCallEvent, setPostCallEvent] = useState(null); // pending annotation
  const [historyLoading, setHistoryLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const isAndroid = typeof window !== 'undefined' && !!window.AndroidCRM;

  // ── Fetch native service status ──
  const fetchNativeStatus = useCallback(() => {
    if (!window.AndroidCRM?.getCallMonitorStatus) return;
    try {
      const parsed = JSON.parse(window.AndroidCRM.getCallMonitorStatus());
      setMonitorStatus(parsed);
    } catch (e) { /* silent */ }
  }, []);

  // ── Fetch call history from server ──
  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const token = localStorage.getItem('token');
      const { data } = await axios.get('/api/calls?limit=10&page=1', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCallHistory(data?.data?.callLogs || data?.data || []);
    } catch (e) {
      // If API fails, try alternate endpoint shape
      try {
        const token = localStorage.getItem('token');
        const { data } = await axios.get('/api/calls', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const logs = Array.isArray(data?.data) ? data.data : [];
        setCallHistory(logs.slice(0, 10));
      } catch (_) { /* ignore */ }
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  // ── Native call event listener (window.onNativeCallStateChange) ──
  useEffect(() => {
    // This global is called by NativeCallMonitor.kt via evaluateJavascript
    window.onNativeCallStateChange = (callId, status, durationSecs) => {
      if (status === 'connected') {
        setActiveCall(prev => ({ ...prev, callId, connectedAt: new Date().toISOString(), status }));
      } else if (['completed', 'no-answer', 'busy', 'cancelled', 'failed'].includes(status)) {
        const endedCall = { ...activeCall, callId, status, durationSeconds: Number(durationSecs) };
        setActiveCall(null);
        // Trigger post-call annotation modal only for completed calls
        if (status === 'completed' && durationSecs > 0) {
          setPostCallEvent(endedCall);
        }
        // Refresh history after a short delay to let server update
        setTimeout(fetchHistory, 1500);
      }
    };

    // CrmCallEventBridge also fires window.dispatchEvent('crmCallEvent')
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

    window.addEventListener('crmCallEvent', handleCrmCallEvent);
    return () => window.removeEventListener('crmCallEvent', handleCrmCallEvent);
  }, [activeCall, fetchHistory]);

  // ── Bootstrap ──
  useEffect(() => {
    fetchNativeStatus();
    fetchHistory();
    const iv = setInterval(() => { fetchNativeStatus(); }, 4000);
    return () => clearInterval(iv);
  }, [fetchNativeStatus, fetchHistory]);

  // ── Service toggle ──
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

  // ── Force sync offline queue ──
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
    <div className="space-y-6 pb-8">
      {/* ── Page Header ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-5 md:p-7 shadow-2xl border border-indigo-500/20">
        <div className="absolute top-0 left-0 w-64 h-64 rounded-full bg-indigo-500/10 blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-48 h-48 rounded-full bg-violet-500/10 blur-3xl translate-x-1/4 translate-y-1/4" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/20 border border-indigo-400/30">
              <Activity className="h-6 w-6 text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black">Call Monitor</h1>
                {activeCall && (
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse">
                    LIVE
                  </span>
                )}
              </div>
              <p className="text-indigo-300 text-xs mt-0.5">Telecom Service · Duration Tracking · Auto Recording</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { fetchNativeStatus(); fetchHistory(); }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-indigo-200 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl transition-all"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ── Live Call Banner ── */}
      {activeCall && <LiveCallBanner activeCall={activeCall} />}

      {/* ── Status Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* CallAgentService */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${monitorStatus.serviceRunning ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                <Smartphone className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Call Agent</h3>
                <p className="text-xs text-gray-400">Foreground Service</p>
              </div>
            </div>
            <span className={`px-2 py-0.5 text-xs font-black rounded-full ${monitorStatus.serviceRunning ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}`}>
              {monitorStatus.serviceRunning ? 'ON' : 'OFF'}
            </span>
          </div>
          <button
            onClick={handleToggleService}
            disabled={!isAndroid}
            className={`w-full py-2 text-xs font-bold rounded-xl transition-colors border ${
              monitorStatus.serviceRunning
                ? 'bg-red-50 text-red-700 border-red-100 hover:bg-red-100'
                : 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {monitorStatus.serviceRunning ? 'Stop Service' : 'Start Service'}
          </button>
        </div>

        {/* Offline Queue */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${monitorStatus.offlineQueueLength > 0 ? 'bg-amber-50 text-amber-600' : 'bg-violet-50 text-violet-600'}`}>
                {monitorStatus.offlineQueueLength > 0 ? <WifiOff className="h-5 w-5" /> : <Wifi className="h-5 w-5" />}
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Offline Queue</h3>
                <p className="text-xs text-gray-400">Pending Sync</p>
              </div>
            </div>
            <span className={`px-2 py-0.5 text-xs font-black rounded-full ${monitorStatus.offlineQueueLength > 0 ? 'bg-amber-100 text-amber-800' : 'bg-violet-100 text-violet-800'}`}>
              {monitorStatus.offlineQueueLength} PENDING
            </span>
          </div>
          <button
            onClick={handleForceSync}
            disabled={syncLoading || !isAndroid}
            className="w-full py-2 text-xs font-bold rounded-xl bg-violet-50 text-violet-700 border border-violet-100 hover:bg-violet-100 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncLoading ? 'animate-spin' : ''}`} />
            {syncLoading ? 'Syncing...' : 'Force Sync'}
          </button>
        </div>

        {/* Default Dialer Role */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${monitorStatus.isDefaultDialer ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-500'}`}>
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Dialer Role</h3>
                <p className="text-xs text-gray-400">InCallService</p>
              </div>
            </div>
            <span className={`px-2 py-0.5 text-xs font-black rounded-full ${monitorStatus.isDefaultDialer ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
              {monitorStatus.isDefaultDialer ? 'GRANTED' : 'REQUIRED'}
            </span>
          </div>
          {!monitorStatus.isDefaultDialer && (
            <button
              onClick={() => window.AndroidCRM?.requestDefaultDialer?.()}
              disabled={!isAndroid}
              className="w-full py-2 text-xs font-bold rounded-xl bg-amber-50 text-amber-700 border border-amber-100 hover:bg-amber-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Request Dialer Role
            </button>
          )}
          {monitorStatus.isDefaultDialer && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 rounded-xl px-3 py-2">
              <CheckCircle2 className="h-3.5 w-3.5" /> Recording enabled via InCallService
            </div>
          )}
        </div>
      </div>

      {/* ── Call History ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-500" />
            <h2 className="text-sm font-bold text-gray-800">Recent Calls</h2>
            <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-500 font-semibold">{callHistory.length}</span>
          </div>
          <button
            onClick={fetchHistory}
            disabled={historyLoading}
            className="text-xs text-indigo-600 font-semibold hover:text-indigo-700 flex items-center gap-1"
          >
            <RefreshCw className={`h-3 w-3 ${historyLoading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {historyLoading ? (
          <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
            <RefreshCw className="h-4 w-4 animate-spin mr-2" /> Loading calls...
          </div>
        ) : callHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <PhoneMissed className="h-10 w-10 mb-3 text-gray-300" />
            <p className="text-sm font-medium">No recent calls</p>
            <p className="text-xs mt-1">Calls will appear here after being logged</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {callHistory.map((call, idx) => (
              <div key={call.id || idx} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/50 transition-colors">
                {/* Direction icon */}
                <div className={`p-2 rounded-xl shrink-0 ${
                  call.callDirection === 'inbound'
                    ? 'bg-blue-50 text-blue-500'
                    : call.callStatus === 'completed'
                    ? 'bg-emerald-50 text-emerald-500'
                    : 'bg-amber-50 text-amber-500'
                }`}>
                  {call.callDirection === 'inbound'
                    ? <PhoneIncoming className="h-4 w-4" />
                    : call.callStatus === 'completed'
                    ? <Phone className="h-4 w-4" />
                    : <PhoneMissed className="h-4 w-4" />}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {call.Lead?.name || call.phoneNumber || 'Unknown'}
                    </p>
                    <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${statusColor[call.callStatus] || 'bg-gray-100 text-gray-600'}`}>
                      {call.callStatus}
                    </span>
                    {call.recordingStatus === 'available' && (
                      <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-bold rounded-full bg-indigo-100 text-indigo-700">
                        <Mic className="h-2.5 w-2.5" /> REC
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    {call.phoneNumber} · {timeAgo(call.startedAt || call.createdAt)}
                    {call.disposition && <span className="ml-1.5 text-indigo-500 font-medium">· {call.disposition}</span>}
                  </p>
                </div>

                {/* Duration */}
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-gray-700 tabular-nums">{formatDuration(call.durationSeconds)}</p>
                  <p className="text-xs text-gray-400">{call.callDirection}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Recording Info Card ── */}
      <div className="bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-xl shrink-0">
            <Mic className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-indigo-900 mb-1">Dual-Source Recording Active</h3>
            <p className="text-xs text-indigo-700 leading-relaxed">
              Calls are automatically recorded when the default dialer role is granted. The system tries{' '}
              <code className="bg-indigo-100 px-1 rounded text-indigo-800">VOICE_RECOGNITION</code> →{' '}
              <code className="bg-indigo-100 px-1 rounded text-indigo-800">VOICE_COMMUNICATION</code> →{' '}
              <code className="bg-indigo-100 px-1 rounded text-indigo-800">MIC</code> sources in order, then falls
              back to OEM recorder detection (MIUI / Samsung / OnePlus) if in-app recording fails.
              Recordings upload automatically on call end.
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
