import { Outlet } from 'react-router-dom';
import PublicHeader from '../components/public/PublicHeader.jsx';
import PublicFooter from '../components/public/PublicFooter.jsx';
import { usePublicSettings } from '../hooks/useSettings.js';
import { ThemeProvider } from '../contexts/ThemeContext.jsx';

export default function PublicLayout() {
  const { data: settings } = usePublicSettings();
  const theme = settings?.site_theme || 'premium';

  return (
    <ThemeProvider theme={theme}>
      <div data-theme={theme} className="public-site flex min-h-screen flex-col bg-brand-ice text-brand-ink">
        <PublicHeader />
        <main className="flex-1">
          <Outlet />
        </main>
        <PublicFooter />
      </div>
    </ThemeProvider>
  );
}
