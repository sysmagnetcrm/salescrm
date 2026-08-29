import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dashboardAPI, userAPI, leadAPI } from '../../services/api';
import { Users, AlertTriangle, Clock, RefreshCw, Trophy, ArrowRightLeft, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const TLDashboard = () => {
  const queryClient = useQueryClient();

  // Reassignment Modal State
  const [selectedBDE, setSelectedBDE] = useState('');
  const [targetBDE, setTargetBDE] = useState('');
  const [reassignReason, setReassignReason] = useState('');

  // Fetch TL Team Data
  const { data = { teamStats: [], salespeople: [] }, isLoading } = useQuery({
    queryKey: ['tl-team'],
    queryFn: async () => {
      const [dashRes, salesRes] = await Promise.all([
        dashboardAPI.getAdminDashboard(),
        userAPI.getSalespeople()
      ]);

      return {
        teamStats: dashRes.data?.data?.salespersonPerformance || [],
        salespeople: salesRes.data?.data || []
      };
    },
    staleTime: 60000
  });

  const teamStats = data.teamStats;
  const salespeople = data.salespeople;

  // Reassign Mutation
  const reassignMutation = useMutation({
    mutationFn: async ({ selectedBDE, targetBDE }) => {
      const leadsRes = await leadAPI.getAllLeads({ limit: 100 });
      const bdeLeads = (leadsRes.data?.data || []).filter(l => l.assignedTo === selectedBDE);

      if (bdeLeads.length === 0) {
        throw new Error('Selected source BDE has no active leads to reassign');
      }

      const leadIds = bdeLeads.map(l => l.id);
      return leadAPI.assignLeads(leadIds, targetBDE);
    },
    onSuccess: (res, { selectedBDE, targetBDE }) => {
      const targetName = salespeople.find(s => String(s.id) === String(targetBDE))?.name || 'target BDE';
      toast.success(`Successfully reassigned leads to ${targetName}`);
      setSelectedBDE('');
      setTargetBDE('');
      setReassignReason('');

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['tl-team'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to reassign leads');
    }
  });

  const handleReassignTeamLeads = (e) => {
    e.preventDefault();
    if (!selectedBDE || !targetBDE) {
      toast.error('Please select both source and target BDE');
      return;
    }
    if (selectedBDE === targetBDE) {
      toast.error('Source and target BDE cannot be the same');
      return;
    }

    reassignMutation.mutate({ selectedBDE, targetBDE });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Leader Operations</h1>
          <p className="text-sm text-gray-500">Monitor BDE performance, workload balance, and trigger lead reassignment</p>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Active BDEs</p>
            <h3 className="text-2xl font-bold text-gray-900">{salespeople.length}</h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4">
          <div className="p-3 bg-green-50 text-green-600 rounded-lg">
            <Trophy className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Total Team Conversions</p>
            <h3 className="text-2xl font-bold text-gray-900">
              {teamStats.reduce((sum, s) => sum + (s.closedLeads || 0), 0)}
            </h3>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
            <RefreshCw className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Leads Managed</p>
            <h3 className="text-2xl font-bold text-gray-900">
              {teamStats.reduce((sum, s) => sum + (s.totalLeads || 0), 0)}
            </h3>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Team Performance Table */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">BDE Team Performance & Load</h2>
            <p className="text-xs text-gray-500">Current active leads and conversion distribution</p>
          </div>
          {isLoading && !teamStats.length ? (
            <div className="p-8 text-center text-gray-400 animate-pulse">Loading team operations data...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs font-medium text-gray-500 uppercase">
                  <tr>
                    <th className="px-6 py-3">Salesperson</th>
                    <th className="px-6 py-3">Assigned Leads</th>
                    <th className="px-6 py-3">Conversions</th>
                    <th className="px-6 py-3">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {teamStats.map((bde) => (
                    <tr key={bde.id} className="hover:bg-gray-50/50">
                      <td className="px-6 py-4 font-medium text-gray-900">{bde.name}</td>
                      <td className="px-6 py-4 text-gray-700">{bde.totalLeads}</td>
                      <td className="px-6 py-4 font-semibold text-green-600">{bde.closedLeads}</td>
                      <td className="px-6 py-4 text-gray-900 font-medium">
                        ₹{Number(bde.revenue || 0).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                  {teamStats.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                        No BDE activity data available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Lead Reassignment Tool Panel */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 text-primary-600 mb-2">
              <ArrowRightLeft className="h-5 w-5" />
              <h2 className="text-lg font-semibold text-gray-900">Reassign BDE Leads</h2>
            </div>
            <p className="text-xs text-gray-500 mb-6">
              Balance team workload by reassigning active leads from an overloaded or absent BDE to another salesperson.
            </p>

            <form onSubmit={handleReassignTeamLeads} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Source BDE (Current Owner)
                </label>
                <select
                  className="input-field text-sm"
                  value={selectedBDE}
                  onChange={(e) => setSelectedBDE(e.target.value)}
                  required
                >
                  <option value="">Select Source BDE</option>
                  {salespeople.map((sp) => (
                    <option key={sp.id} value={sp.id}>
                      {sp.name} ({sp.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Target BDE (New Owner)
                </label>
                <select
                  className="input-field text-sm"
                  value={targetBDE}
                  onChange={(e) => setTargetBDE(e.target.value)}
                  required
                >
                  <option value="">Select Target BDE</option>
                  {salespeople.map((sp) => (
                    <option key={sp.id} value={sp.id}>
                      {sp.name} ({sp.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Reason for Reassignment (Optional)
                </label>
                <textarea
                  className="input-field text-sm h-20 resize-none"
                  placeholder="e.g. Workload rebalancing, leave coverage..."
                  value={reassignReason}
                  onChange={(e) => setReassignReason(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={reassignMutation.isPending}
                className="w-full btn-primary flex items-center justify-center space-x-2 py-2.5 text-sm"
              >

                <span>{reassignMutation.isPending ? 'Reassigning Leads...' : 'Execute Reassignment'}</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TLDashboard;
