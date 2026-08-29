import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { callAPI } from '../../services/api';
import { Phone, Clock, Play, FileText, Sparkles, UserCheck, CheckCircle2, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const CallHistory = () => {
  const [selectedCall, setSelectedCall] = useState(null);
  const [transcript, setTranscript] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  // Fetch Call Records
  const { data: callLogs = [], isLoading: loading } = useQuery({
    queryKey: ['calls', 'all'],
    queryFn: () => callAPI.getAllCallLogs().then(r => r.data?.data || []),
    staleTime: 30000
  });

  const handleOpenIntelligence = async (call) => {
    setSelectedCall(call);
    setTranscript(null);
    setAiAnalysis(null);
    setModalLoading(true);

    try {
      // Trigger AI analysis asynchronously if not completed
      await callAPI.triggerAIAnalysis(call.id);

      // Fetch transcript & AI analysis results on-demand
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

  const getSentimentBadge = (sentiment) => {
    switch (sentiment) {
      case 'Positive':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Positive</span>;
      case 'Negative':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Negative</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">Neutral</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Phone className="h-7 w-7 text-primary-600" />
            Telephony & Call Intelligence
          </h1>
          <p className="text-sm text-gray-500">
            Protected call audio recordings, TL-on-behalf logs, and automated AI call analysis
          </p>
        </div>
      </div>

      {/* Call Records Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading && !callLogs.length ? (
          <div className="p-8 text-center text-gray-400 animate-pulse">Loading call records...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs font-medium text-gray-500 uppercase">
                <tr>
                  <th className="px-6 py-3">Timestamp</th>
                  <th className="px-6 py-3">Lead / Phone</th>
                  <th className="px-6 py-3">Caller BDE</th>
                  <th className="px-6 py-3">Connected Talk Time</th>
                  <th className="px-6 py-3">Disposition / Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {callLogs.map((call) => (
                  <tr key={call.id} className="hover:bg-gray-50/50">
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                      {call.createdAt ? format(new Date(call.createdAt), 'MMM dd, yyyy HH:mm') : 'N/A'}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      <div>{call.Lead?.name || 'Unknown Lead'}</div>
                      <div className="text-xs text-gray-400">{call.phoneDialed}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-700">
                      <div className="flex items-center gap-1.5">
                        <span>{call.User?.name || 'BDE'}</span>
                        {call.callerUserId && String(call.callerUserId) !== String(call.userId) && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-800" title="TL called on behalf of BDE">
                            <UserCheck className="h-3 w-3 mr-0.5" /> TL on-behalf
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-900 font-semibold">
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span>{call.connectedTalkTime ? `${call.connectedTalkTime}s` : '0s'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-50 text-blue-800 border border-blue-100">
                        {call.outcome || 'Logged'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      {call.recordingUrl && (
                        <a
                          href={call.recordingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
                        >
                          <Play className="h-3.5 w-3.5" /> Play Audio
                        </a>
                      )}
                      <button
                        onClick={() => handleOpenIntelligence(call)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
                      >
                        <Sparkles className="h-3.5 w-3.5" /> AI Intelligence
                      </button>
                    </td>
                  </tr>
                ))}
                {callLogs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                      No telephony call records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* AI Intelligence Modal */}
      {selectedCall && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-6 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-gray-100 pb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Sparkles className="h-6 w-6 text-purple-600" />
                  AI Call Intelligence & Transcript
                </h2>
                <p className="text-xs text-gray-500">
                  Lead: {selectedCall.Lead?.name || 'Unknown'} | Phone: {selectedCall.phoneDialed}
                </p>
              </div>
              <button
                onClick={() => setSelectedCall(null)}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg px-2"
              >
                ✕
              </button>
            </div>

            {modalLoading ? (
              <div className="p-12 text-center text-gray-400 animate-pulse">
                Analyzing speech audio and generating AI summary...
              </div>
            ) : (
              <div className="space-y-6">
                {/* Sentiment & Intent Summary */}
                {aiAnalysis && (
                  <div className="grid grid-cols-2 gap-4 bg-purple-50/50 p-4 rounded-xl border border-purple-100">
                    <div>
                      <span className="text-xs text-gray-500 font-medium block mb-1">Customer Sentiment</span>
                      {getSentimentBadge(aiAnalysis.sentiment)}
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 font-medium block mb-1">Customer Intent</span>
                      <span className="text-sm font-semibold text-gray-900">{aiAnalysis.customerIntent || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 font-medium block mb-1">Discussed Course</span>
                      <span className="text-sm font-semibold text-gray-900">{aiAnalysis.courseDiscussed || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 font-medium block mb-1">Suggested Follow-up</span>
                      <span className="text-sm font-semibold text-purple-700">{aiAnalysis.suggestedFollowUpAt ? format(new Date(aiAnalysis.suggestedFollowUpAt), 'MMM dd, HH:mm') : 'None'}</span>
                    </div>
                  </div>
                )}

                {/* AI Executive Summary */}
                {aiAnalysis?.summary && (
                  <div>
                    <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Executive Summary</h4>
                    <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-100">
                      {aiAnalysis.summary}
                    </p>
                  </div>
                )}

                {/* Formatted Call Transcript */}
                <div>
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Speech Transcript</h4>
                  {transcript ? (
                    <div className="bg-gray-900 text-gray-100 p-4 rounded-xl text-xs font-mono whitespace-pre-wrap max-h-60 overflow-y-auto leading-relaxed">
                      {transcript.formattedTranscript || transcript.rawTranscript}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400 italic">No transcript recorded for this call.</div>
                  )}
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
