import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';

const AuthContext = createContext();

export const SESSION_INACTIVITY_TIMEOUT_MINUTES = 30;
const INACTIVITY_TIMEOUT_MS = SESSION_INACTIVITY_TIMEOUT_MINUTES * 60 * 1000;
const EVENT_THROTTLE_MS = 5000; // Throttle event activity updates to once per 5s

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const lastActivityTimeRef = useRef(Date.now());
  const lastThrottledUpdateRef = useRef(Date.now());

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    
    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (err) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  // Monitor user interaction and enforce centralized inactivity timeout
  useEffect(() => {
    if (!user) return;

    // Reset activity timestamps on user login
    lastActivityTimeRef.current = Date.now();
    lastThrottledUpdateRef.current = Date.now();

    const handleUserInteraction = () => {
      const now = Date.now();
      if (now - lastThrottledUpdateRef.current > EVENT_THROTTLE_MS) {
        lastThrottledUpdateRef.current = now;
        lastActivityTimeRef.current = now;
      }
    };

    // User DOM interaction event listeners (background API calls do NOT trigger these)
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(evt => {
      window.addEventListener(evt, handleUserInteraction, { passive: true });
    });

    // Check inactivity periodically every 10 seconds
    const intervalId = setInterval(() => {
      const now = Date.now();
      if (now - lastActivityTimeRef.current >= INACTIVITY_TIMEOUT_MS) {
        console.warn(`[AuthContext] Session expired after ${SESSION_INACTIVITY_TIMEOUT_MINUTES} minutes of inactivity.`);
        
        // Immediate session invalidation
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        
        toast.error('Your session expired due to inactivity. Please sign in again.');
        
        if (typeof window !== 'undefined' && window.location?.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }, 10000);

    return () => {
      events.forEach(evt => {
        window.removeEventListener(evt, handleUserInteraction);
      });
      clearInterval(intervalId);
    };
  }, [user]);

  const login = async (credentials) => {
    try {
      const response = await authAPI.login(credentials);
      const { token, ...userData } = response.data.data;
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
      
      lastActivityTimeRef.current = Date.now();
      lastThrottledUpdateRef.current = Date.now();
      setUser(userData);
      
      toast.success('Login successful!');
      return userData;
    } catch (error) {
      const message = error.response?.data?.message || 'Login failed';
      toast.error(message);
      throw error;
    }
  };

  const loginWithPhone = async ({ phone, password }) => {
    try {
      const response = await authAPI.loginPhone({ phone, password });
      const { token, ...userData } = response.data.data;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));

      lastActivityTimeRef.current = Date.now();
      lastThrottledUpdateRef.current = Date.now();
      setUser(userData);

      toast.success('Login successful!');
      return userData;
    } catch (error) {
      const message = error.response?.data?.message || 'Login failed';
      toast.error(message);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    toast.success('Logged out successfully');
  };

  const register = async (userData) => {
    try {
      const response = await authAPI.register(userData);
      toast.success('Registration successful!');
      return response.data;
    } catch (error) {
      const message = error.response?.data?.message || 'Registration failed';
      toast.error(message);
      throw error;
    }
  };

  const isAdminRole = ['admin', 'accountant'].includes(user?.role);
  const isAccountant = user?.role === 'accountant';

  const value = {
    user,
    loading,
    login,
    loginWithPhone,
    logout,
    register,
    isAdmin: isAdminRole,
    isAccountant,
    isSalesperson: user?.role === 'salesperson'
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
