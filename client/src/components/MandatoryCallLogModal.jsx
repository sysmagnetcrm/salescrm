import React, { useState, useEffect, useCallback } from 'react';
import { PhoneCall, AlertTriangle, Save, ShieldAlert, CheckCircle2, User, Phone, Globe, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { leadAPI, settingsAPI, paymentAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const MandatoryCallLogModal = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [isOpen, setIsOpen] = useState(false);
  const [pendingCall, setPendingCall] = useState(null);
  const [status, setStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [advance, setAdvance] = useState('');
  const [product, setProduct] = useState('');
  const [country, setCountry] = useState('India');
  const [showWarning, setShowWarning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [statuses, setStatuses] = useState([]);
  const [products, setProducts] = useState([]);

  // Fetch Metadata for Statuses and Products
  useEffect(() => {
    let mounted = true;
    const fetchMetadata = async () => {
      try {
        const [statusRes, productRes] = await Promise.allSettled([
          settingsAPI.getStatuses(),
          settingsAPI.getProducts()
        ]);

        if (mounted && statusRes.status === 'fulfilled' && statusRes.value?.data?.data) {
          setStatuses(statusRes.value.data.data);
        } else if (mounted) {
          setStatuses([
            { value: 'interested', label: 'Interested - High Intent' },
            { value: 'follow-up', label: 'Follow-Up Required' },
            { value: 'orientation-scheduled', label: 'Orientation Scheduled' },
            { value: 'no-answer', label: 'No Answer' },
            { value: 'busy', label: 'Busy / Call Back' },
            { value: 'not-interested', label: 'Not Interested' },
            { value: 'rnr', label: 'RNR (Ringing No Response)' },
            { value: 'dead', label: 'Dead / Junk' },
            { value: 'closed', label: 'Registered / Converted' }
          ]);
        }

        if (mounted && productRes.status === 'fulfilled' && productRes.value?.data?.data) {
          setProducts(productRes.value.data.data.map((p) => p.name || p));
        }
      } catch (err) {
        console.error('Failed to fetch call log metadata:', err);
      }
    };

    fetchMetadata();
    return () => { mounted = false; };
  }, []);

  const userId = user?.id || user?._id || 'default';

  // Check for pending call logs for the logged in user
  const checkPendingCallLog = useCallback(() => {
    if (!user) {
      setIsOpen(false);
      setPendingCall(null);
      return;
    }

    try {
      const userKey = `pendingCallLog_${userId}`;
      let stored = localStorage.getItem(userKey);
      if (!stored) {
        stored = localStorage.getItem('pendingCallLog');
      }

      if (stored) {
        const data = JSON.parse(stored);
        // Verify this pending call log belongs to current user or is generic
        if (data && (data.userId === userId || !data.userId || data.leadId)) {
          setPendingCall(data);
          setStatus(''); // Always force user to select new status
          setNotes('');
          setAdvance(data.value !== undefined && data.value !== null ? String(data.value) : '');
          setProduct(data.product || '');
          setCountry(data.country || 'India');
          setIsOpen(true);
          setShowWarning(false);
          return;
        }
      }
    } catch (err) {
      console.error('Error checking pending call log:', err);
    }
  }, [user, userId]);

  useEffect(() => {
    checkPendingCallLog();

    const handleCallStarted = (e) => {
      if (e.detail) {
        setPendingCall(e.detail);
        setStatus('');
        setNotes('');
        setAdvance(e.detail.value !== undefined && e.detail.value !== null ? String(e.detail.value) : '');
        setProduct(e.detail.product || '');
        setCountry(e.detail.country || 'India');
        setIsOpen(true);
        setShowWarning(false);
      }
    };

    const handleCallError = () => {
      setIsOpen(false);
      setPendingCall(null);
      localStorage.removeItem('pendingCallLog');
      const rawUser = localStorage.getItem('user');
      const user = rawUser ? JSON.parse(rawUser) : null;
      const userId = user?.id || user?._id || 'default';
      localStorage.removeItem(`pendingCallLog_${userId}`);
    };

    const handleFocusOrVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkPendingCallLog();
      }
    };

    window.addEventListener('crmCallStarted', handleCallStarted);
    window.addEventListener('crmCallError', handleCallError);
    window.addEventListener('focus', handleFocusOrVisibility);
    document.addEventListener('visibilitychange', handleFocusOrVisibility);

    return () => {
      window.removeEventListener('crmCallStarted', handleCallStarted);
      window.removeEventListener('crmCallError', handleCallError);
      window.removeEventListener('focus', handleFocusOrVisibility);
      document.removeEventListener('visibilitychange', handleFocusOrVisibility);
    };
  }, [checkPendingCallLog]);

  // Handle Cancel Button Click (STRICT ENFORCEMENT: Warning message shown, DOES NOT CLOSE)
  const handleCancelClick = () => {
    setShowWarning(true);
    toast.error('Action Required: You must update the status and save the call log! Or contact your Team Leader (TL).', {
      duration: 5000,
      id: 'mandatory-call-warning'
    });
  };

  // Handle Submit & Save Call Log
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!status) {
      setShowWarning(true);
      toast.error('Please select a Call Status before saving!');
      return;
    }

    if (!pendingCall?.leadId) {
      toast.error('Lead information missing');
      return;
    }

    setIsSubmitting(true);
    try {
      const numericAdvance = (advance !== '' && advance !== null && advance !== undefined) ? Number(advance) : 0;

      const payload = {
        status,
        value: numericAdvance > 0 ? numericAdvance : ((advance === '' || advance === null || advance === undefined) ? '' : Number(advance)),
        notes: notes,
        country: country,
        product: product,
        lastCalled: new Date().toISOString()
      };

      await leadAPI.updateLead(pendingCall.leadId, payload);

      // Connect advance payment with backend Payment model for Admin & TL dashboards
      if (numericAdvance > 0) {
        try {
          await paymentAPI.recordPayment({
            leadId: pendingCall.leadId,
            paymentType: 'admission',
            amount: numericAdvance,
            notes: notes ? `Call Advance: ${notes}` : 'Advance payment marked during call log'
          });
        } catch (payErr) {
          console.warn('Payment recording notice:', payErr?.response?.data?.message || payErr.message);
        }
      }

      if (notes && notes.trim()) {
        await leadAPI.addActivity(pendingCall.leadId, {
          type: 'call',
          description: `Call logged [Status: ${status.toUpperCase()}]: ${notes.trim()}`
        });
      }

      // Clear pending call log from storage
      localStorage.removeItem(`pendingCallLog_${userId}`);
      localStorage.removeItem('pendingCallLog');

      // Invalidate queries to refresh UI lists and stats
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });

      window.dispatchEvent(new CustomEvent('crmCallLogSaved', { detail: { leadId: pendingCall.leadId, status } }));

      toast.success('Call log & status saved successfully!');
      setIsOpen(false);
      setPendingCall(null);
      setShowWarning(false);
    } catch (err) {
      console.error('Failed to save call log:', err);
      toast.error('Failed to save call log. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !pendingCall || !user) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-red-100 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-5 border-b border-slate-700 relative">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-500/20 text-red-400 rounded-xl border border-red-500/30 animate-pulse">
              <PhoneCall className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-red-500 text-white">
                  MANDATORY ACTION
                </span>
                <span className="text-xs text-slate-300 font-mono">Log Call</span>
              </div>
              <h2 className="text-lg font-bold text-white mt-0.5">
                Update Lead Call Status
              </h2>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs overflow-y-auto">
          {/* Lead Summary Info */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Lead Student</span>
                <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5 mt-0.5">
                  <User className="h-4 w-4 text-primary-600" />
                  {pendingCall.leadName || 'Lead Student'}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Phone Number</span>
                <span className="font-bold font-mono text-slate-800 text-xs flex items-center gap-1 justify-end mt-0.5">
                  <Phone className="h-3.5 w-3.5 text-emerald-600" />
                  {pendingCall.phone || 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Warning Alert Banner (If cancel attempted or validation warning) */}
          {showWarning && (
            <div className="p-4 bg-amber-50 border-2 border-amber-400 rounded-xl flex items-start gap-3 text-amber-900 animate-in slide-in-from-top-2 duration-200 shadow-sm">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <h4 className="font-black text-amber-950 flex items-center gap-1">
                  Status Update Required!
                </h4>
                <p className="leading-relaxed font-medium">
                  This window cannot be closed without updating the lead status and saving the call log.
                  Please select a call result status below and click <strong>Save Call Log</strong>, or contact your <strong>Team Leader (TL)</strong>.
                </p>
              </div>
            </div>
          )}

          {/* Call Status Input (Mandatory) */}
          <div className="space-y-1.5">
            <label className="block font-bold text-gray-900 flex items-center gap-1">
              <span>Call Status / Outcome</span>
              <span className="text-red-500 font-bold text-sm">*</span>
            </label>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                if (showWarning && e.target.value) setShowWarning(false);
              }}
              required
              className={`w-full p-3 text-xs font-bold border rounded-xl focus:ring-2 focus:outline-none transition-all ${
                !status && showWarning
                  ? 'border-red-500 ring-2 ring-red-500/30 bg-red-50 text-red-950'
                  : 'border-slate-300 focus:ring-primary-500 bg-white text-slate-900'
              }`}
            >
              <option value="">-- Select Mandatory Status Outcome --</option>
              {statuses.map((s) => (
                <option key={s.value || s.id} value={s.value || s.id}>
                  {s.label || s.name || s.value}
                </option>
              ))}
            </select>
          </div>

          {/* Call Notes Input */}
          <div className="space-y-1.5">
            <label className="block font-bold text-gray-800">
              Call Notes & Key Discussion Details (Optional)
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Record call summary, student feedback, program interest, fee agreement..."
              className="w-full p-3 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none bg-white"
            />
          </div>

          {/* Advance & Product inputs in 2 columns */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block font-bold text-gray-800">
                Advance Paid (₹)
              </label>
              <input
                type="number"
                value={advance}
                onChange={(e) => setAdvance(e.target.value)}
                placeholder="0"
                className="w-full p-2.5 text-xs font-semibold border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block font-bold text-gray-800">
                Product / Course
              </label>
              <select
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                className="w-full p-2.5 text-xs font-semibold border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none bg-white"
              >
                <option value="">Select Product</option>
                {products.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Footer Action Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleCancelClick}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-all flex items-center gap-1.5"
            >
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              <span>Cancel</span>
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 px-5 font-black text-xs text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>{isSubmitting ? 'Saving Call Log...' : 'Save Call Log & Update Status'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MandatoryCallLogModal;
