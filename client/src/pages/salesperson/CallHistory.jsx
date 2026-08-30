import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { callAPI } from '../../services/api';
import { Phone, Clock, Play, FileText, Sparkles, UserCheck, CheckCircle2, ShieldAlert, Activity } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import CallLifecycleModal from '../../components/CallLifecycleModal';
import AiIntelligenceDrawer from '../../components/AiIntelligenceDrawer';

const CallHistory = () => {
  const [selectedCall, setSelectedCall] = useState(null);
  const [lifecycleCall, setLifecycleCall] = useState(null);
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

  const renderRecordingBadge = (call, isMobile = false) => {
    const status = call.recordingStatus || (call.recordingUrl ? 'available' : 'unavailable');

    if (status === 'available' && call.recordingUrl) {
      return (
        <div className="inline-flex items-center gap-2">
          {!isMobile && <audio controls className="h-8 w-44" src={call.recordingUrl} />}
          <a
            href={call.recordingUrl}
            target="_blank"
            rel="noreferrer"
            className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-200 flex items-center gap-1"
          >
            <Play className="h-3 w-3" /> PLAY RECORDING
          </a>
        </div>
      );
    }

    if (status === 'processing') {
      return (
        <span className="px-2.5 py-1 text-xs font-semibold text-amber-800 bg-amber-50 rounded-md border border-amber-200 animate-pulse">
          Recording PROCESSING
        </span>
      );
    }

    if (status === 'ambiguous') {
      return (
        <span className="px-2.5 py-1 text-xs font-semibold text-gray-600 bg-gray-100 rounded-md border border-gray-300" title="Multiple candidate recordings found for this call window">
          Multiple recordings found
        </span>
      );
    }

    return (
      <span className="px-2.5 py-1 text-xs text-gray-400 bg-gray-100 rounded-md border border-gray-200">
        Recording UNAVAILABLE
      </span>
    );
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

      {/* Call Records Table (Desktop) & Cards (Mobile) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading && !callLogs.length ? (
          <div className="p-8 text-center text-gray-400 animate-pulse font-medium">Loading call records...</div>
        ) : (
          <>
            {/* DESKTOP TABLE */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase border-b border-gray-200">
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
                  {callLogs.map((call) => {
                    const isRecAvailable = (call.recordingStatus === 'available' || (!call.recordingStatus && call.recordingUrl));
                    return (
                      <tr key={call.id} className="hover:bg-gray-50/50">
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500 text-xs">
                          {call.createdAt ? format(new Date(call.createdAt), 'MMM dd, yyyy HH:mm') : 'N/A'}
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-900">
                          <div>{call.leadName || call.Lead?.name || call.lead?.name || (call.phoneNumber || call.phoneDialed ? `Lead (${call.phoneNumber || call.phoneDialed})` : 'Call Record')}</div>
                          <div className="text-xs text-gray-400">{call.phoneNumber || call.phoneDialed}</div>
                        </td>
                        <td className="px-6 py-4 text-gray-700 text-xs">
                          <div className="flex items-center gap-1.5">
                            <span>{call.User?.name || 'BDE'}</span>
                            {call.callerUserId && String(call.callerUserId) !== String(call.userId) && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-800" title="TL called on behalf of BDE">
                                <UserCheck className="h-3 w-3 mr-0.5" /> TL on-behalf
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-900 font-semibold text-xs">
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4 text-gray-400" />
                            <span>{call.durationSeconds !== undefined ? `${call.durationSeconds}s` : (call.connectedTalkTime ? `${call.connectedTalkTime}s` : '0s')}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-50 text-blue-800 border border-blue-100">
                            {call.disposition || call.outcome || 'Logged'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          {renderRecordingBadge(call, false)}
                          <button
                            onClick={() => handleOpenIntelligence(call)}
                            disabled={!isRecAvailable}
                            className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                              isRecAvailable
                                ? 'text-purple-700 bg-purple-50 hover:bg-purple-100 cursor-pointer'
                                : 'text-gray-400 bg-gray-100 cursor-not-allowed opacity-60'
                            }`}
                            title={isRecAvailable ? 'View AI Transcript & Analysis' : 'AI analysis requires a verified accessible call recording'}
                          >
                            <Sparkles className="h-3.5 w-3.5" /> AI Intelligence
                          </button>
                        </td>
                      </tr>
                    );
                  })}
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

            {/* MOBILE CARDS */}
            <div className="md:hidden space-y-3 p-3 bg-gray-50/50">
              {callLogs.map((call) => {
                const isRecAvailable = (call.recordingStatus === 'available' || (!call.recordingStatus && call.recordingUrl));
                return (
                  <div key={call.id} className="p-3.5 bg-white rounded-xl shadow-sm border border-gray-200 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-gray-900">{call.leadName || call.Lead?.name || call.lead?.name || (call.phoneNumber || call.phoneDialed ? `Lead (${call.phoneNumber || call.phoneDialed})` : 'Call Record')}</h3>
                        <p className="text-xs text-gray-500">{call.phoneNumber || call.phoneDialed}</p>
                      </div>
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-blue-50 text-blue-800 border border-blue-200">
                        {call.disposition || call.outcome || 'Logged'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-600 pt-1 border-t border-gray-100">
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="font-extrabold text-emerald-700">Talk: {call.durationSeconds ? `${Math.floor(call.durationSeconds / 60)}:${(call.durationSeconds % 60).toString().padStart(2, '0')}` : '00:00'}</span>
                        <span className="text-gray-300">•</span>
                        <span className="font-semibold text-gray-700">Total: {call.lifecycleDurationSeconds ? `${Math.floor(call.lifecycleDurationSeconds / 60)}:${(call.lifecycleDurationSeconds % 60).toString().padStart(2, '0')}` : '00:00'}</span>
                      </div>
                      <span className="text-[11px] text-gray-400">
                        {call.createdAt ? format(new Date(call.createdAt), 'MMM dd, HH:mm') : '—'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                      <div className="text-xs text-gray-600 flex items-center gap-1">
                        <span className="font-semibold">{call.User?.name || 'BDE'}</span>
                        {call.callerUserId && String(call.callerUserId) !== String(call.userId) && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-purple-100 text-purple-800">
                            TL on-behalf
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {renderRecordingBadge(call, true)}
                        <button
                          onClick={() => handleOpenIntelligence(call)}
                          disabled={!isRecAvailable}
                          className={`px-2 py-1 text-[11px] font-bold rounded-lg border flex items-center gap-1 ${
                            isRecAvailable
                              ? 'text-purple-700 bg-purple-50 border-purple-200'
                              : 'text-gray-400 bg-gray-100 border-gray-200 opacity-60 cursor-not-allowed'
                          }`}
                        >
                          <Sparkles className="h-3 w-3" /> AI
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {callLogs.length === 0 && (
                <div className="p-6 text-center text-gray-400 text-xs">
                  No telephony call records found.
                </div>
              )}
            </div>
          </>
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

      {/* Call Lifecycle Audit Modal */}
      {lifecycleCall && (
        <CallLifecycleModal
          callLog={lifecycleCall}
          onClose={() => setLifecycleCall(null)}
        />
      )}

      {/* AI Intelligence Drawer */}
      {selectedCall && (
        <AiIntelligenceDrawer
          callLog={selectedCall}
          onClose={() => setSelectedCall(null)}
        />
      )}
    </div>
  );
};

export default CallHistory;
