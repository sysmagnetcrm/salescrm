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
    <nav className="fixed top-0 left-0 right-0 bg-white shadow-md border-b z-50">
      <div className="mx-auto px-3 sm:px-6 lg:px-8 max-w-[430px] md:max-w-7xl">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-3">
            {/* Mobile hamburger to toggle sidebar */}
            <button
              type="button"
              aria-label="Toggle sidebar"
              onClick={() => window.dispatchEvent(new Event('toggleSidebar'))}
              className="md:hidden mr-2 p-2 rounded hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <Menu className="h-5 w-5 text-gray-700" />
            </button>

            <Link to={homePath} className="flex items-center space-x-2">
              <img src={logoUrl} alt={`${appName} Logo`} className="h-8 md:h-10 w-auto shrink-0 object-contain max-w-[140px]" />
              <div className="flex flex-col leading-none">
                <span className="hidden sm:inline font-bold text-gray-900 text-base md:text-lg">{appName}</span>
                {location && (
                  <span className="hidden sm:inline text-[11px] text-primary-600 font-semibold mt-0.5">{location}</span>
                )}
              </div>
            </Link>
          </div>

          <div className="flex items-center space-x-2 md:space-x-4">
            <div className="hidden sm:flex items-center space-x-2 text-gray-700">
              <User className="h-5 w-5" />
              <span className="font-medium text-sm md:text-base">{user?.name}</span>
              <span className="px-2 py-1 text-xs bg-primary-100 text-primary-800 rounded-full">
                {user?.role}
              </span>
            </div>

            {isAdminLike && (
              <Link
                to="/admin/profile"
                className="flex items-center space-x-2 text-gray-700 hover:text-primary-600 transition-colors"
              >
                <Settings className="h-5 w-5" />
                <span className="hidden sm:inline text-sm md:text-base">Settings</span>
              </Link>
            )}
            
            <button
              onClick={handleLogout}
              className="flex items-center space-x-1 md:space-x-2 text-gray-700 hover:text-red-600 transition-colors"
            >
              <LogOut className="h-5 w-5" />
              <span className="hidden sm:inline text-sm md:text-base">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
