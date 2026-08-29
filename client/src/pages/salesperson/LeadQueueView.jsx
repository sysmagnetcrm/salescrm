import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { leadAPI, paymentAPI, callAPI, dispositionAPI, startCrmCall } from '../../services/api';
import {
  Phone,
  PhoneOff,
  CheckCircle,
  ArrowRight,
  Save,
  CreditCard,
  RefreshCw,
  MessageCircle,
  Check,
  Zap,
  DollarSign,
  AlertCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format, formatDistanceToNow, isBefore } from 'date-fns';

const LeadQueueView = () => {
  const queryClient = useQueryClient();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeBucket, setActiveBucket] = useState('all');
  const [lastRefreshedAt, setLastRefreshedAt] = useState(new Date());
  const [isPaymentExpanded, setIsPaymentExpanded] = useState(false);

  // Dynamic Dispositions Query
  const { data: dispositions = [] } = useQuery({
    queryKey: ['dispositions'],
    queryFn: () => dispositionAPI.getDispositions().then(r => r.data.data || []),
    staleTime: 300000
  });

  // Working Queue Query with silent 15s background polling & placeholder caching
  const { data: queueResponse, isLoading: loading, isFetching, refetch: refetchQueue } = useQuery({
    queryKey: ['leads', 'queue', activeBucket],
    queryFn: () => leadAPI.getQueue({ bucket: activeBucket }).then(r => {
      setLastRefreshedAt(new Date());
      return r.data;
    }),
    staleTime: 15000,
    refetchInterval: 15000,
    placeholderData: (prev) => prev
  });

  const queue = queueResponse?.data || [];
  const summary = queueResponse?.queueSummary || { missedCount: 0, todayCount: 0, freshCount: 0, totalQueueCount: 0 };

  // Lead Working Form State
  const [status, setStatus] = useState('fresh');
  const [disposition, setDisposition] = useState('');
  const [campus, setCampus] = useState('');
  const [nextFollowUpAt, setNextFollowUpAt] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Calling State Machine (idle | initiating | ringing | connected | completed)
  const [activeCallId, setActiveCallId] = useState(null);
  const [callState, setCallState] = useState('idle');
  const [callTimer, setCallTimer] = useState(0);
  const [calledPhone, setCalledPhone] = useState('');

  // Structured Payment Form State
  const [paymentType, setPaymentType] = useState('admission');
  const [paymentAmount, setPaymentAmount] = useState('1000');
  const [paymentRef, setPaymentRef] = useState('');
  const [recordingPayment, setRecordingPayment] = useState(false);

  const currentLead = queue[currentIndex] || null;

  // Sync form state when current lead changes
  useEffect(() => {
    if (currentLead) {
      setStatus(currentLead.status || 'fresh');
      setCampus(currentLead.campus || '');
      setNotes(currentLead.notes || '');
      setDisposition(currentLead.disposition || '');
      setNextFollowUpAt(
        currentLead.nextFollowUpAt
          ? new Date(currentLead.nextFollowUpAt).toISOString().slice(0, 16)
          : ''
      );
      setSaveError(null);
    }
  }, [currentLead]);

  // Call timer interval for live connected talk-time
  useEffect(() => {
    let interval;
    if (callState === 'connected') {
      interval = setInterval(() => {
        setCallTimer(prev => prev + 1);
      }, 1000);
    } else {
      setCallTimer(0);
    }
    return () => clearInterval(interval);
  }, [callState]);

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getWhatsAppNumber = (phone) => {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) return `91${digits}`;
    return digits;
  };

  const ensureE164 = (phone) => {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) return `+91${digits}`;
    return `+${digits}`;
  };

  // Start Call Handler
  const handleStartCall = async (phone) => {
    if (!currentLead || callState !== 'idle') return;
    setCalledPhone(phone);
    setCallState('initiating');

    try {
      const callData = await startCrmCall({ ...currentLead, phone });
      if (callData?.id) {
        setActiveCallId(callData.id);
        setCallState('ringing');

        setTimeout(async () => {
          setCallState('connected');
          await callAPI.updateCallState(callData.id, {
            callStatus: 'connected',
            connectedAt: new Date()
          }).catch(() => {});
        }, 3000);
      }
    } catch (err) {
      setCallState('idle');
      toast.error('Failed to initiate CRM call');
    }
  };

  const [lastCompletedCall, setLastCompletedCall] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);

  // End Call Handler
  const handleEndCall = async (dispositionOutcome = 'completed') => {
    if (!activeCallId) {
      setCallState('idle');
      return;
    }
    const endingCallId = activeCallId;
    const talkSecs = callTimer;
    try {
      const res = await callAPI.updateCallState(endingCallId, {
        callStatus: dispositionOutcome,
        endedAt: new Date(),
        disposition: disposition || status,
        notes
      });
      const updatedLog = res.data?.data;
      setLastCompletedCall({
        id: endingCallId,
        talkTimeSeconds: updatedLog?.durationSeconds ?? talkSecs,
        lifecycleSeconds: updatedLog?.lifecycleDurationSeconds ?? (talkSecs + 5),
        endedAt: updatedLog?.endedAt ? new Date(updatedLog.endedAt) : new Date(),
        phone: calledPhone,
        startedAt: updatedLog?.startedAt,
        ringingAt: updatedLog?.ringingAt,
        connectedAt: updatedLog?.connectedAt
      });
      if (window.AndroidCRM?.stopAndUploadCallRecording && endingCallId) {
        const token = localStorage.getItem('token') || '';
        const uploadUrl = `${window.location.origin}/api/calls/${endingCallId}/upload-audio`;
        window.AndroidCRM.stopAndUploadCallRecording(endingCallId, uploadUrl, token);
      }

      toast.success('Call logged successfully.');
    } catch (err) {
      toast.error('Error logging call outcome');
    } finally {
      setActiveCallId(null);
      setCallState('idle');
    }
  };

  // AI Call Intelligence Trigger Handler
  const handleTriggerAI = async () => {
    if (!lastCompletedCall?.id) {
      toast.error('No recent call record found to analyze.');
      return;
    }
    setAiAnalyzing(true);
    setAiAnalysis(null);
    try {
      await callAPI.triggerAIAnalysis(lastCompletedCall.id);
      toast.success('AI Call Analysis initiated asynchronously (202 Accepted)');
      
      // Poll for AI results
      setTimeout(async () => {
        try {
          const res = await callAPI.getCallAIAnalysis(lastCompletedCall.id);
          if (res.data?.success) {
            setAiAnalysis(res.data.data);
            toast.success('AI Call Intelligence ready');
          }
        } catch (e) {
          toast.error('AI analysis still processing');
        } finally {
          setAiAnalyzing(false);
        }
      }, 2000);
    } catch (err) {
      toast.error(err.response?.data?.message || 'AI analysis could not be completed. Please retry.');
      setAiAnalyzing(false);
    }
  };

  // Handle Save Lead (Save vs Save & Next)
  const handleSaveLead = async (advanceNext = false) => {
    if (!currentLead) return;
    setSaving(true);
    setSaveError(null);

    const requiresFollowUp = status === 'follow-up' || disposition.toLowerCase().includes('follow-up') || disposition.toLowerCase().includes('callback');
    if (requiresFollowUp && !nextFollowUpAt) {
      const errMsg = 'Please specify Next Follow-up Date & Time before saving.';
      setSaveError(errMsg);
      toast.error(errMsg);
      setSaving(false);
      return;
    }

    const payload = {
      status,
      disposition,
      campus,
      nextFollowUpAt: nextFollowUpAt ? new Date(nextFollowUpAt).toISOString() : null,
      notes
    };

    try {
      await leadAPI.updateLead(currentLead.id, payload);
      toast.success(advanceNext ? 'Lead saved. Moving to next lead...' : 'Lead saved successfully');

      if (advanceNext) {
        if (currentIndex < queue.length - 1) {
          setCurrentIndex(prev => prev + 1);
        } else {
          toast.success('Queue processing complete!');
          await refetchQueue();
        }
      }
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (err) {
      const msg = err.response?.data?.message || 'Unable to save lead. Please retry.';
      setSaveError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // Handle Recording Structured Payment
  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!currentLead) return;
    setRecordingPayment(true);

    try {
      const amt = parseFloat(paymentAmount);
      if (isNaN(amt) || amt <= 0) {
        toast.error('Please enter a valid positive payment amount');
        setRecordingPayment(false);
        return;
      }

      const res = await paymentAPI.recordPayment({
        leadId: currentLead.id,
        paymentType,
        amount: amt,
        referenceId: paymentRef,
        notes: `Recorded ${paymentType} fee`
      });

      if (res.data?.success) {
        toast.success(res.data.message);
        setPaymentRef('');
        queryClient.invalidateQueries({ queryKey: ['leads'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record payment');
    } finally {
      setRecordingPayment(false);
    }
  };

  const isMissedFollowUp = (lead) => {
    if (!lead?.nextFollowUpAt) return false;
    return isBefore(new Date(lead.nextFollowUpAt), new Date());
  };

  if (loading && !queue.length) {
    return (
      <div className="p-8 text-center text-gray-400 animate-pulse font-medium">
        Loading Working Queue...
      </div>
    );
  }

  return (
    <div className="space-y-3 max-w-4xl mx-auto pb-24 md:pb-8">
      {/* 1. COMPACT OPERATIONAL QUEUE HEADER */}
      <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-gray-200 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-base md:text-lg font-black text-gray-900 tracking-tight uppercase flex items-center gap-1.5">
              <Zap className="h-4.5 w-4.5 text-primary-600" />
              WORKING QUEUE
            </h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] md:text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              {lastRefreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          <button
            onClick={() => refetchQueue()}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {/* Compact Horizontal Stat Cards */}
        <div className="grid grid-cols-4 gap-1.5 pt-1.5 border-t border-gray-100">
          <button
            onClick={() => { setActiveBucket('missed-followup'); setCurrentIndex(0); }}
            className={`p-2 rounded-lg text-left transition-all border flex flex-col justify-between h-[58px] ${
              activeBucket === 'missed-followup'
                ? 'bg-red-50 border-red-500 text-red-900 font-bold shadow-sm'
                : 'bg-gray-50/80 border-gray-200 text-gray-700 hover:bg-gray-100'
            }`}
          >
            <span className="text-[10px] font-bold text-gray-500 uppercase">Missed</span>
            <span className="text-base font-black text-red-600 leading-none">{summary.missedCount}</span>
          </button>

          <button
            onClick={() => { setActiveBucket('followup-today'); setCurrentIndex(0); }}
            className={`p-2 rounded-lg text-left transition-all border flex flex-col justify-between h-[58px] ${
              activeBucket === 'followup-today'
                ? 'bg-orange-50 border-orange-500 text-orange-900 font-bold shadow-sm'
                : 'bg-gray-50/80 border-gray-200 text-gray-700 hover:bg-gray-100'
            }`}
          >
            <span className="text-[10px] font-bold text-gray-500 uppercase">Due</span>
            <span className="text-base font-black text-orange-600 leading-none">{summary.todayCount}</span>
          </button>

          <button
            onClick={() => { setActiveBucket('fresh'); setCurrentIndex(0); }}
            className={`p-2 rounded-lg text-left transition-all border flex flex-col justify-between h-[58px] ${
              activeBucket === 'fresh'
                ? 'bg-blue-50 border-blue-500 text-blue-900 font-bold shadow-sm'
                : 'bg-gray-50/80 border-gray-200 text-gray-700 hover:bg-gray-100'
            }`}
          >
            <span className="text-[10px] font-bold text-gray-500 uppercase">New</span>
            <span className="text-base font-black text-blue-600 leading-none">{summary.freshCount}</span>
          </button>

          <button
            onClick={() => { setActiveBucket('all'); setCurrentIndex(0); }}
            className={`p-2 rounded-lg text-left transition-all border flex flex-col justify-between h-[58px] ${
              activeBucket === 'all'
                ? 'bg-gray-900 border-gray-900 text-white font-bold shadow-sm'
                : 'bg-gray-50/80 border-gray-200 text-gray-700 hover:bg-gray-100'
            }`}
          >
            <span className="text-[10px] font-bold text-gray-400 uppercase">Total</span>
            <span className="text-base font-black leading-none">{summary.totalQueueCount}</span>
          </button>
        </div>
      </div>

      {/* 2. EMPTY STATE (WHEN QUEUE COMPLETE) */}
      {!currentLead ? (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm text-center max-w-md mx-auto my-6 space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">✓ Queue Complete</h3>
            <p className="text-xs text-gray-500 mt-1">All eligible leads in the <strong>{activeBucket}</strong> queue have been processed.</p>
          </div>
          <button
            onClick={() => { setActiveBucket('all'); refetchQueue(); }}
            className="px-4 py-2 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-lg transition-colors inline-flex items-center gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh Queue
          </button>
        </div>
      ) : (
        /* 3. ACTIVE LEAD WORKSPACE */
        <div className="space-y-3">
          {/* Single Row Progress Counter */}
          <div className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700">
            <button
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
              className="px-2.5 py-1 border rounded-lg hover:bg-gray-50 disabled:opacity-30 text-xs font-bold transition-colors"
            >
              ‹ Prev
            </button>
            <div className="flex items-center gap-1 text-xs">
              <span className="text-gray-400 font-bold uppercase text-[10px]">Lead</span>
              <span className="font-black text-gray-900 px-2 py-0.5 bg-gray-100 rounded-md">
                {currentIndex + 1} of {queue.length}
              </span>
            </div>
            <button
              disabled={currentIndex >= queue.length - 1}
              onClick={() => setCurrentIndex(prev => Math.min(queue.length - 1, prev + 1))}
              className="px-2.5 py-1 border rounded-lg hover:bg-gray-50 disabled:opacity-30 text-xs font-bold transition-colors"
            >
              Next ›
            </button>
          </div>

          {/* HIGH DENSITY LEAD CARD */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden space-y-3 p-4">
            
            {/* Header: Name, Status badge, Source & Direct Phone links */}
            <div className="space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 leading-tight">{currentLead.name}</h2>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                    <span className="font-semibold">{currentLead.product || 'Data Science'}</span>
                    <span>•</span>
                    <span>{currentLead.country || 'India'}</span>
                    <span>•</span>
                    <span>{currentLead.campus || 'Kochi'}</span>
                  </div>
                </div>
                <div>
                  {isMissedFollowUp(currentLead) ? (
                    <span className="px-2 py-0.5 text-[10px] font-black rounded-md bg-red-100 text-red-800 border border-red-200 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> MISSED
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-blue-50 text-blue-800 border border-blue-200 uppercase">
                      {currentLead.status || 'FRESH'}
                    </span>
                  )}
                </div>
              </div>

              {/* Direct Phone & WhatsApp Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <a
                  href={`tel:${ensureE164(currentLead.phone)}`}
                  className="flex-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-900 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors border border-gray-200"
                >
                  <Phone className="h-3.5 w-3.5 text-gray-600" />
                  <span>{currentLead.phone}</span>
                </a>
                <a
                  href={`https://wa.me/${getWhatsAppNumber(currentLead.phone)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors border border-emerald-200 shrink-0"
                >
                  <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
                  <span>WhatsApp</span>
                </a>
              </div>
            </div>

            {/* CALL ACTION & LIVE TELEPHONY STATE */}
            <div className="pt-2 border-t border-gray-100 space-y-2">
              {callState === 'idle' ? (
                <div className="space-y-2">
                  <button
                    onClick={() => handleStartCall(currentLead.phone)}
                    className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-black text-sm tracking-wide transition-all shadow hover:shadow-md active:scale-98 flex items-center justify-center gap-2"
                  >
                    <Phone className="h-4.5 w-4.5" />
                    <span>☎ CALL NOW</span>
                  </button>

                  {/* POST-CALL SUMMARY CARD (WHEN LAST CALL COMPLETED) */}
                  {lastCompletedCall && (
                    <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2 text-xs">
                      <div className="flex items-center justify-between border-b border-emerald-200/60 pb-1.5">
                        <span className="font-black text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                          CALL COMPLETED ({lastCompletedCall.endedAt ? format(new Date(lastCompletedCall.endedAt), 'hh:mm a') : 'Just now'})
                        </span>
                        <button
                          type="button"
                          disabled={aiAnalyzing}
                          onClick={handleTriggerAI}
                          className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-colors flex items-center gap-1 text-[11px] shadow-sm disabled:opacity-50"
                        >
                          <Zap className="h-3 w-3" />
                          <span>{aiAnalyzing ? 'Analyzing...' : '⚡ AI ANALYZE CALL'}</span>
                        </button>
                      </div>

                      {/* Duration Breakdown (Authoritative Timestamps) */}
                      <div className="grid grid-cols-2 gap-2 text-center py-1">
                        <div className="bg-white p-2 rounded-lg border border-emerald-100">
                          <span className="text-[10px] font-bold text-gray-500 uppercase block">Talk Time</span>
                          <span className="text-sm font-black text-emerald-700">{formatTimer(lastCompletedCall.talkTimeSeconds || 0)}</span>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-emerald-100">
                          <span className="text-[10px] font-bold text-gray-500 uppercase block">Total Call Time</span>
                          <span className="text-sm font-black text-gray-900">{formatTimer(lastCompletedCall.lifecycleSeconds || 0)}</span>
                        </div>
                      </div>

                      {/* AI Intelligence Insights (When Available) */}
                      {aiAnalysis && (
                        <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-lg space-y-2 text-xs text-gray-800">
                          <div className="flex items-center justify-between font-bold text-purple-900 border-b border-purple-200/60 pb-1">
                            <span className="flex items-center gap-1">
                              <Zap className="h-3.5 w-3.5 text-purple-600" /> AI Call Intelligence
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-purple-200 text-purple-900 uppercase">
                              {aiAnalysis.sentiment || 'Positive'}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                            <div><strong>Intent:</strong> {aiAnalysis.customerIntent || 'Admission Enquiry'}</div>
                            <div><strong>Interest:</strong> <span className="text-emerald-700 font-bold">{aiAnalysis.interestLevel || 'HIGH'}</span></div>
                            <div><strong>Discussed:</strong> {aiAnalysis.courseDiscussed || 'Data Science'}</div>
                            <div><strong>Suggested Follow-up:</strong> {aiAnalysis.suggestedFollowUpAt ? format(new Date(aiAnalysis.suggestedFollowUpAt), 'MMM dd, HH:mm') : 'Tomorrow'}</div>
                          </div>

                          {aiAnalysis.summary && (
                            <p className="text-[11px] italic bg-white p-2 rounded border border-purple-100">
                              "{aiAnalysis.summary}"
                            </p>
                          )}

                          {aiAnalysis.suggestedDisposition && (
                            <div className="flex items-center justify-between pt-1 border-t border-purple-200/60">
                              <span className="text-[11px] font-bold text-purple-900">
                                Suggested: <span className="underline">{aiAnalysis.suggestedDisposition}</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => setDisposition(aiAnalysis.suggestedDisposition)}
                                className="px-2 py-0.5 bg-purple-700 text-white text-[10px] font-extrabold rounded hover:bg-purple-800 transition-colors"
                              >
                                Apply AI Disposition
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-red-700 uppercase tracking-wider animate-pulse flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
                      {callState === 'connected' ? `CONNECTED ${formatTimer(callTimer)}` : 'RINGING...'}
                    </span>
                    <button
                      onClick={() => handleEndCall('completed')}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-md flex items-center gap-1 transition-colors"
                    >
                      <PhoneOff className="h-3.5 w-3.5" />
                      <span>END CALL</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* DISPOSITION SELECTION CHIPS */}
            <div className="pt-2 border-t border-gray-100 space-y-1.5">
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                Call Disposition Outcome
              </label>
              <div className="flex flex-wrap gap-1.5">
                {(dispositions.length > 0 ? dispositions : [
                  { label: 'Interested', category: 'connected' },
                  { label: 'Follow-up Required', category: 'callback' },
                  { label: 'Call Back Requested', category: 'callback' },
                  { label: 'RNR', category: 'no_answer' },
                  { label: 'Busy', category: 'busy' },
                  { label: 'No Answer', category: 'no_answer' },
                  { label: 'Registered', category: 'registered' },
                  { label: 'Not Interested', category: 'not_interested' },
                  { label: 'Wrong Number', category: 'other' },
                  { label: 'Duplicate Lead', category: 'other' }
                ]).map((d) => {
                  const isSelected = disposition === d.label;
                  return (
                    <button
                      key={d.label}
                      type="button"
                      onClick={() => {
                        setDisposition(d.label);
                        if (d.category === 'registered') setStatus('registered');
                        else if (d.requiresFollowUp || d.category === 'callback' || d.label.toLowerCase().includes('follow-up') || d.label.toLowerCase().includes('call back')) {
                          setStatus('follow-up');
                        }
                      }}
                      className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-all flex items-center gap-1 ${
                        isSelected
                          ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                      <span>{d.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* FOLLOW-UP & FORM INPUTS */}
            <div className="pt-2 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-2.5 py-1.5 border rounded-lg text-xs font-medium bg-white"
                >
                  <option value="fresh">Fresh</option>
                  <option value="follow-up">Follow-up Required</option>
                  <option value="registered">Registered</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase mb-1">Campus</label>
                <select
                  value={campus}
                  onChange={(e) => setCampus(e.target.value)}
                  className="w-full px-2.5 py-1.5 border rounded-lg text-xs font-medium bg-white"
                >
                  <option value="Kochi">Kochi</option>
                  <option value="Chennai">Chennai</option>
                </select>
              </div>

              <div className={(status === 'follow-up' || disposition.toLowerCase().includes('follow-up') || disposition.toLowerCase().includes('call back')) ? 'ring-2 ring-primary-500 rounded-lg p-0.5' : ''}>
                <label className="block text-[10px] font-bold text-gray-700 uppercase mb-1">
                  Next Follow-up Date & Time {(status === 'follow-up' || disposition.toLowerCase().includes('follow-up') || disposition.toLowerCase().includes('call back')) && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="datetime-local"
                  value={nextFollowUpAt}
                  onChange={(e) => setNextFollowUpAt(e.target.value)}
                  className={`w-full px-2.5 py-1.5 border rounded-lg text-xs font-medium bg-white ${saveError && !nextFollowUpAt ? 'border-red-500' : ''}`}
                />
              </div>
            </div>

            {/* CALL NOTES */}
            <div className="pt-2 border-t border-gray-100">
              <label className="block text-[10px] font-bold text-gray-700 uppercase mb-1">Call Notes</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add call notes, objections, or next steps..."
                className="w-full px-3 py-2 border rounded-lg text-xs bg-white focus:ring-1 focus:ring-primary-500"
              />
            </div>

            {/* COLLAPSIBLE STRUCTURED PAYMENT WIDGET */}
            <div className="pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsPaymentExpanded(prev => !prev)}
                className="w-full flex items-center justify-between p-2.5 bg-gray-50 hover:bg-gray-100 rounded-lg text-xs font-bold text-gray-800 border border-gray-200 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary-600" />
                  <span>Structured Payment Entry</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-700 font-extrabold">₹{(currentLead.paidAmount || 0).toLocaleString('en-IN')}</span>
                  {isPaymentExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </button>

              {isPaymentExpanded && (
                <form onSubmit={handleRecordPayment} className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2.5">
                  <select
                    value={paymentType}
                    onChange={(e) => setPaymentType(e.target.value)}
                    className="px-2.5 py-1.5 border rounded-lg text-xs font-medium bg-white"
                  >
                    <option value="admission">Admission Fee</option>
                    <option value="orientation">Orientation Fee</option>
                    <option value="tuition">Tuition Fee</option>
                  </select>

                  <input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="px-2.5 py-1.5 border rounded-lg text-xs font-bold bg-white"
                    placeholder="Amount ₹"
                    min="1"
                  />

                  <input
                    type="text"
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    className="px-2.5 py-1.5 border rounded-lg text-xs bg-white"
                    placeholder="UPI / Reference ID"
                  />

                  <button
                    type="submit"
                    disabled={recordingPayment}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1"
                  >
                    <DollarSign className="h-3.5 w-3.5" />
                    <span>{recordingPayment ? 'Recording...' : 'Record Payment'}</span>
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* STICKY BOTTOM SAVE ACTION BAR */}
          <div className="fixed bottom-14 left-0 right-0 p-3 bg-white/95 backdrop-blur-md border-t border-gray-200 z-30 shadow-lg md:static md:p-0 md:bg-transparent md:border-0 md:shadow-none">
            <div className="max-w-4xl mx-auto flex items-center justify-end gap-3 px-3 md:px-0">
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSaveLead(false)}
                className="flex-1 md:flex-none px-4 py-2.5 border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Save className="h-4 w-4 text-gray-500" />
                <span>{saving ? 'Saving...' : 'SAVE'}</span>
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={() => handleSaveLead(true)}
                className="flex-1 md:flex-none px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-black transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-md hover:shadow-lg active:scale-98"
              >
                <span>{saving ? 'Processing...' : 'SAVE & NEXT'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadQueueView;
