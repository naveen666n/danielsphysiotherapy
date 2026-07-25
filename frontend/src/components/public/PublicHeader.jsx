import { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { usePublicSettings } from '../../hooks/useSettings.js';
import { getPhotoUrl } from '../../utils/photoUrl.js';

const navLinks = [
  { to: '/', label: 'Home', end: true },
  { to: '/services', label: 'Services' },
  { to: '/doctors', label: 'Doctors' },
  { to: '/testimonials', label: 'Testimonials' },
  { to: '/contact', label: 'Contact' },
];

const desktopLinkClass = ({ isActive }) =>
  `text-sm font-medium ${isActive ? 'text-teal-700' : 'text-slate-600 hover:text-teal-700'}`;

const mobileLinkClass = ({ isActive }) =>
  `block rounded px-2 py-2 text-sm font-medium ${isActive ? 'text-teal-700' : 'text-slate-600'}`;

export default function PublicHeader() {
  const { data: settings } = usePublicSettings();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2" onClick={() => setMenuOpen(false)}>
          {settings?.logo_url ? (
            <img
              src={getPhotoUrl(settings.logo_url)}
              alt={settings?.hospital_name || 'Hospital logo'}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-600 text-lg font-bold text-white">
              {(settings?.hospital_name || 'H').charAt(0)}
            </span>
          )}
          <span className="text-lg font-semibold text-slate-800">
            {settings?.hospital_name || "Daniel's Physiotherapy Hospital"}
          </span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} className={desktopLinkClass}>
              {link.label}
            </NavLink>
          ))}
          <Link
            to="/login"
            className="rounded-full border border-teal-600 px-4 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-50"
          >
            Hospital Login
          </Link>
          <Link
            to="/book"
            className="rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
          >
            Book Appointment
          </Link>
        </nav>

        <button type="button" className="md:hidden" aria-label="Toggle menu" onClick={() => setMenuOpen((open) => !open)}>
          <svg className="h-6 w-6 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {menuOpen && (
        <nav className="flex flex-col gap-1 border-t border-slate-100 bg-white px-4 py-3 md:hidden">
          {navLinks.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} className={mobileLinkClass} onClick={() => setMenuOpen(false)}>
              {link.label}
            </NavLink>
          ))}
          <Link
            to="/login"
            onClick={() => setMenuOpen(false)}
            className="mt-1 rounded-full border border-teal-600 px-4 py-2 text-center text-sm font-semibold text-teal-700"
          >
            Hospital Login
          </Link>
          <Link
            to="/book"
            onClick={() => setMenuOpen(false)}
            className="mt-1 rounded-full bg-amber-500 px-5 py-2 text-center text-sm font-semibold text-white"
          >
            Book Appointment
          </Link>
        </nav>
      )}
    </header>
  );
}
