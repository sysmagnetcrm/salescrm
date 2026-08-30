import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadAPI, userAPI, settingsAPI } from '../../services/api';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import LeadCard from '../../components/LeadCard';
import { Search, Trash2, Globe2, Package, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Phone, MessageCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { useBranch } from '../../context/BranchContext';

const AllLeads = () => {
  const queryClient = useQueryClient();
  const { branch } = useBranch();
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const [selectedLead, setSelectedLead] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [assignTo, setAssignTo] = useState('');
  const [selectedLeads, setSelectedLeads] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    phone: '',
    country: 'India',
    email: '',
    product: '',
    source: '',
    assignedTo: '',
    notes: ''
  });

  const COLORS = {
    gray: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200', row: 'bg-white', hover: 'hover:bg-gray-50', card: 'bg-gray-100 border-gray-300' },
    blue: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200', row: 'bg-blue-50', hover: 'hover:bg-blue-100', card: 'bg-blue-50 border-blue-300' },
    green: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200', row: 'bg-green-50', hover: 'hover:bg-green-100', card: 'bg-green-100 border-green-300' },
    red: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200', row: 'bg-red-50', hover: 'hover:bg-red-100', card: 'bg-red-100 border-red-300' },
    orange: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200', row: 'bg-orange-50', hover: 'hover:bg-orange-100', card: 'bg-orange-100 border-orange-300' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200', row: 'bg-purple-50', hover: 'hover:bg-purple-100', card: 'bg-purple-100 border-purple-300' },
    indigo: { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-200', row: 'bg-indigo-50', hover: 'hover:bg-indigo-100', card: 'bg-indigo-50 border-indigo-300' },
    pink: { bg: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-200', row: 'bg-pink-50', hover: 'hover:bg-pink-100', card: 'bg-pink-50 border-pink-300' },
    yellow: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200', row: 'bg-yellow-50', hover: 'hover:bg-yellow-100', card: 'bg-yellow-50 border-yellow-300' }
  };

  const [filters, setFilters] = useState({
    branch: '',
    status: '',
    search: '',
    country: '',
    product: '',
    startDate: null,
    endDate: null
  });

  const [dateRange, setDateRange] = useState([null, null]);
  const [startDate, endDate] = dateRange;
  const [updateData, setUpdateData] = useState({
    status: '',
    notes: '',
    lastCalled: '',
    value: '',
    country: '',
    product: ''
  });
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [assignToSingle, setAssignToSingle] = useState('');

  // Queries for lookups
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

  const { data: salespeople = [] } = useQuery({
    queryKey: ['salespeople', branch],
    queryFn: () => userAPI.getSalespeople({ branch }).then(r => r.data.data || []),
    staleTime: 120000
  });

  // Main Leads Query with keepPreviousData for smooth pagination
  const { data: leadsResponse, isLoading: loading, isFetching } = useQuery({
    queryKey: ['leads', 'all', { filters, page, pageSize, branch }],
    queryFn: () => leadAPI.getAllLeads({ ...filters, page, limit: pageSize, branch }).then(r => r.data),
    placeholderData: (previousData) => previousData,
    staleTime: 30000
  });

  const rawRows = Array.isArray(leadsResponse?.data) ? leadsResponse.data : [];
  const leads = rawRows.map((l) => ({
    ...l,
    value: l.value !== undefined && l.value !== null ? Number(l.value) : l.value
  }));
  const total = leadsResponse?.count || 0;
  const statusSummary = leadsResponse?.statusCounts || {};

  // Map common countries to dial codes. Fallback to +91 if unknown.
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

  const buildWhatsAppNumber = (phone, country) => {
    const e164 = ensureE164(phone, country);
    return e164.replace(/\D/g, '');
  };

  const handleBulkAssign = async () => {
    try {
      if (selectedLeads.length === 0) {
        toast.error('Please select leads to assign');
        return;
      }
      if (!assignTo) {
        toast.error('Please select a salesperson');
        return;
      }
      await leadAPI.assignLeads(selectedLeads, assignTo);
      toast.success(`Assigned ${selectedLeads.length} lead(s)`);
      setSelectedLeads([]);
      setAssignTo('');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['tl-team'] });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to assign leads');
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await settingsAPI.getProducts();
      setProducts(response.data.data.map(p => p.name));
    } catch (error) {
      // Silently fail if no products
    }
  };

  const fetchSalespeople = async () => {
    try {
      const response = await userAPI.getSalespeople();
      setSalespeople(response?.data?.data || []);
    } catch (error) {
      // Silently ignore
    }
  };

  const getStatusPillClass = (statusValue) => {
    const status = statuses.find(s => s.value === statusValue);
    const colorKey = status?.color || 'gray';
    const conf = COLORS[colorKey] || COLORS['gray'];
    return `${conf.bg} ${conf.text} ${conf.border} border`;
  };

  const getStatusRowStyles = (statusValue) => {
    const status = statuses.find(s => s.value === statusValue);
    const colorKey = status?.color || 'gray';
    const conf = COLORS[colorKey] || COLORS['gray'];
    return {
      row: conf.row,
      hover: conf.hover,
      avatar: `border ${conf.border} ${conf.bg.replace('100', '200')} ${conf.text}`,
      card: conf.card
    };
  };

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const response = await leadAPI.getAllLeads({ ...filters, page, limit: pageSize });
      const rows = Array.isArray(response.data.data) ? response.data.data : [];
      setLeads(rows.map((l) => ({ ...l, value: l.value !== undefined && l.value !== null ? Number(l.value) : l.value })));
      setTotal(response.data.count || 0);
      setStatusSummary(response.data.statusCounts || {});
    } catch (error) {
      toast.error('Failed to load leads');
    } finally {
      setLoading(false);
    }
  };

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

    // Handle nested salesperson name
    if (sortConfig.key === 'salesperson') {
      aValue = a.salesperson?.name || '';
      bValue = b.salesperson?.name || '';
    }

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

  const handleLeadClick = async (lead) => {
    try {
      const response = await leadAPI.getLead(lead.id);
      const data = response.data.data || {};
      // Coerce value for the edit form
      setSelectedLead({ ...data, value: data.value !== undefined && data.value !== null ? Number(data.value) : data.value });
      // Preselect current assignee in single-assign dropdown
      setAssignToSingle(data?.salesperson?.id || '');
      setUpdateData({
        status: response.data.data.status,
        notes: response.data.data.notes || '',
        lastCalled: response.data.data.lastCalled || '',
        value: (response.data.data.value !== undefined && response.data.data.value !== null)
          ? String(Number(response.data.data.value))
          : '',
        country: response.data.data.country || 'India',
        product: response.data.data.product || ''
      });
      setShowModal(true);
    } catch (error) {
      toast.error('Failed to load lead details');
    }
  };

  const handleUpdateLead = async (e) => {
    e.preventDefault();
    try {
      console.log('Updating lead with data:', updateData);
      const response = await leadAPI.updateLead(selectedLead.id, {
        ...updateData,
        // ensure numeric payload for value when present
        value: updateData.value === '' || updateData.value === null || updateData.value === undefined
          ? ''
          : Number(updateData.value),
        country: updateData.country,
        product: updateData.product
      });
      console.log('Update response:', response.data);
      toast.success('Lead updated successfully');
      // Optimistically update local list so UI reflects new advance immediately
      if (response?.data?.data) {
        const updated = response.data.data;
        setLeads((prev) => prev.map((l) => (l.id === updated.id ? { ...l, ...updated, value: Number(updated.value) } : l)));
      }
      setShowModal(false);
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (error) {
      console.error('Update error:', error.response?.data || error.message);
      toast.error(error.response?.data?.message || 'Failed to update lead');
    }
  };

  const handleDeleteLead = async (leadId) => {
    if (window.confirm('Are you sure you want to delete this lead?')) {
      try {
        await leadAPI.deleteLead(leadId);
        toast.success('Lead deleted successfully');
        setShowModal(false);
        queryClient.invalidateQueries({ queryKey: ['leads'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      } catch (error) {
        toast.error('Failed to delete lead');
      }
    }
  };

  const handleSelectLead = (leadId) => {
    if (selectedLeads.includes(leadId)) {
      setSelectedLeads(selectedLeads.filter(id => id !== leadId));
    } else {
      setSelectedLeads([...selectedLeads, leadId]);
    }
  };

  const handleSelectAll = () => {
    if (selectedLeads.length === leads.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(leads.map(lead => lead.id));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedLeads.length === 0) {
      toast.error('Please select leads to delete');
      return;
    }

    if (window.confirm(`Are you sure you want to delete ${selectedLeads.length} lead(s)?`)) {
      try {
        await Promise.all(selectedLeads.map(id => leadAPI.deleteLead(id)));
        toast.success(`${selectedLeads.length} lead(s) deleted successfully`);
        setSelectedLeads([]);
        queryClient.invalidateQueries({ queryKey: ['leads'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      } catch (error) {
        toast.error('Failed to delete some leads');
      }
    }
  };

  const statusCounts = statusSummary;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canGoPrev = page > 1;
  const canGoNext = page < totalPages;

  const handlePageChange = (newPage) => {
    setPage(newPage);
    setSelectedLeads([]);
    setLoading(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      if (!createForm.name || !createForm.phone || !createForm.country) {
        toast.error('Name, phone and country are required');
        return;
      }
      const payload = { ...createForm, branch };
      if (!payload.assignedTo) delete payload.assignedTo;
      await leadAPI.createLead(payload);
      toast.success('Lead created');
      setShowCreate(false);
      setCreateForm({ name: '', phone: '', country: '', email: '', product: '', source: '', assignedTo: '', notes: '' });
      fetchLeads();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create lead');
    }
  };

  const allTabs = [
    { key: '', label: 'All', className: 'bg-gray-100 text-gray-800' },
    ...statuses.map(s => ({
      key: s.value,
      label: s.label,
      className: getStatusPillClass(s.value)
    }))
  ];



  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">All Leads</h1>
        </div>
        {/* Desktop ADD LEAD pill (hide on mobile) */}
        {selectedLeads.length === 0 && (
          <div className="hidden sm:block ml-auto">
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex bg-red-600 hover:bg-red-700 text-white font-bold uppercase tracking-wider text-xs px-4 py-2 rounded-full shadow"
            >
              ADD LEAD
            </button>
          </div>
        )}
        {/* Mobile ADD LEAD pill (hide on md and up) */}
        {selectedLeads.length === 0 && (
          <button
            onClick={() => setShowCreate(true)}
            className="sm:hidden self-start ml-auto bg-red-600 hover:bg-red-700 text-white font-bold uppercase tracking-wider text-xs px-4 py-2 rounded-full shadow"
          >
            ADD LEAD
          </button>
        )}

        {/* Bulk Actions - Desktop & Mobile */}
        {selectedLeads.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">
              {selectedLeads.length} selected
            </span>
            <select
              className="input-field text-sm"
              value={assignTo}
              onChange={(e) => setAssignTo(e.target.value)}
            >
              <option value="">Assign to...</option>
              {salespeople.map((sp) => (
                <option key={sp.id} value={sp.id}>{sp.name}</option>
              ))}
            </select>
            <button
              onClick={handleBulkAssign}
              className="btn-primary text-sm"
              disabled={!assignTo}
            >
              Assign Selected
            </button>
            <button
              onClick={handleBulkDelete}
              className="btn-secondary text-red-600 hover:bg-red-50 flex items-center gap-2 text-sm"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Delete Selected</span>
              <span className="sm:hidden">Delete</span>
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="card !overflow-visible">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="flex-1">
            <div className="relative">
              {loading ? (
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin h-5 w-5 border-2 border-gray-300 border-t-gray-500 rounded-full"></div>
                </div>
              ) : (
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              )}
              <input
                type="text"
                placeholder="Search leads..."
                className="input-field pl-10 text-base"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-2">
            <select
              className="input-field"
              value={filters.product || ''}
              onChange={(e) => setFilters({ ...filters, product: e.target.value })}
            >
              <option value="">All Products</option>
              {products.map((product) => (
                <option key={product} value={product}>
                  {product}
                </option>
              ))}
            </select>
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
              className="input-field w-full"
              wrapperClassName="w-full"
              popperClassName="!z-50"
              popperProps={{ strategy: 'fixed' }}
            />
          </div>
        </div>
      </div>

      {/* Sticky Status Tabs */}
      <div className="sticky top-0 z-30 bg-gray-50 pt-2 pb-2 -mx-4 px-4 shadow-sm md:static md:bg-transparent md:shadow-none md:p-0 md:mx-0">
        {/* Status Tabs - two rows grid on mobile/tablet */}
        <div className="grid grid-cols-4 gap-2 lg:hidden">
          {allTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilters({ ...filters, status: tab.key })}
              className={`inline-flex items-center justify-center w-full h-7 px-2 py-0.5 text-[10px] rounded-full font-medium transition-all whitespace-nowrap ${tab.className} ${filters.status === tab.key ? 'ring-2 ring-primary-500' : ''
                }`}
            >
              {tab.label} ({statusCounts[tab.key || 'all'] ?? 0})
            </button>
          ))}
        </div>

        {/* Keep previous horizontal pills for desktop */}
        <div className="hidden lg:flex flex-nowrap gap-2 overflow-x-auto">
          {allTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilters({ ...filters, status: tab.key })}
              className={`inline-flex items-center justify-center h-9 px-3 py-0 rounded-full font-medium transition-all text-base whitespace-nowrap shadow-sm border ${filters.status === tab.key ? 'border-primary-500 bg-white' : 'border-transparent'
                } ${tab.className}`}
            >
              {tab.label} ({statusCounts[tab.key || 'all'] ?? 0})
            </button>
          ))}
        </div>
      </div>

      {/* Select All Checkbox */}
      {leads.length > 0 && (
        <div className="flex items-center gap-2 mt-3">
          <input
            type="checkbox"
            checked={selectedLeads.length === leads.length}
            onChange={handleSelectAll}
            className="w-4 h-4 text-primary-600 rounded"
          />
          <label className="text-sm font-medium text-gray-700">
            Select All ({leads.length})
          </label>
        </div>
      )}

      {/* Leads - Mobile Compact List and Desktop Grid */}
      {loading && leads.length === 0 && (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
        </div>
      )}
      {leads.length > 0 ? (
        <>
          {/* Mobile/Tablet (incl. iPad) Compact List - Enhanced with colored backgrounds */}
          <div className="lg:hidden space-y-2">
            {sortedLeads.map((lead) => (
              <div
                key={`${lead.id}-${Number(lead.value ?? 0)}`}
                className={`px-3 py-2 flex items-center rounded-lg border shadow-sm ${getStatusRowStyles(lead.status).card || 'bg-white border-gray-200'}`}
                onClick={() => handleLeadClick(lead)}
              >
                {/* Select checkbox */}
                <input
                  type="checkbox"
                  checked={selectedLeads.includes(lead.id)}
                  onChange={() => handleSelectLead(lead.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="mr-2 w-4 h-4 text-primary-600 rounded"
                />
                {/* Avatar hidden on mobile */}
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {lead.name}
                      {lead.salesperson?.name && (
                        <span className="text-xs font-normal text-gray-600"> • {lead.salesperson.name}</span>
                      )}
                    </p>
                    {lead.value !== null && lead.value !== undefined && !isNaN(Number(lead.value)) && (
                      <span className={`text-[11px] font-semibold whitespace-nowrap ${lead.status === 'dead' || lead.status === 'cancelled' || lead.status === 'rejected' ? 'text-red-700' : 'text-green-700'}`}>
                        {lead.status === 'cancelled' ? 'Refund: ' : ''}
                        {Number(lead.value).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center text-xs text-gray-600 truncate">
                    <span className="truncate">{lead.country || '-'}{lead.product ? ` • ${lead.product}` : ''}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-500">
                    <span>Uploaded {lead.createdAt ? formatDistanceToNow(new Date(lead.createdAt), { addSuffix: true }) : '-'}</span>
                    <span>•</span>
                    <span>Last follow up {lead.lastCalled ? formatDistanceToNow(new Date(lead.lastCalled), { addSuffix: true }) : '-'}</span>
                  </div>
                </div>
                <div className="ml-2 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  {lead.phone && (
                    <a
                      href={`tel:${ensureE164(lead.phone, lead.country)}`}
                      className="p-2 rounded-md bg-green-50 text-green-700 hover:bg-green-100"
                      title="Call"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Phone className="w-4 h-4" />
                    </a>
                  )}
                  {lead.phone && (
                    <a
                      href={`https://wa.me/${buildWhatsAppNumber(lead.phone, lead.country)}`}
                      className="p-2 rounded-md bg-primary-100 text-primary-700 hover:bg-primary-200"
                      title="WhatsApp"
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MessageCircle className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table (only for lg and above) */}
          <div className="hidden lg:block card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-white">
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedLeads.length === leads.length && leads.length > 0}
                        onChange={handleSelectAll}
                        className="w-4 h-4 text-primary-600 rounded"
                      />
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center gap-2">
                        Lead Name
                        {getSortIcon('name')}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50"
                      onClick={() => handleSort('country')}
                    >
                      <div className="flex items-center gap-2">
                        Lead Source
                        {getSortIcon('country')}
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50"
                      onClick={() => handleSort('status')}
                    >
                      <div className="flex items-center gap-2">
                        Lead Status
                        {getSortIcon('status')}
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50"
                      onClick={() => handleSort('lastCalled')}
                    >
                      <div className="flex items-center gap-2">
                        Last Called
                        {getSortIcon('lastCalled')}
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50"
                      onClick={() => handleSort('salesperson')}
                    >
                      <div className="flex items-center gap-2">
                        Lead Owner
                        {getSortIcon('salesperson')}
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50"
                      onClick={() => handleSort('value')}
                    >
                      <div className="flex items-center gap-2">
                        Advance / Refund
                        {getSortIcon('value')}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white">
                  {sortedLeads.map((lead) => {
                    const styles = getStatusRowStyles(lead.status);
                    return (
                      <tr
                        key={`${lead.id}-${Number(lead.value ?? 0)}`}
                        className={`${styles.row} ${styles.hover} transition-colors`}
                        onClick={() => handleLeadClick(lead)}
                      >
                        <td className="px-4 py-4 align-top" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedLeads.includes(lead.id)}
                            onChange={() => handleSelectLead(lead.id)}
                            className="w-4 h-4 text-primary-600 rounded"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap align-top">
                          <div className="flex items-start gap-3">
                            <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold ${styles.avatar}`}>
                              {lead.name?.[0]?.toUpperCase() || '?'}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">{lead.name}</div>
                              <div className="text-xs text-gray-500">
                                {lead.lastCalled
                                  ? `Last called ${formatDistanceToNow(new Date(lead.lastCalled), { addSuffix: true })}`
                                  : `Created ${formatDistanceToNow(new Date(lead.createdAt), { addSuffix: true })}`}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-top">
                          <div className="flex flex-col gap-0.5">
                            {lead.email && <span className="text-gray-900">{lead.email}</span>}
                            <span className="text-gray-600">{ensureE164(lead.phone, lead.country)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-top">
                          {lead.product || lead.country || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap align-top">
                          <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusPillClass(lead.status)}`}>
                            {lead.status === 'follow-up'
                              ? 'Follow-up'
                              : lead.status === 'rnr'
                                ? 'RNR'
                                : lead.status === 'cancelled'
                                  ? 'Cancelled'
                                  : lead.status === 'rejected'
                                    ? 'Rejected'
                                    : lead.status === 'interested'
                                      ? 'Interested'
                                      : (lead.status === 'closed' || lead.status === 'registered')
                                        ? 'Registered'
                                        : lead.status?.charAt(0)?.toUpperCase() + lead.status?.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-top">
                          {lead.lastCalled
                            ? formatDistanceToNow(new Date(lead.lastCalled), { addSuffix: true })
                            : '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-top">
                          {lead.salesperson?.name || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 align-top">
                          {lead.value !== null && lead.value !== undefined && !isNaN(Number(lead.value)) ? (
                            <div className="flex flex-col leading-tight">
                              <span className="text-[11px] uppercase tracking-wide text-gray-500">
                                {lead.status === 'cancelled' ? 'Refund' : 'Advance'}
                              </span>
                              <span>{Number(lead.value).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}</span>
                            </div>
                          ) : (
                            '-'
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="card text-center py-12">
          <p className="text-gray-500 text-lg">No leads found</p>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pt-2">
          <div className="text-sm text-gray-600">
            Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} of {total} leads
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn-secondary text-sm"
              onClick={() => handlePageChange(page - 1)}
              disabled={!canGoPrev}
            >
              Previous
            </button>
            <div className="flex items-center gap-2 text-sm">
              <span>Page</span>
              <span className="font-semibold">{page}</span>
              <span>of {totalPages}</span>
            </div>
            <button
              className="btn-secondary text-sm"
              onClick={() => handlePageChange(page + 1)}
              disabled={!canGoNext}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Create Lead Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-xl p-5 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Create Lead</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label">Name</label>
                <input className="input-field" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} required />
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input-field" value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} required />
              </div>
              <div>
                <label className="label">Country</label>
                <select
                  className="input-field"
                  value={createForm.country}
                  onChange={(e) => setCreateForm({ ...createForm, country: e.target.value })}
                  required
                >
                  <option value="">Select Country</option>
                  {countries.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
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
                <label className="label">Assign To</label>
                <select
                  className="input-field"
                  value={createForm.assignedTo}
                  onChange={(e) => setCreateForm({ ...createForm, assignedTo: e.target.value })}
                >
                  <option value="">Unassigned</option>
                  {salespeople.map((sp) => (
                    <option key={sp.id} value={sp.id}>{sp.name}</option>
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

      {/* Lead Detail Modal - Compact */}
      {showModal && selectedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-[430px] p-5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Lead Details</h2>
              <button
                onClick={() => handleDeleteLead(selectedLead.id)}
                className="text-red-600 hover:text-red-800"
                title="Delete Lead"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>

            {/* Lead Info Grid */}
            <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
              <div>
                <p className="text-gray-500">Name</p>
                <p className="font-semibold">{selectedLead.name}</p>
              </div>
              {selectedLead.salesperson && (
                <div>
                  <p className="text-gray-500">Assigned To</p>
                  <p className="font-semibold">{selectedLead.salesperson.name}</p>
                </div>
              )}
              <div>
                <p className="text-gray-500">Email</p>
                {selectedLead.email ? (
                  <a href={`mailto:${selectedLead.email}`} className="font-semibold text-gray-900 hover:underline">
                    {selectedLead.email}
                  </a>
                ) : (
                  <p className="font-semibold">-</p>
                )}
              </div>
              <div>
                <p className="text-gray-500">Country</p>
                <p className="font-semibold">{selectedLead.country || '-'}</p>
                {/* Country change history */}
                {Array.isArray(selectedLead.activities) && selectedLead.activities.filter(a => a.newCountry).length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {selectedLead.activities
                      .filter(a => a.newCountry)
                      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                      .map((a, idx) => (
                        <div key={a.id || idx} className="text-xs text-gray-500">
                          {a.newCountry} • {new Date(a.createdAt).toLocaleString()}
                        </div>
                      ))}
                  </div>
                )}
              </div>
              <div>
                <p className="text-gray-500">Phone</p>
                <a
                  href={`tel:${ensureE164(selectedLead.phone, selectedLead.country)}`}
                  className="font-semibold text-primary-600 hover:underline"
                >
                  {ensureE164(selectedLead.phone, selectedLead.country)}
                </a>
              </div>
              <div>
                <p className="text-gray-500">Product</p>
                <p className="font-semibold">{selectedLead.product || '-'}</p>
              </div>
            </div>

            {/* Manual Assign (single lead) */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Assign To</label>
              <div className="flex items-center gap-2">
                <select
                  className="input-field text-sm"
                  value={assignToSingle}
                  onChange={(e) => setAssignToSingle(e.target.value)}
                >
                  <option value="">Select salesperson</option>
                  {salespeople.map((sp) => (
                    <option key={sp.id} value={sp.id}>{sp.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn-secondary text-sm"
                  disabled={!assignToSingle}
                  onClick={async () => {
                    try {
                      if (!assignToSingle) return;
                      await leadAPI.assignLeads([selectedLead.id], assignToSingle);
                      toast.success('Lead assigned');
                      // Refresh detail and list
                      const res = await leadAPI.getLead(selectedLead.id);
                      setSelectedLead(res.data.data);
                      setAssignToSingle(res.data.data?.salesperson?.id || '');
                      fetchLeads();
                    } catch (err) {
                      toast.error(err.response?.data?.message || 'Failed to assign lead');
                    }
                  }}
                >
                  Assign
                </button>
              </div>
            </div>

            {/* Update Form */}
            <form onSubmit={handleUpdateLead} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    className="input-field text-sm"
                    value={updateData.status}
                    onChange={(e) => setUpdateData({ ...updateData, status: e.target.value })}
                  >
                    {statuses.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {updateData.status === 'cancelled' ? 'Refund' : 'Advance'}
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    className="input-field text-sm"
                    value={updateData.value}
                    onChange={(e) => setUpdateData({ ...updateData, value: e.target.value })}
                    placeholder={updateData.status === 'cancelled' ? 'Enter refund amount' : '0.00'}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                  <select
                    className="input-field text-sm"
                    value={updateData.country}
                    onChange={(e) => setUpdateData({ ...updateData, country: e.target.value })}
                  >
                    <option value="">Select Country</option>

                    {countries.map((country) => (
                      <option key={country} value={country}>
                        {country}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
                  <select
                    className="input-field text-sm"
                    value={updateData.product}
                    onChange={(e) => setUpdateData({ ...updateData, product: e.target.value })}
                  >
                    <option value="">Select Product</option>
                    {products.map((product) => (
                      <option key={product} value={product}>
                        {product}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedLead.lastCalled && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Called</label>
                  <input
                    type="text"
                    className="input-field text-sm bg-gray-50 cursor-not-allowed"
                    value={new Date(selectedLead.lastCalled).toLocaleString()}
                    readOnly
                    disabled
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  className="input-field text-sm"
                  rows="2"
                  value={updateData.notes}
                  onChange={(e) => setUpdateData({ ...updateData, notes: e.target.value })}
                  placeholder="Add notes..."
                ></textarea>
              </div>

              <div className="flex space-x-2 pt-2">
                <button type="submit" className="btn-primary flex-1 text-sm py-2">Update Lead</button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1 text-sm py-2">Close</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AllLeads;
