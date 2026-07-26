import { Link } from 'react-router-dom';
import { usePublicSettings } from '../../hooks/useSettings.js';
import { usePublicContent } from '../../hooks/usePublicContent.js';
import { normalizeExternalUrl } from '../../utils/url.js';
import { socialPlatforms } from './socialPlatforms.jsx';

const quickLinks = [
  { to: '/', label: 'Home' },
  { to: '/services', label: 'Services' },
  { to: '/doctors', label: 'Doctors' },
  { to: '/testimonials', label: 'Testimonials' },
  { to: '/contact', label: 'Contact' },
];

export default function PublicFooter() {
  const { data: settings } = usePublicSettings();
  const { data: content } = usePublicContent();
  const socialLinks = settings?.social_links || {};
  const hasSocialLinks = Object.values(socialLinks).some((url) => url);
  const hospitalName = settings?.hospital_name || "Daniel's Physiotherapy Hospital";

  return (
    <footer className="bg-brand-navy text-white/65">
      <div className="mx-auto max-w-6xl px-4 pt-14 pb-10 sm:px-6">
        <div className="grid grid-cols-1 gap-10 border-b border-white/14 pb-10 sm:grid-cols-2 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:gap-10">
          <div>
            <div className="font-display text-2xl text-white">{hospitalName}</div>
            <p className="mt-3 max-w-[260px] text-sm">{content?.footer_tagline}</p>
            {hasSocialLinks && (
              <div className="mt-5 flex gap-3">
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
                        className={`flex h-9 w-9 items-center justify-center rounded-full shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md ${social.bg}`}
                      >
                        {social.icon}
                      </a>
                    )
                )}
              </div>
            )}
          </div>

          <div>
            <h4 className="font-mono-brand text-[11.5px] tracking-[0.07em] text-white/40 uppercase">Navigate</h4>
            <ul className="mt-4 space-y-2.5">
              {quickLinks.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="text-sm transition-colors hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-mono-brand text-[11.5px] tracking-[0.07em] text-white/40 uppercase">Contact</h4>
            <ul className="mt-4 space-y-2.5 text-sm">
              {settings?.phone && <li>{settings.phone}</li>}
              {settings?.email && <li>{settings.email}</li>}
              {settings?.address && <li>{settings.address}</li>}
            </ul>
          </div>

          <div>
            <h4 className="font-mono-brand text-[11.5px] tracking-[0.07em] text-white/40 uppercase">Hours</h4>
            <ul className="mt-4 space-y-2.5 text-sm">{settings?.opening_hours && <li>{settings.opening_hours}</li>}</ul>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-6 font-mono-brand text-xs sm:flex-row sm:items-center sm:justify-between">
          <span>
            © {new Date().getFullYear()} {hospitalName}. All rights reserved.
          </span>
          <Link to="/login" className="transition-colors hover:text-white">
            Staff Login
          </Link>
        </div>
      </div>
    </footer>
  );
}
