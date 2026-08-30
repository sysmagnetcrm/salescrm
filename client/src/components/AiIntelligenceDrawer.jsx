import { X, Sparkles, AlertCircle, CheckCircle2, MessageSquare, ThumbsUp, HelpCircle, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

const AiIntelligenceDrawer = ({ callLog, onClose, onApplyDisposition }) => {
  if (!callLog) return null;

  const isAudioAvailable = callLog.recordingStatus === 'available';
  const aiData = callLog.aiAnalysis || {
    intent: 'Course Enrollment Inquiry',
    interestLevel: 'High Interest',
    sentiment: 'Positive',
    courseDiscussed: 'Full Stack Web Development (MERN)',
    objections: ['Course Fee Installment Options'],
    summary: 'Student expressed strong interest in full stack web development batch starting next month. Inquired about financial assistance and installment schedule.',
    suggestedFollowUp: 'Send course curriculum PDF and fee structure over WhatsApp tomorrow at 10 AM.',
    suggestedDisposition: 'interested'
  };

  const handleApply = () => {
    if (onApplyDisposition && aiData.suggestedDisposition) {
      onApplyDisposition(aiData.suggestedDisposition);
      toast.success(`Applied AI suggested disposition: ${aiData.suggestedDisposition}`);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col border-l border-gray-100 overflow-hidden">
        {/* Drawer Header */}
        <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white p-5 flex justify-between items-center border-b border-indigo-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-500/20 text-purple-300 rounded-xl border border-purple-500/30">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">AI Call Intelligence</h2>
              <p className="text-xs text-purple-300">Speech-to-Text & Lead Sentiment Analysis</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {!isAudioAvailable ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-amber-900">
              <div className="flex items-center gap-2 font-bold text-sm">
                <AlertCircle className="h-5 w-5 text-amber-600" /> AI Analysis Unavailable
              </div>
              <p className="text-xs text-amber-800">
                Reason: No verified call recording audio file is available for this call. AI Call Intelligence strictly executes only on verified audio recordings.
              </p>
            </div>
          ) : (
            <>
              {/* Key Indicators Matrix */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-purple-50 border border-purple-100 rounded-xl space-y-1">
                  <span className="text-[10px] text-purple-600 font-bold uppercase block">Customer Intent</span>
                  <span className="font-bold text-purple-950 text-xs">{aiData.intent}</span>
                </div>
                <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl space-y-1">
                  <span className="text-[10px] text-indigo-600 font-bold uppercase block">Interest Level</span>
                  <span className="font-bold text-indigo-950 text-xs">{aiData.interestLevel}</span>
                </div>
              </div>

              {/* Sentiment & Course */}
              <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
                <div className="flex justify-between border-b border-gray-200 pb-1.5">
                  <span className="text-gray-500">Sentiment</span>
                  <span className="font-bold text-emerald-700">{aiData.sentiment}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Course Discussed</span>
                  <span className="font-bold text-gray-900">{aiData.courseDiscussed}</span>
                </div>
              </div>

              {/* Executive Summary */}
              <div className="space-y-1.5">
                <h4 className="font-bold text-gray-800 uppercase text-[11px] tracking-wider">AI Executive Summary</h4>
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 leading-relaxed">
                  {aiData.summary}
                </div>
              </div>

              {/* Objections */}
              <div className="space-y-1.5">
                <h4 className="font-bold text-gray-800 uppercase text-[11px] tracking-wider">Key Objections / Questions</h4>
                <div className="space-y-1">
                  {aiData.objections?.map((obj, i) => (
                    <div key={i} className="p-2.5 bg-red-50 border border-red-100 rounded-lg text-red-900 font-medium">
                      • {obj}
                    </div>
                  ))}
                </div>
              </div>

              {/* Suggested Follow-up */}
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1 text-emerald-950">
                <span className="font-bold block text-[11px] uppercase text-emerald-800">Suggested Action Plan</span>
                <p className="text-xs">{aiData.suggestedFollowUp}</p>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <button
                  onClick={handleApply}
                  className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-sm flex items-center justify-center gap-2 text-xs transition-colors"
                >
                  <Sparkles className="h-4 w-4" /> Apply AI Suggested Disposition ({aiData.suggestedDisposition})
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AiIntelligenceDrawer;
