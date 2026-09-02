import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { callAPI, leadAPI } from '../../services/api';
import { PhoneCall, AlertTriangle, Link2, UserPlus, Clock, Search, X, CheckCircle2, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const UnmatchedCalls = () => {
  const queryClient = useQueryClient();
  const [selectedCall, setSelectedCall] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState('');

  // Fetch Unmatched Calls
  const { data: unmatchedCalls = [], isLoading } = useQuery({
    queryKey: ['calls', 'unmatched'],
    queryFn: () => callAPI.getUnmatchedCalls().then(r => r.data?.data || []),
    staleTime: 15000
  });

  // Fetch Leads for selection
  const { data: leads = [] } = useQuery({
    queryKey: ['leads', 'my-leads'],
    queryFn: () => leadAPI.getMyLeads().then(r => r.data?.data || []),
    staleTime: 60000
  });

  // Reconcile Mutation
  const reconcileMutation = useMutation({
    mutationFn: ({ callId, leadId }) => callAPI.reconcileUnmatchedCall(callId, leadId),
    onSuccess: () => {
      toast.success('Call associated with lead successfully');
      queryClient.invalidateQueries(['calls', 'unmatched']);
      queryClient.invalidateQueries(['calls', 'all']);
      setSelectedCall(null);
      setSelectedLeadId('');
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to reconcile call');
    }
  });

  const filteredLeads = leads.filter(l =>
    l.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.phone?.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="h-7 w-7 text-amber-500" />
            Unmatched Calls Queue
          </h1>
          <p className="text-sm text-gray-500">
            SIM calls with missing or ambiguous lead matches. Review and assign to the correct CRM lead.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400 animate-pulse font-medium">Loading unmatched calls...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3">Timestamp</th>
                  <th className="px-6 py-3">Phone Number</th>
                  <th className="px-6 py-3">Direction</th>
                  <th className="px-6 py-3">Talk Duration</th>
                  <th className="px-6 py-3">Match Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {unmatchedCalls.map((call) => (
                  <tr key={call.id} className="hover:bg-gray-50/50">
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500 text-xs">
                      {call.createdAt ? format(new Date(call.createdAt), 'MMM dd, yyyy HH:mm') : 'N/A'}
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-gray-900">
                      {call.phoneNumber || 'Unknown Number'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 text-xs font-bold rounded ${call.callDirection === 'inbound' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                        {call.callDirection?.toUpperCase() || 'OUTBOUND'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-900 font-semibold text-xs">
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span>{call.durationSeconds ? `${call.durationSeconds}s` : '0s'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-xs font-extrabold rounded-full ${call.matchingStatus === 'AMBIGUOUS' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-gray-100 text-gray-700 border border-gray-200'}`}>
                        {call.matchingStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedCall(call)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors border border-primary-200"
                      >
                        <Link2 className="h-3.5 w-3.5" /> Associate Lead
                      </button>
                    </td>
                  </tr>
                ))}
                {unmatchedCalls.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                      <div className="flex items-center justify-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        No unmatched or ambiguous calls found! All calls matched to CRM leads.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Associate Lead Modal */}
      {selectedCall && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-start border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Associate Call to Lead</h3>
                <p className="text-xs text-gray-500">Phone: {selectedCall.phoneNumber}</p>
              </div>
              <button onClick={() => setSelectedCall(null)} className="text-gray-400 hover:text-gray-600 font-bold p-1"><X className="h-5 w-5" /></button>
            </div>

            <div className="space-y-3">
              <div className="relative">
                <Search className="h-4 w-4 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search lead by name or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="max-h-48 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-lg">
                {filteredLeads.map((lead) => (
                  <div
                    key={lead.id}
                    onClick={() => setSelectedLeadId(lead.id)}
                    className={`p-2.5 text-xs flex justify-between items-center cursor-pointer hover:bg-primary-50/50 ${selectedLeadId === lead.id ? 'bg-primary-50 font-bold text-primary-900' : 'text-gray-700'}`}
                  >
                    <div>
                      <div className="font-semibold">{lead.name}</div>
                      <div className="text-[10px] text-gray-400">{lead.phone}</div>
                    </div>
                    {selectedLeadId === lead.id && <span className="text-primary-600 font-bold flex items-center gap-1"><Check className="h-3.5 w-3.5" /> Selected</span>}
                  </div>
                ))}
                {filteredLeads.length === 0 && (
                  <div className="p-4 text-center text-xs text-gray-400">No matching leads found.</div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                onClick={() => setSelectedCall(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => reconcileMutation.mutate({ callId: selectedCall.id, leadId: selectedLeadId })}
                disabled={!selectedLeadId || reconcileMutation.isPending}
                className="px-4 py-2 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 rounded-lg"
              >
                {reconcileMutation.isPending ? 'Associating...' : 'Confirm Association'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnmatchedCalls;
