import { QueryClient } from '@tanstack/react-query';
import { dashboardAPI, userAPI, leadAPI, settingsAPI, callAPI, dispositionAPI } from '../services/api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes default stale time
      gcTime: 1000 * 60 * 10,    // 10 minutes cache garbage collection time
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1
    }
  }
});

// Route-to-Query prefetch map for hover/focus prefetching
export const prefetchRouteQuery = (client, path, userRole = 'admin', branch = '') => {
  if (!client) return;

  const isAdmin = ['admin', 'accountant'].includes(userRole);

  try {
    if (path === '/admin' || path === '/admin/dashboard') {
      client.prefetchQuery({
        queryKey: ['dashboard', 'admin', branch],
        queryFn: () => dashboardAPI.getAdminDashboard({ branch }).then(r => r.data.data)
      });
    } else if (path === '/admin/tl-dashboard') {
      client.prefetchQuery({
        queryKey: ['tl-team', branch],
        queryFn: async () => {
          const [dashRes, salesRes] = await Promise.all([
            dashboardAPI.getAdminDashboard(),
            userAPI.getSalespeople()
          ]);
          return {
            teamStats: dashRes.data.data?.salespersonPerformance || [],
            salespeople: salesRes.data.data || []
          };
        }
      });
    } else if (path === '/admin/leads') {
      client.prefetchQuery({
        queryKey: ['leads', 'all', { page: 1, pageSize: 50, branch }],
        queryFn: () => leadAPI.getAllLeads({ page: 1, limit: 50, branch }).then(r => r.data)
      });
    } else if (path === '/admin/salespeople') {
      client.prefetchQuery({
        queryKey: ['salespeople', branch],
        queryFn: () => userAPI.getSalespeople({ branch }).then(r => r.data.data)
      });
    } else if (path === '/admin/leaderboard' || path === '/salesperson/leaderboard') {
      client.prefetchQuery({
        queryKey: ['leaderboard', 'month', branch],
        queryFn: () => dashboardAPI.getLeaderboard({ period: 'month', branch }).then(r => r.data.data)
      });
    } else if (path === '/salesperson/queue') {
      client.prefetchQuery({
        queryKey: ['leads', 'queue'],
        queryFn: () => leadAPI.getQueue().then(r => r.data)
      });
    } else if (path === '/salesperson/dashboard') {
      client.prefetchQuery({
        queryKey: ['dashboard', 'salesperson'],
        queryFn: () => dashboardAPI.getSalespersonDashboard().then(r => r.data.data)
      });
    } else if (path === '/salesperson/leads') {
      client.prefetchQuery({
        queryKey: ['leads', 'my', { page: 1, pageSize: 50 }],
        queryFn: () => leadAPI.getMyLeads({ page: 1, limit: 50 }).then(r => r.data)
      });
    } else if (path === '/admin/calls' || path === '/salesperson/calls') {
      client.prefetchQuery({
        queryKey: ['calls', 'all'],
        queryFn: () => callAPI.getAllCallLogs().then(r => r.data.data)
      });
    }
  } catch (err) {
    // Non-blocking prefetch error catch
  }
};

// Post-Login background prefetcher (runs silently after auth)
export const prefetchPostLoginData = (client, role = 'admin', branch = '') => {
  if (!client) return;

  setTimeout(() => {
    if (['admin', 'accountant'].includes(role)) {
      prefetchRouteQuery(client, '/admin', role, branch);
      prefetchRouteQuery(client, '/admin/tl-dashboard', role, branch);
      prefetchRouteQuery(client, '/admin/leads', role, branch);
      prefetchRouteQuery(client, '/admin/salespeople', role, branch);
    } else if (role === 'salesperson') {
      prefetchRouteQuery(client, '/salesperson/queue', role, branch);
      prefetchRouteQuery(client, '/salesperson/dashboard', role, branch);
      prefetchRouteQuery(client, '/salesperson/leads', role, branch);
      prefetchRouteQuery(client, '/salesperson/leaderboard', role, branch);
    }
  }, 100);
};
