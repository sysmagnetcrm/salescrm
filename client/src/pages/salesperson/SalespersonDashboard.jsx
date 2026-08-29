import { useState, useEffect } from 'react';
import { dashboardAPI } from '../../services/api';
import StatCard from '../../components/StatCard';
import { ClipboardList, Phone, CheckCircle, XCircle, DollarSign, Target } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const SalespersonDashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const response = await dashboardAPI.getSalespersonDashboard();
      setDashboardData(response.data.data);
    } catch (error) {
      toast.error('Failed to load dashboard');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">My Dashboard</h1>
        <p className="text-gray-600 mt-1">Track your performance and manage your leads</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Leads"
          value={overview?.totalLeads || 0}
          icon={ClipboardList}
          color="primary"
        />
        <StatCard
          title="Follow-ups"
          value={overview?.followUpLeads || 0}
          icon={Phone}
          color="orange"
        />
        <StatCard
          title="Registered Leads"
          value={overview?.closedLeads || 0}
          icon={CheckCircle}
          color="green"
        />
        <StatCard
          title="Dead Leads"
          value={overview?.deadLeads || 0}
          icon={XCircle}
          color="red"
        />
      </div>

      {/* Performance Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Closings Target vs Achieved (Number of conversions) */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Closings Target vs Achieved</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip formatter={(value) => [`${value} conversions`, '']} />
              <Legend />
              <Bar dataKey="Target" fill="#94a3b8" name="Target (Closings)" />
              <Bar dataKey="Achieved" fill="#10b981" name="Achieved (Closings)" />
            </BarChart>
          </ResponsiveContainer>
          
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600">Weekly Achievement</p>
              <p className="text-2xl font-bold text-primary-600">{weekly?.achievement || 0}%</p>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-600">Monthly Achievement</p>
              <p className="text-2xl font-bold text-green-600">{monthly?.achievement || 0}%</p>
            </div>
          </div>
        </div>

        {/* Revenue Summary */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Revenue Summary</h2>
          <div className="space-y-4">
            <div className="p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-700 font-medium">Monthly Revenue</p>
                  <p className="text-3xl font-bold text-green-900 mt-1">
                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(parseFloat(monthly?.revenue || 0))}
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    Target: {parseInt(monthly?.target || 0)} conversions
                  </p>
                </div>
                <DollarSign className="h-12 w-12 text-green-600" />
              </div>
            </div>

            <div className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-700 font-medium">Weekly Revenue</p>
                  <p className="text-3xl font-bold text-blue-900 mt-1">
                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(parseFloat(weekly?.revenue || 0))}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    Target: {parseInt(weekly?.target || 0)} conversions
                  </p>
                </div>
                <Target className="h-12 w-12 text-blue-600" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">This Week</p>
                <p className="text-xl font-bold text-gray-900">{weekly?.closedLeads || 0} Registered</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">This Month</p>
                <p className="text-xl font-bold text-gray-900">{monthly?.closedLeads || 0} Registered</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Calls */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Calls</h2>
        {recentCalls && recentCalls.length > 0 ? (
          <div className="space-y-3">
            {recentCalls.map((lead) => (
              <div key={lead.id} className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div>
                  <h4 className="font-semibold text-gray-900">{lead.name}</h4>
                  <p className="text-sm text-gray-600">{lead.phone}</p>
                  {lead.country && (
                    <p className="text-sm text-gray-500">{lead.country}</p>
                  )}
                  {lead.product && (
                    <p className="text-sm text-gray-500">{lead.product}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-blue-700">
                    {format(new Date(lead.lastCalled), 'MMM dd, yyyy')}
                  </p>
                  <p className="text-xs text-gray-500">
                    {format(new Date(lead.lastCalled), 'h:mm a')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No recent calls</p>
        )}
      </div>
    </div>
  );
};

export default SalespersonDashboard;
