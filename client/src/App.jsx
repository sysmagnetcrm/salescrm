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

// Shared Pages
import Leaderboard from './pages/Leaderboard';

// Helper component to strip a leading locale segment like /en or /en-US
const LocaleRedirect = () => {
  const location = useLocation();
  const stripped = location.pathname.replace(/^\/[A-Za-z]{2}(?:-[A-Za-z]{2})?/, '');
  const target = stripped && stripped !== '/' ? stripped : '/login';
  return <Navigate to={target} replace />;
};

import MobileBottomNav from './components/MobileBottomNav';
import NetworkBanner from './components/NetworkBanner';

// Persistent Application Shell — Navbar, Sidebar & Main Content Outlet stay mounted during route transitions
const AppShell = () => (
  <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
    <Navbar />
    <NetworkBanner />
    <div className="flex pt-14 md:pt-16">
      <Sidebar />
      <main className="flex-1 p-0 md:p-8">
        <div className="w-full mx-auto max-w-[430px] md:max-w-none px-3 md:px-0">
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
      { path: 'calls', element: <CallHistory /> }
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

function App() {
  return (
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
  );
}

export default App;
