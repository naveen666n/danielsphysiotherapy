import { usePublicContent } from '../../hooks/usePublicContent.js';
import { usePublicSettings } from '../../hooks/useSettings.js';
import { usePageTitle } from '../../hooks/usePageTitle.js';
import SectionHeading from '../../components/public/SectionHeading.jsx';
import ContactForm from '../../components/public/ContactForm.jsx';
import GoogleMapEmbed from '../../components/public/GoogleMapEmbed.jsx';

export default function Contact() {
  usePageTitle('Contact');
  const { data: content } = usePublicContent();
  const { data: settings } = usePublicSettings();

  return (
    <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6 sm:py-24">
      <SectionHeading eyebrow="Get In Touch" title={content?.contact_page_heading} subtitle={content?.contact_page_subheading} />
      <div className="grid grid-cols-1 gap-10 sm:grid-cols-2">
        <div className="space-y-5">
          <h3 className="font-mono-brand text-[11px] tracking-[0.08em] text-brand-blue uppercase">Reach Us</h3>
          <ul className="space-y-3 border-t border-brand-line pt-5 text-sm text-brand-ink-soft">
            {settings?.address && <li>{settings.address}</li>}
            {settings?.phone && <li>{settings.phone}</li>}
            {settings?.email && <li>{settings.email}</li>}
            {settings?.opening_hours && <li>{settings.opening_hours}</li>}
          </ul>
          <GoogleMapEmbed address={settings?.address} className="h-56 w-full rounded-[4px] border border-brand-line" />
          {settings?.google_map_link && (
            <a
              href={settings.google_map_link}
              target="_blank"
              rel="noreferrer"
              className="inline-block rounded-[3px] bg-brand-navy px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0d3a63]"
            >
              Get Directions
            </a>
          )}
        </div>
        <ContactForm />
      </div>
    </div>
  );
}
