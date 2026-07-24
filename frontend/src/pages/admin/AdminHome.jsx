import { useAuth } from '../../contexts/AuthContext.jsx';

export default function AdminHome() {
  const { user } = useAuth();
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-800">Welcome, {user?.name}</h1>
      <p className="mt-2 text-slate-500">
        The full dashboard is built in a later phase. Login is working.
      </p>
    </div>
  );
}
