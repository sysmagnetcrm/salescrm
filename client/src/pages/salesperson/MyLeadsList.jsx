import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { leadAPI, settingsAPI, startCrmCall } from '../../services/api';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { 
  Phone, MessageCircle, Search, Filter, ArrowUpDown, ArrowUp, ArrowDown, Clock,
  UserPlus, Sparkles, TrendingUp, Wallet, RotateCcw, ChevronLeft, ChevronRight,
  Calendar, Package, X, Plus, Layers
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext.jsx';
import LeadPaymentSection from '../../components/LeadPaymentSection';

const formatCallDuration = (totalSecs) => {
  const sec = parseInt(totalSecs) || 0;
  if (sec <= 0) return '0s';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

// Helpers to format phone numbers with country codes (default India +91)
// Helpers to format phone numbers with country codes (default India +91)
const getDialCode = (country) => {
  return '+91';
};

const ensureE164 = (phone, country) => {
  if (!phone) return '';
  const raw = String(phone).trim();
  if (raw.startsWith('+')) {
    return `+${raw.replace(/[^0-9]/g, '')}`;
  }
  if (raw.startsWith('00')) {
    return `+${raw.replace(/[^0-9]/g, '').replace(/^00/, '')}`;
  }
  const digits = raw.replace(/[^0-9]/g, '');
  const code = getDialCode(country);
  return `${code}${digits}`;
};

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const MyLeadsList = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [selectedLead, setSelectedLead] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ country: 'India', product: '' });

  const COLORS = {
    gray: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200', row: 'bg-white', hover: 'hover:bg-gray-50', card: 'bg-gray-100 border-gray-300' },
    blue: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200', row: 'bg-blue-50', hover: 'hover:bg-blue-100', card: 'bg-blue-50 border-blue-300' },
    green: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200', row: 'bg-green-50', hover: 'hover:bg-green-100', card: 'bg-green-100 border-green-300' },
    red: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200', row: 'bg-red-50', hover: 'hover:bg-red-100', card: 'bg-red-100 border-red-300' },
    orange: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200', row: 'bg-orange-50', hover: 'hover:bg-orange-100', card: 'bg-orange-100 border-orange-300' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200', row: 'bg-purple-50', hover: 'hover:bg-purple-100', card: 'bg-purple-100 border-purple-300' },
    indigo: { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-200', row: 'bg-indigo-50', hover: 'hover:bg-indigo-100', card: 'bg-indigo-50 border-indigo-300' },
    pink: { bg: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-200', row: 'bg-pink-50', hover: 'hover:bg-pink-100', card: 'bg-pink-50 border-pink-300' },
    yellow: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200', row: 'bg-yellow-50', hover: 'hover:bg-yellow-100', card: 'bg-yellow-100 border-yellow-300' }
  };
  const [filters, setFilters] = useState({
    status: '',
    search: '',
    country: '',
    product: '',
    startDate: null,
    endDate: null
  });
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(filters.search);
    }, 300);
    return () => clearTimeout(timer);
  }, [filters.search]);

  const queryFilters = {
    ...filters,
    search: debouncedSearch
  };

  const [dateRange, setDateRange] = useState([null, null]);
  const [startDate, endDate] = dateRange;
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [callData, setCallData] = useState({
    note: '',
    status: '',
    advance: '',
    country: 'India',
    product: ''
  });
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    phone: '',
    country: 'India',
    email: '',
    product: '',
    source: '',
    notes: ''
  });
  const pendingCallRestored = useRef(false);

  // Metadata Queries
  const { data: statuses = [] } = useQuery({
    queryKey: ['statuses'],
    queryFn: () => settingsAPI.getStatuses().then(r => r.data.data || []),
    staleTime: 300000
  });

  const { data: countries = [] } = useQuery({
    queryKey: ['countries'],
    queryFn: () => settingsAPI.getCountries().then(r => (r.data.data || []).map(c => c.name)),
    staleTime: 300000
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => settingsAPI.getProducts().then(r => (r.data.data || []).map(p => p.name)),
    staleTime: 300000
  });

  // My Leads Query with debounced search filters
  const { data: leadsResponse, isLoading: loading, isFetching } = useQuery({
    queryKey: ['leads', 'my', queryFilters],
    queryFn: () => leadAPI.getMyLeads(queryFilters).then(r => r.data),
    placeholderData: (prev) => prev,
    staleTime: 30000
  });

  const rawRows = Array.isArray(leadsResponse?.data) ? leadsResponse.data : [];
  const leads = rawRows.map((l) => ({
    ...l,
    value: l.value !== undefined && l.value !== null ? Number(l.value) : l.value
  }));

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedLeads = [...leads].sort((a, b) => {
    if (!sortConfig.key) return 0;

    let aValue = a[sortConfig.key];
    let bValue = b[sortConfig.key];

    // Handle null/undefined values
    if (aValue === null || aValue === undefined) aValue = '';
    if (bValue === null || bValue === undefined) bValue = '';

    // Convert to lowercase for string comparison
    if (typeof aValue === 'string') aValue = aValue.toLowerCase();
    if (typeof bValue === 'string') bValue = bValue.toLowerCase();

    if (aValue < bValue) {
      return sortConfig.direction === 'asc' ? -1 : 1;
    }
    if (aValue > bValue) {
      return sortConfig.direction === 'asc' ? 1 : -1;
    }
    return 0;
  });

  const getSortIcon = (columnKey) => {
    if (sortConfig.key !== columnKey) {
      return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    }
    return sortConfig.direction === 'asc'
      ? <ArrowUp className="h-4 w-4 text-primary-600" />
      : <ArrowDown className="h-4 w-4 text-primary-600" />;
  };

  const handleCall = async (lead) => {
    try {
      await startCrmCall(lead);
    } catch (err) {
      console.error('Unified CRM call error:', err);
      toast.error('Failed to initiate call');
    }
  };

  const handleWhatsApp = (lead) => {
    const message = encodeURIComponent(`Hello ${lead.name}, this is regarding your inquiry.`);
    const number = buildWhatsAppNumber(lead.phone, lead.country);
    window.open(`https://wa.me/${number}?text=${message}`, '_blank');
  };

  const handleCallComplete = async (e) => {
    e.preventDefault();

    try {
      // Update lead with new status, advance, country, product, and lastCalled
      const payload = {
        status: callData.status,
        value: (callData.advance === '' || callData.advance === null || callData.advance === undefined) ? '' : Number(callData.advance),
        notes: callData.note,
        country: callData.country,
        product: callData.product,
        lastCalled: new Date().toISOString()
      };
      const resp = await leadAPI.updateLead(selectedLead.id, payload);
      if (resp?.data?.data) {
        const updated = resp.data.data;
        setLeads((prev) => prev.map((l) => (l.id === updated.id ? { ...l, ...updated, value: Number(updated.value) } : l)));
      }

      // Add activity only if note provided
      if (callData.note && callData.note.trim()) {
        await leadAPI.addActivity(selectedLead.id, {
          type: 'call',
          description: `Call made: ${callData.note}`
        });
      }

      toast.success('Call logged successfully');
      setShowCallModal(false);
      setSelectedLead(null);
      localStorage.removeItem('pendingCallLog');
      pendingCallRestored.current = false;
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (error) {
      toast.error('Failed to log call');
    }
  };

  const handleCancelCallLog = () => {
    setShowCallModal(false);
    setSelectedLead(null);
    localStorage.removeItem('pendingCallLog');
    pendingCallRestored.current = false;
  };

  const handleViewLead = async (lead) => {
    try {
      const response = await leadAPI.getLead(lead.id);
      const leadData = response.data.data;
      setSelectedLead(leadData);
      setEditData({ product: leadData.product || '' });
      setIsEditing(false);
      setShowModal(true);
    } catch (error) {
      toast.error('Failed to load lead details');
    }
  };

  const handleSaveEdit = async () => {
    try {
      const payload = {
        product: editData.product
      };
      const response = await leadAPI.updateLead(selectedLead.id, payload);
      if (response?.data?.data) {
        const updated = response.data.data;
        setSelectedLead(updated);
        setLeads((prev) => prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l)));
        setIsEditing(false);
        toast.success('Lead updated successfully');
      }
    } catch (error) {
      toast.error('Failed to update lead');
    }
  };

  const handleCancelEdit = () => {
    setEditData({ product: selectedLead.product || '' });
    setIsEditing(false);
  };

  // Pagination & Filter Metrics
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters, debouncedSearch]);

  const statusCounts = { all: leads.length };
  statuses.forEach(s => { statusCounts[s.value] = 0; });
  leads.forEach(l => {
    if (l.status) {
      statusCounts[l.status] = (statusCounts[l.status] || 0) + 1;
    }
  });

  const totalFilteredLeads = sortedLeads.length;
  const totalPages = Math.ceil(totalFilteredLeads / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedLeads = sortedLeads.slice(startIndex, startIndex + pageSize);

  const totalLeadsCount = leads.length;
  const freshLeadsCount = statusCounts['fresh'] || 0;
  const followUpCount = statusCounts['follow-up'] || 0;

  const totalAdvanceSum = sortedLeads.reduce((acc, lead) => {
    const val = lead.value !== undefined && lead.value !== null ? parseFloat(lead.value) : 0;
    return acc + (isNaN(val) ? 0 : val);
  }, 0);

  const getStatusColor = (statusValue) => {
    const status = statuses.find(s => s.value === statusValue);
    const colorKey = status?.color || 'gray';
    const conf = COLORS[colorKey] || COLORS['gray'];
    return `${conf.bg} ${conf.text} ${conf.border || ''}`;
  };

  const getRowStyles = (statusValue) => {
    const status = statuses.find(s => s.value === statusValue);
    const colorKey = status?.color || 'gray';
    const conf = COLORS[colorKey] || COLORS['gray'];
    return {
      row: conf.row,
      hover: conf.hover,
      card: conf.card
    };
  };

  useEffect(() => {
    const restorePendingCall = async () => {
      const stored = localStorage.getItem('pendingCallLog');
      if (!stored || pendingCallRestored.current) return;

      try {
        const pending = JSON.parse(stored);
        if (!pending?.leadId) {
          localStorage.removeItem('pendingCallLog');
          return;
        }

        let lead = leads.find((l) => l.id === pending.leadId);
        if (!lead) {
          const response = await leadAPI.getLead(pending.leadId);
          lead = response?.data?.data;
        }

        if (lead) {
          setSelectedLead(lead);
          setCallData({
            note: '',
            status: lead.status,
            advance: (lead.value !== undefined && lead.value !== null) ? String(Number(lead.value)) : '',
            country: lead.country || 'India',
            product: lead.product || ''
          });
          setShowCallModal(true);
          pendingCallRestored.current = true;
        } else {
          localStorage.removeItem('pendingCallLog');
        }
      } catch (err) {
        localStorage.removeItem('pendingCallLog');
      }
    };

    restorePendingCall();
  }, [leads]);

  const allTabs = [
    { key: '', label: 'All', color: 'bg-gray-100 text-gray-800' },
    ...statuses.map(s => ({
      key: s.value,
      label: s.label,
      color: getStatusColor(s.value)
    }))
  ];



  return (
    <div className="space-y-4 md:space-y-6">
      {/* Redesigned Hero Header Card */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-5 md:p-8 shadow-2xl border border-indigo-500/20">
        {/* Background Ambient Glowing Orbs */}
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
              <span>Sales Workspace</span>
            </div>
            <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight text-white flex flex-wrap items-center gap-3">
              My Leads Pipeline
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {totalLeadsCount} Total Active
              </span>
            </h1>
            <p className="text-xs md:text-sm text-slate-300 max-w-xl">
              Track, organize, and convert your assigned leads in real-time. Execute instant calls and log lead notes.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto">
            <button
              onClick={() => setShowCreate(true)}
              className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-extrabold text-xs md:text-sm px-5 py-3 rounded-2xl shadow-lg shadow-emerald-500/25 flex items-center gap-2 transition-all transform hover:scale-[1.02] active:scale-95 border border-emerald-400/30"
            >
              <UserPlus className="w-4 h-4" />
              <span>ADD NEW LEAD</span>
            </button>
          </div>
        </div>

        {/* Live Metrics Quick Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl p-3.5 border border-slate-700/50 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-medium">Total Pipeline</p>
              <p className="text-base font-bold text-white">{totalLeadsCount}</p>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl p-3.5 border border-slate-700/50 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-medium">Fresh Leads</p>
              <p className="text-base font-bold text-sky-300">{freshLeadsCount}</p>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl p-3.5 border border-slate-700/50 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-medium">Follow-ups Due</p>
              <p className="text-base font-bold text-amber-300">{followUpCount}</p>
            </div>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-md rounded-2xl p-3.5 border border-slate-700/50 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-medium">Pipeline Advances</p>
              <p className="text-base font-bold text-emerald-400 font-mono">
                ₹{totalAdvanceSum.toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Redesigned Search & Filter Control Bar */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
          {/* Search Input */}
          <div className="flex-1 relative">
            {loading ? (
              <div className="absolute left-3.5 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
              </div>
            ) : (
              <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            )}
            <input
              type="text"
              placeholder="Search by lead name, phone, email..."
              className="w-full pl-10 pr-9 py-2.5 text-sm bg-gray-50/80 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-gray-400 font-medium"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
            {filters.search && (
              <button
                onClick={() => setFilters({ ...filters, search: '' })}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Product Filter */}
          <div className="w-full lg:w-56 relative">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none">
              <Package className="w-4 h-4" />
            </div>
            <select
              className="w-full pl-9 pr-8 py-2.5 text-sm bg-gray-50/80 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-gray-700 cursor-pointer"
              value={filters.product}
              onChange={(e) => setFilters({ ...filters, product: e.target.value })}
            >
              <option value="">All Products</option>
              {products.map((product) => (
                <option key={product} value={product}>
                  {product}
                </option>
              ))}
            </select>
          </div>

          {/* Date Picker */}
          <div className="w-full lg:w-64 relative">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none z-10">
              <Calendar className="w-4 h-4" />
            </div>
            <DatePicker
              selectsRange={true}
              startDate={startDate}
              endDate={endDate}
              onChange={(update) => {
                setDateRange(update);
                if (update[0] && update[1]) {
                  setFilters({ ...filters, startDate: update[0].toISOString(), endDate: update[1].toISOString() });
                } else if (!update[0]) {
                  setFilters({ ...filters, startDate: null, endDate: null });
                }
              }}
              isClearable={true}
              placeholderText="Select Date Range"
              className="w-full pl-9 pr-3 py-2.5 text-sm bg-gray-50/80 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-gray-700 cursor-pointer"
              wrapperClassName="w-full"
              popperClassName="!z-50"
              popperProps={{ strategy: 'fixed' }}
            />
          </div>

          {/* Reset Filters Button */}
          {(filters.search || filters.product || filters.status || startDate || endDate) && (
            <button
              onClick={() => {
                setFilters({ status: '', search: '', country: '', product: '', startDate: null, endDate: null });
                setDateRange([null, null]);
              }}
              className="px-3.5 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center justify-center gap-1.5 transition-all shrink-0 cursor-pointer"
              title="Reset all filters"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Horizontal Scrollable Status Filter Bar */}
      <div className="sticky top-14 z-20 bg-gray-50/95 backdrop-blur-md py-2 w-full max-w-full overflow-x-hidden border-b border-gray-200/80 md:static md:bg-transparent md:border-0 md:p-0">
        <div className="flex items-center gap-2 overflow-x-auto max-w-full py-1 no-scrollbar">
          {allTabs.map((tab) => {
            const isActive = filters.status === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setFilters({ ...filters, status: tab.key })}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold transition-all text-xs whitespace-nowrap border shrink-0 cursor-pointer ${
                  isActive
                    ? 'border-indigo-600 bg-indigo-600 text-white shadow-md shadow-indigo-500/20 scale-[1.02]'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-100 hover:border-gray-300'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'
                }`}>
                  {statusCounts[tab.key || 'all'] || 0}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Leads List - Desktop Table */}
      {loading && leads.length === 0 && (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
        </div>
      )}

      <div className={loading ? "opacity-50 pointer-events-none transition-opacity" : ""}>
        {leads.length > 0 ? (
          <>
            <div className="hidden md:block card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-white border-b border-gray-200">
                    <tr>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50"
                        onClick={() => handleSort('createdAt')}
                      >
                        <div className="flex items-center gap-2">
                          Date Added
                          {getSortIcon('createdAt')}
                        </div>
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50"
                        onClick={() => handleSort('name')}
                      >
                        <div className="flex items-center gap-2">
                          Name
                          {getSortIcon('name')}
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50"
                        onClick={() => handleSort('product')}
                      >
                        <div className="flex items-center gap-2">
                          Product
                          {getSortIcon('product')}
                        </div>
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50"
                        onClick={() => handleSort('status')}
                      >
                        <div className="flex items-center gap-2">
                          Status
                          {getSortIcon('status')}
                        </div>
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50"
                        onClick={() => handleSort('value')}
                      >
                        <div className="flex items-center gap-2">
                          Advance
                          {getSortIcon('value')}
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white">
                    {paginatedLeads.map((lead) => {
                      const styles = getRowStyles(lead.status);
                      return (
                        <tr
                          key={lead.id}
                          className={`${styles.row} ${styles.hover} cursor-pointer transition-colors`}
                          onClick={() => handleViewLead(lead)}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-600">{lead.createdAt ? format(new Date(lead.createdAt), 'dd MMM yyyy') : '—'}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{lead.name}</div>
                            {lead.email && <div className="text-sm text-gray-500">{lead.email}</div>}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{ensureE164(lead.phone, lead.country)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lead.product || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(lead.status)}`}>
                              {lead.status === 'follow-up'
                                ? 'FOLLOW-UP'
                                : lead.status === 'cancelled'
                                  ? 'CANCELLED'
                                  : lead.status === 'rejected'
                                    ? 'REJECTED'
                                    : lead.status === 'interested'
                                      ? 'INTERESTED'
                                      : lead.status === 'closed'
                                        ? 'REGISTERED'
                                        : lead.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {lead.value !== null && lead.value !== undefined && !isNaN(Number(lead.value))
                              ? Number(lead.value).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })
                              : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex space-x-2" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => handleCall(lead)}
                                className="p-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                                title="Call"
                              >
                                <Phone className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleWhatsApp(lead)}
                                className="p-2 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 transition-colors"
                                title="WhatsApp"
                              >
                                <MessageCircle className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="md:hidden space-y-2.5">
              {paginatedLeads.map((lead) => {
                const styles = getRowStyles(lead.status);
                return (
                  <div
                    key={lead.id}
                    className="p-3.5 bg-white rounded-xl shadow-sm border border-gray-200 space-y-2 hover:border-gray-300 transition-all cursor-pointer"
                    onClick={() => handleViewLead(lead)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-sm font-bold text-gray-900 leading-snug">{lead.name}</h3>
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md uppercase ${getStatusColor(lead.status)}`}>
                            {lead.status || 'FRESH'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {lead.product || 'Course'}
                        </p>
                      </div>
                      {lead.value !== null && lead.value !== undefined && !isNaN(Number(lead.value)) && Number(lead.value) > 0 && (
                        <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 shrink-0">
                          ₹{Number(lead.value).toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 border-t border-gray-100">
                      <span>Follow-up: {lead.nextFollowUpAt ? format(new Date(lead.nextFollowUpAt), 'MMM dd, HH:mm') : '—'}</span>
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleCall(lead); }}
                          className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold flex items-center gap-1 border border-gray-200"
                        >
                          <Phone className="h-3 w-3 text-gray-600" />
                          <span>Call</span>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleWhatsApp(lead); }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold flex items-center gap-1 border border-emerald-200"
                        >
                          <MessageCircle className="h-3 w-3 text-emerald-600" />
                          <span>WA</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Redesigned Bottom Toolbar & Pagination Section */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 mt-4">
              {/* Left: Summary & Stats */}
              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 w-full md:w-auto justify-between md:justify-start">
                <span>
                  Showing <strong className="text-gray-900">{totalFilteredLeads > 0 ? startIndex + 1 : 0}</strong> to{' '}
                  <strong className="text-gray-900">{Math.min(startIndex + pageSize, totalFilteredLeads)}</strong> of{' '}
                  <strong className="text-gray-900">{totalFilteredLeads}</strong> leads
                </span>
                {totalAdvanceSum > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                    <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>View Advance Total: ₹{totalAdvanceSum.toLocaleString('en-IN')}</span>
                  </span>
                )}
              </div>

              {/* Right: Pagination Controls */}
              <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 font-medium">Per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="text-xs font-bold text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value={15}>15</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                    title="Previous Page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <span className="text-xs font-bold text-gray-800 px-2">
                    Page {currentPage} of {totalPages}
                  </span>

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                    disabled={currentPage >= totalPages}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                    title="Next Page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          !loading && (
            <div className="card text-center py-12">
              <p className="text-gray-500 text-lg">No leads found</p>
            </div>
          )
        )}
      </div>

      {/* Create Lead Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-xl p-5 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Create Lead</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                if (!createForm.name || !createForm.phone) {
                  toast.error('Name and phone are required');
                  return;
                }
                const payload = { ...createForm };
                await leadAPI.createLead(payload);
                toast.success('Lead created');
                setShowCreate(false);
                setCreateForm({ name: '', phone: '', country: 'India', email: '', product: '', source: '', notes: '' });
                queryClient.invalidateQueries({ queryKey: ['leads'] });
              } catch (err) {
                if (err.response?.data?.code === 'DUPLICATE_ACTIVE_ASSIGNMENT') {
                  const owner = err.response.data.assignedTo;
                  const ownerText = owner ? `${owner.name} (${owner.email})` : 'another salesperson';
                  toast.error(`Conflict: Lead with phone ${createForm.phone} is already assigned to ${ownerText}.`, { duration: 7000 });
                } else {
                  toast.error(err.response?.data?.message || 'Failed to create lead');
                }
              }
            }} className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label">Name</label>
                <input className="input-field" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} required />
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input-field" value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} required />
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" className="input-field" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} />
              </div>
              <div>
                <label className="label">Product</label>
                <select
                  className="input-field"
                  value={createForm.product}
                  onChange={(e) => setCreateForm({ ...createForm, product: e.target.value })}
                >
                  <option value="">Select Product</option>
                  {products.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Source</label>
                <input className="input-field" value={createForm.source} onChange={(e) => setCreateForm({ ...createForm, source: e.target.value })} />
              </div>

              <div className="md:col-span-2">
                <label className="label">Notes</label>
                <textarea className="input-field" rows={3} value={createForm.notes} onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })} />
              </div>
              <div className="md:col-span-2 flex justify-end gap-2">
                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Call Modal */}
      {showCallModal && selectedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-[430px] p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Log Call - {selectedLead.name}</h2>

            <form onSubmit={handleCallComplete} className="space-y-4">
              <div>
                <label className="label text-red-600 font-bold">Status (Update Required) *</label>
                <select
                  className="input-field border-red-400 focus:border-red-600 focus:ring-red-600 bg-red-50"
                  value={callData.status}
                  onChange={(e) => setCallData({ ...callData, status: e.target.value })}
                  required
                  autoFocus
                >
                  <option value="" disabled>-- Select Call Result --</option>
                  {statuses.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Call Notes (optional)</label>
                <textarea
                  className="input-field"
                  rows="4"
                  value={callData.note}
                  onChange={(e) => setCallData({ ...callData, note: e.target.value })}
                  placeholder="What was discussed in the call?"
                ></textarea>
              </div>

              <div>
                <label className="label">Advance (₹)</label>
                <input
                  type="number"
                  className="input-field"
                  value={callData.advance}
                  onChange={(e) => setCallData({ ...callData, advance: e.target.value })}
                  placeholder="Enter advance amount"
                />
              </div>

              <div>
                <label className="label">Product (optional)</label>
                <select
                  className="input-field"
                  value={callData.product}
                  onChange={(e) => setCallData({ ...callData, product: e.target.value })}
                >
                  <option value="">Select Product</option>
                  {products.map((product) => (
                    <option key={product} value={product}>
                      {product}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex space-x-3 pt-2">
                <button type="submit" className="btn-primary flex-1">Save Call Log</button>
                <button type="button" onClick={handleCancelCallLog} className="btn-secondary flex-1">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Lead Modal */}
      {showModal && selectedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 my-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Lead Details</h2>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Name</p>
                  <p className="font-semibold text-gray-900">{selectedLead.name}</p>
                </div>
                {selectedLead.salesperson && (
                  <div>
                    <p className="text-sm text-gray-600">Assigned To</p>
                    <p className="font-semibold text-gray-900">{selectedLead.salesperson.name}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  {selectedLead.email ? (
                    <a href={`mailto:${selectedLead.email}`} className="font-semibold text-gray-900 hover:underline">
                      {selectedLead.email}
                    </a>
                  ) : (
                    <p className="font-semibold text-gray-900">-</p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-gray-600">Call Duration</p>
                  <p className="font-bold text-gray-900 font-mono flex items-center gap-1.5 mt-0.5">
                    <Clock className="w-4 h-4 text-sky-600" />
                    <span>
                      {selectedLead.totalCallDuration
                        ? formatCallDuration(selectedLead.totalCallDuration)
                        : '0s'}
                    </span>
                    <span className="text-xs text-gray-500 font-normal">
                      ({selectedLead.callCount || 0} calls)
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Phone</p>
                  <button
                    onClick={() => handleCall(selectedLead)}
                    className="font-semibold text-primary-600 hover:underline flex items-center gap-1"
                    title="Initiate CRM Call"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>{selectedLead.phone}</span>
                  </button>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Product</p>
                  {isEditing ? (
                    <select
                      className="input-field mt-1"
                      value={editData.product}
                      onChange={(e) => setEditData({ ...editData, product: e.target.value })}
                    >
                      <option value="">Select Product</option>
                      {products.map((product) => (
                        <option key={product} value={product}>
                          {product}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="font-semibold text-gray-900">{selectedLead.product || '-'}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(selectedLead.status)}`}>
                    {selectedLead.status === 'closed' ? 'REGISTERED' : selectedLead.status.toUpperCase()}
                  </span>
                </div>
                {selectedLead.value > 0 && (
                  <div>
                    <p className="text-sm text-gray-600">Advance</p>
                    <p className="font-semibold text-green-600">
                      {Number(selectedLead.value).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                    </p>
                  </div>
                )}
                {selectedLead.lastCalled && (
                  <div>
                    <p className="text-sm text-gray-600">Last Called</p>
                    <p className="font-semibold text-gray-900">
                      {new Date(selectedLead.lastCalled).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>

              {selectedLead.notes && (
                <div>
                  <p className="text-sm text-gray-600">Notes</p>
                  <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">{selectedLead.notes}</p>
                </div>
              )}

              {/* Lead Payment & Fee Lifecycle Section */}
              <LeadPaymentSection
                lead={selectedLead}
                onPaymentRecorded={(updated) => {
                  setSelectedLead(updated);
                  queryClient.invalidateQueries({ queryKey: ['leads'] });
                }}
              />

              {/* Activities */}
              {selectedLead.activities && selectedLead.activities.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Activity History</h3>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {[...selectedLead.activities]
                      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                      .map((activity) => (
                        <div key={activity.id} className="p-3 bg-gray-50 rounded-lg text-sm">
                          <p className="font-medium text-gray-900 capitalize">{activity.type}</p>
                          <p className="text-gray-600">{activity.description}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(activity.createdAt).toLocaleString()}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <div className="flex space-x-3 pt-4">
                {isEditing ? (
                  <>
                    <button
                      onClick={handleSaveEdit}
                      className="flex-1 btn-primary"
                    >
                      Save Changes
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="flex-1 btn-secondary"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex-1 btn-secondary"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setShowModal(false)}
                      className="flex-1 btn-primary"
                    >
                      Close
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyLeadsList;
