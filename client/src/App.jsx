import { createBrowserRouter, RouterProvider, Navigate, Outlet, useLocation } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { AuthProvider } from './context/AuthContext';
import { BranchProvider } from './context/BranchContext';
import { Toaster } from 'react-hot-toast';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import UploadLeads from './pages/admin/UploadLeads';
import ManageSalespeople from './pages/admin/ManageSalespeople';
import AllLeads from './pages/admin/AllLeads';
import Reports from './pages/admin/Reports';
import AdminProfile from './pages/admin/AdminProfile';
import SalespersonPerformance from './pages/admin/SalespersonPerformance';
import ManageLists from './pages/admin/ManageLists';
import TLDashboard from './pages/admin/TLDashboard';

// Salesperson Pages
import MyLeadsList from './pages/salesperson/MyLeadsList';
import LeadQueueView from './pages/salesperson/LeadQueueView';
import SalespersonDashboard from './pages/salesperson/SalespersonDashboard';
import CallHistory from './pages/salesperson/CallHistory';
import CallMonitor from './pages/salesperson/CallMonitor';
import UnmatchedCalls from './pages/salesperson/UnmatchedCalls';
import DeviceDiagnostics from './pages/salesperson/DeviceDiagnostics';
import CallAnalyticsDashboard from './pages/salesperson/CallAnalyticsDashboard';

import CrmCallSetupWizard from './pages/salesperson/CrmCallSetupWizard';
import AdminTelephonyMonitor from './pages/admin/AdminTelephonyMonitor';

// Shared Pages
import Leaderboard from './pages/Leaderboard';

// Helper component to strip a leading locale segment like /en or /en-US
const LocaleRedirect = () => {
  const location = useLocation();
  if (location.pathname === '/index.html' || location.pathname.endsWith('.html')) {
    return <Navigate to="/login" replace />;
  }
  const stripped = location.pathname.replace(/^\/[A-Za-z]{2}(?:-[A-Za-z]{2})?/, '');
  const target = (stripped && stripped !== '/' && stripped !== '/index.html') ? stripped : '/login';
  return <Navigate to={target} replace />;
};

import MobileBottomNav from './components/MobileBottomNav';
import NetworkBanner from './components/NetworkBanner';

// Persistent Application Shell — Navbar, Sidebar & Main Content Outlet stay mounted during route transitions
const AppShell = () => (
  <div className="min-h-screen bg-gray-50 pb-20 md:pb-0 max-w-full overflow-x-hidden">
    <Navbar />
    <NetworkBanner />
    <div className="flex pt-14 md:pt-16 max-w-full overflow-x-hidden">
      <Sidebar />
      <main className="flex-1 p-0 md:p-8 min-w-0 max-w-full overflow-x-hidden">
        <div className="w-full max-w-full px-2 sm:px-4 md:px-0">
          <Outlet />
        </div>
      </main>
    </div>
    <MobileBottomNav />
  </div>
);

// Protected Admin Layout
const AdminLayout = () => (
  <ProtectedRoute allowedRoles={['admin', 'accountant']}>
    <AppShell />
  </ProtectedRoute>
);

// Protected Salesperson Layout
const SalespersonLayout = () => (
  <ProtectedRoute allowedRoles={['salesperson']}>
    <AppShell />
  </ProtectedRoute>
);

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  { path: '/index.html', element: <Navigate to="/login" replace /> },
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { index: true, element: <AdminDashboard /> },
      { path: 'leads', element: <AllLeads /> },
      { path: 'upload', element: <UploadLeads /> },
      { path: 'salespeople', element: <ManageSalespeople /> },
      { path: 'reports', element: <Reports /> },
      { path: 'leaderboard', element: <Leaderboard /> },
      { path: 'profile', element: <AdminProfile /> },
      { path: 'salespeople/:id/performance', element: <SalespersonPerformance /> },
      { path: 'manage-lists', element: <ManageLists /> },
      { path: 'tl-dashboard', element: <TLDashboard /> },
      { path: 'calls', element: <CallHistory /> },
      { path: 'call-monitor', element: <CallMonitor /> },
      { path: 'unmatched-calls', element: <UnmatchedCalls /> },
      { path: 'diagnostics', element: <DeviceDiagnostics /> },
      { path: 'call-analytics', element: <CallAnalyticsDashboard /> },
      { path: 'telephony-monitor', element: <AdminTelephonyMonitor /> }
    ]
  },
  {
    path: '/salesperson',
    element: <SalespersonLayout />,
    children: [
      { index: true, element: <Navigate to="/salesperson/queue" replace /> },
      { path: 'queue', element: <LeadQueueView /> },
      { path: 'dashboard', element: <SalespersonDashboard /> },
      { path: 'leads', element: <MyLeadsList /> },
      { path: 'calls', element: <CallHistory /> },
      { path: 'call-monitor', element: <CallMonitor /> },
      { path: 'unmatched-calls', element: <UnmatchedCalls /> },
      { path: 'diagnostics', element: <DeviceDiagnostics /> },
      { path: 'call-analytics', element: <CallAnalyticsDashboard /> },
      { path: 'call-setup', element: <CrmCallSetupWizard /> },
      { path: 'leaderboard', element: <Leaderboard /> }
    ]
  },
  // Default redirect
  { path: '/', element: <Navigate to="/login" replace /> },
  // Locale-prefixed routes (e.g., /en, /en-US) redirect to non-locale path
  { path: ':lang/*', element: <LocaleRedirect /> },
  // Catch-all
  { path: '*', element: <Navigate to="/login" replace /> }
]);

import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BranchProvider>
            <Toaster position="top-right" />
            <RouterProvider
              router={router}
              future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
            />
          </BranchProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
