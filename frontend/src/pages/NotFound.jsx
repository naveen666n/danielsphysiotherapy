import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-slate-600">
      <h1 className="text-3xl font-bold">404</h1>
      <p>Page not found.</p>
      <Link to="/login" className="text-blue-600 hover:underline">
        Back to login
      </Link>
    </div>
  );
}
