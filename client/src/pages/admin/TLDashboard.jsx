import { useState, useEffect } from 'react';
import { dashboardAPI, userAPI, leadAPI } from '../../services/api';
import { Users, AlertTriangle, Clock, RefreshCw, Trophy, ArrowRightLeft, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

let tlDashboardCache = null;

const TLDashboard = () => {
  const [teamStats, setTeamStats] = useState(tlDashboardCache?.teamStats || []);
  const [salespeople, setSalespeople] = useState(tlDashboardCache?.salespeople || []);
  const [loading, setLoading] = useState(!tlDashboardCache);

  // Reassignment Modal State
  const [selectedBDE, setSelectedBDE] = useState('');
  const [targetBDE, setTargetBDE] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  const [reassigning, setReassigning] = useState(false);

  useEffect(() => {
    fetchTLData();
  }, []);

  const fetchTLData = async () => {
    try {
      const [dashRes, salesRes] = await Promise.all([
        dashboardAPI.getAdminDashboard(),
        userAPI.getSalespeople()
      ]);

      let stats = teamStats;
      let sales = salespeople;

      if (dashRes.data?.success) {
        stats = dashRes.data.data?.salespersonPerformance || [];
        setTeamStats(stats);
      }

      if (salesRes.data?.success) {
        sales = salesRes.data.data || [];
        setSalespeople(sales);
      }

      tlDashboardCache = { teamStats: stats, salespeople: sales };
    } catch (err) {
      if (!tlDashboardCache) toast.error('Failed to load TL team dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleReassignTeamLeads = async (e) => {
    e.preventDefault();
    if (!selectedBDE || !targetBDE) {
      toast.error('Please select both source and target BDE');
      return;
    }
    if (selectedBDE === targetBDE) {
      toast.error('Source and target BDE cannot be the same');
      return;
    }

    setReassigning(true);
    try {
      // Fetch stale / assigned leads of source BDE
      const leadsRes = await leadAPI.getAllLeads({ limit: 100 });
      const bdeLeads = (leadsRes.data?.data || []).filter(l => l.assignedTo === selectedBDE);

      if (bdeLeads.length === 0) {
        toast.error('No active leads found for selected source BDE');
        setReassigning(false);
        return;
      }

      const leadIds = bdeLeads.map(l => l.id);
      const res = await leadAPI.assignLeads(leadIds, targetBDE);

      if (res.data?.success) {
        toast.success(`Successfully reassigned ${res.data.count} leads`);
        setSelectedBDE('');
        setTargetBDE('');
        setReassignReason('');
        await fetchTLData();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reassign team leads');
    } finally {
      setReassigning(false);
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Leader Operations Dashboard</h1>
          <p className="text-gray-500 text-sm">Monitor BDE operational buckets, missed follow-ups, and team reassignments</p>
        </div>
        <button
          onClick={fetchTLData}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg shadow-sm"
        >
          <RefreshCw className="h-4 w-4 text-gray-600" />
          Refresh Team Metrics
        </button>
      </div>

      {/* BDE Team Operational Table */}
      <div className="card bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center gap-2 mb-4 border-b pb-3">
          <Users className="h-5 w-5 text-primary-600" />
          <h2 className="text-lg font-bold text-gray-800">BDE Team Operational Breakdown</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-700 uppercase text-xs">
              <tr>
                <th className="px-4 py-3">BDE Name</th>
                <th className="px-4 py-3">Assigned Leads</th>
                <th className="px-4 py-3 text-orange-600">Follow-up Today</th>
                <th className="px-4 py-3 text-red-600">Missed Follow-ups</th>
                <th className="px-4 py-3">Registered</th>
                <th className="px-4 py-3 text-right">Revenue Cleared</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {teamStats.map((sp) => (
                <tr key={sp.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-gray-900">{sp.name}</td>
                  <td className="px-4 py-3 font-medium text-gray-700">{sp.totalAssigned || 0}</td>
                  <td className="px-4 py-3 font-bold text-orange-600">{sp.followUpCount || 0}</td>
                  <td className="px-4 py-3 font-bold text-red-600">{sp.missedCount || 0}</td>
                  <td className="px-4 py-3 font-bold text-green-600">{sp.registeredCount || sp.closedCount || 0}</td>
                  <td className="px-4 py-3 font-extrabold text-right text-gray-900">
                    ₹{parseFloat(sp.totalRevenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}

              {teamStats.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-gray-500 italic">No active BDE team members found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* TL Team Lead Reassignment Card */}
      <div className="card bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center gap-2 mb-4 border-b pb-3">
          <ArrowRightLeft className="h-5 w-5 text-primary-600" />
          <h2 className="text-lg font-bold text-gray-800">Team Lead Reassignment Tool</h2>
        </div>

        <form onSubmit={handleReassignTeamLeads} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Source BDE (Transfer From)</label>
            <select
              className="input-field w-full text-sm"
              value={selectedBDE}
              onChange={(e) => setSelectedBDE(e.target.value)}
              required
            >
              <option value="">Select Source BDE...</option>
              {salespeople.map(sp => (
                <option key={sp.id} value={sp.id}>{sp.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Target BDE (Assign To)</label>
            <select
              className="input-field w-full text-sm"
              value={targetBDE}
              onChange={(e) => setTargetBDE(e.target.value)}
              required
            >
              <option value="">Select Target BDE...</option>
              {salespeople.map(sp => (
                <option key={sp.id} value={sp.id}>{sp.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={reassigning}
              className="btn-primary w-full py-2 text-sm flex items-center justify-center gap-2"
            >
              <ArrowRightLeft className="h-4 w-4" />
              {reassigning ? 'Reassigning...' : 'Reassign Leads'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TLDashboard;
