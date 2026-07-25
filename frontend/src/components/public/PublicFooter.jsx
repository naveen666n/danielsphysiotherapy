import { Link } from 'react-router-dom';
import { usePublicSettings } from '../../hooks/useSettings.js';
import { usePublicContent } from '../../hooks/usePublicContent.js';

const quickLinks = [
  { to: '/', label: 'Home' },
  { to: '/services', label: 'Services' },
  { to: '/doctors', label: 'Doctors' },
  { to: '/testimonials', label: 'Testimonials' },
  { to: '/contact', label: 'Contact' },
];

const socialIcons = {
  facebook: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12Z" />
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path d="M12 2c2.7 0 3.1 0 4.1.1 1.1 0 1.8.2 2.4.5.7.2 1.2.6 1.7 1.1.5.5.9 1 1.1 1.7.3.6.5 1.3.5 2.4.1 1 .1 1.4.1 4.1s0 3.1-.1 4.1c0 1.1-.2 1.8-.5 2.4-.2.7-.6 1.2-1.1 1.7-.5.5-1 .9-1.7 1.1-.6.3-1.3.5-2.4.5-1 .1-1.4.1-4.1.1s-3.1 0-4.1-.1c-1.1 0-1.8-.2-2.4-.5-.7-.2-1.2-.6-1.7-1.1-.5-.5-.9-1-1.1-1.7-.3-.6-.5-1.3-.5-2.4C2 15.1 2 14.7 2 12s0-3.1.1-4.1c0-1.1.2-1.8.5-2.4.2-.7.6-1.2 1.1-1.7.5-.5 1-.9 1.7-1.1.6-.3 1.3-.5 2.4-.5C8.9 2 9.3 2 12 2Zm0 1.8c-2.6 0-3 0-4 .1-.9 0-1.4.2-1.7.3-.4.2-.7.3-1 .6-.3.3-.5.6-.6 1-.1.3-.3.8-.3 1.7-.1 1-.1 1.4-.1 4s0 3 .1 4c0 .9.2 1.4.3 1.7.2.4.3.7.6 1 .3.3.6.5 1 .6.3.1.8.3 1.7.3 1 .1 1.4.1 4 .1s3 0 4-.1c.9 0 1.4-.2 1.7-.3.4-.2.7-.3 1-.6.3-.3.5-.6.6-1 .1-.3.3-.8.3-1.7.1-1 .1-1.4.1-4s0-3-.1-4c0-.9-.2-1.4-.3-1.7-.2-.4-.3-.7-.6-1-.3-.3-.6-.5-1-.6-.3-.1-.8-.3-1.7-.3-1-.1-1.4-.1-4-.1Zm0 3.5a4.7 4.7 0 1 1 0 9.4 4.7 4.7 0 0 1 0-9.4Zm0 1.8a2.9 2.9 0 1 0 0 5.8 2.9 2.9 0 0 0 0-5.8Zm5-2a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0Z" />
    </svg>
  ),
  twitter: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path d="M22 5.9c-.7.3-1.5.6-2.3.7.8-.5 1.5-1.3 1.8-2.3-.8.5-1.7.8-2.6 1a4.1 4.1 0 0 0-7 3.7A11.6 11.6 0 0 1 3.4 4.6a4.1 4.1 0 0 0 1.3 5.5c-.7 0-1.3-.2-1.9-.5v.1c0 2 1.4 3.6 3.3 4a4.1 4.1 0 0 1-1.9.1c.5 1.6 2 2.8 3.8 2.8A8.2 8.2 0 0 1 2 18.4a11.6 11.6 0 0 0 6.3 1.8c7.5 0 11.7-6.3 11.7-11.7v-.5c.8-.6 1.5-1.3 2-2.1Z" />
    </svg>
  ),
};

export default function PublicFooter() {
  const { data: settings } = usePublicSettings();
  const { data: content } = usePublicContent();
  const socialLinks = settings?.social_links || {};
  const hasSocialLinks = Object.values(socialLinks).some((url) => url);

  return (
    <footer className="border-t border-slate-100 bg-slate-50">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">
            {settings?.hospital_name || "Daniel's Physiotherapy Hospital"}
          </h3>
          <p className="mt-2 text-sm text-slate-500">{content?.footer_tagline}</p>
          {hasSocialLinks && (
            <div className="mt-4 flex gap-3">
              {Object.entries(socialLinks).map(([platform, url]) =>
                url ? (
                  <a key={platform} href={url} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-teal-600" aria-label={platform}>
                    {socialIcons[platform]}
                  </a>
                ) : null
              )}
            </div>
          )}
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Quick Links</h4>
          <ul className="mt-3 space-y-2">
            {quickLinks.map((link) => (
              <li key={link.to}>
                <Link to={link.to} className="text-sm text-slate-600 hover:text-teal-700">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Contact</h4>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            {settings?.address && <li>{settings.address}</li>}
            {settings?.phone && <li>{settings.phone}</li>}
            {settings?.email && <li>{settings.email}</li>}
            {settings?.opening_hours && <li>{settings.opening_hours}</li>}
          </ul>
        </div>
      </div>

      <div className="border-t border-slate-200 px-4 py-4 text-center text-xs text-slate-400 sm:px-6">
        <p>
          © {new Date().getFullYear()} {settings?.hospital_name || "Daniel's Physiotherapy Hospital"}. All rights reserved.
          {' · '}
          <Link to="/login" className="hover:text-teal-600">
            Staff Login
          </Link>
        </p>
      </div>
    </footer>
  );
}
