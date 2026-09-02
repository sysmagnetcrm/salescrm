import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardAPI, userAPI } from '../../services/api';
import StatCard from '../../components/StatCard';
import StaleLeadsNotification from '../../components/StaleLeadsNotification';
import { Users, TrendingUp, Phone, IndianRupee, Target, Award } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, Label, LabelList } from 'recharts';
import toast from 'react-hot-toast';
import { useBranch } from '../../context/BranchContext';

const AdminDashboard = () => {
  const { branch } = useBranch();
  const [isMobile, setIsMobile] = useState(false);
  const [targetPeriod, setTargetPeriod] = useState('month'); // 'week' | 'month'

  const emptyCounts = { all: 0, fresh: 0, 'follow-up': 0, rnr: 0, closed: 0, dead: 0, cancelled: 0, rejected: 0 };

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Main Dashboard Query
  const { data: dashboardData, isLoading: isDashLoading } = useQuery({
    queryKey: ['dashboard', 'admin', branch],
    queryFn: () => dashboardAPI.getAdminDashboard({ branch }).then(r => r.data.data || {}),
    staleTime: 60000
  });

  // Sales Targets Query
  const { data: targetsData = [] } = useQuery({
    queryKey: ['targets', targetPeriod, branch],
    queryFn: async () => {
      const [lbRes, spRes] = await Promise.all([
        dashboardAPI.getLeaderboard({ period: targetPeriod === 'week' ? 'week' : 'month', branch }),
        userAPI.getSalespeople({ branch })
      ]);
      const leaderboard = lbRes.data?.data || [];
      const salespeople = spRes.data?.data || [];
      const conversionsById = new Map(leaderboard.map(r => [r.id, parseInt(r.closedLeads || 0)]));
      const merged = salespeople.map(u => ({
        id: u.id,
        name: u.name,
        conversions: conversionsById.get(u.id) || 0,
        target: parseInt((targetPeriod === 'week' ? u.weeklyTarget : u.monthlyTarget) || 0)
      }));
      merged.sort((a, b) => b.conversions - a.conversions);
      return merged;
    },
    staleTime: 60000
  });

  // Status Counts Queries
  const { data: dailyCounts = emptyCounts } = useQuery({
    queryKey: ['statusCounts', 'daily', branch],
    queryFn: () => dashboardAPI.getStatusCounts({ period: 'daily', branch }).then(r => r?.data?.statusCounts || emptyCounts),
    staleTime: 60000
  });

  const { data: weeklyCounts = emptyCounts } = useQuery({
    queryKey: ['statusCounts', 'weekly', branch],
    queryFn: () => dashboardAPI.getStatusCounts({ period: 'weekly', branch }).then(r => r?.data?.statusCounts || emptyCounts),
    staleTime: 60000
  });

  const { data: monthlyCounts = emptyCounts } = useQuery({
    queryKey: ['statusCounts', 'monthly', branch],
    queryFn: () => dashboardAPI.getStatusCounts({ period: 'monthly', branch }).then(r => r?.data?.statusCounts || emptyCounts),
    staleTime: 60000
  });

  // ── Capsule Design Status Summary Board (5% Opacity Backgrounds) ──────────
  const StatusSummaryBoard = ({ counts, label }) => {
    const items = [
      { key: 'all',       label: 'All',        color: 'bg-slate-900/5 text-slate-900 border-slate-900/20 hover:bg-slate-900/10', badge: 'bg-slate-900/10 text-slate-900' },
      { key: 'fresh',     label: 'Fresh',      color: 'bg-slate-500/5 text-slate-800 border-slate-400/20 hover:bg-slate-500/10', badge: 'bg-slate-500/10 text-slate-900' },
      { key: 'follow-up', label: 'Follow-up',  color: 'bg-amber-500/5 text-amber-950 border-amber-400/30 hover:bg-amber-500/10', badge: 'bg-amber-500/15 text-amber-950' },
      { key: 'rnr',       label: 'RNR',        color: 'bg-purple-500/5 text-purple-950 border-purple-400/30 hover:bg-purple-500/10', badge: 'bg-purple-500/15 text-purple-950' },
      { key: 'closed',    label: 'Registered', color: 'bg-emerald-500/5 text-emerald-950 border-emerald-400/30 hover:bg-emerald-500/10', badge: 'bg-emerald-500/15 text-emerald-950' },
      { key: 'dead',      label: 'Dead',       color: 'bg-rose-500/5 text-rose-950 border-rose-400/30 hover:bg-rose-500/10', badge: 'bg-rose-500/15 text-rose-950' },
      { key: 'cancelled', label: 'Cancelled',  color: 'bg-orange-500/5 text-orange-950 border-orange-400/30 hover:bg-orange-500/10', badge: 'bg-orange-500/15 text-orange-950' },
      { key: 'rejected',  label: 'Rejected',   color: 'bg-red-500/5 text-red-950 border-red-400/30 hover:bg-red-500/10', badge: 'bg-red-500/15 text-red-950' },
    ];
    const total = counts?.all || 0;
    return (
      <div className="flex flex-col space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">{label}</h3>
          <span className="text-xs font-black text-slate-800 bg-white/90 backdrop-blur-xs px-3 py-1 rounded-full border border-slate-200/80 shadow-2xs">
            {total.toLocaleString()} leads
          </span>
        </div>
        {/* Capsule Pills Row */}
        <div className="flex flex-wrap gap-2 items-center">
          {items.map(item => {
            const val = counts?.[item.key] ?? 0;
            return (
              <div
                key={item.key}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all duration-200 hover:scale-105 shadow-2xs ${item.color}`}
              >
                <span>{item.label}</span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-black tabular-nums ${item.badge}`}>
                  {val.toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };


  const { overview, leadsByStatus, topPerformers } = dashboardData || {};

  // Status-based colors as requested
  const STATUS_COLORS = {
    'fresh': '#FFFFFF',      // white
    'follow-up': '#F59E0B',  // orange
    'closed': '#10B981',     // green
    'dead': '#EF4444',       // red
    'rnr': '#9CA3AF',        // gray (fallback for RNR)
  };

  const totalStatusCount = Array.isArray(leadsByStatus)
    ? leadsByStatus.reduce((sum, s) => sum + Number(s.count || 0), 0)
    : 0;

  const percent = (value) => {
    if (!totalStatusCount) return '0%';
    const p = (Number(value) / totalStatusCount) * 100;
    return `${Math.round(p)}%`;
  };

  const formatInr = (amount) => {
    const numeric = Number(amount ?? 0);
    const safeValue = Number.isFinite(numeric) ? numeric : 0;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(safeValue);
  };

  const statusLabel = (st) => {
    if (st === 'closed') return 'Registered';
    if (!st) return 'Unknown';
    return st.charAt(0).toUpperCase() + st.slice(1);
  };

  const overviewList = [
    { title: 'Total Leads', value: overview?.totalLeads ?? 0, icon: Users, color: 'blue' },
    { title: 'Follow-ups Today', value: overview?.followUpsToday ?? 0, icon: Phone, color: 'yellow' },
    { title: 'Registered Students', value: overview?.closedLeads ?? 0, icon: Award, color: 'green' },
    { title: 'Total Revenue Collected', value: formatInr(overview?.totalRevenue), icon: IndianRupee, color: 'purple' },
    { title: 'Conversion Rate', value: `${overview?.conversionRate ?? 0}%`, icon: TrendingUp, color: 'indigo' },
    { title: 'Active BDEs', value: overview?.activeSalespeople ?? 0, icon: Target, color: 'pink' }
  ];

  return (
    <div className="space-y-6">
      <StaleLeadsNotification />
      <div className="relative overflow-hidden bg-gradient-to-r from-amber-50/80 via-rose-50/30 to-slate-50 rounded-3xl p-6 md:p-8 text-slate-900 shadow-sm border border-amber-100/60 backdrop-blur-md">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard Overview</h1>
        <p className="text-slate-500 text-xs mt-0.5 font-medium">Real-time performance, status summaries & sales metrics</p>
      </div>

      {/* Summary Status Cards */}
      {isDashLoading && !dashboardData ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-28 bg-slate-100 animate-pulse rounded-3xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {overviewList.map((item, idx) => (
            <StatCard key={idx} {...item} />
          ))}
        </div>
      )}

      {/* Status Summary Boards — Daily / Weekly / Monthly */}
      <div className="space-y-5">
        {[
          { label: 'Daily Activity', period: 'daily', counts: dailyCounts, grad: 'from-amber-50/70 via-orange-50/40 to-slate-50', border: 'border-amber-100/60' },
          { label: 'Weekly Activity', period: 'weekly', counts: weeklyCounts, grad: 'from-purple-50/70 via-indigo-50/40 to-slate-50', border: 'border-purple-100/60' },
          { label: 'Monthly Activity', period: 'monthly', counts: monthlyCounts, grad: 'from-emerald-50/70 via-teal-50/40 to-slate-50', border: 'border-emerald-100/60' }
        ].map(({ label, period, counts, grad, border }) => (
          <div key={period} className={`bg-gradient-to-r ${grad} rounded-3xl border ${border} p-6 shadow-sm backdrop-blur-md`}>
            <StatusSummaryBoard counts={counts} label={label} period={period} />
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leads by Status */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Leads by Status</h2>
          <div className="h-80 flex flex-col md:flex-row items-center justify-between">
            <div className="w-full md:w-1/2 h-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={leadsByStatus || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="count"
                    nameKey="status"
                  >
                    {(leadsByStatus || []).map((entry, index) => {
                      const st = String(entry.status || '').toLowerCase();
                      const color = STATUS_COLORS[st] || '#9CA3AF';
                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill={color}
                          stroke={st === 'fresh' ? '#D1D5DB' : 'none'}
                          strokeWidth={st === 'fresh' ? 1.5 : 0}
                        />
                      );
                    })}
                    <Label
                      value={`${totalStatusCount}`}
                      position="center"
                      className="text-xl font-bold fill-gray-900"
                    />
                  </Pie>
                  <Tooltip
                    formatter={(val, name) => [`${val} (${percent(val)})`, statusLabel(name)]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Custom Legend */}
            <div className="w-full md:w-1/2 mt-4 md:mt-0 pl-0 md:pl-4 space-y-2 max-h-72 overflow-y-auto">
              {(leadsByStatus || []).map((item, idx) => {
                const st = String(item.status || '').toLowerCase();
                const color = STATUS_COLORS[st] || '#9CA3AF';
                const isWhite = st === 'fresh';
                return (
                  <div key={idx} className="flex items-center justify-between text-sm py-1 border-b border-gray-50 last:border-0">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`w-3 h-3 rounded-full inline-block ${isWhite ? 'border border-gray-400' : ''}`}
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-gray-600 font-medium">{statusLabel(item.status)}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-gray-900">{item.count}</span>
                      <span className="text-xs text-gray-400 font-normal">({percent(item.count)})</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sales Targets Table */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Sales Targets</h2>
                <p className="text-xs text-gray-500">Conversions vs assigned target</p>
              </div>
              <div className="inline-flex p-1 bg-gray-100 rounded-full">
                <button
                  className={`px-3 py-1 text-sm rounded-full ${targetPeriod === 'week' ? 'bg-white shadow text-gray-900' : 'text-gray-600'}`}
                  onClick={() => setTargetPeriod('week')}
                >
                  Weekly
                </button>
                <button
                  className={`ml-1 px-3 py-1 text-sm rounded-full ${targetPeriod === 'month' ? 'bg-white shadow text-gray-900' : 'text-gray-600'}`}
                  onClick={() => setTargetPeriod('month')}
                >
                  Monthly
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Salesperson</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Conversions</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(targetsData || []).map((row) => (
                    <tr key={row.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{row.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{Number(row.conversions || 0)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{Number(row.target || 0)}</td>
                    </tr>
                  ))}
                  {(!targetsData || targetsData.length === 0) && (
                    <tr>
                      <td colSpan={3} className="px-6 py-6 text-center text-sm text-gray-500">No data</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Top Performers Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">BDE Leaderboard Overview</h2>
          <p className="text-sm text-gray-500">Top performing sales team members</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
              <tr>
                <th className="px-6 py-3">Rank</th>
                <th className="px-6 py-3">Salesperson</th>
                <th className="px-6 py-3">Conversions</th>
                <th className="px-6 py-3">Revenue</th>
                <th className="px-6 py-3">Total Leads</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {(topPerformers || []).map((performer, idx) => (
                <tr key={performer.id} className="hover:bg-gray-50/50">
                  <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-900">
                    #{idx + 1}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{performer.name}</div>
                    <div className="text-xs text-gray-500">{performer.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-semibold">
                    {performer.closedLeads}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                    ₹{Number(performer.revenue).toLocaleString('en-IN')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {performer.totalLeads}
                  </td>
                </tr>
              ))}
              {(!topPerformers || topPerformers.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No sales activity logged yet.
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

export default AdminDashboard;
