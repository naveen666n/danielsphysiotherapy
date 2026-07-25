import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useDashboard } from '../../hooks/useDashboard.js';

const STATUS_STYLES = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-700',
  completed: 'bg-green-100 text-green-700',
};

const STATUS_CARDS = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

function StatCard({ label, value, to }) {
  return (
    <Link to={to} className="rounded-lg bg-white p-5 shadow transition hover:shadow-md">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-800">{value}</p>
    </Link>
  );
}

function truncate(text, length) {
  if (!text) return '';
  return text.length > length ? `${text.slice(0, length)}...` : text;
}

export default function AdminHome() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { data, isLoading, isError } = useDashboard();

  if (isLoading) {
    return <div className="text-slate-500">Loading dashboard...</div>;
  }

  if (isError || !data) {
    return <div className="text-slate-500">Failed to load dashboard.</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-800">Welcome, {user?.name}</h1>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {STATUS_CARDS.map((card) => (
          <StatCard
            key={card.key}
            label={`${card.label} Appointments`}
            value={data.appointmentCounts[card.key]}
            to="/admin/appointments"
          />
        ))}
        <StatCard label="Active Doctors" value={data.activeDoctorCount} to="/admin/doctors" />
        {isAdmin && <StatCard label="Active Staff" value={data.activeStaffCount} to="/admin/staff" />}
        <StatCard label="Unread Messages" value={data.unreadMessageCount} to="/admin/messages" />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg bg-white p-5 shadow">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">Recent Appointments</h2>
            <Link to="/admin/appointments" className="text-sm font-medium text-blue-600 hover:text-blue-700">
              View All →
            </Link>
          </div>
          {data.recentAppointments.length === 0 ? (
            <p className="text-sm text-slate-500">All caught up — no appointments yet.</p>
          ) : (
            <ul className="space-y-3">
              {data.recentAppointments.map((appointment) => (
                <li key={appointment.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium text-slate-800">{appointment.patient_name}</p>
                    <p className="text-slate-500">
                      {appointment.appointment_date} · {appointment.appointment_time}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLES[appointment.status]}`}>
                    {appointment.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg bg-white p-5 shadow">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">Recent Unread Messages</h2>
            <Link to="/admin/messages" className="text-sm font-medium text-blue-600 hover:text-blue-700">
              View All →
            </Link>
          </div>
          {data.recentUnreadMessages.length === 0 ? (
            <p className="text-sm text-slate-500">All caught up — no unread messages.</p>
          ) : (
            <ul className="space-y-3">
              {data.recentUnreadMessages.map((message) => (
                <li key={message.id} className="text-sm">
                  <p className="font-medium text-slate-800">{message.name}</p>
                  <p className="text-slate-500">{truncate(message.message, 80)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
