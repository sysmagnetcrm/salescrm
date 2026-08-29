import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';
import loginBg from '../assets/loginBg.jpg';

const Login = () => {
  const [credentials, setCredentials] = useState({ identifier: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, loginWithPhone } = useAuth();
  const { appName, location, logoUrl } = useBranding();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);

    try {
      setError('');
      const id = (credentials.identifier || '').trim();
      const isEmail = id.includes('@');

      const user = isEmail
        ? await login({ email: id, password: credentials.password })
        : await loginWithPhone({ phone: id, password: credentials.password });
      
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

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
      <img
        src={loginBg}
        alt="Login background"
        className="absolute inset-0 h-full w-full object-cover opacity-100"
      />
      <div className="absolute inset-0 bg-white/10" aria-hidden="true" />

      <div className="relative z-10 bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="flex flex-col items-center mb-8 text-center">
          <img src={logoUrl} alt={`${appName} Logo`} className="h-12 md:h-14 w-auto mb-3 object-contain max-w-[200px]" />
          <h1 className="text-xl font-bold text-gray-900">{appName}</h1>
          {location && <p className="text-xs font-semibold text-primary-600 mb-1">{location}</p>}
          <p className="text-gray-600 text-sm">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}
          <div>
            <label className="label">Email or Phone</label>
            <input
              type="text"
              required
              className="input-field"
              aria-invalid={Boolean(error)}
              value={credentials.identifier}
              onChange={(e) => setCredentials({ ...credentials, identifier: e.target.value })}
              placeholder="you@example.com or 9876543210"
              inputMode="email"
              autoComplete="username"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="label mb-0">Password</label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              className="input-field"
              aria-invalid={Boolean(error)}
              value={credentials.password}
              onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
