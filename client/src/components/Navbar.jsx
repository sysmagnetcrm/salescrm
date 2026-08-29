import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';
import { LogOut, User, LayoutDashboard, Menu, Settings } from 'lucide-react';

const Navbar = () => {
  const { user, logout } = useAuth();
  const { appName, location, logoUrl } = useBranding();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isAdminLike = user?.role === 'admin' || user?.role === 'accountant';
  const homePath = isAdminLike ? '/admin' : user?.role === 'salesperson' ? '/salesperson' : '/login';

  return (
    <nav className="fixed top-0 left-0 right-0 bg-white shadow-sm border-b z-50">
      <div className="mx-auto px-3 sm:px-6 lg:px-8 max-w-[430px] md:max-w-7xl">
        <div className="flex justify-between items-center h-14">
          <div className="flex items-center space-x-2">
            {/* Mobile hamburger to toggle sidebar */}
            <button
              type="button"
              aria-label="Toggle sidebar"
              onClick={() => window.dispatchEvent(new Event('toggleSidebar'))}
              className="md:hidden p-1.5 rounded-lg text-gray-700 hover:bg-gray-100 focus:outline-none"
            >
              <Menu className="h-5 w-5" />
            </button>

            <Link to={homePath} className="flex items-center space-x-2">
              <img src={logoUrl} alt={`${appName} Logo`} className="h-7 md:h-9 w-auto shrink-0 object-contain max-w-[120px]" />
              <div className="flex flex-col leading-none">
                <span className="hidden sm:inline font-bold text-gray-900 text-sm md:text-base">{appName}</span>
                {location && (
                  <span className="hidden sm:inline text-[10px] text-primary-600 font-semibold">{location}</span>
                )}
              </div>
            </Link>
          </div>

          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1.5 text-gray-700">
              <User className="h-4 w-4 text-gray-500" />
              <span className="font-semibold text-xs md:text-sm max-w-[90px] sm:max-w-none truncate">{user?.name}</span>
            </div>

            {isAdminLike && (
              <Link
                to="/admin/profile"
                className="p-1.5 text-gray-600 hover:text-primary-600 transition-colors"
                title="Settings"
              >
                <Settings className="h-4.5 w-4.5" />
              </Link>
            )}
            
            <button
              onClick={handleLogout}
              className="p-1.5 text-gray-600 hover:text-red-600 transition-colors"
              title="Logout"
            >
              <LogOut className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
