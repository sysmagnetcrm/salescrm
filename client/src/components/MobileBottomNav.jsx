import { Link, useLocation } from 'react-router-dom';
import { Zap, ClipboardList, Phone, LayoutDashboard } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { leadAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const MobileBottomNav = () => {
  const location = useLocation();
  const { user } = useAuth();
  const isSalesperson = user?.role === 'salesperson';

  const { data: queueData } = useQuery({
    queryKey: ['leads', 'queue', 'all'],
    queryFn: () => leadAPI.getQueue({ bucket: 'all' }).then(r => r.data),
    enabled: isSalesperson,
    staleTime: 30000
  });

  if (!isSalesperson) return null;

  const queueCount = queueData?.queueSummary?.totalQueueCount ?? queueData?.data?.length ?? 0;

  const navItems = [
    { to: '/salesperson/queue', icon: Zap, label: 'Queue', badge: queueCount },
    { to: '/salesperson/leads', icon: ClipboardList, label: 'Leads' },
    { to: '/salesperson/calls', icon: Phone, label: 'Calls' },
    { to: '/salesperson/dashboard', icon: LayoutDashboard, label: 'Me' }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-gray-200 md:hidden pb-safe shadow-xl w-full">
      <div className="flex justify-around items-center h-14 w-full max-w-full px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center justify-center w-full py-1 text-xs font-semibold relative transition-colors ${
                isActive ? 'text-primary-600 font-bold' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <div className="relative">
                <Icon className={`h-5 w-5 ${isActive ? 'text-primary-600 stroke-[2.5]' : 'text-gray-500'}`} />
                {item.badge > 0 && (
                  <span className="absolute -top-1 -right-3 bg-primary-600 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full min-w-[16px] text-center leading-tight">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="mt-0.5 text-[11px]">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
