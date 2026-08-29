import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardAPI } from '../../services/api';
import StatCard from '../../components/StatCard';
import { ClipboardList, Phone, CheckCircle, DollarSign, Target, Activity, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

const SalespersonDashboard = () => {
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['dashboard', 'salesperson'],
    queryFn: () => dashboardAPI.getSalespersonDashboard().then(r => r.data.data || {}),
    staleTime: 60000
  });

  const { overview, monthly, weekly, recentCalls } = dashboardData || {};

  const hasTargetData = (weekly?.target > 0 || monthly?.target > 0 || weekly?.closedLeads > 0 || monthly?.closedLeads > 0);

  const performanceData = [
    {
      name: 'Weekly',
      Target: parseFloat(weekly?.target || 0),
      Achieved: parseInt(weekly?.closedLeads || 0)
    },
    {
      name: 'Monthly',
      Target: parseFloat(monthly?.target || 0),
      Achieved: parseInt(monthly?.closedLeads || 0)
    }
  ];

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">My Dashboard</h1>
        <p className="text-xs text-gray-500">Secondary performance overview and call activity log</p>
      </div>

      {/* Overview Cards (Top Row) */}
      {isLoading && !dashboardData ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-20 bg-gray-200 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            title="Assigned Leads"
            value={overview?.totalLeads ?? 0}
            icon={ClipboardList}
            color="blue"
          />
          <StatCard
            title="Follow-ups Today"
            value={overview?.followUpsToday ?? 0}
            icon={Phone}
            color="yellow"
          />
          <StatCard
            title="Registered"
            value={overview?.closedLeads ?? 0}
            icon={CheckCircle}
            color="green"
          />
          <StatCard
            title="Revenue"
            value={formatCurrency(overview?.totalRevenue)}
            icon={DollarSign}
            color="purple"
          />
        </div>
      )}

      {/* Real DB Telephony Call Metrics */}
      {dashboardData?.callMetrics && (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 space-y-3">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
              <Phone className="h-4 w-4 text-primary-600" />
              Today's Telephony Performance
            </h2>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              Connection Rate: {dashboardData.callMetrics.connectionRatePercent}%
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center text-xs">
            <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
              <span className="text-gray-400 block text-[10px] font-bold uppercase">Calls Attempted</span>
              <span className="text-base font-black text-gray-900">{dashboardData.callMetrics.callsToday}</span>
            </div>
            <div className="bg-emerald-50/70 p-2.5 rounded-lg border border-emerald-100">
              <span className="text-emerald-700 block text-[10px] font-bold uppercase">Connected Calls</span>
              <span className="text-base font-black text-emerald-800">{dashboardData.callMetrics.connectedCalls}</span>
            </div>
            <div className="bg-blue-50/70 p-2.5 rounded-lg border border-blue-100">
              <span className="text-blue-700 block text-[10px] font-bold uppercase">Total Talk Time</span>
              <span className="text-base font-black text-blue-800">
                {Math.floor(dashboardData.callMetrics.totalTalkTimeSeconds / 60)}m {dashboardData.callMetrics.totalTalkTimeSeconds % 60}s
              </span>
            </div>
            <div className="bg-purple-50/70 p-2.5 rounded-lg border border-purple-100">
              <span className="text-purple-700 block text-[10px] font-bold uppercase">Avg Talk Time</span>
              <span className="text-base font-black text-purple-800">
                {Math.floor(dashboardData.callMetrics.avgTalkTimeSeconds / 60)}m {dashboardData.callMetrics.avgTalkTimeSeconds % 60}s
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Targets & Activity Progress Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Target Progress */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
              <Target className="h-4 w-4 text-primary-600" />
              Target Achievement
            </h2>
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-gray-700">Weekly Goal</span>
                <span className="text-gray-900 font-bold">
                  {weekly?.closedLeads || 0} / {weekly?.target || 0} Leads
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-primary-600 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      100,
                      ((weekly?.closedLeads || 0) / (weekly?.target || 1)) * 100
                    )}%`
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-gray-700">Monthly Goal</span>
                <span className="text-gray-900 font-bold">
                  {monthly?.closedLeads || 0} / {monthly?.target || 0} Leads
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      100,
                      ((monthly?.closedLeads || 0) / (monthly?.target || 1)) * 100
                    )}%`
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Target Comparison Chart or Compact Empty State */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 space-y-3">
          <div className="flex items-center justify-between border-b pb-2">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-emerald-600" />
              Target vs Conversions
            </h2>
          </div>
          {hasTargetData ? (
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="Target" fill="#E5E7EB" name="Assigned Target" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Achieved" fill="#2563EB" name="Conversions" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-44 flex flex-col items-center justify-center text-center p-4 border border-dashed border-gray-200 rounded-lg">
              <Activity className="h-8 w-8 text-gray-300 mb-1" />
              <p className="text-xs font-bold text-gray-600">No activity data yet</p>
              <p className="text-[11px] text-gray-400">Start processing leads in the Working Queue to see performance charts.</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Call Activity Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
            <Phone className="h-4 w-4 text-primary-600" />
            Recent Telephony Activity
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-[11px] font-bold text-gray-500 uppercase border-b border-gray-100">
              <tr>
                <th className="px-4 py-2.5">Time</th>
                <th className="px-4 py-2.5">Lead Name</th>
                <th className="px-4 py-2.5">Talk Duration</th>
                <th className="px-4 py-2.5">Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(recentCalls || []).map((call) => (
                <tr key={call.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-4 py-2.5 whitespace-nowrap text-gray-500">
                    {call.createdAt ? format(new Date(call.createdAt), 'MMM dd, HH:mm') : 'N/A'}
                  </td>
                  <td className="px-4 py-2.5 font-bold text-gray-900">
                    {call.Lead?.name || 'Lead'}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 font-medium">
                    {call.duration} sec
                  </td>
                  <td className="px-4 py-2.5 font-semibold text-gray-700">
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-50 text-blue-700 font-bold">
                      {call.outcome || 'Logged'}
                    </span>
                  </td>
                </tr>
              ))}
              {(!recentCalls || recentCalls.length === 0) && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                    No recent call activity logged.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SalespersonDashboard;
