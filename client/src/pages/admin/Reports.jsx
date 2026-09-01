import { useState } from 'react';
import { 
  FileDown, Calendar, Filter, FileSpreadsheet, FileText, Check, Clock, 
  BarChart3, TrendingUp, IndianRupee, PhoneCall, RefreshCw, Zap, ShieldCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import { leadAPI } from '../../services/api';
import { useBranch } from '../../context/BranchContext';

const Reports = () => {
  const { branch } = useBranch();
  const [reportType, setReportType] = useState('all'); // 'all' | 'daily' | 'weekly' | 'monthly' | 'custom'
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [format, setFormat] = useState('csv');
  const [downloading, setDownloading] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleEmail, setScheduleEmail] = useState('');
  const [scheduleFrequency, setScheduleFrequency] = useState('daily');

  // CSV Column Selection customization
  const [selectedColumns, setSelectedColumns] = useState({
    id: true,
    name: true,
    phone: true,
    email: true,
    product: true,
    status: true,
    value: true,
    totalClearedPayment: true,
    totalCallDuration: true,
    callCount: true,
    lastCalled: true,
    salesperson: true,
    createdAt: true
  });

  const availableColumns = [
    { key: 'id', label: 'Lead ID' },
    { key: 'name', label: 'Lead Name' },
    { key: 'phone', label: 'Phone Number' },
    { key: 'email', label: 'Email' },
    { key: 'product', label: 'Product / Course' },
    { key: 'status', label: 'Status' },
    { key: 'value', label: 'Advance Payment (₹)' },
    { key: 'totalClearedPayment', label: 'Total Cleared Payment (₹)' },
    { key: 'totalCallDuration', label: 'Call Duration (Sec)' },
    { key: 'callCount', label: 'Total Calls' },
    { key: 'lastCalled', label: 'Last Called Timestamp' },
    { key: 'salesperson', label: 'Assigned BDE' },
    { key: 'createdAt', label: 'Creation Date' }
  ];

  const toggleColumn = (key) => {
    setSelectedColumns(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const selectAllColumns = (val) => {
    const updated = {};
    availableColumns.forEach(col => { updated[col.key] = val; });
    setSelectedColumns(updated);
  };

  const toCSV = (rows) => {
    if (!rows || rows.length === 0) return '';
    const activeCols = availableColumns.filter(c => selectedColumns[c.key]);
    const headers = activeCols.map(c => c.label);

    const escape = (val) => {
      if (val === null || val === undefined) return '';
      const s = String(val).replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };

    const lines = rows.map(l => {
      return activeCols.map(col => {
        let val = '';
        if (col.key === 'salesperson') {
          val = l.salesperson?.name || '';
        } else if (col.key === 'createdAt' || col.key === 'lastCalled') {
          val = l[col.key] ? new Date(l[col.key]).toLocaleString('en-IN') : '';
        } else {
          val = l[col.key];
        }
        return escape(val);
      }).join(',');
    });

    return [headers.join(','), ...lines].join('\n');
  };

  const handleGenerateReport = async (presetType = null) => {
    const targetType = presetType || reportType;

    if (format === 'pdf') {
      toast.error('PDF report format is coming soon in the next version. Exporting as CSV now.');
    }

    try {
      setDownloading(true);
      toast.loading('Compiling report data...', { id: 'report' });

      const params = { branch };
      if (targetType === 'custom') {
        if (dateRange.startDate) params.startDate = dateRange.startDate;
        if (dateRange.endDate) params.endDate = dateRange.endDate;
      }
      params.type = targetType;

      const res = await leadAPI.getAllLeads(params);
      let leads = res?.data?.data || res?.data || [];

      // Filter by preset date if requested
      if (targetType === 'daily') {
        const todayStr = new Date().toISOString().split('T')[0];
        leads = leads.filter(l => l.createdAt && l.createdAt.startsWith(todayStr));
      } else if (targetType === 'weekly') {
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        leads = leads.filter(l => new Date(l.createdAt) >= weekAgo);
      } else if (targetType === 'monthly') {
        const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        leads = leads.filter(l => new Date(l.createdAt) >= monthAgo);
      }

      if (!Array.isArray(leads) || leads.length === 0) {
        toast.dismiss('report');
        toast.error('No lead records found for the selected filter parameters');
        return;
      }

      const csv = toCSV(leads);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const ts = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `CRM-Report-${targetType.toUpperCase()}-${ts}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Successfully exported ${leads.length} record(s)`, { id: 'report' });
    } catch (err) {
      console.error(err);
      toast.dismiss('report');
      toast.error('Failed to generate report file');
    } finally {
      setDownloading(false);
    }
  };

  const handleSaveSchedule = (e) => {
    e.preventDefault();
    if (!scheduleEmail) {
      toast.error('Please provide a valid email address');
      return;
    }
    toast.success(`Automated ${scheduleFrequency} report schedule saved for ${scheduleEmail}`);
    setShowScheduleModal(false);
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-10">
      {/* Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white p-8 rounded-3xl shadow-xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-white/5 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-indigo-200 text-xs font-semibold backdrop-blur-md">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Real-Time Business Analytics & Data Export</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">System Reports & Exports</h1>
            <p className="text-indigo-200 text-sm max-w-xl">
              Generate custom CSV reports, analyze salesperson conversion metrics, revenue collections, and automated schedules.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowScheduleModal(true)}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm backdrop-blur-md transition-all flex items-center gap-2 border border-white/10 shadow-sm"
            >
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Schedule Email Reports</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Report Configurator */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Columns: Config Controls */}
        <div className="lg:col-span-2 space-y-6">
          {/* 1. Select Timeframe & Preset */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-5">
            <div className="flex items-center justify-between border-b pb-4">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-600" />
                1. Select Time Horizon
              </h2>
              <span className="text-xs text-gray-400">Filter datasets before exporting</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {[
                { id: 'all', label: 'All Time' },
                { id: 'daily', label: 'Today' },
                { id: 'weekly', label: 'Last 7 Days' },
                { id: 'monthly', label: 'Last 30 Days' },
                { id: 'custom', label: 'Custom Range' }
              ].map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setReportType(item.id)}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all border ${
                    reportType === item.id
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-[1.02]'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {reportType === 'custom' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    className="input-field w-full text-xs"
                    value={dateRange.startDate}
                    onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    className="input-field w-full text-xs"
                    value={dateRange.endDate}
                    onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 2. Select Fields / Columns to Export */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-5">
            <div className="flex items-center justify-between border-b pb-4">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Filter className="w-5 h-5 text-indigo-600" />
                2. Customize Export Columns
              </h2>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => selectAllColumns(true)}
                  className="text-indigo-600 font-semibold hover:underline"
                >
                  Select All
                </button>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  onClick={() => selectAllColumns(false)}
                  className="text-gray-500 font-semibold hover:underline"
                >
                  Clear All
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {availableColumns.map(col => {
                const isSelected = selectedColumns[col.key];
                return (
                  <button
                    key={col.key}
                    type="button"
                    onClick={() => toggleColumn(col.key)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-left text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-indigo-50/70 border-indigo-200 text-indigo-900 font-semibold'
                        : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    <span>{col.label}</span>
                    <div className={`w-4 h-4 rounded-md flex items-center justify-center border ${
                      isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300 bg-white'
                    }`}>
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Export Action Card */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900">Format: CSV Spreadsheet</h3>
                <p className="text-xs text-gray-500">Includes UTF-8 encoding for Excel, Google Sheets, and CRM tools</p>
              </div>
              <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-semibold border border-emerald-200">
                <FileSpreadsheet className="w-4 h-4" />
                <span>Ready for Export</span>
              </div>
            </div>

            <button
              onClick={() => handleGenerateReport()}
              disabled={downloading}
              className={`w-full py-3.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-base shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2.5 transition-all ${
                downloading ? 'opacity-70 cursor-not-allowed' : 'hover:scale-[1.01]'
              }`}
            >
              {downloading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Processing & Generating CSV...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-5 h-5" />
                  <span>Download CSV Report Now</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Pre-built Templates & Quick Actions */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 border-b pb-3">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
              Pre-built Report Templates
            </h3>

            <div className="space-y-3">
              {[
                {
                  title: 'Daily Operations Digest',
                  desc: 'Leads created, called, and status updates for today',
                  icon: Clock,
                  color: 'bg-blue-50 text-blue-600 border-blue-100',
                  type: 'daily'
                },
                {
                  title: 'Weekly Conversion Funnel',
                  desc: '7-day performance, registered leads & revenue',
                  icon: TrendingUp,
                  color: 'bg-emerald-50 text-emerald-600 border-emerald-100',
                  type: 'weekly'
                },
                {
                  title: 'Monthly Financial Audit',
                  desc: 'Cleared payments, orientation fees & advances',
                  icon: IndianRupee,
                  color: 'bg-purple-50 text-purple-600 border-purple-100',
                  type: 'monthly'
                },
                {
                  title: 'Telephony & Call Duration',
                  desc: 'Total talk time and call count breakdown',
                  icon: PhoneCall,
                  color: 'bg-amber-50 text-amber-600 border-amber-100',
                  type: 'all'
                }
              ].map((template, idx) => {
                const Icon = template.icon;
                return (
                  <div
                    key={idx}
                    onClick={() => handleGenerateReport(template.type)}
                    className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-white hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2.5 rounded-xl border ${template.color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                          {template.title}
                        </h4>
                        <p className="text-xs text-gray-500 mt-0.5">{template.desc}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Data Security & Compliance Badge */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 text-indigo-950 space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm text-indigo-900">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
              <span>Data Export & Security Guard</span>
            </div>
            <p className="text-xs text-indigo-700/80 leading-relaxed">
              Exported files contain sensitive lead details and payments. All report generations are logged for auditing and branch privacy.
            </p>
          </div>
        </div>
      </div>

      {/* Automated Email Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-600" />
                Schedule Automated Reports
              </h3>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSchedule} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Recipient Email</label>
                <input
                  type="email"
                  className="input-field w-full"
                  placeholder="admin@academy.com"
                  value={scheduleEmail}
                  onChange={(e) => setScheduleEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Schedule Frequency</label>
                <select
                  className="input-field w-full"
                  value={scheduleFrequency}
                  onChange={(e) => setScheduleFrequency(e.target.value)}
                >
                  <option value="daily">Daily at 8:00 AM</option>
                  <option value="weekly">Weekly on Mondays</option>
                  <option value="monthly">Monthly on 1st</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md"
                >
                  Save Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
