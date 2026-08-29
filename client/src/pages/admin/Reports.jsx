import { useState } from 'react';
import { FileDown, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import { leadAPI } from '../../services/api';

const Reports = () => {
  const [reportType, setReportType] = useState('daily');
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  const [format, setFormat] = useState('csv');
  const [downloading, setDownloading] = useState(false);

  const toCSV = (rows) => {
    if (!rows || rows.length === 0) return '';
    const headers = [
      'ID','Name','Phone','Email','Country','Product','Status','Advance (INR)','Last Called','Salesperson'
    ];
    const escape = (val) => {
      if (val === null || val === undefined) return '';
      const s = String(val).replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const lines = rows.map(l => [
      l.id,
      l.name,
      l.phone,
      l.email,
      l.country,
      l.product,
      l.status,
      l.value,
      l.lastCalled,
      l.salesperson?.name || ''
    ].map(escape).join(','));
    return [headers.join(','), ...lines].join('\n');
  };

  const handleGenerateReport = async () => {
    if (format === 'pdf') {
      toast.error('PDF export not yet supported. Please choose CSV.');
      return;
    }
    try {
      setDownloading(true);
      toast.loading('Preparing report...', { id: 'report' });

      // Build params (basic, since backend may not filter by date yet)
      const params = {};
      // Optionally include dateRange or type as query for future backend support
      if (dateRange.startDate) params.startDate = dateRange.startDate;
      if (dateRange.endDate) params.endDate = dateRange.endDate;
      params.type = reportType;

      const res = await leadAPI.getAllLeads(params);
      const leads = res?.data?.data || res?.data || [];

      if (!Array.isArray(leads) || leads.length === 0) {
        toast.dismiss('report');
        toast.error('No data available for the selected period');
        return;
      }

      const csv = toCSV(leads);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const ts = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `leads-report-${reportType}-${ts}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Report downloaded', { id: 'report' });
    } catch (err) {
      console.error(err);
      toast.dismiss('report');
      toast.error('Failed to generate report');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
        <p className="text-gray-600 mt-1">Generate and download performance reports</p>
      </div>

      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Generate Report</h2>

        <div className="space-y-6">
          <div>
            <label className="label">Report Type</label>
            <select
              className="input-field"
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
            >
              <option value="daily">Daily Report</option>
              <option value="weekly">Weekly Report</option>
              <option value="monthly">Monthly Report</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {reportType === 'custom' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Start Date</label>
                <input
                  type="date"
                  className="input-field"
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                />
              </div>
              <div>
                <label className="label">End Date</label>
                <input
                  type="date"
                  className="input-field"
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                />
              </div>
            </div>
          )}

          <div>
            <label className="label">Report Format</label>
            <div className="flex gap-4">
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="format"
                  value="csv"
                  checked={format === 'csv'}
                  onChange={(e) => setFormat(e.target.value)}
                  className="text-primary-600"
                />
                <span>CSV</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="format"
                  value="pdf"
                  checked={format === 'pdf'}
                  onChange={(e) => setFormat(e.target.value)}
                  className="text-primary-600"
                />
                <span>PDF</span>
              </label>
            </div>
          </div>

          <button
            onClick={handleGenerateReport}
            disabled={downloading}
            className={`btn-primary w-full flex items-center justify-center space-x-2 ${downloading ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            <FileDown className="h-5 w-5" />
            <span>{downloading ? 'Generating...' : 'Generate & Download Report'}</span>
          </button>
        </div>
      </div>

      {/* Report Templates */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Available Reports</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            {
              title: 'Sales Performance',
              description: 'Individual salesperson performance metrics',
              icon: '📊'
            },
            {
              title: 'Lead Conversion',
              description: 'Lead conversion rates and statistics',
              icon: '📈'
            },
            {
              title: 'Revenue Analysis',
              description: 'Revenue breakdown by period and salesperson',
              icon: '💰'
            },
            {
              title: 'Activity Log',
              description: 'Complete activity history and timeline',
              icon: '📝'
            }
          ].map((report, index) => (
            <div key={index} className="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-500 transition-colors cursor-pointer">
              <div className="flex items-start space-x-3">
                <span className="text-3xl">{report.icon}</span>
                <div>
                  <h3 className="font-semibold text-gray-900">{report.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{report.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="card bg-gradient-to-r from-primary-50 to-blue-50">
        <div className="flex items-center space-x-3 mb-4">
          <Calendar className="h-6 w-6 text-primary-600" />
          <h2 className="text-xl font-semibold text-gray-900">Report Schedule</h2>
        </div>
        <p className="text-gray-700">
          Set up automated report generation and email delivery. Configure your preferences in the settings panel.
        </p>
        <button className="mt-4 btn-secondary">
          Configure Schedule
        </button>
      </div>
    </div>
  );
};

export default Reports;
