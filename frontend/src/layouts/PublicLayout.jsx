import { Outlet } from 'react-router-dom';
import PublicHeader from '../components/public/PublicHeader.jsx';
import PublicFooter from '../components/public/PublicFooter.jsx';

export default function PublicLayout() {
  return (
    <div className="public-site flex min-h-screen flex-col bg-white text-brand-ink">
      <PublicHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  );
}
