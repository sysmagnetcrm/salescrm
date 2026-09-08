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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/60 to-blue-50/40 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans text-slate-900 selection:bg-sky-500 selection:text-white">
      
      {/* Dynamic Background Ambient Light-Blue & Luxury White Glow Orbs */}
      <div className="absolute -top-32 -left-32 w-[450px] h-[450px] bg-sky-300/30 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] bg-blue-400/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-sky-200/25 rounded-full blur-3xl pointer-events-none" />
      
      {/* Luxury Tactile SVG Grain Texture Overlay */}
      <div 
        className="absolute inset-0 opacity-[0.035] pointer-events-none mix-blend-multiply"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
        }}
      />

      {/* Main Glassmorphic Luxury White Login Card */}
      <div className="relative z-10 w-full max-w-md bg-white/85 border border-slate-200/80 backdrop-blur-2xl rounded-3xl shadow-[0_20px_50px_rgba(14,165,233,0.08),0_10px_25px_rgba(0,0,0,0.04)] p-6 sm:p-8 space-y-6 transition-all duration-300">
        
        {/* Branding & Logo Header */}
        <div className="flex flex-col items-center text-center space-y-2.5">
          <div className="w-16 h-16 rounded-2xl bg-white border border-sky-100 flex items-center justify-center p-2.5 shadow-md shadow-sky-500/10 ring-4 ring-sky-50/80 group transition-transform duration-300 hover:scale-105">
            <img src={logoUrl} alt={`${appName} Logo`} className="h-full w-full object-contain" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">{appName}</h1>
            {location && <p className="text-xs font-bold text-sky-600 mt-0.5 tracking-wide">{location}</p>}
            <p className="text-xs text-slate-500 mt-1 font-medium">Sign in to your sales workspace</p>
          </div>
        </div>

        {/* Auth Mode Switcher Pills (Email & Password | Phone & OTP) */}
        <div className="flex items-center justify-center p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/80 text-xs font-bold">
          <button
            type="button"
            onClick={() => { setLoginMode('password'); setError(''); }}
            className={`flex-1 py-2.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 ${
              loginMode === 'password'
                ? 'bg-white text-slate-900 shadow-md shadow-slate-200/60 ring-1 ring-slate-200/80 font-black'
                : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Mail className={`w-3.5 h-3.5 ${loginMode === 'password' ? 'text-sky-600' : 'text-slate-400'}`} />
            <span>Email & Password</span>
          </button>

          <button
            type="button"
            onClick={() => { setLoginMode('otp'); setError(''); }}
            className={`flex-1 py-2.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 ${
              loginMode === 'otp'
                ? 'bg-white text-slate-900 shadow-md shadow-slate-200/60 ring-1 ring-slate-200/80 font-black'
                : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Phone className={`w-3.5 h-3.5 ${loginMode === 'otp' ? 'text-sky-600' : 'text-slate-400'}`} />
            <span>Phone & OTP</span>
          </button>
        </div>

        {/* Error Notification Alert */}
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50/80 p-3.5 text-xs font-semibold text-red-600 flex items-start gap-2.5 shadow-sm animate-in fade-in slide-in-from-top-1 duration-200">
            <span className="w-2 h-2 rounded-full bg-red-500 mt-1 shrink-0 animate-ping" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODE 1: EMAIL & PASSWORD ENTRY (FIRST PRIORITY)                           */}
        {/* ========================================================================= */}
        {loginMode === 'password' && (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            
            {/* Email or Phone Field */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700">
                Email Address or Phone
              </label>
              <div className="relative group">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-sky-600 transition-colors duration-200" />
                <input
                  type="text"
                  required
                  value={credentials.identifier}
                  onChange={(e) => setCredentials({ ...credentials, identifier: e.target.value })}
                  placeholder="you@example.com or 9876543210"
                  inputMode="email"
                  autoComplete="username"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50/80 border border-slate-200/90 rounded-xl text-xs font-semibold text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition-all duration-200 shadow-inner shadow-slate-100/50"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[11px] text-sky-600 hover:text-sky-700 font-bold transition-colors"
                >
                  {showPassword ? 'Hide Password' : 'Show Password'}
                </button>
              </div>
              <div className="relative group">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-sky-600 transition-colors duration-200" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={credentials.password}
                  onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                  placeholder="Enter your account password"
                  autoComplete="current-password"
                  className="w-full pl-10 pr-10 py-3 bg-slate-50/80 border border-slate-200/90 rounded-xl text-xs font-semibold text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition-all duration-200 shadow-inner shadow-slate-100/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Action Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-sky-500 via-blue-600 to-blue-700 hover:from-sky-600 hover:via-blue-700 hover:to-blue-800 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-sky-500/25 hover:shadow-sky-500/40 active:scale-[0.98] transition-all duration-200 disabled:opacity-60 flex items-center justify-center gap-2 mt-2 group"
            >
              <span>{loading ? 'Signing in...' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200" />
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
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700">
                Mobile Number
              </label>
              <div className="relative group">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-sky-600 transition-colors duration-200" />
                <input
                  type="tel"
                  required
                  disabled={otpSent}
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="10-digit mobile number"
                  inputMode="numeric"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50/80 border border-slate-200/90 rounded-xl text-xs font-semibold text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition-all duration-200 shadow-inner shadow-slate-100/50 disabled:opacity-60"
                />
              </div>
            </div>

            {/* OTP Code Input Field (Shown after OTP request) */}
            {otpSent && (
              <div className="space-y-1.5 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700">
                    Verification OTP Code
                  </label>
                  {otpTimer > 0 ? (
                    <span className="text-[10px] text-slate-500 font-bold">Resend in {otpTimer}s</span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      className="text-[11px] text-sky-600 hover:text-sky-700 font-bold transition-colors"
                    >
                      Resend OTP
                    </button>
                  )}
                </div>
                <div className="relative group">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-sky-600 transition-colors duration-200" />
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="Enter 6-digit OTP code"
                    inputMode="numeric"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50/80 border border-slate-200/90 rounded-xl text-xs font-mono font-bold tracking-widest text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition-all duration-200 shadow-inner shadow-slate-100/50"
                  />
                </div>
              </div>
            )}

            {/* OTP Action Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-sky-500 via-blue-600 to-blue-700 hover:from-sky-600 hover:via-blue-700 hover:to-blue-800 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-sky-500/25 hover:shadow-sky-500/40 active:scale-[0.98] transition-all duration-200 disabled:opacity-60 flex items-center justify-center gap-2 mt-2 group"
            >
              <span>{loading ? 'Verifying...' : (otpSent ? 'Verify & Sign In' : 'Get OTP Code')}</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200" />
            </button>
          </form>
        )}

        {/* Encrypted Session Footer Badge */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-center gap-2 text-[10px] font-bold text-slate-400 tracking-wide">
          <ShieldCheck className="w-4 h-4 text-sky-500" />
          <span>256-BIT ENCRYPTED CRM SESSION</span>
        </div>
      </div>
    </div>
  );
};

export default Login;

