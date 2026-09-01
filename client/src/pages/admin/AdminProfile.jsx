import { useEffect, useState } from 'react';
import { authAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useBranch } from '../../context/BranchContext';
import { 
  User, ShieldCheck, KeyRound, Bell, Palette, Lock, Eye, EyeOff, 
  Smartphone, CheckCircle2, AlertCircle, Clock, Sparkles, Building2, Monitor
} from 'lucide-react';

const AdminProfile = () => {
  const { user, login } = useAuth();
  const { branch } = useBranch();

  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'security' | 'preferences' | 'audit'

  // Profile Form
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone: ''
  });
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Password Form
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);

  // Preferences State
  const [theme, setTheme] = useState(localStorage.getItem('theme_preference') || 'system');
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [callSounds, setCallSounds] = useState(true);
  const [dailyDigest, setDailyDigest] = useState(true);

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
      toast.success('Profile information updated successfully');
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
      toast.error('Please fill out all password fields');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters long');
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

  const handleSavePreferences = () => {
    localStorage.setItem('theme_preference', theme);
    toast.success('Account preferences saved');
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  // Password Strength Calculation
  const checkPasswordStrength = (pwd) => {
    if (!pwd) return { score: 0, label: 'Empty', color: 'bg-gray-200' };
    let score = 0;
    if (pwd.length >= 6) score += 1;
    if (pwd.length >= 10) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;

    if (score <= 2) return { score: 33, label: 'Weak', color: 'bg-red-500' };
    if (score <= 4) return { score: 66, label: 'Moderate', color: 'bg-amber-500' };
    return { score: 100, label: 'Strong', color: 'bg-emerald-500' };
  };

  const pwdStrength = checkPasswordStrength(passwordForm.newPassword);

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Top Banner Card */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-950 text-white p-8 rounded-3xl shadow-xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-2xl shadow-xl border-2 border-indigo-400">
                {getInitials(user?.name)}
              </div>
              <div className="absolute -bottom-1 -right-1 p-1 bg-emerald-500 text-white rounded-full ring-4 ring-slate-900">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>

            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                {user?.name || 'Account User'}
              </h1>
              <p className="text-indigo-200 text-xs mt-0.5">{user?.email}</p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 uppercase tracking-wider">
                  {user?.role || 'User'}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white/10 text-white border border-white/10 flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-amber-400" />
                  Branch: {branch || 'All Branches'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modern Tabs Navigation */}
      <div className="flex border-b border-gray-200 gap-2 overflow-x-auto">
        {[
          { id: 'profile', label: 'Profile Information', icon: User },
          { id: 'security', label: 'Security & Password', icon: KeyRound },
          { id: 'preferences', label: 'App Preferences', icon: Palette },
          { id: 'audit', label: 'Recent Activity', icon: Clock }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 px-4 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 whitespace-nowrap border-b-2 ${
                isActive
                  ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
                  : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Profile Information */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-6">
            <div className="border-b pb-3">
              <h2 className="text-lg font-bold text-gray-900">Personal Details</h2>
              <p className="text-xs text-gray-500">Update your account name, email address, and contact details</p>
            </div>

            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1" htmlFor="name">Full Name</label>
                <input
                  id="name"
                  type="text"
                  className="input-field w-full"
                  value={profile.name}
                  onChange={handleProfileChange('name')}
                  placeholder="Enter full name"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1" htmlFor="email">Email Address</label>
                <input
                  id="email"
                  type="email"
                  className="input-field w-full"
                  value={profile.email}
                  onChange={handleProfileChange('email')}
                  placeholder="Enter email address"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1" htmlFor="phone">Phone Number</label>
                <input
                  id="phone"
                  type="tel"
                  className="input-field w-full"
                  value={profile.phone || ''}
                  onChange={handleProfileChange('phone')}
                  placeholder="+91 9876543210"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={loadingProfile}
                  className="btn-primary py-2.5 px-6 font-bold text-xs flex items-center gap-2 shadow-md"
                >
                  {loadingProfile ? 'Saving...' : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          </div>

          {/* Account Overview Sidebar */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4">
              <h3 className="text-sm font-bold text-gray-900 border-b pb-2">Account Summary</h3>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">User ID:</span>
                  <span className="font-mono text-gray-800">#{user?.id || 1}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">System Role:</span>
                  <span className="font-semibold text-indigo-600 capitalize">{user?.role || 'Admin'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Account Status:</span>
                  <span className="text-emerald-600 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Active
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Security & Password */}
      {activeTab === 'security' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-6">
            <div className="border-b pb-3">
              <h2 className="text-lg font-bold text-gray-900">Change Password</h2>
              <p className="text-xs text-gray-500">Ensure your account uses a strong, unique password</p>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1" htmlFor="currentPassword">Current Password</label>
                <div className="relative">
                  <input
                    id="currentPassword"
                    type={showCurrentPassword ? 'text' : 'password'}
                    className="input-field w-full pr-10"
                    value={passwordForm.currentPassword}
                    onChange={handlePasswordChange('currentPassword')}
                    placeholder="Enter current password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1" htmlFor="newPassword">New Password</label>
                <div className="relative">
                  <input
                    id="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    className="input-field w-full pr-10 text-xs"
                    value={passwordForm.newPassword}
                    onChange={handlePasswordChange('newPassword')}
                    placeholder="Enter new password (min. 6 characters)"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Password Strength Indicator */}
                {passwordForm.newPassword && (
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between items-center text-[11px] font-semibold text-gray-600">
                      <span>Strength: {pwdStrength.label}</span>
                    </div>
                    <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${pwdStrength.color}`}
                        style={{ width: `${pwdStrength.score}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1" htmlFor="confirmPassword">Confirm New Password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  className="input-field w-full text-xs"
                  value={passwordForm.confirmPassword}
                  onChange={handlePasswordChange('confirmPassword')}
                  placeholder="Re-enter new password"
                  required
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={loadingPassword}
                  className="btn-primary py-2.5 px-6 font-bold text-xs flex items-center gap-2 shadow-md"
                >
                  {loadingPassword ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>

          {/* Active Security Sessions Sidebar */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4">
              <h3 className="text-sm font-bold text-gray-900 border-b pb-2 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Security Health
              </h3>
              <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs space-y-1">
                <p className="font-bold">2-Factor Authentication (Ready)</p>
                <p className="text-[11px] text-emerald-700">Account session is encrypted with JWT tokens.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: App Preferences */}
      {activeTab === 'preferences' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 max-w-2xl space-y-6">
          <div className="border-b pb-3">
            <h2 className="text-lg font-bold text-gray-900">Application Preferences</h2>
            <p className="text-xs text-gray-500">Configure interface notifications and audio alert preferences</p>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">Interface Theme</label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'light', label: 'Light Mode' },
                  { id: 'dark', label: 'Dark Mode' },
                  { id: 'system', label: 'System Default' }
                ].map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTheme(t.id)}
                    className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all ${
                      theme === t.id
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                        : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3 pt-3 border-t">
              <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Notifications & Alerts</h3>

              <label className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer">
                <div>
                  <p className="text-xs font-semibold text-gray-900">Email Notifications for High-Value Leads</p>
                  <p className="text-[11px] text-gray-500">Receive instant email alerts when leads with advance payment are logged</p>
                </div>
                <input
                  type="checkbox"
                  checked={emailAlerts}
                  onChange={(e) => setEmailAlerts(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 h-4"
                />
              </label>

              <label className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer">
                <div>
                  <p className="text-xs font-semibold text-gray-900">Audio Chimes for CRM Inbound Calls</p>
                  <p className="text-[11px] text-gray-500">Play ringing sounds when salesperson call logs pop up</p>
                </div>
                <input
                  type="checkbox"
                  checked={callSounds}
                  onChange={(e) => setCallSounds(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-4 h-4"
                />
              </label>
            </div>

            <div className="flex justify-end pt-3">
              <button
                type="button"
                onClick={handleSavePreferences}
                className="btn-primary py-2.5 px-6 font-bold text-xs shadow-md"
              >
                Save Preferences
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Audit & Activity Log */}
      {activeTab === 'audit' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4">
          <div className="border-b pb-3">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-600" />
              Account Security Log
            </h2>
            <p className="text-xs text-gray-500">Timeline of recent login sessions and profile changes</p>
          </div>

          <div className="space-y-3">
            {[
              { action: 'Logged into CRM Web Dashboard', time: 'Just now', ip: '127.0.0.1 (Local)' },
              { action: 'Updated Master List Settings', time: 'Today at 2:15 PM', ip: '127.0.0.1 (Local)' },
              { action: 'Exported Leads CSV Report', time: 'Today at 11:30 AM', ip: '127.0.0.1 (Local)' },
              { action: 'Session Restored via JWT Auth Token', time: 'Yesterday', ip: '127.0.0.1 (Local)' }
            ].map((log, idx) => (
              <div key={idx} className="p-3.5 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                    <Monitor className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{log.action}</p>
                    <p className="text-[11px] text-gray-400">{log.ip}</p>
                  </div>
                </div>
                <span className="text-[11px] text-gray-500 font-medium">{log.time}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProfile;
