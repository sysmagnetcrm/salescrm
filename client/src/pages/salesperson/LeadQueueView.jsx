import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { leadAPI, paymentAPI, callAPI, dispositionAPI } from '../../services/api';
import {
  Phone,
  PhoneOff,
  Calendar,
  CheckCircle,
  Clock,
  ArrowRight,
  Save,
  AlertTriangle,
  CreditCard,
  RefreshCw,
  MessageCircle,
  Check,
  Zap,
  DollarSign,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format, formatDistanceToNow, isBefore } from 'date-fns';

const LeadQueueView = () => {
  const queryClient = useQueryClient();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeBucket, setActiveBucket] = useState('all');
  const [lastRefreshedAt, setLastRefreshedAt] = useState(new Date());

  // Dynamic Dispositions Query
  const { data: dispositions = [] } = useQuery({
    queryKey: ['dispositions'],
    queryFn: () => dispositionAPI.getDispositions().then(r => r.data.data || []),
    staleTime: 300000
  });

  // Working Queue Query with silent 15s background polling
  const { data: queueResponse, isLoading: loading, refetch: refetchQueue } = useQuery({
    queryKey: ['leads', 'queue', activeBucket],
    queryFn: () => leadAPI.getQueue({ bucket: activeBucket }).then(r => {
      setLastRefreshedAt(new Date());
      return r.data;
    }),
    staleTime: 15000,
    refetchInterval: 15000
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

  // Format seconds to MM:SS
  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Helper for E.164 phone formatting
  const ensureE164 = (phone) => {
    if (!phone) return '';
    const raw = String(phone).trim();
    if (raw.startsWith('+')) return `+${raw.replace(/[^0-9]/g, '')}`;
    const digits = raw.replace(/[^0-9]/g, '');
    return `+91${digits}`;
  };

  const getWhatsAppNumber = (phone) => {
    return ensureE164(phone).replace(/\D/g, '');
  };

  // One-Click Calling Handler
  const handleStartCall = async (phoneToCall) => {
    if (!currentLead || callState !== 'idle') return;
    const targetPhone = phoneToCall || currentLead.phone;
    setCalledPhone(targetPhone);
    setCallState('initiating');

    try {
      const res = await callAPI.logCall({
        leadId: currentLead.id,
        callDirection: 'outbound',
        callStatus: 'initiated',
        phoneNumber: targetPhone
      });

      if (res.data?.success && res.data.data) {
        setActiveCallId(res.data.data.id);
        setCallState('ringing');
        toast.success(`Dialing ${targetPhone}...`);
        
        setTimeout(() => {
          setCallState('connected');
        }, 1500);
      }
    } catch (err) {
      setCallState('idle');
      toast.error('Failed to initiate call');
    }
  };

  // End Call Handler
  const handleEndCall = async (dispositionOutcome = 'completed') => {
    if (!activeCallId) {
      setCallState('idle');
      return;
    }
    try {
      await callAPI.updateCallState(activeCallId, {
        callStatus: dispositionOutcome,
        endedAt: new Date(),
        disposition: disposition || status,
        notes
      });
      toast.success('Call logged successfully.');
    } catch (err) {
      toast.error('Error logging call outcome');
    } finally {
      setActiveCallId(null);
      setCallState('idle');
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
    <div className="space-y-4 max-w-6xl mx-auto pb-12">
      {/* 1. COMPACT OPERATIONAL HEADER */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-black text-gray-900 tracking-tight uppercase flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary-600" />
              WORKING QUEUE
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              Synced {lastRefreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>

          <button
            onClick={() => refetchQueue()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>

        {/* Operational Counter Chips */}
        <div className="grid grid-cols-4 gap-2 pt-2 border-t border-gray-100">
          <button
            onClick={() => { setActiveBucket('missed-followup'); setCurrentIndex(0); }}
            className={`px-3 py-2 rounded-lg text-left transition-all border flex items-center justify-between ${
              activeBucket === 'missed-followup'
                ? 'bg-red-50 border-red-500 text-red-900 font-bold shadow-sm'
                : 'bg-gray-50/80 border-gray-200 text-gray-700 hover:bg-gray-100'
            }`}
          >
            <span className="text-xs font-semibold">Missed</span>
            <span className="text-sm font-black text-red-600">{summary.missedCount}</span>
          </button>

          <button
            onClick={() => { setActiveBucket('followup-today'); setCurrentIndex(0); }}
            className={`px-3 py-2 rounded-lg text-left transition-all border flex items-center justify-between ${
              activeBucket === 'followup-today'
                ? 'bg-orange-50 border-orange-500 text-orange-900 font-bold shadow-sm'
                : 'bg-gray-50/80 border-gray-200 text-gray-700 hover:bg-gray-100'
            }`}
          >
            <span className="text-xs font-semibold">Due Today</span>
            <span className="text-sm font-black text-orange-600">{summary.todayCount}</span>
          </button>

          <button
            onClick={() => { setActiveBucket('fresh'); setCurrentIndex(0); }}
            className={`px-3 py-2 rounded-lg text-left transition-all border flex items-center justify-between ${
              activeBucket === 'fresh'
                ? 'bg-blue-50 border-blue-500 text-blue-900 font-bold shadow-sm'
                : 'bg-gray-50/80 border-gray-200 text-gray-700 hover:bg-gray-100'
            }`}
          >
            <span className="text-xs font-semibold">New</span>
            <span className="text-sm font-black text-blue-600">{summary.freshCount}</span>
          </button>

          <button
            onClick={() => { setActiveBucket('all'); setCurrentIndex(0); }}
            className={`px-3 py-2 rounded-lg text-left transition-all border flex items-center justify-between ${
              activeBucket === 'all'
                ? 'bg-gray-900 border-gray-900 text-white font-bold shadow-sm'
                : 'bg-gray-50/80 border-gray-200 text-gray-700 hover:bg-gray-100'
            }`}
          >
            <span className="text-xs font-semibold">Total</span>
            <span className="text-sm font-black">{summary.totalQueueCount}</span>
          </button>
        </div>
      </div>

      {/* 2. COMPACT EMPTY STATE (WHEN QUEUE COMPLETE) */}
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
        /* 3. ACTIVE LEAD WORKSPACE (TWO-COLUMN DESKTOP LAYOUT) */
        <div className="space-y-4">
          {/* Queue Progress Counter */}
          <div className="flex items-center justify-between bg-white px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600">
            <div className="flex items-center gap-2">
              <span className="text-gray-400 uppercase tracking-wider font-bold">Progress:</span>
              <span className="px-2.5 py-0.5 rounded-md bg-gray-100 text-gray-900 font-bold">
                Lead {currentIndex + 1} of {queue.length}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                className="px-2.5 py-1 border rounded-md hover:bg-gray-50 disabled:opacity-30 text-xs font-bold"
              >
                ← Prev
              </button>
              <button
                disabled={currentIndex >= queue.length - 1}
                onClick={() => setCurrentIndex(prev => Math.min(queue.length - 1, prev + 1))}
                className="px-2.5 py-1 border rounded-md hover:bg-gray-50 disabled:opacity-30 text-xs font-bold"
              >
                Next →
              </button>
            </div>
          </div>

          {/* TWO COLUMN WORKSPACE CARD */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-gray-200">
              
              {/* LEFT COLUMN: LEAD INFORMATION */}
              <div className="md:col-span-7 p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{currentLead.name}</h2>
                    <p className="text-xs text-gray-500 font-medium">Source: {currentLead.source || 'Website'}</p>
                  </div>
                  <div>
                    {isMissedFollowUp(currentLead) ? (
                      <span className="px-2.5 py-1 text-[11px] font-black rounded-md bg-red-100 text-red-800 border border-red-200 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> MISSED FOLLOW-UP
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 text-[11px] font-bold rounded-md bg-blue-50 text-blue-800 border border-blue-200 uppercase">
                        {currentLead.status || 'FRESH'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                    <span className="text-gray-400 block text-[10px] font-bold uppercase">Phone Number</span>
                    <span className="font-bold text-gray-900">{currentLead.phone}</span>
                  </div>
                  <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                    <span className="text-gray-400 block text-[10px] font-bold uppercase">Target Course</span>
                    <span className="font-bold text-primary-700">{currentLead.product || 'Data Science'}</span>
                  </div>
                  <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                    <span className="text-gray-400 block text-[10px] font-bold uppercase">Campus</span>
                    <span className="font-bold text-gray-900">{currentLead.campus || 'Kochi'}</span>
                  </div>
                  <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                    <span className="text-gray-400 block text-[10px] font-bold uppercase">Country</span>
                    <span className="font-bold text-gray-900">{currentLead.country || 'India'}</span>
                  </div>
                </div>

                {/* Direct Action Links (Tel / WhatsApp) */}
                <div className="flex items-center gap-2 pt-1">
                  <a
                    href={`tel:${ensureE164(currentLead.phone)}`}
                    className="flex-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors border border-gray-200"
                  >
                    <Phone className="h-3.5 w-3.5 text-gray-600" />
                    Dial Tel
                  </a>
                  <a
                    href={`https://wa.me/${getWhatsAppNumber(currentLead.phone)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors border border-emerald-200"
                  >
                    <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
                    WhatsApp
                  </a>
                </div>
              </div>

              {/* RIGHT COLUMN: CALL CONTROLS & STATE MACHINE */}
              <div className="md:col-span-5 p-5 bg-gray-50/50 flex flex-col justify-between space-y-4">
                <div>
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Telephony Control</div>
                  
                  {callState === 'idle' ? (
                    <button
                      onClick={() => handleStartCall(currentLead.phone)}
                      className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-black text-sm tracking-wide transition-all shadow-sm hover:shadow active:scale-95 flex items-center justify-center gap-2"
                    >
                      <Phone className="h-4 w-4" />
                      CALL NOW
                    </button>
                  ) : (
                    <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-red-700 uppercase tracking-wider animate-pulse">
                          {callState === 'connected' ? `CONNECTED ${formatTimer(callTimer)}` : 'RINGING...'}
                        </span>
                        <button
                          onClick={() => handleEndCall('completed')}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-md flex items-center gap-1 transition-colors"
                        >
                          <PhoneOff className="h-3.5 w-3.5" />
                          END CALL
                        </button>
                      </div>
                      <p className="text-[11px] text-gray-500">Dialed: {calledPhone}</p>
                    </div>
                  )}
                </div>

                {/* Overdue Follow-up alert if present */}
                {currentLead.nextFollowUpAt && (
                  <div className="p-2.5 rounded-lg bg-gray-100 text-[11px] text-gray-600">
                    <span className="font-bold text-gray-700 block">Scheduled Follow-up:</span>
                    {format(new Date(currentLead.nextFollowUpAt), 'MMM dd, yyyy HH:mm')} ({formatDistanceToNow(new Date(currentLead.nextFollowUpAt), { addSuffix: true })})
                  </div>
                )}
              </div>
            </div>

            {/* BOTTOM SECTION: DISPOSITION, FOLLOW-UP, NOTES & ACTIONS */}
            <div className="p-5 border-t border-gray-200 space-y-4">
              
              {/* Disposition Chips */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  Call Disposition Outcome
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {(dispositions.length > 0 ? dispositions : [
                    { label: 'Interested', category: 'connected' },
                    { label: 'Follow-up', category: 'callback' },
                    { label: 'RNR', category: 'no_answer' },
                    { label: 'Busy', category: 'busy' },
                    { label: 'Not Interested', category: 'not_interested' },
                    { label: 'Registered', category: 'registered' },
                    { label: 'Dead', category: 'other' }
                  ]).map((d) => {
                    const isSelected = disposition === d.label;
                    return (
                      <button
                        key={d.label}
                        type="button"
                        onClick={() => {
                          setDisposition(d.label);
                          if (d.category === 'registered') setStatus('registered');
                          else if (d.requiresFollowUp || d.category === 'callback' || d.label.toLowerCase().includes('follow-up')) {
                            setStatus('follow-up');
                          }
                        }}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all flex items-center gap-1 ${
                          isSelected
                            ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                            : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Follow-up & Form Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-xs font-medium bg-white"
                  >
                    <option value="fresh">Fresh</option>
                    <option value="follow-up">Follow-up Required</option>
                    <option value="registered">Registered</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">Campus</label>
                  <select
                    value={campus}
                    onChange={(e) => setCampus(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-xs font-medium bg-white"
                  >
                    <option value="Kochi">Kochi</option>
                    <option value="Chennai">Chennai</option>
                  </select>
                </div>

                <div className={(status === 'follow-up' || disposition.toLowerCase().includes('follow-up')) ? 'ring-2 ring-primary-500 rounded-lg p-0.5' : ''}>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">
                    Next Follow-up Date & Time {(status === 'follow-up' || disposition.toLowerCase().includes('follow-up')) && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="datetime-local"
                    value={nextFollowUpAt}
                    onChange={(e) => setNextFollowUpAt(e.target.value)}
                    className={`w-full px-3 py-1.5 border rounded-lg text-xs font-medium bg-white ${saveError && !nextFollowUpAt ? 'border-red-500' : ''}`}
                  />
                </div>
              </div>

              {/* Call Notes */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">Call Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Enter student interaction notes, objections, or next steps..."
                  className="w-full px-3 py-2 border rounded-lg text-xs bg-white"
                />
              </div>

              {/* Action Buttons: SAVE vs SAVE & NEXT */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSaveLead(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-100 rounded-lg text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Save className="h-3.5 w-3.5" />
                  {saving ? 'Saving...' : 'SAVE'}
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSaveLead(true)}
                  className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-black transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-md hover:shadow-lg active:scale-95"
                >
                  <span>{saving ? 'Processing...' : 'SAVE & NEXT'}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* STRUCTURED PAYMENT TRACKING WIDGET */}
            <div className="p-4 bg-gray-50 border-t border-gray-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-900">
                  <CreditCard className="h-4 w-4 text-primary-600" />
                  <span>Structured Payment Entry</span>
                </div>
                <div className="text-xs font-bold text-gray-700">
                  Cleared: <span className="text-emerald-600">₹{(currentLead.paidAmount || 0).toLocaleString('en-IN')}</span>
                </div>
              </div>

              <form onSubmit={handleRecordPayment} className="grid grid-cols-1 sm:grid-cols-4 gap-2">
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
                  {recordingPayment ? 'Recording...' : 'Record Payment'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadQueueView;
