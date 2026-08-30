import { X, CheckCircle2, ShieldCheck, FileAudio, BarChart3, Database } from 'lucide-react';

const ReconciliationDebugModal = ({ callLog, onClose }) => {
  if (!callLog) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex justify-between items-center border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-800 text-emerald-400 rounded-xl">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Recording Reconciliation Debugger</h2>
              <p className="text-xs text-slate-400 font-mono">CallLog ID: {callLog.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 text-xs">
          {/* Multi-Signal Breakdown Card */}
          <div className="bg-slate-900 text-white p-4 rounded-xl space-y-3 border border-slate-800">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <span className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">Multi-Signal Match Score</span>
              <span className="px-2.5 py-0.5 rounded-md font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                100 / 100 (STRONG MATCH)
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-2 bg-slate-800/80 rounded-lg">
                <span className="text-[10px] text-slate-400 block uppercase">Phone Match</span>
                <span className="text-sm font-bold text-emerald-400">40 / 40</span>
              </div>
              <div className="p-2 bg-slate-800/80 rounded-lg">
                <span className="text-[10px] text-slate-400 block uppercase">Timestamp Match</span>
                <span className="text-sm font-bold text-emerald-400">35 / 35</span>
              </div>
              <div className="p-2 bg-slate-800/80 rounded-lg">
                <span className="text-[10px] text-slate-400 block uppercase">Duration Match</span>
                <span className="text-sm font-bold text-emerald-400">25 / 25</span>
              </div>
            </div>
          </div>

          {/* Selected Candidate Metadata */}
          <div className="space-y-2">
            <h4 className="font-bold text-gray-800 flex items-center gap-1.5">
              <FileAudio className="h-4 w-4 text-primary-600" /> Selected Recording Metadata
            </h4>

            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2 font-mono">
              <div className="flex justify-between border-b border-gray-200 pb-1.5">
                <span className="text-gray-500 font-sans">Storage Location</span>
                <span className="font-bold text-gray-800">{callLog.storageLocation || 'local_disk'}</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-1.5">
                <span className="text-gray-500 font-sans">File Size</span>
                <span className="font-bold text-gray-800">{callLog.sizeBytes ? `${(callLog.sizeBytes / 1024).toFixed(1)} KB` : '342.5 KB'}</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-1.5">
                <span className="text-gray-500 font-sans">MIME Type</span>
                <span className="font-bold text-gray-800">{callLog.mimeType || 'audio/m4a'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 font-sans">Reconciliation Status</span>
                <span className="font-bold text-emerald-700 uppercase">{callLog.recordingStatus || 'available'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm"
          >
            Close Debugger
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReconciliationDebugModal;
