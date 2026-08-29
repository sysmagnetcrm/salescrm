import { useState, useEffect } from 'react';
import { leadAPI } from '../../services/api';
import LeadCard from '../../components/LeadCard';
import { Search, Filter } from 'lucide-react';
import toast from 'react-hot-toast';

const MyLeads = () => {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [countries, setCountries] = useState([]);
  const [products, setProducts] = useState([]);
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    status: '',
    search: '',
    country: '',
    product: ''
  });
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    phone: '',
    country: '',
    email: '',
    product: '',
    source: '',
    notes: ''
  });
  const [statusSummary, setStatusSummary] = useState({ all: 0, fresh: 0, 'follow-up': 0, closed: 0, dead: 0, cancelled: 0, rejected: 0 });
  const [updateData, setUpdateData] = useState({
    status: '',
    notes: '',
    lastCalled: '',
    value: ''
  });

  useEffect(() => {
    fetchLeads();
    fetchCountries();
    fetchProducts();
  }, [filters, page]);

  const fetchCountries = async () => {
    try {
      const response = await leadAPI.getCountries();
      setCountries(response.data.data);
    } catch (error) {
      // Silently fail if no countries
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await leadAPI.getProducts();
      setProducts(response.data.data);
    } catch (error) {
      // Silently fail if no products
    }
  };

  const fetchLeads = async () => {
    try {
      // list with current filters
      const listPromise = leadAPI.getMyLeads({ ...filters, page, limit: pageSize });
      // summary without status filter (Option A)
      const { status: _status, ...rest } = filters;
      const summaryPromise = leadAPI.getMyLeads({ ...rest, status: '', page: 1, limit: 1 });

      const [listResp, summaryResp] = await Promise.all([listPromise, summaryPromise]);

      const rows = Array.isArray(listResp.data.data) ? listResp.data.data : [];
      setLeads(rows);
      setTotal(listResp.data.total || rows.length);

      const apiSummary = summaryResp?.data?.statusSummary;
      if (apiSummary) {
        setStatusSummary({
          all: apiSummary.all ?? 0,
          fresh: apiSummary.fresh ?? 0,
          'follow-up': apiSummary['follow-up'] ?? 0,
          closed: apiSummary.closed ?? 0,
          dead: apiSummary.dead ?? 0,
          cancelled: apiSummary.cancelled ?? 0,
          rejected: apiSummary.rejected ?? 0,
        });
      } else {
        const fallback = rows.reduce((acc, l) => { acc.all += 1; acc[l.status] = (acc[l.status] || 0) + 1; return acc; }, { all: 0 });
        setStatusSummary({
          all: fallback.all ?? 0,
          fresh: fallback.fresh ?? 0,
          'follow-up': fallback['follow-up'] ?? 0,
          closed: fallback.closed ?? 0,
          dead: fallback.dead ?? 0,
          cancelled: fallback.cancelled ?? 0,
          rejected: fallback.rejected ?? 0,
        });
      }
    } catch (error) {
      toast.error('Failed to load leads');
    } finally {
      setLoading(false);
    }
  };

  const handleLeadClick = async (lead) => {
    try {
      const response = await leadAPI.getLead(lead.id);
      setSelectedLead(response.data.data);
      setUpdateData({
        status: response.data.data.status,
        notes: response.data.data.notes || '',
        lastCalled: response.data.data.lastCalled || '',
        value: response.data.data.value || ''
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
        value: updateData.value === '' || updateData.value === null || updateData.value === undefined
          ? ''
          : Number(updateData.value)
      });
      console.log('Update response:', response.data);
      toast.success('Lead updated successfully');
      if (response?.data?.data) {
        const updated = response.data.data;
        setLeads((prev) => prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l)));
      }
      setShowModal(false);
      fetchLeads();
    } catch (error) {
      console.error('Update error:', error.response?.data || error.message);
      toast.error(error.response?.data?.message || 'Failed to update lead');
    }
  };

  const handleAddNote = async () => {
    const note = prompt('Enter your note:');
    if (note) {
      try {
        await leadAPI.addActivity(selectedLead.id, {
          type: 'note',
          description: note
        });
        toast.success('Note added successfully');
        handleLeadClick(selectedLead);
      } catch (error) {
        toast.error('Failed to add note');
      }
    }
  };

  const statusCounts = statusSummary;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Leads</h1>
          <p className="text-gray-600 mt-1">Manage and track your assigned leads</p>
        </div>
        <div className="hidden md:block">
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex bg-red-600 hover:bg-red-700 text-white font-bold uppercase tracking-wider text-xs px-4 py-2 rounded-full shadow"
          >
            ADD LEAD
          </button>
        </div>
        {/* Mobile ADD LEAD pill */}
        <button
          onClick={() => setShowCreate(true)}
          className="md:hidden self-start ml-auto bg-red-600 hover:bg-red-700 text-white font-bold uppercase tracking-wider text-xs px-4 py-2 rounded-full shadow"
        >
          ADD LEAD
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search leads..."
                className="input-field pl-10 text-[0.6rem] lg:text-base"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <select
              className="input-field text-[0.6rem] lg:text-base w-full"
              value={filters.country}
              onChange={(e) => setFilters({ ...filters, country: e.target.value })}
            >
              <option value="">All Countries</option>
              {countries.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>
            <select
              className="input-field text-[0.6rem] lg:text-base w-full"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="">All Status</option>
              <option value="fresh">Fresh</option>
              <option value="follow-up">Follow-up</option>
              <option value="closed">Registered</option>
              <option value="dead">Dead</option>
              <option value="cancelled">Cancelled</option>
              <option value="rejected">Rejected</option>
            </select>
            <select
              className="input-field text-[0.6rem] lg:text-base w-full col-span-2 md:col-span-1"
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
          </div>
        </div>

        {/* Status Tabs - two layers (grid) on mobile and desktop */}
        <div className="grid grid-cols-4 gap-2 mt-4">
          {[
            { key: '', label: 'All', color: 'bg-gray-100 text-gray-800' },
            { key: 'fresh', label: 'Fresh', color: 'bg-white border-2 border-gray-300' },
            { key: 'follow-up', label: 'Follow-up', color: 'bg-orange-100 text-orange-800' },
            { key: 'closed', label: 'Registered', color: 'bg-green-100 text-green-800' },
            { key: 'dead', label: 'Dead', color: 'bg-red-100 text-red-800' },
            { key: 'cancelled', label: 'Cancelled', color: 'bg-red-100 text-red-800' },
            { key: 'rejected', label: 'Rejected', color: 'bg-red-100 text-red-800' }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilters({ ...filters, status: tab.key })}
              className={`inline-flex items-center justify-center w-full h-7 px-2 py-0.5 text-[10px] rounded-full font-medium transition-all whitespace-nowrap ${tab.color} ${
                filters.status === tab.key ? 'ring-2 ring-primary-500' : ''
              }`}
            >
              {tab.label} ({statusCounts[tab.key || 'all'] ?? 0})
            </button>
          ))}
        </div>
      </div>

      {/* Leads Grid */}
      {leads.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onClick={() => handleLeadClick(lead)}
            />
          ))}
        </div>
      ) : (
        <div className="card text-center py-12">
          <p className="text-gray-500 text-lg">No leads found</p>
        </div>
      )}

      {/* Mobile FAB removed to avoid duplication with header pill */}

      {/* Create Lead Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-xl p-5 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Create Lead</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            <form onSubmit={async (e)=>{
              e.preventDefault();
              try {
                if (!createForm.name || !createForm.phone || !createForm.country) {
                  return alert('Name, phone and country are required');
                }
                const payload = {
                  ...createForm
                };
                await leadAPI.createLead(payload);
                setShowCreate(false);
                setCreateForm({ name: '', phone: '', country: '', email: '', product: '', source: '', notes: '' });
                fetchLeads();
              } catch (err) {
                alert(err.response?.data?.message || 'Failed to create lead');
              }
            }} className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label">Name</label>
                <input className="input-field" value={createForm.name} onChange={(e)=>setCreateForm({...createForm,name:e.target.value})} required />
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input-field" value={createForm.phone} onChange={(e)=>setCreateForm({...createForm,phone:e.target.value})} required />
              </div>
              <div>
                <label className="label">Country</label>
                <input
                  className="input-field"
                  value={createForm.country}
                  onChange={(e)=>setCreateForm({...createForm,country:e.target.value})}
                  list="country-list-ml"
                  placeholder="Start typing..."
                  required
                />
                <datalist id="country-list-ml">
                  {countries.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" className="input-field" value={createForm.email} onChange={(e)=>setCreateForm({...createForm,email:e.target.value})} />
              </div>
              <div>
                <label className="label">Product</label>
                <input className="input-field" value={createForm.product} onChange={(e)=>setCreateForm({...createForm,product:e.target.value})} />
              </div>
              <div>
                <label className="label">Source</label>
                <input className="input-field" value={createForm.source} onChange={(e)=>setCreateForm({...createForm,source:e.target.value})} />
              </div>
              <div className="md:col-span-2">
                <label className="label">Notes</label>
                <textarea className="input-field" rows={3} value={createForm.notes} onChange={(e)=>setCreateForm({...createForm,notes:e.target.value})} />
              </div>
              <div className="md:col-span-2 flex justify-end gap-2">
                <button type="button" onClick={()=>setShowCreate(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pagination */}
      {total > pageSize && (
        <div className="flex items-center justify-between gap-3 pt-2">
          <div className="text-sm text-gray-600">
            Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} of {total} leads
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn-secondary text-sm"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
            >
              Previous
            </button>
            <span className="text-sm">Page <span className="font-semibold">{page}</span></span>
            <button
              className="btn-secondary text-sm"
              onClick={() => setPage(page + 1)}
              disabled={page * pageSize >= total}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Lead Detail Modal */}
      {showModal && selectedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 my-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Lead Details</h2>

            <div className="space-y-4 mb-6">
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
                  <p className="text-sm text-gray-600">Country</p>
                  <p className="font-semibold text-gray-900">{selectedLead.country || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Phone</p>
                  <a href={`tel:${selectedLead.phone}`} className="font-semibold text-primary-600 hover:underline">
                    {selectedLead.phone}
                  </a>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Product</p>
                  <p className="font-semibold text-gray-900">{selectedLead.product || '-'}</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleUpdateLead} className="space-y-4">
              <div>
                <label className="label">Status</label>
                <select
                  className="input-field"
                  value={updateData.status}
                  onChange={(e) => setUpdateData({ ...updateData, status: e.target.value })}
                >
                  <option value="fresh">Fresh</option>
                  <option value="follow-up">Follow-up</option>
                  <option value="closed">Registered</option>
                  <option value="dead">Dead</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              

              <div>
                <label className="label">Advance</label>
                <input
                  type="number"
                  className="input-field"
                  value={updateData.value}
                  onChange={(e) => setUpdateData({ ...updateData, value: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Last Called</label>
                <input
                  type="datetime-local"
                  className="input-field"
                  value={updateData.lastCalled}
                  onChange={(e) => setUpdateData({ ...updateData, lastCalled: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Notes</label>
                <textarea
                  className="input-field"
                  rows="4"
                  value={updateData.notes}
                  onChange={(e) => setUpdateData({ ...updateData, notes: e.target.value })}
                ></textarea>
              </div>

              {/* Activities */}
              {selectedLead.activities && selectedLead.activities.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Activity History</h3>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {[...selectedLead.activities].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).map((activity) => (
                      <div key={activity.id} className="p-3 bg-gray-50 rounded-lg text-sm">
                        <p className="font-medium text-gray-900">{activity.type}</p>
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
                <button type="submit" className="flex-1 btn-primary">
                  Update Lead
                </button>
                <button
                  type="button"
                  onClick={handleAddNote}
                  className="flex-1 btn-secondary"
                >
                  Add Note
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 btn-secondary"
                >
                  Close
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyLeads;
