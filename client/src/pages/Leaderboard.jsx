import { useState, useEffect } from 'react';
import { dashboardAPI } from '../services/api';
import { Trophy, Award, TrendingUp, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { useBranch } from '../context/BranchContext';

const Leaderboard = () => {
  const { branch } = useBranch();
  const [leaderboard, setLeaderboard] = useState([]);
  const [period, setPeriod] = useState('month');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, [period, branch]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const response = await dashboardAPI.getLeaderboard({ period, branch });
      setLeaderboard(response.data.data);
    } catch (error) {
      toast.error('Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  const getMedalColor = (rank) => {
    switch (rank) {
      case 1:
        return 'text-yellow-500';
      case 2:
        return 'text-gray-400';
      case 3:
        return 'text-orange-600';
      default:
        return 'text-gray-300';
    }
  };

  const getMedalIcon = (rank) => {
    if (rank === 1) return '🏆';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const topPerformer = leaderboard[0];

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Leaderboard</h1>
          <p className="text-sm md:text-base text-gray-600 mt-1">Top performing salespeople</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setPeriod('week')}
            className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg font-medium transition-colors text-sm md:text-base ${period === 'week'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
          >
            This Week
          </button>
          <button
            onClick={() => setPeriod('month')}
            className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg font-medium transition-colors text-sm md:text-base ${period === 'month'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
          >
            This Month
          </button>
        </div>
      </div>

      {/* Star Performer */}
      {topPerformer && topPerformer.isStarPerformer && (
        <div className="card bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-yellow-400 p-3 md:p-4 rounded-full">
                <Star className="h-8 w-8 md:h-12 md:w-12 text-white fill-current" />
              </div>
              <div>
                <h2 className="text-lg md:text-2xl font-bold text-gray-900">
                  {period === 'week' ? 'Star of the Week' : 'Star of the Month'}
                </h2>
                <p className="text-base md:text-xl text-gray-700 mt-1">{topPerformer.name}</p>
                <p className="text-xs md:text-sm text-gray-600 truncate max-w-[200px] md:max-w-none">{topPerformer.email}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs md:text-sm text-gray-600">Total Revenue</p>
              <p className="text-2xl md:text-4xl font-bold text-green-600">
                {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(parseFloat(topPerformer.revenue))}
              </p>
              <p className="text-xs md:text-sm text-gray-600 mt-1">
                {topPerformer.closedLeads} deals closed
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard - Desktop Table */}
      <div className="hidden md:block card">
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
                  Total Leads
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Registered Leads
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Conversion Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Revenue
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {leaderboard.map((person) => (
                <tr
                  key={person.id}
                  className={`${person.rank === 1
                      ? 'bg-yellow-50'
                      : person.rank === 2
                        ? 'bg-gray-50'
                        : person.rank === 3
                          ? 'bg-orange-50'
                          : ''
                    } hover:bg-blue-50 transition-colors`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className={`text-3xl ${getMedalColor(person.rank)}`}>
                        {getMedalIcon(person.rank)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div>
                        <div className="text-sm font-medium text-gray-900 flex items-center">
                          {person.name}
                          {person.isStarPerformer && (
                            <Star className="h-4 w-4 text-yellow-500 ml-2 fill-current" />
                          )}
                        </div>
                        <div className="text-sm text-gray-500">{person.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 font-medium">{person.totalLeads}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-semibold text-green-600">{person.closedLeads}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="text-sm font-medium text-gray-900">{person.conversionRate}%</div>
                      <div className="ml-2 w-16 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-500 h-2 rounded-full"
                          style={{ width: `${Math.min(Math.max(parseFloat(person.conversionRate) || 0, 0), 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-bold text-gray-900">
                      {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(parseFloat(person.revenue))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {leaderboard.length === 0 && (
          <div className="text-center py-12">
            <Trophy className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No data available for this period</p>
          </div>
        )}
      </div>

      {/* Leaderboard - Mobile List */}
      <div className="md:hidden card p-0 overflow-hidden">
        {leaderboard.length === 0 ? (
          <div className="text-center py-10">
            <Trophy className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No data available for this period</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {leaderboard.map((person) => (
              <li key={person.id} className={`px-4 py-3 ${person.rank === 1
                  ? 'bg-yellow-50'
                  : person.rank === 2
                    ? 'bg-gray-50'
                    : person.rank === 3
                      ? 'bg-orange-50'
                      : 'bg-white'
                }`}>
                <div className="flex items-center gap-3">
                  <span className={`text-2xl ${getMedalColor(person.rank)}`}>
                    {getMedalIcon(person.rank)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 truncate">{person.name}</p>
                      {person.isStarPerformer && (
                        <Star className="h-4 w-4 text-yellow-500 fill-current" />
                      )}
                    </div>
                    <p className="text-xs text-gray-600 truncate">{person.email}</p>
                    <div className="mt-1 flex items-center justify-between text-xs">
                      <span className="text-gray-700">Leads: <strong>{person.totalLeads}</strong></span>
                      <span className="text-green-700">Registered: <strong>{person.closedLeads}</strong></span>
                      <span className="text-gray-700">Conv: <strong>{parseFloat(person.conversionRate).toFixed(1)}%</strong></span>
                      <span className="text-green-700 font-semibold">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(parseFloat(person.revenue))}</span>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Performance Stats */}
      {leaderboard.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card bg-gradient-to-br from-green-50 to-green-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700 font-medium">Total Revenue</p>
                <p className="text-3xl font-bold text-green-900 mt-2">
                  {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(leaderboard.reduce((sum, p) => sum + parseFloat(p.revenue), 0))}
                </p>
              </div>
              <TrendingUp className="h-12 w-12 text-green-600" />
            </div>
          </div>

          <div className="card bg-gradient-to-br from-blue-50 to-blue-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-700 font-medium">Total Registered Leads</p>
                <p className="text-3xl font-bold text-blue-900 mt-2">
                  {leaderboard.reduce((sum, p) => sum + p.closedLeads, 0)}
                </p>
              </div>
              <Award className="h-12 w-12 text-blue-600" />
            </div>
          </div>

          <div className="card bg-gradient-to-br from-purple-50 to-purple-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-700 font-medium">Avg Conversion Rate</p>
                <p className="text-3xl font-bold text-purple-900 mt-2">
                  {(
                    leaderboard.reduce((sum, p) => sum + parseFloat(p.conversionRate), 0) /
                    leaderboard.length
                  ).toFixed(2)}%
                </p>
              </div>
              <Trophy className="h-12 w-12 text-purple-600" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Leaderboard;
