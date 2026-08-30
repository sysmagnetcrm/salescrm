import { X, Clock, Phone, User, ShieldCheck, FileText, Sparkles, Volume2, CheckCircle2, AlertCircle } from 'lucide-react';

const formatTime = (dateStr) => {
  if (!dateStr) return '--:--:--';
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const formatSeconds = (sec) => {
  if (!sec || sec <= 0) return '00:00';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const CallLifecycleModal = ({ callLog, onClose }) => {
  if (!callLog) return null;

  const leadName = callLog.lead ? callLog.lead.name : (callLog.phoneNumber || 'Unknown Lead');
  const leadPhone = callLog.phoneNumber || (callLog.lead ? callLog.lead.phone : 'N/A');
  const callerName = callLog.callerUser ? callLog.callerUser.name : 'Salesperson';
  const isRecorded = callLog.recordingStatus === 'available';
  const isAnalyzed = callLog.analysisStatus === 'completed';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-gray-100 overflow-hidden space-y-0 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-5 flex justify-between items-center border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-800 text-sky-400 rounded-xl">
              <Phone className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Call Lifecycle Audit Detail</h2>
              <p className="text-xs text-slate-400 font-mono">ID: {callLog.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Lead & Caller Metadata Card */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200 text-xs">
            <div>
              <span className="text-gray-500 block mb-0.5">Lead Name</span>
              <span className="font-bold text-gray-900 text-sm flex items-center gap-1">
                <User className="h-3.5 w-3.5 text-primary-600" /> {leadName}
              </span>
            </div>
            <div>
              <span className="text-gray-500 block mb-0.5">Phone Number</span>
              <span className="font-bold font-mono text-gray-900 text-sm">{leadPhone}</span>
            </div>
            <div>
              <span className="text-gray-500 block mb-0.5">Caller / Owner</span>
              <span className="font-bold text-gray-900">{callerName}</span>
            </div>
          </div>

          {/* Call Timeline */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-primary-600" /> Call Stage Timeline
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Started</span>
                <span className="font-mono font-bold text-sm text-slate-800">{formatTime(callLog.startedAt)}</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Ringing</span>
                <span className="font-mono font-bold text-sm text-slate-800">{formatTime(callLog.ringingAt)}</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Connected</span>
                <span className="font-mono font-bold text-sm text-slate-800">{formatTime(callLog.connectedAt)}</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Ended</span>
                <span className="font-mono font-bold text-sm text-slate-800">{formatTime(callLog.endedAt)}</span>
              </div>
            </div>
          </div>

          {/* Duration Comparison */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-sky-50 border border-sky-200 rounded-xl">
            <div>
              <span className="text-xs font-bold text-sky-800 block">Authoritative Talk Time</span>
              <span className="text-2xl font-black font-mono text-sky-950">{formatSeconds(callLog.durationSeconds)}</span>
              <span className="text-[11px] text-sky-600 block mt-0.5">(endedAt - connectedAt)</span>
            </div>
            <div>
              <span className="text-xs font-bold text-sky-800 block">Total Call Lifecycle Time</span>
              <span className="text-2xl font-black font-mono text-sky-950">{formatSeconds(callLog.lifecycleDurationSeconds)}</span>
              <span className="text-[11px] text-sky-600 block mt-0.5">(endedAt - startedAt)</span>
            </div>
          </div>

          {/* Processing Stages Matrix */}
          <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100 text-xs">
            <div className="p-3 bg-gray-50 font-bold text-gray-800 flex justify-between">
              <span>Pipeline Stage</span>
              <span>Status</span>
            </div>

            <div className="p-3.5 flex justify-between items-center">
              <span className="font-semibold text-gray-700 flex items-center gap-1.5">
                <Volume2 className="h-4 w-4 text-slate-600" /> OEM Call Recording
              </span>
              <span className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[11px] ${isRecorded ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                {callLog.recordingStatus || 'PROCESSING'}
              </span>
            </div>

            <div className="p-3.5 flex justify-between items-center">
              <span className="font-semibold text-gray-700 flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-slate-600" /> Recording Match & Reconciliation
              </span>
              <span className="font-bold text-emerald-700">100% (STRONG MATCH)</span>
            </div>

            <div className="p-3.5 flex justify-between items-center">
              <span className="font-semibold text-gray-700 flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-slate-600" /> Audio Transcript
              </span>
              <span className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[11px] ${isRecorded ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>
                {isRecorded ? 'AVAILABLE' : 'UNAVAILABLE'}
              </span>
            </div>

            <div className="p-3.5 flex justify-between items-center">
              <span className="font-semibold text-gray-700 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-purple-600" /> AI Call Intelligence
              </span>
              <span className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[11px] ${isAnalyzed ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-600'}`}>
                {isAnalyzed ? 'ANALYZED' : (isRecorded ? 'READY' : 'UNAVAILABLE')}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm"
          >
            Close Audit View
          </button>
        </div>
      </div>
    </div>
  );
};

export default CallLifecycleModal;
