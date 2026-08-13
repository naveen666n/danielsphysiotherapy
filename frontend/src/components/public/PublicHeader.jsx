import { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { usePublicSettings } from '../../hooks/useSettings.js';
import { usePublicContent } from '../../hooks/usePublicContent.js';
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
  `rounded-full px-4 py-2 text-[14.5px] font-medium transition-colors ${
    isActive ? 'bg-brand-navy text-white' : 'text-brand-navy/80 hover:bg-brand-navy/8 hover:text-brand-navy'
  }`;

const mobileLinkClass = ({ isActive }) =>
  `block rounded px-2 py-2 text-sm font-medium ${isActive ? 'text-brand-navy' : 'text-brand-ink-soft'}`;

export default function PublicHeader() {
  const { data: settings } = usePublicSettings();
  const { data: content } = usePublicContent();
  const [menuOpen, setMenuOpen] = useState(false);
  const socialLinks = settings?.social_links || {};
  const hospitalName = settings?.hospital_name || "Daniel's Physiotherapy Hospital";

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-brand-line bg-white/92 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="flex shrink-0 items-center" onClick={() => setMenuOpen(false)}>
            {settings?.logo_url ? (
              <img
                src={getPhotoUrl(settings.logo_url)}
                alt={hospitalName}
                className="h-12 w-12 shrink-0 rounded-full object-cover shadow-sm ring-1 ring-brand-line transition-transform hover:scale-105"
              />
            ) : (
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-brand-line transition-transform hover:scale-105">
                <svg viewBox="0 0 40 40" fill="none" className="h-8 w-8">
                  <circle cx="20" cy="20" r="19" style={{ stroke: 'var(--color-brand-blue)' }} strokeWidth="1.4" />
                  <rect x="17" y="10" width="6" height="20" rx="1.5" style={{ fill: 'var(--color-brand-navy)' }} />
                  <rect x="10" y="17" width="20" height="6" rx="1.5" style={{ fill: 'var(--color-brand-sage)' }} />
                </svg>
              </span>
            )}
          </Link>

          <nav className="hidden shrink-0 items-center gap-1 lg:flex">
            {navLinks.map((link) => (
              <NavLink key={link.to} to={link.to} end={link.end} className={desktopLinkClass}>
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden shrink-0 items-center gap-2.5 lg:flex">
            <div className="flex items-center gap-2">
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
              className="rounded-[var(--radius-button)] border border-brand-navy px-4 py-2.5 text-sm font-semibold text-brand-navy transition-colors hover:bg-brand-navy hover:text-white"
            >
              Hospital Login
            </Link>
            <Link
              to="/video-consultation"
              className="rounded-[var(--radius-button)] border border-brand-navy px-4 py-2.5 text-sm font-semibold text-brand-navy transition-colors hover:bg-brand-navy hover:text-white"
            >
              Video Consultation
            </Link>
            <Link
              to="/book"
              className="rounded-[var(--radius-button)] bg-brand-navy px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-brand-navy-hover)]"
            >
              Book Appointment
            </Link>
          </div>

          <button type="button" className="lg:hidden" aria-label="Toggle menu" onClick={() => setMenuOpen((open) => !open)}>
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
          <nav className="flex flex-col gap-1 border-t border-brand-line bg-white px-4 py-3 lg:hidden">
            {navLinks.map((link) => (
              <NavLink key={link.to} to={link.to} end={link.end} className={mobileLinkClass} onClick={() => setMenuOpen(false)}>
                {link.label}
              </NavLink>
            ))}
            <Link
              to="/login"
              onClick={() => setMenuOpen(false)}
              className="mt-1 rounded-[var(--radius-button)] border border-brand-navy px-4 py-2 text-center text-sm font-semibold text-brand-navy"
            >
              Hospital Login
            </Link>
            <Link
              to="/video-consultation"
              onClick={() => setMenuOpen(false)}
              className="mt-1 rounded-[var(--radius-button)] border border-brand-navy px-4 py-2 text-center text-sm font-semibold text-brand-navy"
            >
              Video Consultation
            </Link>
            <Link
              to="/book"
              onClick={() => setMenuOpen(false)}
              className="mt-1 rounded-[var(--radius-button)] bg-brand-navy px-5 py-2 text-center text-sm font-semibold text-white"
            >
              Book Appointment
            </Link>
          </nav>
        )}
      </header>

      <div className="border-b border-brand-line bg-brand-navy px-4 py-3 text-center sm:px-6">
        <div className="flex items-center justify-center gap-3">
          <span className="hidden h-px w-10 shrink-0 bg-white/30 sm:block" aria-hidden="true" />
          <span className="font-display text-xl text-white italic sm:text-2xl">{hospitalName}</span>
          <span className="hidden h-px w-10 shrink-0 bg-white/30 sm:block" aria-hidden="true" />
        </div>
        {content?.footer_tagline && (
          <p className="mt-1 text-[11px] font-semibold tracking-[0.2em] text-brand-sage uppercase sm:text-xs">
            {content.footer_tagline}
          </p>
        )}
      </div>
    </>
  );
}
