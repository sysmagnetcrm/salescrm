import { useState, useEffect } from 'react';
import { leadAPI } from '../services/api';
import { AlertTriangle, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useBranch } from '../context/BranchContext';

const StaleLeadsNotification = () => {
  const { branch } = useBranch();
  const [staleLeads, setStaleLeads] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchStaleLeads();
  }, [branch]);

  const fetchStaleLeads = async () => {
    try {
      const response = await leadAPI.getStaleLeads({ branch });
      const leads = response.data.data;
      setStaleLeads(leads);

      // Show modal if there are stale leads
      if (leads.length > 0) {
        setShowModal(true);
      }
    } catch (error) {
      console.error('Failed to fetch stale leads:', error);
    }
  };

  const handleSelectAll = () => {
    if (selectedLeads.length === staleLeads.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(staleLeads.map(lead => lead.id));
    }
  };

  const handleSelectLead = (leadId) => {
    if (selectedLeads.includes(leadId)) {
      setSelectedLeads(selectedLeads.filter(id => id !== leadId));
    } else {
      setSelectedLeads([...selectedLeads, leadId]);
    }
  };

  const handleRedistribute = async () => {
    if (selectedLeads.length === 0) {
      toast.error('Please select at least one lead to redistribute');
      return;
    }

    setLoading(true);
    try {
      const response = await leadAPI.redistributeLeads(selectedLeads, branch);
      toast.success(response.data.message);
      setShowModal(false);
      setStaleLeads([]);
      setSelectedLeads([]);
    } catch (error) {
      toast.error('Failed to redistribute leads');
    } finally {
      setLoading(false);
    }
  };

  if (!showModal || staleLeads.length === 0) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="h-8 w-8 text-orange-600" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Stale Leads Alert</h2>
              <p className="text-gray-600">
                {staleLeads.length} lead{staleLeads.length !== 1 ? 's' : ''} have been Fresh or RNR for 4+ days
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowModal(false)}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="mb-4 flex items-center justify-between">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedLeads.length === staleLeads.length}
              onChange={handleSelectAll}
              className="w-4 h-4 text-primary-600 rounded"
            />
            <span className="text-sm font-medium text-gray-700">Select All</span>
          </label>
          <span className="text-sm text-gray-600">
            {selectedLeads.length} of {staleLeads.length} selected
          </span>
        </div>

        <div className="overflow-x-auto mb-6">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Select
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Phone
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Country
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Assigned To
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Days Old
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {staleLeads.map((lead) => {
                const daysOld = Math.floor(
                  (new Date() - new Date(lead.createdAt)) / (1000 * 60 * 60 * 24)
                );

                return (
                  <tr key={lead.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedLeads.includes(lead.id)}
                        onChange={() => handleSelectLead(lead.id)}
                        className="w-4 h-4 text-primary-600 rounded"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {lead.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {lead.phone}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {lead.country}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${lead.status === 'fresh' ? 'bg-gray-200 text-gray-800' :
                          'bg-purple-200 text-purple-800'
                        }`}>
                        {lead.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {lead.salesperson?.name || 'Unassigned'}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-orange-600">
                      {daysOld} days
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={handleRedistribute}
            disabled={loading || selectedLeads.length === 0}
            className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Redistributing...' : `Redistribute ${selectedLeads.length} Lead${selectedLeads.length !== 1 ? 's' : ''}`}
          </button>
          <button
            onClick={() => setShowModal(false)}
            className="flex-1 btn-secondary"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};

export default StaleLeadsNotification;
