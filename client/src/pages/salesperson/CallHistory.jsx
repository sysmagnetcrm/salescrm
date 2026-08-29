import { useState, useEffect } from 'react';
import { callAPI } from '../../services/api';
import { Phone, Clock, Play, FileText, Sparkles, UserCheck, CheckCircle2, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const CallHistory = () => {
  const [callLogs, setCallLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCall, setSelectedCall] = useState(null);
  const [transcript, setTranscript] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    fetchCallLogs();
  }, []);

  const fetchCallLogs = async () => {
    setLoading(true);
    try {
      const res = await callAPI.getAllCallLogs();
      if (res.data?.success) {
        setCallLogs(res.data.data || []);
      }
    } catch (err) {
      toast.error('Failed to load call records');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenIntelligence = async (call) => {
    setSelectedCall(call);
    setTranscript(null);
    setAiAnalysis(null);
    setModalLoading(true);

    try {
      // Trigger AI analysis asynchronously if not completed
      await callAPI.triggerAIAnalysis(call.id);

      // Fetch transcript & AI analysis results
      const [tRes, aRes] = await Promise.allSettled([
        callAPI.getCallTranscript(call.id),
        callAPI.getCallAIAnalysis(call.id)
      ]);

      if (tRes.status === 'fulfilled' && tRes.value.data?.success) {
        setTranscript(tRes.value.data.data);
      }

      if (aRes.status === 'fulfilled' && aRes.value.data?.success) {
        setAiAnalysis(aRes.value.data.data);
      }
    } catch (err) {
      toast.error('Error fetching call intelligence');
    } finally {
      setModalLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Call Records & Intelligence</h1>
          <p className="text-xs md:text-sm text-gray-500 mt-1">Authorized telephony logs, talk-time records, and AI call insights</p>
        </div>
      </div>

      {callLogs.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-gray-200 text-center text-gray-500">
          No call records found.
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-700">
              <thead className="bg-gray-50 text-gray-900 font-bold border-b text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="p-4">Date & Time</th>
                  <th className="p-4">Student Lead</th>
                  <th className="p-4">Caller (Attribution)</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Talk Duration</th>
                  <th className="p-4">Disposition</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {callLogs.map((call) => {
                  const isTLCall = call.callerUserId !== call.leadOwnerId;
                  return (
                    <tr key={call.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4 whitespace-nowrap font-medium text-gray-900">
                        {call.createdAt ? format(new Date(call.createdAt), 'MMM dd, yyyy h:mm a') : 'N/A'}
                      </td>
                      <td className="p-4 font-bold text-gray-900">
                        {call.lead?.name || 'N/A'}
                        <div className="text-[11px] text-gray-500 font-normal">{call.phoneNumber || call.lead?.phone}</div>
                      </td>
                      <td className="p-4">
                        <span className="font-semibold">{call.caller?.name || 'BDE'}</span>
                        {isTLCall && (
                          <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                            <UserCheck className="h-3 w-3" />
                            TL on behalf of BDE
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${call.callStatus === 'completed' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                          {call.callStatus}
                        </span>
                      </td>
                      <td className="p-4 font-mono font-bold text-gray-900">
                        {call.durationSeconds || 0}s
                        <div className="text-[10px] text-gray-500 font-sans">Full Lifecycle: {call.lifecycleDurationSeconds || 0}s</div>
                      </td>
                      <td className="p-4 font-semibold text-primary-700">
                        {call.disposition || 'N/A'}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleOpenIntelligence(call)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 text-primary-700 hover:bg-primary-100 rounded-xl text-xs font-bold transition-colors border border-primary-200"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          AI Intelligence
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* AI Intelligence & Audio Modal */}
      {selectedCall && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-primary-600" />
                <div>
                  <h3 className="text-lg font-black text-gray-900">Call Intelligence Summary</h3>
                  <p className="text-xs text-gray-500">{selectedCall.lead?.name} ({selectedCall.phoneNumber})</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCall(null)}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg p-1"
              >
                ✕
              </button>
            </div>

            {modalLoading ? (
              <div className="py-12 text-center space-y-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                <p className="text-xs font-semibold text-gray-600">Analyzing call transcript & intelligence...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* AI Analysis Cards */}
                {aiAnalysis && (
                  <div className="bg-gradient-to-r from-primary-50 to-indigo-50 p-5 rounded-2xl border border-primary-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-primary-900 uppercase tracking-wider">Customer Intent & Interest</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${aiAnalysis.interestLevel === 'high' ? 'bg-green-600 text-white' : 'bg-orange-500 text-white'}`}>
                        {aiAnalysis.interestLevel?.toUpperCase()} INTEREST
                      </span>
                    </div>

                    <p className="text-xs text-gray-800 font-medium leading-relaxed">{aiAnalysis.summary}</p>

                    <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-primary-200/50">
                      <div>
                        <span className="text-gray-500">Course Discussed:</span>
                        <strong className="block text-gray-900">{aiAnalysis.courseDiscussed || 'N/A'}</strong>
                      </div>
                      <div>
                        <span className="text-gray-500">Suggested Disposition:</span>
                        <strong className="block text-primary-700">{aiAnalysis.suggestedDisposition || 'N/A'}</strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* Speech Transcript */}
                <div>
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-gray-500" />
                    Speech Transcript
                  </h4>
                  <div className="bg-gray-50 p-4 rounded-xl text-xs font-mono text-gray-800 leading-relaxed whitespace-pre-wrap border border-gray-200 max-h-48 overflow-y-auto">
                    {transcript?.rawTranscript || 'No transcript generated for this call.'}
                  </div>
                </div>

                <div className="pt-3 border-t text-right">
                  <button
                    onClick={() => setSelectedCall(null)}
                    className="px-5 py-2 bg-gray-900 text-white text-xs font-bold rounded-xl hover:bg-gray-800 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CallHistory;
