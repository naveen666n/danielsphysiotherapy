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
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <SectionHeading title={content?.contact_page_heading} subtitle={content?.contact_page_subheading} />
      <div className="grid grid-cols-1 gap-10 sm:grid-cols-2">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-800">Reach Us</h3>
          <ul className="space-y-2 text-sm text-slate-600">
            {settings?.address && <li>{settings.address}</li>}
            {settings?.phone && <li>{settings.phone}</li>}
            {settings?.email && <li>{settings.email}</li>}
            {settings?.opening_hours && <li>{settings.opening_hours}</li>}
          </ul>
          <GoogleMapEmbed address={settings?.address} className="h-56 w-full rounded-xl border border-slate-200" />
          {settings?.google_map_link && (
            <a
              href={settings.google_map_link}
              target="_blank"
              rel="noreferrer"
              className="inline-block rounded-full bg-teal-600 px-6 py-2.5 font-semibold text-white hover:bg-teal-700"
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
