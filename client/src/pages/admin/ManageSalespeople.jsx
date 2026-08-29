import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userAPI } from '../../services/api';
import { UserPlus, Edit2, UserX, Trash2, BarChart2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useBranch } from '../../context/BranchContext';

const ManageSalespeople = () => {
  const { branch } = useBranch();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    monthlyTarget: '',
    weeklyTarget: ''
  });

  // Query Salespeople
  const { data: salespeople = [], isLoading } = useQuery({
    queryKey: ['salespeople', branch],
    queryFn: () => userAPI.getSalespeople({ branch }).then(r => r.data.data || []),
    staleTime: 120000
  });

  // Add / Edit Mutation
  const saveMutation = useMutation({
    mutationFn: (payload) => {
      if (editingUser) {
        return userAPI.updateSalesperson(editingUser.id, payload);
      }
      return userAPI.createSalesperson(payload);
    },
    onSuccess: () => {
      toast.success(`Salesperson ${editingUser ? 'updated' : 'created'} successfully`);
      setShowModal(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['salespeople'] });
      queryClient.invalidateQueries({ queryKey: ['tl-team'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to save salesperson');
    }
  });

  // Deactivate Mutation
  const deactivateMutation = useMutation({
    mutationFn: (id) => userAPI.deactivateSalesperson(id),
    onSuccess: () => {
      toast.success('Salesperson deactivated');
      queryClient.invalidateQueries({ queryKey: ['salespeople'] });
      queryClient.invalidateQueries({ queryKey: ['tl-team'] });
    },
    onError: () => toast.error('Failed to deactivate salesperson')
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => userAPI.deleteSalesperson(id),
    onSuccess: () => {
      toast.success('Salesperson deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['salespeople'] });
      queryClient.invalidateQueries({ queryKey: ['tl-team'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to delete salesperson');
    }
  });

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

  const handleEdit = (sp) => {
    setEditingUser(sp);
    setFormData({
      name: sp.name,
      email: sp.email,
      password: '', // Leave blank unless changing
      phone: sp.phone || '',
      monthlyTarget: sp.monthlyTarget || '',
      weeklyTarget: sp.weeklyTarget || ''
    });
    setShowModal(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = { ...formData };
    if (editingUser && !payload.password) {
      delete payload.password;
    }
    saveMutation.mutate(payload);
  };

  const handleDeactivate = (id) => {
    if (window.confirm('Are you sure you want to deactivate this salesperson?')) {
      deactivateMutation.mutate(id);
    }
  };

  const handleDelete = (id, name) => {
    if (window.confirm(`Are you sure you want to PERMANENTLY DELETE salesperson "${name}"?\n\nThis action cannot be undone.`)) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manage Salespeople</h1>
          <p className="text-sm text-gray-500">Create, manage, and assign targets to BDEs</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="btn-primary flex items-center space-x-2"
        >
          <UserPlus className="h-5 w-5" />
          <span>Add Salesperson</span>
        </button>
      </div>

      {/* Salespeople Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading && !salespeople.length ? (
          <div className="p-8 text-center text-gray-400 animate-pulse">Loading team members...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs font-medium text-gray-500 uppercase">
                <tr>
                  <th className="px-6 py-3">Salesperson</th>
                  <th className="px-6 py-3">Contact</th>
                  <th className="px-6 py-3">Weekly Target</th>
                  <th className="px-6 py-3">Monthly Target</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {salespeople.map((sp) => (
                  <tr key={sp.id} className="hover:bg-gray-50/50">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      <div>{sp.name}</div>
                      <div className="text-xs text-gray-400 font-normal">Role: {sp.role}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      <div>{sp.email}</div>
                      <div className="text-xs text-gray-400">{sp.phone || 'No phone'}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-900 font-medium">
                      {sp.weeklyTarget ? `${sp.weeklyTarget} leads` : 'Not set'}
                    </td>
                    <td className="px-6 py-4 text-gray-900 font-medium">
                      {sp.monthlyTarget ? `${sp.monthlyTarget} leads` : 'Not set'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${sp.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {sp.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => navigate(`/admin/salespeople/${sp.id}/performance`)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="View Detailed Performance"
                      >
                        <BarChart2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(sp)}
                        className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Edit User"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      {sp.isActive && (
                        <button
                          onClick={() => handleDeactivate(sp.id)}
                          className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                          title="Deactivate Account"
                        >
                          <UserX className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(sp.id, sp.name)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete User"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {salespeople.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                      No salespeople registered yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h2 className="text-xl font-bold text-gray-900">
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
                <label className="label">Email Address</label>
                <input
                  type="email"
                  required
                  className="input-field"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div>
                <label className="label">{editingUser ? 'Password (leave blank to keep unchanged)' : 'Password'}</label>
                <input
                  type="password"
                  required={!editingUser}
                  className="input-field"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Phone Number</label>
                <input
                  type="text"
                  className="input-field"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Weekly Target</label>
                  <input
                    type="number"
                    className="input-field"
                    value={formData.weeklyTarget}
                    onChange={(e) => setFormData({ ...formData, weeklyTarget: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Monthly Target</label>
                  <input
                    type="number"
                    className="input-field"
                    value={formData.monthlyTarget}
                    onChange={(e) => setFormData({ ...formData, monthlyTarget: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="btn-primary px-4 py-2 text-sm"
                >
                  {saveMutation.isPending ? 'Saving...' : 'Save Salesperson'}
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
