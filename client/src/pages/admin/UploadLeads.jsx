import { useState, useEffect } from 'react';
import { leadAPI, userAPI } from '../../services/api';
import { Upload, FileText, CheckCircle, AlertCircle, UserPlus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useBranch } from '../../context/BranchContext';

const UploadLeads = () => {
  const { branch } = useBranch();
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [unassignedLeads, setUnassignedLeads] = useState([]);
  const [salespeople, setSalespeople] = useState([]);
  const [selectedLeads, setSelectedLeads] = useState([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedSalesperson, setSelectedSalesperson] = useState('');
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    fetchUnassignedLeads();
    fetchSalespeople();
  }, [branch]);

  const fetchUnassignedLeads = async () => {
    try {
      const response = await leadAPI.getUnassignedLeads({ branch });
      setUnassignedLeads(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch unassigned leads:', error);
    }
  };

  const fetchSalespeople = async () => {
    try {
      const response = await userAPI.getSalespeople({ branch });
      setSalespeople(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch salespeople:', error);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      const ext = selectedFile.name.split('.').pop().toLowerCase();
      if (['csv', 'xlsx', 'xls'].includes(ext)) {
        setFile(selectedFile);
        setResult(null);
      } else {
        toast.error('Please upload a CSV or Excel file');
      }
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a file');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('branch', branch);

    try {
      const response = await leadAPI.uploadLeads(formData);
      setResult(response.data.data);
      toast.success(response.data.message);
      setFile(null);
      // Refresh unassigned leads
      fetchUnassignedLeads();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSelectLead = (leadId) => {
    setSelectedLeads(prev =>
      prev.includes(leadId)
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId]
    );
  };

  const handleSelectAll = () => {
    if (selectedLeads.length === unassignedLeads.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(unassignedLeads.map(lead => lead.id));
    }
  };

  const handleAssignLeads = async () => {
    if (!selectedSalesperson) {
      toast.error('Please select a salesperson');
      return;
    }

    if (selectedLeads.length === 0) {
      toast.error('Please select at least one lead');
      return;
    }

    setAssigning(true);
    try {
      await leadAPI.assignLeads(selectedLeads, selectedSalesperson);
      toast.success(`${selectedLeads.length} lead(s) assigned successfully`);
      setSelectedLeads([]);
      setShowAssignModal(false);
      setSelectedSalesperson('');
      fetchUnassignedLeads();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Assignment failed');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Upload Leads</h1>
        <p className="text-gray-600 mt-1">Upload files and manually assign leads to salespeople</p>
      </div>

      {/* Upload Card */}
      <div className="card">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="bg-primary-100 p-6 rounded-full mb-6">
            <Upload className="h-12 w-12 text-primary-600" />
          </div>

          <h3 className="text-xl font-semibold text-gray-900 mb-2">Upload Lead File</h3>
          <p className="text-gray-600 mb-6 text-center max-w-md">
            Upload a CSV or Excel file containing lead information. Leads will be saved as unassigned and can be distributed manually.
          </p>

          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
            id="file-upload"
          />

          <label
            htmlFor="file-upload"
            className="btn-primary cursor-pointer inline-flex items-center space-x-2"
          >
            <FileText className="h-5 w-5" />
            <span>{file ? file.name : 'Select File'}</span>
          </label>

          {file && (
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="mt-4 btn-primary disabled:opacity-50"
            >
              {uploading ? 'Uploading...' : 'Upload Leads'}
            </button>
          )}
        </div>

        {/* File Format Instructions */}
        <div className="border-t border-gray-200 pt-6 mt-6">
          <h4 className="font-semibold text-gray-900 mb-4">Required Format:</h4>
          <div className="bg-gray-50 p-4 rounded-lg">
            <code className="text-sm text-gray-700">
              name, phone, email, country, product, source, date
              <br />
              John Doe, 1234567890, john@example.com, USA, Product A, Website, 2024-01-15
            </code>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            * name, phone, and country are required fields
          </p>
        </div>
      </div>

      {/* Unassigned Leads Table */}
      {unassignedLeads.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Unassigned Leads ({unassignedLeads.length})</h2>
              <p className="text-sm text-gray-600">Select leads and assign to salespeople</p>
            </div>
            {selectedLeads.length > 0 && (
              <button
                onClick={() => setShowAssignModal(true)}
                className="btn-primary inline-flex items-center space-x-2"
              >
                <UserPlus className="h-4 w-4" />
                <span>Assign {selectedLeads.length} Lead(s)</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={selectedLeads.length === unassignedLeads.length && unassignedLeads.length > 0}
                        onChange={handleSelectAll}
                        className="rounded border-gray-300"
                      />
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => setSelectedLeads(unassignedLeads.slice(0, 10).map(l => l.id))}
                          className="text-xs text-primary-600 hover:text-primary-700 font-medium px-2 py-1 rounded hover:bg-primary-50"
                          title="Select first 10 leads"
                        >
                          10
                        </button>
                        <span className="text-xs text-gray-400">|</span>
                        <button
                          onClick={handleSelectAll}
                          className="text-xs text-primary-600 hover:text-primary-700 font-medium px-2 py-1 rounded hover:bg-primary-50"
                        >
                          All
                        </button>
                      </div>
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Country</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {unassignedLeads.map((lead) => (
                  <tr key={lead.id} className={selectedLeads.includes(lead.id) ? 'bg-primary-50' : 'hover:bg-gray-50'}>
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedLeads.includes(lead.id)}
                        onChange={() => handleSelectLead(lead.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{lead.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{lead.phone}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{lead.email || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{lead.country}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{lead.product || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{lead.source || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Assignment Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Assign Leads</h3>
              <button onClick={() => setShowAssignModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Assign {selectedLeads.length} selected lead(s) to a salesperson
            </p>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Salesperson
              </label>
              <select
                value={selectedSalesperson}
                onChange={(e) => setSelectedSalesperson(e.target.value)}
                className="input"
              >
                <option value="">Choose a salesperson...</option>
                {salespeople.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name} - {person.email}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={handleAssignLeads}
                disabled={assigning || !selectedSalesperson}
                className="flex-1 btn-primary disabled:opacity-50"
              >
                {assigning ? 'Assigning...' : 'Assign Leads'}
              </button>
              <button
                onClick={() => setShowAssignModal(false)}
                className="flex-1 btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadLeads;
