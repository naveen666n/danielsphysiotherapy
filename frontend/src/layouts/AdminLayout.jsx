import { NavLink, Outlet } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext.jsx';

const navLinkClass = ({ isActive }) =>
  `block rounded px-3 py-2 text-sm font-medium ${
    isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
  }`;

export default function AdminLayout() {
  const { user, logout } = useAuth();

  async function handleLogout() {
    try {
      await logout();
      toast.success('Logged out successfully');
    } catch (err) {
      toast.error(err.message || 'Logout failed. Please try again.');
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between bg-blue-700 px-6 py-4 text-white">
        <span className="text-lg font-semibold">Daniel's Physiotherapy Hospital — Admin</span>
        <div className="flex items-center gap-4">
          <span className="text-sm">{user?.name} ({user?.role})</span>
          <button
            onClick={handleLogout}
            className="rounded bg-blue-800 px-3 py-1.5 text-sm hover:bg-blue-900"
          >
            Logout
          </button>
        </div>
      </header>
      <div className="flex">
        <aside className="w-56 border-r border-slate-200 bg-white p-4">
          <nav className="space-y-1">
            <NavLink to="/admin" end className={navLinkClass}>
              Dashboard
            </NavLink>
            <NavLink to="/admin/doctors" className={navLinkClass}>
              Doctors
            </NavLink>
            <NavLink to="/admin/appointments" className={navLinkClass}>
              Appointments
            </NavLink>
            <NavLink to="/admin/services" className={navLinkClass}>
              Services
            </NavLink>
            <NavLink to="/admin/testimonials" className={navLinkClass}>
              Testimonials
            </NavLink>
            <NavLink to="/admin/messages" className={navLinkClass}>
              Messages
            </NavLink>
            {user?.role === 'admin' && (
              <NavLink to="/admin/staff" className={navLinkClass}>
                Staff
              </NavLink>
            )}
            {user?.role === 'admin' && (
              <NavLink to="/admin/settings" className={navLinkClass}>
                Settings
              </NavLink>
            )}
          </nav>
        </aside>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
