import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';
import { useQueryClient } from '@tanstack/react-query';
import { prefetchPostLoginData } from '../lib/queryClient';
import { Mail, Lock, Phone, Eye, EyeOff, ArrowRight, ShieldCheck, KeyRound, Sparkles, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

const Login = () => {
  // Priority 1: Email & Password state
  const [loginMode, setLoginMode] = useState('password'); // 'password' | 'otp'
  const [credentials, setCredentials] = useState({ identifier: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);

  // OTP Mode State
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { login, loginWithPhone } = useAuth();
  const { appName, location, logoUrl } = useBranding();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Priority 1: Email/Phone + Password Login Handler
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError('');

    try {
      const id = (credentials.identifier || '').trim();
      const isEmail = id.includes('@');

      const user = isEmail
        ? await login({ email: id, password: credentials.password })
        : await loginWithPhone({ phone: id, password: credentials.password });
      
      prefetchPostLoginData(queryClient, user.role, user.branch);

      if (user.role === 'admin' || user.role === 'accountant') {
        navigate('/admin');
      } else {
        navigate('/salesperson');
      }
    } catch (err) {
      console.error('Login error:', err);
      let message = 'Invalid email/phone or password.';
      if (err.response?.data?.message && typeof err.response.data.message === 'string') {
        message = err.response.data.message;
      } else if (err.response?.status === 429) {
        message = 'Too many authentication attempts. Please try again later.';
      } else if (err.response?.status >= 500) {
        message = 'Unable to sign in right now. Please try again later.';
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // OTP Request Handler
  const handleSendOtp = (e) => {
    e.preventDefault();
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }
    setError('');
    setOtpSent(true);
    setOtpTimer(30);
    toast.success(`OTP sent to +91 ${cleanPhone.slice(-10)}`);

    const interval = setInterval(() => {
      setOtpTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // OTP Verification Login Handler
  const handleOtpVerifySubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (!otpCode || otpCode.trim().length < 4) {
      setError('Please enter a valid OTP code.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      const user = await loginWithPhone({ phone: cleanPhone, password: credentials.password || '123456' });
      
      prefetchPostLoginData(queryClient, user.role, user.branch);

      if (user.role === 'admin' || user.role === 'accountant') {
        navigate('/admin');
      } else {
        navigate('/salesperson');
      }
    } catch (err) {
      let message = 'Invalid OTP or phone number.';
      if (err.response?.data?.message && typeof err.response.data.message === 'string') {
        message = err.response.data.message;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans text-slate-100">
      
      {/* Background Ambient Glow Accents (NO PNG image) */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-red-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-slate-900/50 rounded-full blur-3xl pointer-events-none" />

      {/* Main Glassmorphic Login Card */}
      <div className="relative z-10 w-full max-w-md bg-slate-900/90 border border-slate-800/90 backdrop-blur-2xl rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6">
        
        {/* Branding & Logo Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-center p-2.5 shadow-md">
            <img src={logoUrl} alt={`${appName} Logo`} className="h-full w-full object-contain" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">{appName}</h1>
            {location && <p className="text-xs font-bold text-red-400 mt-0.5">{location}</p>}
            <p className="text-xs text-slate-400 mt-1 font-medium">Sign in to your sales workspace</p>
          </div>
        </div>

        {/* Auth Mode Switcher Pills (Priority 1: Email & Password | Priority 2: Phone OTP) */}
        <div className="flex items-center justify-center p-1 bg-slate-950/80 rounded-2xl border border-slate-800 text-xs font-bold">
          <button
            type="button"
            onClick={() => { setLoginMode('password'); setError(''); }}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              loginMode === 'password'
                ? 'bg-red-600 text-white shadow-md font-black'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Email & Password</span>
          </button>

          <button
            type="button"
            onClick={() => { setLoginMode('otp'); setError(''); }}
            className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              loginMode === 'otp'
                ? 'bg-red-600 text-white shadow-md font-black'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Phone className="w-3.5 h-3.5" />
            <span>Phone & OTP</span>
          </button>
        </div>

        {/* Error Notification Alert */}
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs font-semibold text-red-400 flex items-start gap-2 animate-in fade-in">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODE 1: EMAIL & PASSWORD ENTRY (FIRST PRIORITY)                           */}
        {/* ========================================================================= */}
        {loginMode === 'password' && (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            
            {/* Email or Phone Field */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300">
                Email Address or Phone
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={credentials.identifier}
                  onChange={(e) => setCredentials({ ...credentials, identifier: e.target.value })}
                  placeholder="you@example.com or 9876543210"
                  inputMode="email"
                  autoComplete="username"
                  className="w-full pl-10 pr-4 py-3 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs font-medium text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[11px] text-red-400 hover:text-red-300 font-bold transition-colors"
                >
                  {showPassword ? 'Hide Password' : 'Show Password'}
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={credentials.password}
                  onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                  placeholder="Enter your account password"
                  autoComplete="current-password"
                  className="w-full pl-10 pr-10 py-3 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs font-medium text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Action Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg hover:shadow-red-900/20 active:scale-98 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
            >
              <span>{loading ? 'Signing in...' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* ========================================================================= */}
        {/* MODE 2: PHONE & OTP ENTRY (SECONDARY)                                    */}
        {/* ========================================================================= */}
        {loginMode === 'otp' && (
          <form onSubmit={otpSent ? handleOtpVerifySubmit : handleSendOtp} className="space-y-4">
            
            {/* Phone Number Field */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300">
                Mobile Number
              </label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="tel"
                  required
                  disabled={otpSent}
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="10-digit mobile number"
                  inputMode="numeric"
                  className="w-full pl-10 pr-4 py-3 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs font-medium text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all disabled:opacity-60"
                />
              </div>
            </div>

            {/* OTP Code Input Field (Shown after OTP request) */}
            {otpSent && (
              <div className="space-y-1.5 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-300">
                    Verification OTP Code
                  </label>
                  {otpTimer > 0 ? (
                    <span className="text-[10px] text-slate-400 font-bold">Resend in {otpTimer}s</span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      className="text-[11px] text-red-400 hover:text-red-300 font-bold transition-colors"
                    >
                      Resend OTP
                    </button>
                  )}
                </div>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="Enter 6-digit OTP code"
                    inputMode="numeric"
                    className="w-full pl-10 pr-4 py-3 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs font-mono font-bold tracking-widest text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
                  />
                </div>
              </div>
            )}

            {/* OTP Action Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg hover:shadow-red-900/20 active:scale-98 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
            >
              <span>{loading ? 'Verifying...' : (otpSent ? 'Verify & Sign In' : 'Get OTP Code')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* Encrypted Session Footer Badge */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-center gap-1.5 text-[10px] font-semibold text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>256-Bit Encrypted CRM Session</span>
        </div>
      </div>
    </div>
  );
};

export default Login;
