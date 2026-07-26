import { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { usePublicSettings } from '../../hooks/useSettings.js';
import { getPhotoUrl } from '../../utils/photoUrl.js';
import { normalizeExternalUrl } from '../../utils/url.js';
import { socialPlatforms } from './socialPlatforms.jsx';

const navLinks = [
  { to: '/', label: 'Home', end: true },
  { to: '/services', label: 'Services' },
  { to: '/doctors', label: 'Doctors' },
  { to: '/testimonials', label: 'Testimonials' },
  { to: '/contact', label: 'Contact' },
];

const desktopLinkClass = ({ isActive }) =>
  `relative py-1.5 text-[14.5px] font-medium transition-colors after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:origin-left after:scale-x-0 after:bg-brand-sage after:transition-transform after:duration-200 hover:after:scale-x-100 ${
    isActive ? 'text-brand-navy after:scale-x-100' : 'text-brand-navy/80 hover:text-brand-navy'
  }`;

const mobileLinkClass = ({ isActive }) =>
  `block rounded px-2 py-2 text-sm font-medium ${isActive ? 'text-brand-navy' : 'text-brand-ink-soft'}`;

export default function PublicHeader() {
  const { data: settings } = usePublicSettings();
  const [menuOpen, setMenuOpen] = useState(false);
  const socialLinks = settings?.social_links || {};

  return (
    <header className="sticky top-0 z-20 border-b border-brand-line bg-white/92 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-4" onClick={() => setMenuOpen(false)}>
          {settings?.logo_url ? (
            <img
              src={getPhotoUrl(settings.logo_url)}
              alt={settings?.hospital_name || 'Hospital logo'}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <svg viewBox="0 0 40 40" fill="none" className="h-9 w-9 shrink-0">
              <circle cx="20" cy="20" r="19" stroke="#1C6E8C" strokeWidth="1.4" />
              <rect x="17" y="10" width="6" height="20" rx="1.5" fill="#0B2E4E" />
              <rect x="10" y="17" width="20" height="6" rx="1.5" fill="#4C8C6B" />
            </svg>
          )}
          <span className="hidden h-8 w-px bg-brand-line sm:block" aria-hidden="true" />
          <span className="font-display max-w-[150px] truncate text-xl whitespace-nowrap text-brand-navy italic sm:max-w-[260px] sm:text-2xl">
            {settings?.hospital_name || "Daniel's Physiotherapy Hospital"}
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} className={desktopLinkClass}>
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-4 md:flex">
          <div className="flex items-center gap-2.5">
            {socialPlatforms.map(
              (social) =>
                socialLinks[social.key] && (
                  <a
                    key={social.key}
                    href={normalizeExternalUrl(socialLinks[social.key])}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={social.label}
                    title={social.label}
                    className={`flex h-8 w-8 items-center justify-center rounded-full shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md ${social.bg}`}
                  >
                    {social.icon}
                  </a>
                )
            )}
          </div>
          <Link
            to="/login"
            className="rounded-[3px] border border-brand-navy px-4 py-2.5 text-sm font-semibold text-brand-navy transition-colors hover:bg-brand-navy hover:text-white"
          >
            Hospital Login
          </Link>
          <Link
            to="/book"
            className="rounded-[3px] bg-brand-navy px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0d3a63]"
          >
            Book Appointment
          </Link>
        </div>

        <button type="button" className="md:hidden" aria-label="Toggle menu" onClick={() => setMenuOpen((open) => !open)}>
          <svg className="h-6 w-6 text-brand-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {menuOpen && (
        <nav className="flex flex-col gap-1 border-t border-brand-line bg-white px-4 py-3 md:hidden">
          {navLinks.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} className={mobileLinkClass} onClick={() => setMenuOpen(false)}>
              {link.label}
            </NavLink>
          ))}
          <Link
            to="/login"
            onClick={() => setMenuOpen(false)}
            className="mt-1 rounded-[3px] border border-brand-navy px-4 py-2 text-center text-sm font-semibold text-brand-navy"
          >
            Hospital Login
          </Link>
          <Link
            to="/book"
            onClick={() => setMenuOpen(false)}
            className="mt-1 rounded-[3px] bg-brand-navy px-5 py-2 text-center text-sm font-semibold text-white"
          >
            Book Appointment
          </Link>
        </nav>
      )}
    </header>
  );
}
