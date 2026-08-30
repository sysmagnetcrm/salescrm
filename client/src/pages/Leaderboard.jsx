import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardAPI } from '../services/api';
import { Trophy, Award, TrendingUp, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { useBranch } from '../context/BranchContext';
import { useAuth } from '../context/AuthContext';

const Leaderboard = () => {
  const { branch } = useBranch();
  const { user } = useAuth();
  const [period, setPeriod] = useState('month');

  const { data: leaderboard = [], isLoading } = useQuery({
    queryKey: ['leaderboard', period, branch],
    queryFn: () => dashboardAPI.getLeaderboard({ period, branch }).then(r => r.data.data || []),
    staleTime: 120000
  });

  const getMedalColor = (rank) => {
    switch (rank) {
      case 1:
        return 'text-yellow-500 bg-yellow-50 border-yellow-200';
      case 2:
        return 'text-gray-400 bg-gray-50 border-gray-200';
      case 3:
        return 'text-amber-600 bg-amber-50 border-amber-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-100';
    }
  };

  const getMedalIcon = (rank) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-6 w-6 text-yellow-500" />;
      case 2:
        return <Award className="h-6 w-6 text-gray-400" />;
      case 3:
        return <Award className="h-6 w-6 text-amber-600" />;
      default:
        return <Star className="h-5 w-5 text-gray-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Trophy className="h-7 w-7 text-yellow-500" />
            Sales Leaderboard
          </h1>
          <p className="text-sm text-gray-500">Top performers based on closed leads and conversions</p>
        </div>

        {/* Period Selector */}
        <div className="inline-flex p-1 bg-gray-100 rounded-lg">
          <button
            onClick={() => setPeriod('week')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              period === 'week'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Weekly
          </button>
          <button
            onClick={() => setPeriod('month')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              period === 'month'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Monthly
          </button>
        </div>
      </div>

      {/* Top 3 Performers Cards */}
      {isLoading && !leaderboard.length ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-44 bg-gray-200 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : (
        leaderboard.length >= 3 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 2nd Place */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center text-center relative overflow-hidden order-2 md:order-1">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gray-50 rounded-bl-full -z-0" />
              <div className="p-3 bg-gray-100 rounded-full mb-3 z-10">
                {getMedalIcon(2)}
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">2nd Place</span>
              <h3 className="text-lg font-bold text-gray-900 z-10">{leaderboard[1]?.name}</h3>
              <p className="text-xs text-gray-500 mb-4">{leaderboard[1]?.email}</p>
              <div className="w-full pt-4 border-t border-gray-100 grid grid-cols-2 gap-2 text-center">
                <div>
                  <p className="text-xs text-gray-500">Conversions</p>
                  <p className="text-lg font-bold text-primary-600">{leaderboard[1]?.closedLeads}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Revenue</p>
                  <p className="text-lg font-bold text-green-600">₹{Number(leaderboard[1]?.revenue || 0).toLocaleString('en-IN')}</p>
                </div>
              </div>
            </div>

            {/* 1st Place */}
            <div className="bg-white p-6 rounded-2xl shadow-md border-2 border-yellow-200 flex flex-col items-center text-center relative overflow-hidden order-1 md:order-2 transform md:-translate-y-2">
              <div className="absolute top-0 right-0 w-28 h-28 bg-yellow-50 rounded-bl-full -z-0" />
              <div className="p-4 bg-yellow-100 rounded-full mb-3 z-10">
                {getMedalIcon(1)}
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-yellow-600 mb-1">Champion</span>
              <h3 className="text-xl font-bold text-gray-900 z-10">{leaderboard[0]?.name}</h3>
              <p className="text-xs text-gray-500 mb-4">{leaderboard[0]?.email}</p>
              <div className="w-full pt-4 border-t border-gray-100 grid grid-cols-2 gap-2 text-center">
                <div>
                  <p className="text-xs text-gray-500">Conversions</p>
                  <p className="text-xl font-bold text-primary-600">{leaderboard[0]?.closedLeads}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Revenue</p>
                  <p className="text-xl font-bold text-green-600">₹{Number(leaderboard[0]?.revenue || 0).toLocaleString('en-IN')}</p>
                </div>
              </div>
            </div>

            {/* 3rd Place */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center text-center relative overflow-hidden order-3">
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-bl-full -z-0" />
              <div className="p-3 bg-amber-100 rounded-full mb-3 z-10">
                {getMedalIcon(3)}
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-600 mb-1">3rd Place</span>
              <h3 className="text-lg font-bold text-gray-900 z-10">{leaderboard[2]?.name}</h3>
              <p className="text-xs text-gray-500 mb-4">{leaderboard[2]?.email}</p>
              <div className="w-full pt-4 border-t border-gray-100 grid grid-cols-2 gap-2 text-center">
                <div>
                  <p className="text-xs text-gray-500">Conversions</p>
                  <p className="text-lg font-bold text-primary-600">{leaderboard[2]?.closedLeads}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Revenue</p>
                  <p className="text-lg font-bold text-green-600">₹{Number(leaderboard[2]?.revenue || 0).toLocaleString('en-IN')}</p>
                </div>
              </div>
            </div>
          </div>
        )
      )}

      {/* Full Leaderboard Table (Desktop) & Cards (Mobile) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">Complete Rankings</h2>
        </div>

        {/* DESKTOP TABLE */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase border-b border-gray-200">
              <tr>
                <th className="px-6 py-3">Rank</th>
                <th className="px-6 py-3">Salesperson</th>
                <th className="px-6 py-3 text-center">Conversions</th>
                <th className="px-6 py-3 text-center">Total Leads</th>
                <th className="px-6 py-3 text-center">Conversion Rate</th>
                <th className="px-6 py-3 text-right">Revenue Generated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {leaderboard.map((item, index) => {
                const rank = index + 1;
                const isCurrentUser = user?.id && String(user.id) === String(item.id);
                return (
                  <tr key={item.id} className={`hover:bg-gray-50/50 transition-colors ${isCurrentUser ? 'bg-primary-50/60 font-semibold' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border ${getMedalColor(rank)}`}>
                          {rank}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-semibold text-gray-900 flex items-center gap-1.5">
                        <span>{item.name}</span>
                        {isCurrentUser && (
                          <span className="px-2 py-0.2 rounded-full text-[10px] font-black bg-primary-600 text-white">YOU</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">{item.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center font-bold text-green-600">
                      {item.closedLeads}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-gray-600">
                      {item.totalLeads}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                        {item.totalLeads > 0 ? ((item.closedLeads / item.totalLeads) * 100).toFixed(1) : 0}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-gray-900">
                      ₹{Number(item.revenue || 0).toLocaleString('en-IN')}
                    </td>
                  </tr>
                );
              })}
              {leaderboard.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No leaderboard data available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* MOBILE CARDS */}
        <div className="md:hidden space-y-2.5 p-3 bg-gray-50/50">
          {leaderboard.map((item, index) => {
            const rank = index + 1;
            const isCurrentUser = user?.id && String(user.id) === String(item.id);
            return (
              <div
                key={item.id}
                className={`p-3 bg-white rounded-xl shadow-sm border transition-all ${
                  isCurrentUser ? 'border-primary-500 ring-2 ring-primary-500/20 bg-primary-50/30' : 'border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs border ${getMedalColor(rank)}`}>
                      {rank}
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1">
                        <span>{item.name}</span>
                        {isCurrentUser && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-primary-600 text-white">YOU</span>
                        )}
                      </h3>
                      <p className="text-[11px] text-gray-500">{item.closedLeads} conversions ({item.totalLeads > 0 ? ((item.closedLeads / item.totalLeads) * 100).toFixed(0) : 0}%)</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-black text-emerald-600 block">
                      ₹{Number(item.revenue || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
          {leaderboard.length === 0 && !isLoading && (
            <div className="p-6 text-center text-gray-400 text-xs">
              No leaderboard data available.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
