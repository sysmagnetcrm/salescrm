import React, { useState, useEffect } from 'react';
import { CreditCard, CheckCircle2, Clock, AlertCircle, PlusCircle, ArrowUpRight, IndianRupee, Receipt, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { paymentAPI, leadAPI } from '../services/api';
import { useQueryClient } from '@tanstack/react-query';

const LeadPaymentSection = ({ lead, onPaymentRecorded }) => {
  const queryClient = useQueryClient();
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State for Recording Subsequent / Additional Payments
  const [paymentType, setPaymentType] = useState('admission');
  const [amount, setAmount] = useState('');
  const [referenceId, setReferenceId] = useState('');
  const [notes, setNotes] = useState('');

  const fetchPayments = async () => {
    if (!lead?.id) return;
    setLoading(true);
    try {
      const res = await paymentAPI.getLeadPayments(lead.id);
      if (res.data?.success) {
        setPayments(res.data.data || []);
        setSummary(res.data.summary || null);
      }
    } catch (err) {
      console.error('Failed to fetch lead payments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [lead?.id]);

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);

    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('Please enter a valid positive payment amount');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await paymentAPI.recordPayment({
        leadId: lead.id,
        paymentType,
        amount: numAmount,
        referenceId: referenceId ? referenceId.trim() : null,
        notes: notes ? notes.trim() : null
      });

      if (res.data?.success) {
        toast.success(`Recorded ₹${numAmount.toLocaleString('en-IN')} ${paymentType} payment!`);
        setAmount('');
        setReferenceId('');
        setNotes('');
        setShowAddForm(false);

        // Refresh internal payments list & summary
        await fetchPayments();

        // Invalidate global queries
        queryClient.invalidateQueries({ queryKey: ['leads'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['reports'] });

        // Refresh parent lead modal if callback provided
        if (onPaymentRecorded) {
          try {
            const updatedLeadRes = await leadAPI.getLead(lead.id);
            if (updatedLeadRes.data?.data) {
              onPaymentRecorded(updatedLeadRes.data.data);
            }
          } catch (err) {
            // Ignore
          }
        }
      }
    } catch (err) {
      console.error('Record Payment Error:', err);
      toast.error(err.response?.data?.message || 'Failed to record payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalCleared = summary?.totalClearedPayment ?? (lead.totalClearedPayment || lead.value || 0);
  const admissionStatus = summary?.admissionFeeStatus || lead.admissionFeeStatus || (totalCleared >= 1000 ? 'cleared' : 'pending');
  const orientationStatus = summary?.orientationFeeStatus || lead.orientationFeeStatus || (totalCleared >= 9000 ? 'cleared' : (totalCleared > 1000 ? 'partial' : 'pending'));
  const isEligible = summary?.batchAllocationEligible ?? (lead.batchAllocationEligible || totalCleared >= 9000);

  return (
    <div className="bg-gradient-to-br from-slate-50 to-emerald-50/30 border border-emerald-100 rounded-2xl p-4 md:p-5 space-y-4 shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-2 border-b border-emerald-100/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              Payment & Fee Lifecycle Status
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              Admin & TL Connected Financial Tracking
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAddForm(!showAddForm)}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            showAddForm
              ? 'bg-slate-200 text-slate-800 hover:bg-slate-300'
              : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
          }`}
        >
          {showAddForm ? 'Cancel' : <><PlusCircle className="w-4 h-4" /> Update Payment After Advance</>}
        </button>
      </div>

      {/* Payment Lifecycle Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-0.5">
          <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Cleared</span>
          <span className="text-base font-black font-mono text-emerald-700">
            {Number(totalCleared).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
          </span>
        </div>

        <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-0.5">
          <span className="text-[10px] font-bold text-slate-500 uppercase block">Admission Fee</span>
          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
            admissionStatus === 'cleared' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-800 border border-amber-300'
          }`}>
            ● {admissionStatus.toUpperCase()}
          </span>
        </div>

        <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-0.5">
          <span className="text-[10px] font-bold text-slate-500 uppercase block">Orientation Fee</span>
          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
            orientationStatus === 'cleared' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
            orientationStatus === 'partial' ? 'bg-sky-100 text-sky-800 border border-sky-300' : 'bg-slate-100 text-slate-700 border border-slate-300'
          }`}>
            ● {orientationStatus.toUpperCase()}
          </span>
        </div>

        <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-0.5">
          <span className="text-[10px] font-bold text-slate-500 uppercase block">Batch Eligibility</span>
          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
            isEligible ? 'bg-purple-100 text-purple-800 border border-purple-300' : 'bg-slate-100 text-slate-600 border border-slate-300'
          }`}>
            {isEligible ? 'ELIGIBLE (≥₹9K)' : 'PENDING'}
          </span>
        </div>
      </div>

      {/* Update Payment Form (Record subsequent payment after advance) */}
      {showAddForm && (
        <form onSubmit={handleRecordPayment} className="p-4 bg-white border-2 border-emerald-400 rounded-xl space-y-3 animate-in fade-in duration-200 shadow-md">
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900 border-b border-slate-100 pb-2">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>Record Additional Payment / Installment After Advance</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Payment Type *</label>
              <select
                value={paymentType}
                onChange={(e) => setPaymentType(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
              >
                <option value="admission">Admission Fee (₹1,000)</option>
                <option value="orientation">Orientation Fee (₹8,000)</option>
                <option value="other">Other / Subsequent Installment</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Amount (₹) *</label>
              <input
                type="number"
                step="0.01"
                min="1"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount (e.g. 1000 or 8000)"
                className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Transaction Ref / UTR</label>
              <input
                type="text"
                value={referenceId}
                onChange={(e) => setReferenceId(e.target.value)}
                placeholder="e.g. UPI/123456789"
                className="w-full p-2.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 mb-1 text-xs">Payment Notes (Optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Paid via GPay, confirmed by student"
              className="w-full p-2.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? 'Recording...' : 'Submit Payment Update'}
            </button>
          </div>
        </form>
      )}

      {/* Payment History Table */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
          <Receipt className="w-3.5 h-3.5 text-slate-500" /> Recorded Payment History ({payments.length})
        </h4>

        {loading ? (
          <div className="text-xs text-slate-400 p-3 text-center">Loading payment history...</div>
        ) : payments.length === 0 ? (
          <div className="p-3 bg-white rounded-xl border border-dashed border-slate-300 text-xs text-slate-500 text-center font-medium">
            No structured payments recorded yet. Use <strong>Update Payment After Advance</strong> button above to record payments.
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
            {payments.map((pay) => (
              <div key={pay.id} className="p-3 flex justify-between items-center gap-3 hover:bg-slate-50 transition-colors">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold capitalize text-slate-900">{pay.paymentType} Payment</span>
                    {pay.referenceId && (
                      <span className="font-mono text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                        Ref: {pay.referenceId}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Date: {new Date(pay.paymentDate || pay.createdAt).toLocaleDateString()} {pay.notes ? `• ${pay.notes}` : ''}
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-black font-mono text-emerald-700 text-sm block">
                    +₹{Number(pay.amount).toLocaleString('en-IN')}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase">
                    {pay.paymentStatus || 'CLEARED'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LeadPaymentSection;
