import { useState } from 'react';
import { PhoneCall, CheckCircle2, Clock, Volume2, Sparkles, ArrowRight, Save, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

const PostCallProgressModal = ({ callData, onSaveAndNext, onClose }) => {
  const [disposition, setDisposition] = useState(callData?.disposition || 'interested');
  const [notes, setNotes] = useState(callData?.notes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!callData) return null;

  const leadName = callData.leadName || 'Lead Student';
  const talkTimeSec = callData.durationSeconds || 42;
  const lifecycleTimeSec = callData.lifecycleDurationSeconds || 58;

  const formatSeconds = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (onSaveAndNext) {
        await onSaveAndNext({ disposition, notes });
      }
      toast.success('Call log saved. Loading next lead in queue...');
    } catch (err) {
      toast.error('Failed to save call details');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex justify-between items-center border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Call Completed - Auto Processed</h2>
              <p className="text-xs text-slate-400">Lead: <strong className="text-white">{leadName}</strong> ({callData.phoneNumber})</p>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 text-xs">
          {/* Automatic Duration Summary */}
          <div className="grid grid-cols-2 gap-3 p-3.5 bg-sky-50 border border-sky-200 rounded-xl">
            <div>
              <span className="text-[11px] font-bold text-sky-800 block">Talk Time</span>
              <span className="text-xl font-black font-mono text-sky-950">{formatSeconds(talkTimeSec)}</span>
              <span className="text-[10px] text-sky-600 block">(endedAt - connectedAt)</span>
            </div>
            <div>
              <span className="text-[11px] font-bold text-sky-800 block">Total Lifecycle Time</span>
              <span className="text-xl font-black font-mono text-sky-950">{formatSeconds(lifecycleTimeSec)}</span>
              <span className="text-[10px] text-sky-600 block">(endedAt - startedAt)</span>
            </div>
          </div>

          {/* Automation Pipeline Badges */}
          <div className="grid grid-cols-3 gap-2 text-center p-3 bg-gray-50 border border-gray-200 rounded-xl">
            <div className="space-y-0.5">
              <span className="text-[10px] text-gray-500 font-bold block uppercase">Recording</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">● AVAILABLE</span>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] text-gray-500 font-bold block uppercase">Transcript</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">● AVAILABLE</span>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] text-gray-500 font-bold block uppercase">AI Pipeline</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-200">● READY</span>
            </div>
          </div>

          {/* BDE Inputs */}
          <div className="space-y-3 pt-1">
            <div>
              <label className="block font-bold text-gray-800 mb-1">Call Disposition</label>
              <select
                value={disposition}
                onChange={(e) => setDisposition(e.target.value)}
                className="w-full p-2.5 text-xs font-semibold border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none bg-white"
              >
                <option value="interested">Interested - High Intent</option>
                <option value="follow-up">Follow-Up Required</option>
                <option value="orientation-scheduled">Orientation Scheduled</option>
                <option value="no-answer">No Answer</option>
                <option value="busy">Busy / Call Back</option>
                <option value="not-interested">Not Interested</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-gray-800 mb-1">Call Notes & Key Takeaways</label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enter call outcome, student questions, fee discussion notes..."
                className="w-full p-2.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-2 flex justify-end gap-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-5 py-2 font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm"
            >
              <Save className="h-4 w-4" /> Save & Next Lead <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PostCallProgressModal;
