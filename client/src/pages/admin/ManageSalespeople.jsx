import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { userAPI } from '../../services/api';
import { UserPlus, Edit2, UserX, Trash2, BarChart2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useBranch } from '../../context/BranchContext';

const ManageSalespeople = () => {
  const { branch } = useBranch();
  const [salespeople, setSalespeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    monthlyTarget: '',
    weeklyTarget: ''
  });

  useEffect(() => {
    fetchSalespeople();
  }, [branch]);

  const fetchSalespeople = async () => {
    try {
      const response = await userAPI.getSalespeople({ branch });
      setSalespeople(response.data.data);
    } catch (error) {
      toast.error('Failed to load salespeople');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (editingUser) {
        await userAPI.updateSalesperson(editingUser.id, formData);
        toast.success('Salesperson updated successfully');
      } else {
        await userAPI.createSalesperson({ ...formData, branch });
        toast.success('Salesperson created successfully');
      }

      setShowModal(false);
      resetForm();
      fetchSalespeople();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Operation failed');
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      phone: user.phone || '',
      monthlyTarget: user.monthlyTarget || '',
      weeklyTarget: user.weeklyTarget || ''
    });
    setShowModal(true);
  };

  const [processingId, setProcessingId] = useState(null);

  const handleDeactivate = async (id, name) => {
    if (processingId) return;
    if (window.confirm(`Deactivate ${name}?\n\nThey will no longer be able to log into the CRM. Historical leads, calls, activities, and payment records will be preserved.`)) {
      setProcessingId(id);
      try {
        const response = await userAPI.deactivateSalesperson(id);
        toast.success(response.data?.message || 'Salesperson deactivated');
        setSalespeople(prev => prev.map(sp => sp.id === id ? { ...sp, isActive: false } : sp));
        fetchSalespeople();
      } catch (error) {
        toast.error(error.response?.data?.message || 'Failed to deactivate salesperson');
      } finally {
        setProcessingId(null);
      }
    }
  };

  const handleDelete = async (id, name) => {
    if (processingId) return;
    if (window.confirm(`Remove ${name}?\n\nThis will remove the salesperson account. Historical CRM records will be safely preserved.`)) {
      setProcessingId(id);
      try {
        const response = await userAPI.deleteSalesperson(id);
        toast.success(response.data?.message || 'Salesperson removed successfully');
        setSalespeople(prev => prev.filter(sp => sp.id !== id));
        fetchSalespeople();
      } catch (error) {
        toast.error(error.response?.data?.message || 'Failed to remove salesperson');
      } finally {
        setProcessingId(null);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      phone: '',
      monthlyTarget: '',
      weeklyTarget: ''
    });
    setEditingUser(null);
  };

  const getLeadStats = (user) => {
    const leads = user.leads || [];
    return {
      total: leads.length,
      closed: leads.filter(l => l.status === 'closed').length,
      fresh: leads.filter(l => l.status === 'fresh').length,
      followUp: leads.filter(l => l.status === 'follow-up').length
    };
  };

  if (loading) {
    return <div className="flex justify-center items-center h-96">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
    </div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Manage Salespeople</h1>
          <p className="text-gray-600 mt-1">Add, edit, and manage your sales team</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="btn-primary flex items-center space-x-2"
        >
          <UserPlus className="h-5 w-5" />
          <span>Add Salesperson</span>
        </button>
      </div>

      {/* Salespeople Grid: phones & iPad (<= lg) single column; desktop >= lg shows 3 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {salespeople.map((person) => {
          const stats = getLeadStats(person);
          return (
            <div key={person.id} className="card">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{person.name}</h3>
                  <p className="text-sm text-gray-600">{person.email}</p>
                  {person.phone && (
                    <p className="text-sm text-gray-600">{person.phone}</p>
                  )}
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${person.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                  {person.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Leads:</span>
                  <span className="font-semibold">{stats.total}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Closed:</span>
                  <span className="font-semibold text-green-600">{stats.closed}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Follow-up:</span>
                  <span className="font-semibold text-orange-600">{stats.followUp}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200 grid grid-cols-2 gap-2">
                <button
                  onClick={() => navigate(`/admin/salespeople/${person.id}/performance`)}
                  className="col-span-2 btn-secondary text-sm flex items-center justify-center space-x-1 mb-2 bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200"
                >
                  <BarChart2 className="h-4 w-4" />
                  <span>View Detailed Stats</span>
                </button>
                <button
                  onClick={() => handleEdit(person)}
                  className="btn-secondary text-sm flex items-center justify-center space-x-1"
                >
                  <Edit2 className="h-4 w-4" />
                  <span>Edit</span>
                </button>
                {person.isActive ? (
                  <button
                    onClick={() => handleDeactivate(person.id, person.name)}
                    disabled={processingId === person.id}
                    className="btn-danger text-sm flex items-center justify-center space-x-1 disabled:opacity-50"
                  >
                    <UserX className="h-4 w-4" />
                    <span>{processingId === person.id ? 'Deactivating...' : 'Deactivate'}</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleDelete(person.id, person.name)}
                    disabled={processingId === person.id}
                    className="btn-danger text-sm flex items-center justify-center space-x-1 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>{processingId === person.id ? 'Removing...' : 'Delete'}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {editingUser ? 'Edit Salesperson' : 'Add New Salesperson'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Full Name</label>
                <input
                  type="text"
                  required
                  className="input-field"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  required
                  className="input-field"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Password {editingUser && '(leave blank to keep current)'}</label>
                <input
                  type="password"
                  className="input-field"
                  required={!editingUser}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Phone</label>
                <input
                  type="tel"
                  className="input-field"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Monthly Conversions Target</label>
                  <input
                    type="number"
                    className="input-field"
                    min={0}
                    step={1}
                    value={formData.monthlyTarget}
                    onChange={(e) => setFormData({ ...formData, monthlyTarget: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">Weekly Conversions Target</label>
                  <input
                    type="number"
                    className="input-field"
                    min={0}
                    step={1}
                    value={formData.weeklyTarget}
                    onChange={(e) => setFormData({ ...formData, weeklyTarget: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button type="submit" className="flex-1 btn-primary">
                  {editingUser ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="flex-1 btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageSalespeople;
