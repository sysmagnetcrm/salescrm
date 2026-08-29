import { useEffect, useState } from 'react';
import { authAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

const AdminProfile = () => {
  const { user, login } = useAuth();
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone: ''
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);

  useEffect(() => {
    if (user) {
      setProfile({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || ''
      });
    }
  }, [user]);

  const handleProfileChange = (field) => (event) => {
    setProfile((prev) => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  const handlePasswordChange = (field) => (event) => {
    setPasswordForm((prev) => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  const handleProfileSubmit = async (event) => {
    event.preventDefault();

    if (!profile.name?.trim() || !profile.email?.trim()) {
      toast.error('Name and email are required');
      return;
    }

    try {
      setLoadingProfile(true);
      const response = await authAPI.updateProfile({
        name: profile.name.trim(),
        email: profile.email.trim(),
        phone: profile.phone
      });

      const updatedUser = response.data.data;
      toast.success('Profile updated successfully');
      localStorage.setItem('user', JSON.stringify(updatedUser));
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to update profile';
      toast.error(message);
    } finally {
      setLoadingProfile(false);
    }
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      toast.error('Please fill out all fields');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (passwordForm.currentPassword === passwordForm.newPassword) {
      toast.error('New password must be different from the current password');
      return;
    }

    try {
      setLoadingPassword(true);
      await authAPI.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });
      toast.success('Password updated successfully');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to update password';
      toast.error(message);
    } finally {
      setLoadingPassword(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Account Settings</h1>
        <p className="text-gray-600 mt-1">
          Manage your profile information and update your password.
        </p>
      </div>

      <div className="card max-w-xl">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Profile Information</h2>
        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="name">Full Name</label>
            <input
              id="name"
              type="text"
              className="input-field"
              value={profile.name}
              onChange={handleProfileChange('name')}
              placeholder="Enter full name"
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              className="input-field"
              value={profile.email}
              onChange={handleProfileChange('email')}
              placeholder="Enter email address"
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="phone">Phone Number</label>
            <input
              id="phone"
              type="tel"
              className="input-field"
              value={profile.phone || ''}
              onChange={handleProfileChange('phone')}
              placeholder="Enter phone number"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={loadingProfile}
              className="btn-primary min-w-[160px] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loadingProfile ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      <div className="card max-w-xl">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Change Password</h2>
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="currentPassword">Current Password</label>
            <input
              id="currentPassword"
              type="password"
              className="input-field"
              value={passwordForm.currentPassword}
              onChange={handlePasswordChange('currentPassword')}
              placeholder="Enter current password"
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="newPassword">New Password</label>
            <input
              id="newPassword"
              type="password"
              className="input-field"
              value={passwordForm.newPassword}
              onChange={handlePasswordChange('newPassword')}
              placeholder="Create a new password"
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="confirmPassword">Confirm New Password</label>
            <input
              id="confirmPassword"
              type="password"
              className="input-field"
              value={passwordForm.confirmPassword}
              onChange={handlePasswordChange('confirmPassword')}
              placeholder="Re-enter new password"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={loadingPassword}
              className="btn-primary min-w-[160px] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loadingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminProfile;
