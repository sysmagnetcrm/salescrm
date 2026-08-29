import { useState, useEffect, useCallback, useRef } from 'react';
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
  Building,
  RefreshCw,
  UserCheck,
  ChevronRight,
  ChevronLeft,
  Wifi,
  Sparkles,
  DollarSign
} from 'lucide-react';
import toast from 'react-hot-toast';

const LeadQueueView = () => {
  const [queue, setQueue] = useState([]);
  const [summary, setSummary] = useState({ missedCount: 0, todayCount: 0, freshCount: 0, totalQueueCount: 0 });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeBucket, setActiveBucket] = useState('all');
  const [loading, setLoading] = useState(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(new Date());

  // Dynamic Dispositions
  const [dispositions, setDispositions] = useState([]);

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

  // Fetch Available Dispositions
  useEffect(() => {
    const fetchDispositionsList = async () => {
      try {
        const res = await dispositionAPI.getDispositions();
        if (res.data?.success) {
          setDispositions(res.data.data);
        }
      } catch (err) {
        console.error('Failed to load disposition list:', err);
      }
    };
    fetchDispositionsList();
  }, []);

  // Fetch Deterministic BDE Working Queue
  const fetchQueue = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const res = await leadAPI.getQueue({ bucket: activeBucket });
      if (res.data?.success) {
        const fetchedLeads = res.data.data || [];
        setQueue(fetchedLeads);
        if (res.data.queueSummary) {
          setSummary(res.data.queueSummary);
        }
        setLastRefreshedAt(new Date());
      }
    } catch (err) {
      if (!isBackground) toast.error('Failed to load lead working queue');
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [activeBucket]);

  useEffect(() => {
    fetchQueue(false);
    // Background polling for reassignment & queue sync every 15s
    const pollInterval = setInterval(() => {
      fetchQueue(true);
    }, 15000);
    return () => clearInterval(pollInterval);
  }, [fetchQueue]);

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
        
        // Auto transition to connected state after 1.5s simulation
        setTimeout(() => {
          setCallState('connected');
        }, 1500);
      }
    } catch (err) {
      setCallState('idle');
      toast.error('Failed to initiate call');
    }
  };

  // End Call Handler (Calculates authoritative talk time)
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

    // Validate follow-up date requirement for follow-up status/dispositions
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
          await fetchQueue(false);
        }
      }
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
        const updatedSummary = res.data.data?.leadSummary;
        if (updatedSummary) {
          setQueue(prev => prev.map((l, i) => i === currentIndex ? { ...l, ...updatedSummary } : l));
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record payment');
    } finally {
      setRecordingPayment(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        <p className="text-sm font-semibold text-gray-600">Loading BDE Sales Queue...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* 1. Header & Live Compact Bucket Counters */}
      <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">Working Queue</h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800">
                <Wifi className="h-3 w-3 animate-pulse text-green-600" />
                Live API
              </span>
            </div>
            <p className="text-xs md:text-sm text-gray-500 mt-0.5">High-frequency BDE Workspace • Auto-synced {lastRefreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
          </div>
          <button
            onClick={() => fetchQueue(false)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors self-start md:self-auto border border-gray-200"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh Queue
          </button>
        </div>

        {/* Operational Bucket Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 border-t pt-3">
          <button
            onClick={() => { setActiveBucket('all'); setCurrentIndex(0); }}
            className={`p-3 rounded-xl text-center border transition-all ${activeBucket === 'all' ? 'bg-primary-50 border-primary-600 text-primary-800 font-bold shadow-sm' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}
          >
            <div className="text-xs font-medium">All Queue</div>
            <div className="text-xl font-extrabold mt-0.5">{summary.totalQueueCount}</div>
          </button>

          <button
            onClick={() => { setActiveBucket('missed-followup'); setCurrentIndex(0); }}
            className={`p-3 rounded-xl text-center border transition-all relative ${activeBucket === 'missed-followup' ? 'bg-red-50 border-red-600 text-red-800 font-bold shadow-sm' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}
          >
            {summary.missedCount > 0 && (
              <span className="absolute top-2 right-2 px-1.5 py-0.5 text-[10px] font-black bg-red-600 text-white rounded-full animate-bounce">MISSED</span>
            )}
            <div className="text-xs font-medium">Missed Follow-ups</div>
            <div className="text-xl font-extrabold text-red-600 mt-0.5">{summary.missedCount}</div>
          </button>

          <button
            onClick={() => { setActiveBucket('followup-today'); setCurrentIndex(0); }}
            className={`p-3 rounded-xl text-center border transition-all ${activeBucket === 'followup-today' ? 'bg-orange-50 border-orange-600 text-orange-800 font-bold shadow-sm' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}
          >
            <div className="text-xs font-medium">Due Today</div>
            <div className="text-xl font-extrabold text-orange-600 mt-0.5">{summary.todayCount}</div>
          </button>

          <button
            onClick={() => { setActiveBucket('fresh'); setCurrentIndex(0); }}
            className={`p-3 rounded-xl text-center border transition-all ${activeBucket === 'fresh' ? 'bg-green-50 border-green-600 text-green-800 font-bold shadow-sm' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}
          >
            <div className="text-xs font-medium">New / Reassigned</div>
            <div className="text-xl font-extrabold text-green-600 mt-0.5">{summary.freshCount}</div>
          </button>
        </div>
      </div>

      {/* 2. Main Lead Workspace */}
      {!currentLead ? (
        <div className="bg-white p-12 rounded-2xl shadow-sm border border-gray-200 text-center space-y-4">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
          <h2 className="text-2xl font-bold text-gray-900">Queue Processing Complete!</h2>
          <p className="text-gray-500 text-sm max-w-md mx-auto">You have processed all eligible leads in the <strong>{activeBucket.toUpperCase()}</strong> queue.</p>
          <button
            onClick={() => { setActiveBucket('all'); fetchQueue(false); }}
            className="btn-primary text-sm px-6 py-2.5 rounded-xl font-bold inline-flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Switch to All Queue
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Navigation bar with compact lead position */}
          <div className="flex items-center justify-between bg-white px-5 py-3 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Queue Position:</span>
              <span className="px-2.5 py-1 bg-primary-100 text-primary-800 rounded-lg text-xs font-black">
                Lead {currentIndex + 1} of {queue.length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                className="p-2 rounded-lg border text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                title="Previous Lead"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                disabled={currentIndex >= queue.length - 1}
                onClick={() => setCurrentIndex(prev => Math.min(queue.length - 1, prev + 1))}
                className="p-2 rounded-lg border text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                title="Next Lead"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Focused Student Lead Workspace Card */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-6">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b pb-5">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-black text-gray-900">{currentLead.name}</h2>
                  <span className={`px-3 py-1 text-xs font-bold rounded-full border ${currentLead.status === 'registered' ? 'bg-green-100 text-green-800 border-green-300' : currentLead.status === 'follow-up' ? 'bg-orange-100 text-orange-800 border-orange-300' : 'bg-blue-100 text-blue-800 border-blue-300'}`}>
                    {currentLead.status?.toUpperCase()}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-600">
                  <div className="flex items-center gap-1.5 font-medium">
                    <span>📱 Primary:</span>
                    <strong className="text-gray-900">{currentLead.phone}</strong>
                  </div>
                  {currentLead.email && (
                    <div className="flex items-center gap-1.5 font-medium">
                      <span>✉️ Email:</span>
                      <strong className="text-gray-900">{currentLead.email}</strong>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 font-medium">
                    <span>📍 Country:</span>
                    <strong className="text-gray-900">{currentLead.country}</strong>
                  </div>
                  <div className="flex items-center gap-1.5 font-medium">
                    <span>🎓 Campus:</span>
                    <strong className="text-primary-700 font-bold">{currentLead.campus || 'Kochi'}</strong>
                  </div>
                </div>
              </div>

              {/* 3. One-Click Calling & Live Call State Panel */}
              <div className="flex items-center gap-2 self-start">
                {callState === 'idle' ? (
                  <button
                    onClick={() => handleStartCall(currentLead.phone)}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-extrabold text-sm transition-all shadow-md hover:shadow-lg active:scale-95"
                  >
                    <Phone className="h-4 w-4" />
                    CALL LEAD
                  </button>
                ) : (
                  <div className="flex items-center gap-3 bg-red-50 border-2 border-red-300 px-4 py-2 rounded-xl shadow-sm">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-black text-red-700 tracking-wider uppercase animate-pulse">
                        {callState === 'connected' ? `CONNECTED (${formatTimer(callTimer)})` : 'RINGING...'}
                      </span>
                      <span className="text-[10px] text-gray-500 font-medium">{calledPhone}</span>
                    </div>
                    <button
                      onClick={() => handleEndCall('completed')}
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                      title="End Call"
                    >
                      <PhoneOff className="h-3.5 w-3.5" />
                      END
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Error Safeguard Banner */}
            {saveError && (
              <div className="bg-red-50 border-l-4 border-red-600 p-4 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-red-900">{saveError}</p>
                    <p className="text-[11px] text-red-700">Form state has been safely preserved. Click Retry to submit again.</p>
                  </div>
                </div>
                <button
                  onClick={() => handleSaveLead(false)}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  Retry Save
                </button>
              </div>
            )}

            {/* 4. Call Outcome & Normalized Disposition Selection */}
            <div className="space-y-4 border-b pb-5">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                Call Outcome / Disposition
              </label>

              <div className="flex flex-wrap gap-2">
                {(dispositions.length > 0 ? dispositions : [
                  { label: 'Connected', category: 'connected' },
                  { label: 'Follow-up Required', category: 'callback' },
                  { label: 'RNR (Ring No Response)', category: 'no_answer' },
                  { label: 'Busy', category: 'busy' },
                  { label: 'Not Interested', category: 'not_interested' },
                  { label: 'Registered', category: 'registered' },
                  { label: 'Wrong Number', category: 'other' }
                ]).map((d) => (
                  <button
                    key={d.label}
                    type="button"
                    onClick={() => {
                      setDisposition(d.label);
                      if (d.category === 'registered') setStatus('registered');
                      else if (d.requiresFollowUp || d.category === 'callback') setStatus('follow-up');
                    }}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${disposition === d.label ? 'bg-primary-600 text-white border-primary-600 shadow-sm' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'}`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 5. Follow-Up & Form Inputs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Lead Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="input-field text-xs font-medium"
                >
                  <option value="fresh">Fresh</option>
                  <option value="follow-up">Follow-up Required</option>
                  <option value="registered">Registered</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Campus Location</label>
                <select
                  value={campus}
                  onChange={(e) => setCampus(e.target.value)}
                  className="input-field text-xs font-medium"
                >
                  <option value="Kochi">Kochi</option>
                  <option value="Chennai">Chennai</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Next Follow-up Date & Time {(status === 'follow-up' || disposition.includes('Follow-up')) && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="datetime-local"
                  value={nextFollowUpAt}
                  onChange={(e) => setNextFollowUpAt(e.target.value)}
                  className={`input-field text-xs font-medium ${saveError && !nextFollowUpAt ? 'border-red-500' : ''}`}
                />
              </div>
            </div>

            {/* 6. Call Notes & Student Requirements */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Call Notes & Requirements</label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enter call notes, student requirements, course interest, or next action steps..."
                className="input-field text-xs"
              />
            </div>

            {/* 7. Action Bar: SAVE vs SAVE & NEXT */}
            <div className="pt-4 border-t flex flex-col sm:flex-row items-center justify-end gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSaveLead(false)}
                className="w-full sm:w-auto px-5 py-2.5 border border-gray-300 text-gray-700 hover:bg-gray-100 rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Save className="h-4 w-4 text-gray-600" />
                {saving ? 'Saving...' : 'SAVE'}
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={() => handleSaveLead(true)}
                className="w-full sm:w-auto px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-extrabold transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-95"
              >
                <span>{saving ? 'Processing...' : 'SAVE & NEXT'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* 8. Structured Payment Tracking & Batch Allocation Status Widget */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary-600" />
                <h3 className="text-base font-bold text-gray-900">Structured Payment Record</h3>
              </div>
              <div className="text-xs font-bold text-gray-700">
                Verified Cleared: <span className="text-emerald-600 font-extrabold">₹{(currentLead.paidAmount || 0).toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Batch Allocation Lock Status Notice */}
            <div className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between ${currentLead.batchEligible ? 'bg-green-50 border-green-200 text-green-800' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
              <div className="flex items-center gap-2">
                {currentLead.batchEligible ? (
                  <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                )}
                <span>
                  {currentLead.batchEligible
                    ? '🎉 Verified total reaches ₹9,000 threshold. Batch Allocation is UNLOCKED.'
                    : `⚠️ Verified total ₹${(currentLead.paidAmount || 0).toLocaleString('en-IN')} is below ₹9,000. Batch Allocation is LOCKED.`}
                </span>
              </div>
            </div>

            {/* Quick Record Payment Form */}
            <form onSubmit={handleRecordPayment} className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-1">Fee Type</label>
                <select
                  value={paymentType}
                  onChange={(e) => setPaymentType(e.target.value)}
                  className="input-field text-xs font-medium py-1.5"
                >
                  <option value="admission">Admission Fee</option>
                  <option value="orientation">Orientation Fee</option>
                  <option value="tuition">Tuition Fee</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-1">Amount (₹)</label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="input-field text-xs py-1.5 font-bold"
                  placeholder="1000"
                  min="1"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-1">Reference ID</label>
                <input
                  type="text"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  className="input-field text-xs py-1.5"
                  placeholder="UPI / Txn Ref"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={recordingPayment}
                  className="w-full btn-secondary text-xs py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200 font-bold flex items-center justify-center gap-1.5"
                >
                  <DollarSign className="h-3.5 w-3.5" />
                  {recordingPayment ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadQueueView;
