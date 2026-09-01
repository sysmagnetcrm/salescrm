import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';
import { useBranch } from '../context/BranchContext';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { prefetchRouteQuery } from '../lib/queryClient';
import { leadAPI } from '../services/api';
import {
  LayoutDashboard,
  Users,
  Upload,
  FileText,
  Trophy,
  ClipboardList,
  Menu,
  X,
  Settings,
  Phone,
  Database,
  Building2,
  Zap,
  CheckCircle2,
  Activity
} from 'lucide-react';

const Sidebar = () => {
  const { isAdmin, isAccountant, user } = useAuth();
  const { appName } = useBranding();
  const { branch } = useBranch();
  const queryClient = useQueryClient();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const userRole = isAdmin ? 'admin' : (isAccountant ? 'accountant' : 'salesperson');
  const isSalesperson = !isAdmin && !isAccountant;

  // Real API count query for Salesperson queue & leads
  const { data: queueData } = useQuery({
    queryKey: ['leads', 'queue', 'all'],
    queryFn: () => leadAPI.getQueue({ bucket: 'all' }).then(r => r.data),
    enabled: isSalesperson,
    staleTime: 30000
  });

  const { data: myLeadsData } = useQuery({
    queryKey: ['leads', 'my', {}],
    queryFn: () => leadAPI.getMyLeads({}).then(r => r.data),
    enabled: isSalesperson,
    staleTime: 60000
  });

  const queueCount = queueData?.queueSummary?.totalQueueCount ?? queueData?.data?.length;
  const myLeadsCount = myLeadsData?.count ?? myLeadsData?.data?.length;

  const handlePrefetch = (path) => {
    prefetchRouteQuery(queryClient, path, userRole, branch);
  };

  useEffect(() => {
    const handler = () => setIsMobileMenuOpen((prev) => !prev);
    window.addEventListener('toggleSidebar', handler);
    return () => window.removeEventListener('toggleSidebar', handler);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setIsMobileMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  const adminLinks = [
    { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/admin/tl-dashboard', icon: Users, label: 'TL Team Ops' },
    { to: '/admin/leads', icon: ClipboardList, label: 'All Leads' },
    { to: '/admin/upload', icon: Upload, label: 'Upload Leads' },
    { to: '/admin/salespeople', icon: Users, label: 'Manage Team' },
    { to: '/admin/manage-lists', icon: Database, label: 'Manage Lists' },
    { to: '/admin/calls', icon: Phone, label: 'Call Records' },
    { to: '/admin/telephony-monitor', icon: Activity, label: 'Telephony Fleet' },
    { to: '/admin/reports', icon: FileText, label: 'Reports' },
    { to: '/admin/leaderboard', icon: Trophy, label: 'Leaderboard' },
    { to: '/admin/profile', icon: Settings, label: 'Account Settings' }
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:static left-0 z-40
        top-16 bottom-0 md:inset-y-0
        w-64 bg-white shadow-lg min-h-screen border-r border-gray-100
        transform transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-4 md:p-5 space-y-6">
          {!isSalesperson ? (
            <nav className="space-y-1.5">
              {adminLinks.map((link) => {
                const Icon = link.icon;
                const isActive = location.pathname === link.to;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    onMouseEnter={() => handlePrefetch(link.to)}
                    onFocus={() => handlePrefetch(link.to)}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all text-sm font-medium ${
                      isActive
                        ? 'bg-primary-600 text-white shadow-sm'
                        : 'text-gray-700 hover:bg-gray-100/80'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Icon className="h-4.5 w-4.5" />
                      <span>{link.label}</span>
                    </div>
                  </Link>
                );
              })}
            </nav>
          ) : (
            <div className="space-y-6">
              {/* PRIMARY WORKSPACE SECTION */}
              <div>
                <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-3">
                  Primary Workspace
                </div>
                {(() => {
                  const isActive = location.pathname === '/salesperson/queue';
                  return (
                    <Link
                      to="/salesperson/queue"
                      onMouseEnter={() => handlePrefetch('/salesperson/queue')}
                      onFocus={() => handlePrefetch('/salesperson/queue')}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center justify-between px-3.5 py-3 rounded-xl transition-all border ${
                        isActive
                          ? 'bg-primary-600 text-white border-primary-600 shadow-md font-semibold'
                          : 'bg-primary-50/50 text-primary-900 border-primary-200/60 hover:bg-primary-100/60 font-semibold'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <Zap className={`h-5 w-5 ${isActive ? 'text-white' : 'text-primary-600'}`} />
                        <span className="text-sm">Working Queue</span>
                      </div>
                      {queueCount !== undefined && queueCount !== null && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-primary-600 text-white'
                        }`}>
                          {queueCount}
                        </span>
                      )}
                    </Link>
                  );
                })()}
              </div>

              {/* SECONDARY PERFORMANCE VIEWS SECTION */}
              <div>
                <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-3">
                  Performance & History
                </div>
                <nav className="space-y-1">
                  {[
                    { to: '/salesperson/dashboard', icon: LayoutDashboard, label: 'My Dashboard' },
                    { to: '/salesperson/leads', icon: ClipboardList, label: 'My Leads', badge: myLeadsCount },
                    { to: '/salesperson/calls', icon: Phone, label: 'Call Records' },
                    { to: '/salesperson/call-monitor', icon: Zap, label: 'Call Monitor' },
                    { to: '/salesperson/unmatched-calls', icon: ClipboardList, label: 'Unmatched Calls' },
                    { to: '/salesperson/call-setup', icon: CheckCircle2, label: 'CRM Call Setup' },
                    { to: '/salesperson/diagnostics', icon: Settings, label: 'Device Diagnostics' },
                    { to: '/salesperson/call-analytics', icon: FileText, label: 'Call Analytics' },
                    { to: '/salesperson/leaderboard', icon: Trophy, label: 'Leaderboard' },
                    { to: '/salesperson/profile', icon: Settings, label: 'Account Settings' }
                  ].map((link) => {
                    const Icon = link.icon;
                    const isActive = location.pathname === link.to;

                    return (
                      <Link
                        key={link.to}
                        to={link.to}
                        onMouseEnter={() => handlePrefetch(link.to)}
                        onFocus={() => handlePrefetch(link.to)}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all text-sm ${
                          isActive
                            ? 'bg-gray-900 text-white font-medium shadow-sm'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 font-medium'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <Icon className="h-4 w-4" />
                          <span>{link.label}</span>
                        </div>
                        {link.badge !== undefined && link.badge !== null && (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            isActive
                              ? 'bg-white/20 text-white'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {link.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
