import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { callAPI } from '../../services/api';
import { Phone, PhoneCall, PhoneMissed, Clock, CheckCircle2, Mic, Sparkles, TrendingUp, Calendar } from 'lucide-react';
import { format } from 'date-fns';

const CallAnalyticsDashboard = () => {
  const [timeframe, setTimeframe] = useState('today');

  const { data: analytics = {}, isLoading } = useQuery({
    queryKey: ['calls', 'analytics', timeframe],
    queryFn: () => callAPI.getCallAnalytics(timeframe).then(r => r.data?.data || {}),
    staleTime: 15000
  });

  const formatDuration = (totalSeconds) => {
    if (!totalSeconds) return '0m 0s';
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    const hours = Math.floor(mins / 60);
    if (hours > 0) {
      return `${hours}h ${mins % 60}m ${secs}s`;
    }
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="h-7 w-7 text-primary-600" />
            Telephony & Calling Analytics
          </h1>
          <p className="text-sm text-gray-500">
            Authoritative BDE talk-time utilization, connection rates, and calling activity
          </p>
        </div>

        {/* Timeframe Filter */}
        <div className="inline-flex p-1 bg-gray-100 rounded-xl text-xs font-bold text-gray-700">
          <button
            onClick={() => setTimeframe('today')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${timeframe === 'today' ? 'bg-white shadow text-primary-700' : 'hover:text-gray-900'}`}
          >
            Today
          </button>
          <button
            onClick={() => setTimeframe('week')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${timeframe === 'week' ? 'bg-white shadow text-primary-700' : 'hover:text-gray-900'}`}
          >
            Last 7 Days
          </button>
          <button
            onClick={() => setTimeframe('month')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${timeframe === 'month' ? 'bg-white shadow text-primary-700' : 'hover:text-gray-900'}`}
          >
            This Month
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-gray-400 animate-pulse font-medium">Calculating telephony analytics...</div>
      ) : (
        <div className="space-y-6">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
                <span>Calls Attempted</span>
                <Phone className="h-4 w-4 text-blue-500" />
              </div>
              <div className="text-2xl font-black text-gray-900">{analytics.callsAttempted || 0}</div>
              <div className="text-[11px] text-gray-400">Total SIM calls initiated</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
                <span>Connected Calls</span>
                <PhoneCall className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-black text-emerald-600">{analytics.connectedCalls || 0}</div>
              <div className="text-[11px] text-emerald-600 font-bold">{analytics.connectionRatePercent || 0}% Connection Rate</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
                <span>Missed / No Answer</span>
                <PhoneMissed className="h-4 w-4 text-amber-500" />
              </div>
              <div className="text-2xl font-black text-amber-600">{analytics.missedCalls || 0}</div>
              <div className="text-[11px] text-gray-400">No-answer, busy or failed</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
                <span>Total Talk Duration</span>
                <Clock className="h-4 w-4 text-purple-500" />
              </div>
              <div className="text-2xl font-black text-purple-700">{formatDuration(analytics.totalTalkTimeSeconds)}</div>
              <div className="text-[11px] text-gray-400">Avg: {formatDuration(analytics.avgTalkTimeSeconds)} / call</div>
            </div>
          </div>

          {/* Secondary Utilization & Recording Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Working Window & Utilization */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
              <div className="flex items-center gap-2 font-bold text-sm text-gray-900">
                <Calendar className="h-4 w-4 text-primary-600" />
                Working Window & Utilization
              </div>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-gray-500">First Call Attempt:</span>
                  <span className="font-semibold text-gray-900">{analytics.firstCallAt ? format(new Date(analytics.firstCallAt), 'HH:mm:ss') : 'N/A'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-gray-500">Last Call Attempt:</span>
                  <span className="font-semibold text-gray-900">{analytics.lastCallAt ? format(new Date(analytics.lastCallAt), 'HH:mm:ss') : 'N/A'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-gray-500">Active Calling Span:</span>
                  <span className="font-semibold text-gray-900">{analytics.workingWindowMinutes || 0} mins</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-500 font-bold">Talk-Time Utilization:</span>
                  <span className="font-extrabold text-emerald-600 text-sm">{analytics.talkTimeUtilizationPercent || 0}%</span>
                </div>
              </div>
            </div>

            {/* Unique Leads Called */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
              <div className="flex items-center gap-2 font-bold text-sm text-gray-900">
                <CheckCircle2 className="h-4 w-4 text-blue-600" />
                Lead Reach & Diversity
              </div>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-gray-500">Unique Leads Contacted:</span>
                  <span className="font-extrabold text-blue-700 text-base">{analytics.uniqueLeadsCalled || 0}</span>
                </div>
                <p className="text-gray-500 leading-relaxed pt-1">
                  Count of distinct CRM leads called during this timeframe.
                </p>
              </div>
            </div>

            {/* Recordings & AI Audits */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
              <div className="flex items-center gap-2 font-bold text-sm text-gray-900">
                <Sparkles className="h-4 w-4 text-purple-600" />
                Call Media & AI Intelligence
              </div>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-gray-500">Verified Audio Recordings:</span>
                  <span className="font-bold text-emerald-700">{analytics.recordedCalls || 0}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-gray-500">Completed AI Analyzed Calls:</span>
                  <span className="font-bold text-purple-700">{analytics.aiAnalyzedCalls || 0}</span>
                </div>
                <p className="text-gray-400 italic text-[11px] pt-1">
                  AI analysis executes strictly on verified accessible audio recordings.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CallAnalyticsDashboard;
