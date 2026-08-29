import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardAPI } from '../../services/api';
import StatCard from '../../components/StatCard';
import { ClipboardList, Phone, CheckCircle, XCircle, DollarSign, Target } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const SalespersonDashboard = () => {
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['dashboard', 'salesperson'],
    queryFn: () => dashboardAPI.getSalespersonDashboard().then(r => r.data.data || {}),
    staleTime: 60000
  });

  const { overview, monthly, weekly, recentCalls } = dashboardData || {};

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Performance Dashboard</h1>
        <p className="text-sm text-gray-500">Track your leads, sales conversions, and activity metrics</p>
      </div>

      {/* Overview Cards */}
      {isLoading && !dashboardData ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 bg-gray-200 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Assigned Leads"
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
            title="Total Registered Students"
            value={overview?.closedLeads ?? 0}
            icon={CheckCircle}
            color="green"
          />
          <StatCard
            title="Revenue Generated"
            value={formatCurrency(overview?.totalRevenue)}
            icon={DollarSign}
            color="purple"
          />
        </div>
      )}

      {/* Target Progress & Chart Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly & Monthly Targets */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Target Achievement</h2>
          <div className="space-y-6">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium text-gray-700">Weekly Target Progress</span>
                <span className="text-gray-900 font-bold">
                  {weekly?.closedLeads || 0} / {weekly?.target || 0} Leads
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
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
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium text-gray-700">Monthly Target Progress</span>
                <span className="text-gray-900 font-bold">
                  {monthly?.closedLeads || 0} / {monthly?.target || 0} Leads
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-green-600 h-full rounded-full transition-all duration-500"
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

        {/* Target vs Achievement Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Target Comparison</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="Target" fill="#E5E7EB" name="Assigned Target" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Achieved" fill="#2563EB" name="Conversions" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Activity / Calls */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Recent Call Activity</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs font-medium text-gray-500 uppercase">
              <tr>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Lead</th>
                <th className="px-6 py-3">Duration</th>
                <th className="px-6 py-3">Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(recentCalls || []).map((call) => (
                <tr key={call.id} className="hover:bg-gray-50/50">
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                    {call.createdAt ? format(new Date(call.createdAt), 'MMM dd, HH:mm') : 'N/A'}
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {call.Lead?.name || 'Lead'}
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {call.duration} sec
                  </td>
                  <td className="px-6 py-4 font-semibold text-gray-700">
                    {call.outcome || 'Logged'}
                  </td>
                </tr>
              ))}
              {(!recentCalls || recentCalls.length === 0) && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    No recent calls logged.
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
