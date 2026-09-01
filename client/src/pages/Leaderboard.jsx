import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardAPI } from '../services/api';
import { 
  Trophy, Award, Star, Flame, Zap, Search, ArrowUpRight, 
  Crown, Sparkles, CheckCircle2, UserCheck
} from 'lucide-react';
import { useBranch } from '../context/BranchContext';
import { useAuth } from '../context/AuthContext';

const Leaderboard = () => {
  const { branch } = useBranch();
  const { user } = useAuth();
  const [period, setPeriod] = useState('month'); // 'week' | 'month' | 'all'
  const [searchQuery, setSearchQuery] = useState('');

  const { data: leaderboard = [], isLoading } = useQuery({
    queryKey: ['leaderboard', period, branch],
    queryFn: () => dashboardAPI.getLeaderboard({ period: period === 'all' ? 'month' : period, branch }).then(r => r.data.data || []),
    staleTime: 60000
  });

  const filteredLeaderboard = leaderboard.filter(sp => 
    sp.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sp.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatInr = (amount) => {
    const val = Number(amount || 0);
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const top1 = leaderboard[0];
  const top2 = leaderboard[1];
  const top3 = leaderboard[2];

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Top Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-amber-600 via-yellow-600 to-amber-700 text-white p-8 rounded-3xl shadow-xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/20 text-yellow-100 text-xs font-bold backdrop-blur-md">
              <Crown className="w-4 h-4 text-amber-200 fill-amber-200" />
              <span>Sales Wall of Fame & Gamified Ranking</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              Sales Champions Leaderboard
            </h1>
            <p className="text-yellow-100 text-sm max-w-xl">
              Real-time rankings based on registrations, admissions fee collection, and total conversion revenue.
            </p>
          </div>

          {/* Period Toggle */}
          <div className="inline-flex p-1.5 bg-black/20 backdrop-blur-md rounded-2xl border border-white/20">
            {[
              { id: 'week', label: 'This Week' },
              { id: 'month', label: 'This Month' },
              { id: 'all', label: 'All Time' }
            ].map(p => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                  period === p.id
                    ? 'bg-white text-amber-900 shadow-lg scale-[1.02]'
                    : 'text-amber-100 hover:text-white hover:bg-white/10'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Champion Podium (Top 3) */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-56 bg-gray-200 animate-pulse rounded-3xl" />
          ))}
        </div>
      ) : (
        leaderboard.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end pt-4">
            {/* 2nd Place Silver */}
            {top2 ? (
              <div className="bg-gradient-to-b from-slate-50 to-white p-6 rounded-3xl border-2 border-slate-200 shadow-md flex flex-col items-center text-center relative overflow-hidden order-2 md:order-1 hover:shadow-xl transition-all">
                <div className="absolute top-3 left-3 bg-slate-200 text-slate-700 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider">
                  2nd Rank
                </div>
                <div className="relative mb-3 mt-2">
                  <div className="w-16 h-16 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-extrabold text-xl shadow-inner border-2 border-slate-300">
                    {getInitials(top2.name)}
                  </div>
                  <div className="absolute -bottom-1 -right-1 p-1.5 bg-slate-400 text-white rounded-full shadow">
                    <Award className="w-4 h-4" />
                  </div>
                </div>

                <h3 className="text-lg font-bold text-gray-900">{top2.name}</h3>
                <p className="text-xs text-gray-400 mb-4">{top2.email}</p>

                <div className="w-full pt-4 border-t border-slate-100 grid grid-cols-2 gap-2 text-center bg-slate-50/80 p-3 rounded-2xl">
                  <div>
                    <span className="text-[11px] text-gray-500 block font-medium">Registrations</span>
                    <span className="text-base font-extrabold text-slate-800">{top2.closedLeads}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-gray-500 block font-medium">Revenue</span>
                    <span className="text-base font-extrabold text-emerald-600">{formatInr(top2.revenue)}</span>
                  </div>
                </div>
              </div>
            ) : <div className="hidden md:block" />}

            {/* 1st Place Gold Champion */}
            {top1 && (
              <div className="bg-gradient-to-b from-amber-500 via-amber-400 to-yellow-500 p-7 rounded-3xl border-4 border-amber-300 shadow-2xl flex flex-col items-center text-center relative overflow-hidden order-1 md:order-2 transform md:-translate-y-4 text-slate-900 hover:scale-[1.02] transition-all">
                <div className="absolute top-3 left-3 bg-amber-900 text-amber-100 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow flex items-center gap-1">
                  <Crown className="w-3 h-3 text-amber-300 fill-amber-300" />
                  1st Champion
                </div>

                <div className="relative mb-3 mt-4">
                  <div className="w-20 h-20 rounded-full bg-amber-950 text-amber-200 flex items-center justify-center font-black text-2xl shadow-2xl border-4 border-amber-300">
                    {getInitials(top1.name)}
                  </div>
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 p-1.5 bg-yellow-300 text-amber-950 rounded-full shadow-lg border border-amber-400 animate-bounce">
                    <Sparkles className="w-4 h-4 fill-amber-950" />
                  </div>
                </div>

                <h3 className="text-xl font-extrabold text-amber-950">{top1.name}</h3>
                <p className="text-xs text-amber-900/80 mb-4 font-medium">{top1.email}</p>

                <div className="w-full pt-4 border-t border-amber-400/40 grid grid-cols-2 gap-2 text-center bg-amber-950/10 p-3.5 rounded-2xl backdrop-blur-sm">
                  <div>
                    <span className="text-[11px] text-amber-950 font-bold block">Registrations</span>
                    <span className="text-xl font-black text-amber-950">{top1.closedLeads}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-amber-950 font-bold block">Total Revenue</span>
                    <span className="text-xl font-black text-amber-950">{formatInr(top1.revenue)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* 3rd Place Bronze */}
            {top3 ? (
              <div className="bg-gradient-to-b from-amber-50/70 to-white p-6 rounded-3xl border-2 border-amber-200/80 shadow-md flex flex-col items-center text-center relative overflow-hidden order-3 hover:shadow-xl transition-all">
                <div className="absolute top-3 left-3 bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider">
                  3rd Rank
                </div>
                <div className="relative mb-3 mt-2">
                  <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-extrabold text-xl shadow-inner border-2 border-amber-200">
                    {getInitials(top3.name)}
                  </div>
                  <div className="absolute -bottom-1 -right-1 p-1.5 bg-amber-700 text-white rounded-full shadow">
                    <Star className="w-4 h-4 fill-white" />
                  </div>
                </div>

                <h3 className="text-lg font-bold text-gray-900">{top3.name}</h3>
                <p className="text-xs text-gray-400 mb-4">{top3.email}</p>

                <div className="w-full pt-4 border-t border-amber-100 grid grid-cols-2 gap-2 text-center bg-amber-50/60 p-3 rounded-2xl">
                  <div>
                    <span className="text-[11px] text-gray-500 block font-medium">Registrations</span>
                    <span className="text-base font-extrabold text-amber-800">{top3.closedLeads}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-gray-500 block font-medium">Revenue</span>
                    <span className="text-base font-extrabold text-emerald-600">{formatInr(top3.revenue)}</span>
                  </div>
                </div>
              </div>
            ) : <div className="hidden md:block" />}
          </div>
        )
      )}

      {/* Search & Full Leaderboard Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden space-y-4 p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              Complete Rankings Matrix
            </h2>
            <p className="text-xs text-gray-500">Showing {filteredLeaderboard.length} salesperson entries</p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search BDE by name..."
              className="input-field pl-9 w-full text-xs"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <th className="py-3.5 px-4">Rank</th>
                <th className="py-3.5 px-4">Salesperson</th>
                <th className="py-3.5 px-4 text-center">Total Assigned</th>
                <th className="py-3.5 px-4 text-center">Conversions</th>
                <th className="py-3.5 px-4 text-center">Conversion Rate</th>
                <th className="py-3.5 px-4 text-right">Revenue Collected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium">
              {filteredLeaderboard.map((sp, idx) => {
                const isCurrentUser = user && (user.id === sp.id || user.email === sp.email);
                const rank = sp.rank || idx + 1;
                const conversionRate = parseFloat(sp.conversionRate || 0);

                return (
                  <tr
                    key={sp.id || idx}
                    className={`transition-colors ${
                      isCurrentUser
                        ? 'bg-amber-50/70 hover:bg-amber-100/70 border-l-4 border-amber-500'
                        : 'hover:bg-gray-50/80'
                    }`}
                  >
                    <td className="py-4 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-extrabold ${
                          rank === 1 ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                          rank === 2 ? 'bg-slate-200 text-slate-800' :
                          rank === 3 ? 'bg-amber-200/60 text-amber-900' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          #{rank}
                        </span>
                        {isCurrentUser && (
                          <span className="text-[10px] bg-amber-500 text-white font-bold px-1.5 py-0.5 rounded-md">
                            YOU
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-4 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                          {getInitials(sp.name)}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 flex items-center gap-1.5">
                            {sp.name}
                            {rank === 1 && <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
                          </p>
                          <p className="text-xs text-gray-400 font-normal">{sp.email}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-4 text-center whitespace-nowrap font-mono text-gray-700">
                      {sp.totalLeads || 0}
                    </td>

                    <td className="py-4 px-4 text-center whitespace-nowrap">
                      <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-xs">
                        {sp.closedLeads || 0} registered
                      </span>
                    </td>

                    <td className="py-4 px-4 text-center whitespace-nowrap">
                      <div className="w-32 mx-auto space-y-1">
                        <div className="flex justify-between text-[11px] font-semibold text-gray-600">
                          <span>{conversionRate}%</span>
                        </div>
                        <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              conversionRate >= 20 ? 'bg-emerald-500' :
                              conversionRate >= 10 ? 'bg-indigo-500' :
                              'bg-amber-500'
                            }`}
                            style={{ width: `${Math.min(conversionRate, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-4 text-right whitespace-nowrap font-mono font-bold text-emerald-600">
                      {formatInr(sp.revenue)}
                    </td>
                  </tr>
                );
              })}

              {filteredLeaderboard.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-400 italic">
                    No leaderboard data matches the selected query
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

export default Leaderboard;
