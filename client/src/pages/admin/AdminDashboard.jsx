import { useState, useEffect } from 'react';
import { dashboardAPI, userAPI } from '../../services/api';
import StatCard from '../../components/StatCard';
import StaleLeadsNotification from '../../components/StaleLeadsNotification';
import { Users, TrendingUp, Phone, IndianRupee, Target, Award } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, Label, LabelList } from 'recharts';
import toast from 'react-hot-toast';
import { useBranch } from '../../context/BranchContext';

let adminDashboardCache = null;

const AdminDashboard = () => {
  const { branch } = useBranch();
  const [dashboardData, setDashboardData] = useState(adminDashboardCache?.dashboardData || null);
  const [loading, setLoading] = useState(!adminDashboardCache);
  const [isMobile, setIsMobile] = useState(false);
  const [targetPeriod, setTargetPeriod] = useState('month'); // 'week' | 'month'
  const [targetsData, setTargetsData] = useState(adminDashboardCache?.targetsData || []);
  const emptyCounts = { all: 0, fresh: 0, 'follow-up': 0, rnr: 0, closed: 0, dead: 0, cancelled: 0, rejected: 0 };
  const [dailyCounts, setDailyCounts] = useState(adminDashboardCache?.dailyCounts || emptyCounts);
  const [monthlyCounts, setMonthlyCounts] = useState(adminDashboardCache?.monthlyCounts || emptyCounts);
  const [weeklyCounts, setWeeklyCounts] = useState(adminDashboardCache?.weeklyCounts || emptyCounts);

  useEffect(() => {
    fetchAllDashboardData();
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [branch]);

  const fetchAllDashboardData = async () => {
    try {
      const [dashRes, lbRes, spRes, dRes, wRes, mRes] = await Promise.allSettled([
        dashboardAPI.getAdminDashboard({ branch }),
        dashboardAPI.getLeaderboard({ period: targetPeriod === 'week' ? 'week' : 'month', branch }),
        userAPI.getSalespeople({ branch }),
        dashboardAPI.getStatusCounts({ period: 'daily', branch }),
        dashboardAPI.getStatusCounts({ period: 'weekly', branch }),
        dashboardAPI.getStatusCounts({ period: 'monthly', branch })
      ]);

      let baseData = dashboardData;
      if (dashRes.status === 'fulfilled') {
        baseData = dashRes.value.data.data || {};
        setDashboardData(baseData);
      }

      let mergedTargets = targetsData;
      if (lbRes.status === 'fulfilled' && spRes.status === 'fulfilled') {
        const leaderboard = lbRes.value.data?.data || [];
        const salespeople = spRes.value.data?.data || [];
        const conversionsById = new Map(leaderboard.map(r => [r.id, parseInt(r.closedLeads || 0)]));
        mergedTargets = salespeople.map(u => ({
          id: u.id,
          name: u.name,
          conversions: conversionsById.get(u.id) || 0,
          target: parseInt((targetPeriod === 'week' ? u.weeklyTarget : u.monthlyTarget) || 0)
        }));
        mergedTargets.sort((a, b) => b.conversions - a.conversions);
        setTargetsData(mergedTargets);
      }

      let dC = dailyCounts, wC = weeklyCounts, mC = monthlyCounts;
      if (dRes.status === 'fulfilled') { dC = dRes.value?.data?.statusCounts || emptyCounts; setDailyCounts(dC); }
      if (wRes.status === 'fulfilled') { wC = wRes.value?.data?.statusCounts || emptyCounts; setWeeklyCounts(wC); }
      if (mRes.status === 'fulfilled') { mC = mRes.value?.data?.statusCounts || emptyCounts; setMonthlyCounts(mC); }

      // Save to memory cache for instant future renders
      adminDashboardCache = {
        dashboardData: baseData,
        targetsData: mergedTargets,
        dailyCounts: dC,
        weeklyCounts: wC,
        monthlyCounts: mC
      };
    } catch (error) {
      if (!adminDashboardCache) toast.error('Failed to load dashboard');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Local component: non-interactive chips matching AllLeads styles
  const StatusChips = ({ counts }) => {
    const items = [
      { key: '', label: 'All', color: 'bg-gray-100 text-gray-800' },
      { key: 'fresh', label: 'Fresh', color: 'bg-white border-2 border-gray-300' },
      { key: 'follow-up', label: 'Follow-up', color: 'bg-orange-100 text-orange-800' },
      { key: 'rnr', label: 'RNR', color: 'bg-purple-100 text-purple-800' },
      { key: 'closed', label: 'Registered', color: 'bg-green-100 text-green-800' },
      { key: 'dead', label: 'Dead', color: 'bg-red-100 text-red-800' },
      { key: 'cancelled', label: 'Cancelled', color: 'bg-red-100 text-red-800' },
      { key: 'rejected', label: 'Rejected', color: 'bg-red-100 text-red-800' }
    ];

    return (
      <>
        {/* Mobile/Tablet grid */}
        <div className="grid grid-cols-4 gap-2 lg:hidden">
          {items.map((tab) => (
            <div
              key={tab.key || 'all'}
              className={`inline-flex items-center justify-center w-full h-7 px-2 py-0.5 text-[10px] rounded-full font-medium whitespace-nowrap ${tab.color}`}
            >
              {tab.label} ({counts?.[tab.key || 'all'] ?? 0})
            </div>
          ))}
        </div>
        {/* Desktop horizontal chips */}
        <div className="hidden lg:flex flex-wrap gap-2 mt-1">
          {items.map((tab) => (
            <div
              key={`lg-${tab.key || 'all'}`}
              className={`inline-flex items-center justify-center h-8 px-3 rounded-full text-sm font-medium whitespace-nowrap shadow-sm border ${tab.color}`}
            >
              {tab.label} ({counts?.[tab.key || 'all'] ?? 0})
            </div>
          ))}
        </div>
      </>
    );
  };

  // Fetch status counts for Daily, Weekly, Monthly (each independently to avoid failing all)
  const fetchStatusBoards = async () => {
    let anyFailed = false;
    // Daily
    try {
      const dRes = await dashboardAPI.getStatusCounts({ period: 'daily', branch });
      setDailyCounts(dRes?.data?.statusCounts || emptyCounts);
    } catch (err) {
      anyFailed = true;
      setDailyCounts(emptyCounts);
      console.warn('Daily status counts unavailable:', err?.response?.status || err?.message);
    }
    // Weekly
    try {
      const wRes = await dashboardAPI.getStatusCounts({ period: 'weekly', branch });
      setWeeklyCounts(wRes?.data?.statusCounts || emptyCounts);
    } catch (err) {
      anyFailed = true;
      setWeeklyCounts(emptyCounts);
      console.warn('Weekly status counts unavailable:', err?.response?.status || err?.message);
    }
    // Monthly
    try {
      const mRes = await dashboardAPI.getStatusCounts({ period: 'monthly', branch });
      setMonthlyCounts(mRes?.data?.statusCounts || emptyCounts);
    } catch (err) {
      anyFailed = true;
      setMonthlyCounts(emptyCounts);
      console.warn('Monthly status counts unavailable:', err?.response?.status || err?.message);
    }
    if (anyFailed) {
      // Show a single toast only once per load cycle
      toast.error('Status boards unavailable (server endpoint not found).');
    }
  };

  const buildTargets = async (period) => {
    const [lbRes, spRes] = await Promise.all([
      dashboardAPI.getLeaderboard({ period: period === 'week' ? 'week' : 'month', branch }),
      userAPI.getSalespeople({ branch })
    ]);
    const leaderboard = lbRes.data?.data || [];
    const salespeople = spRes.data?.data || [];
    const conversionsById = new Map(leaderboard.map(r => [r.id, parseInt(r.closedLeads || 0)]));
    const merged = salespeople.map(u => ({
      id: u.id,
      name: u.name,
      conversions: conversionsById.get(u.id) || 0,
      target: parseInt((period === 'week' ? u.weeklyTarget : u.monthlyTarget) || 0)
    }));
    // Sort by conversions desc
    merged.sort((a, b) => b.conversions - a.conversions);
    setTargetsData(merged);
  };

  // Rebuild targets when user switches period
  useEffect(() => {
    buildTargets(targetPeriod);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetPeriod]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

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

  return (
    <div className="space-y-6">
      {/* Stale Leads Notification */}
      <StaleLeadsNotification />

      <div>
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600 mt-1">Overview of your CRM performance</p>
      </div>

      {/* Lead Status Boards: Daily, Weekly, Monthly */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Daily */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Daily Lead Status</h2>
          <StatusChips counts={dailyCounts} />
        </div>
        {/* Weekly */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Weekly Lead Status</h2>
          <StatusChips counts={weeklyCounts} />
        </div>
        {/* Monthly */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Monthly Lead Status</h2>
          <StatusChips counts={monthlyCounts} />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Leads"
          value={overview?.totalLeads || 0}
          icon={Users}
          color="primary"
        />
        <StatCard
          title="This Month"
          value={overview?.leadsThisMonth || 0}
          icon={TrendingUp}
          color="green"
        />
        <StatCard
          title="Follow-ups"
          value={overview?.followUpsCount || 0}
          icon={Phone}
          color="orange"
        />
        <StatCard
          title="Monthly Revenue"
          value={formatInr(overview?.monthlyRevenue)}
          icon={IndianRupee}
          color="green"
          subtitle={`${overview?.conversionRate || 0}% conversion`}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leads by Status */}
        <div className="card overflow-visible">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Leads by Status</h2>
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={leadsByStatus}
                cx="50%"
                cy="50%"
                innerRadius={isMobile ? 55 : 70}
                outerRadius={isMobile ? 90 : 110}
                paddingAngle={2}
                cornerRadius={6}
                labelLine={false}
                label={isMobile ? false : ((props) => {
                  const { cx, cy, midAngle, innerRadius, outerRadius, value, payload } = props;
                  if (!value || totalStatusCount === 0) return null;
                  const share = Number(value) / totalStatusCount;
                  if (share < 0.03) return null; // hide tiny slices
                  const RADIAN = Math.PI / 180;
                  // place label at the midpoint of the ring thickness
                  const r = (innerRadius + outerRadius) / 2;
                  const x = cx + r * Math.cos(-midAngle * RADIAN);
                  const y = cy + r * Math.sin(-midAngle * RADIAN);
                  const text = `${Math.round(share * 100)}%`;
                  const fill = payload?.status === 'fresh' ? '#111827' : '#ffffff';
                  return (
                    <text x={x} y={y} fill={fill} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={700}>
                      {text}
                    </text>
                  );
                })}
                dataKey="count"
                nameKey="status"
              >
                {leadsByStatus?.map((entry, index) => {
                  const fill = STATUS_COLORS[entry.status] || '#9CA3AF';
                  return (
                    <Cell key={`cell-${index}`} fill={fill} stroke="#e5e7eb" strokeWidth={2} />
                  );
                })}
                {!isMobile && (
                  <Label
                    position="center"
                    content={({ viewBox }) => {
                      const { cx, cy } = viewBox;
                      return (
                        <g>
                          <text x={cx} y={cy - 4} textAnchor="middle" dominantBaseline="central" fontSize={24} fontWeight={700} fill="#111827">
                            {totalStatusCount.toLocaleString('en-IN')}
                          </text>
                          <text x={cx} y={cy + 18} textAnchor="middle" dominantBaseline="central" fontSize={12} fill="#6B7280">
                            Leads
                          </text>
                        </g>
                      );
                    }}
                  />
                )}
              </Pie>
              <Tooltip
                formatter={(value, name, props) => [
                  `${Number(value).toLocaleString()} (${percent(value)})`,
                  props?.payload?.status || name
                ]}
              />
              <Legend verticalAlign={isMobile ? 'bottom' : 'right'} align={isMobile ? 'center' : 'right'} layout={isMobile ? 'horizontal' : 'vertical'} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Top Performers */}
        <div className="card overflow-visible">
          <h2 className="text-xl font-semibold text-gray-900">Top Registrations</h2>
          <p className="text-sm text-gray-500 mb-4">Ranked by registered leads this month</p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topPerformers} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: isMobile ? 10 : 12 }} />
              <YAxis width={isMobile ? 30 : 40} allowDecimals={false} label={{ value: 'Registrations', angle: -90, position: 'insideLeft', offset: 10 }} />
              <Tooltip formatter={(value) => [`${value} registrations`, 'Registered Leads']} />
              <Bar dataKey="closedLeads" fill="#10b981" name="Registered Leads" barSize={isMobile ? 28 : 32} radius={[6, 6, 0, 0]}>
                <LabelList dataKey="closedLeads" position="top" fill="#047857" formatter={(val) => `${val}`} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Targets Table: Salesperson | Conversions | Target */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Targets ({targetPeriod === 'week' ? 'This Week' : 'This Month'})</h2>
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

      {/* Top Performers Table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Leaderboard</h2>
          <Award className="h-6 w-6 text-yellow-500" />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rank
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Salesperson
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Registrations
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Revenue (₹)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Leads
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {topPerformers?.map((performer, index) => (
                <tr key={performer.id} className={index === 0 ? 'bg-yellow-50' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-2xl ${index === 0 ? 'text-yellow-500' : 'text-gray-400'}`}>
                      {index === 0 ? '🏆' : `#${index + 1}`}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{performer.name}</div>
                    <div className="text-sm text-gray-500">{performer.email}</div>
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
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
