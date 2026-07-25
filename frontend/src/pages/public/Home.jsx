import { Link } from 'react-router-dom';
import { usePublicContent } from '../../hooks/usePublicContent.js';
import { usePublicServices } from '../../hooks/useServices.js';
import { usePublicDoctors } from '../../hooks/useDoctors.js';
import { usePublicTestimonials } from '../../hooks/useTestimonials.js';
import { usePublicSettings } from '../../hooks/useSettings.js';
import { usePageTitle } from '../../hooks/usePageTitle.js';
import SectionHeading from '../../components/public/SectionHeading.jsx';
import ServiceCard from '../../components/public/ServiceCard.jsx';
import DoctorCard from '../../components/public/DoctorCard.jsx';
import TestimonialCard from '../../components/public/TestimonialCard.jsx';
import EmptyState from '../../components/public/EmptyState.jsx';
import GoogleMapEmbed from '../../components/public/GoogleMapEmbed.jsx';

const whyIcons = [
  <svg key="1" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-8 w-8">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>,
  <svg key="2" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-8 w-8">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>,
  <svg key="3" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-8 w-8">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4z"
    />
  </svg>,
  <svg key="4" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-8 w-8">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>,
];

export default function Home() {
  usePageTitle('Home');
  const { data: content } = usePublicContent();
  const { data: services } = usePublicServices();
  const { data: doctors } = usePublicDoctors();
  const { data: testimonials } = usePublicTestimonials();
  const { data: settings } = usePublicSettings();

  const previewServices = (services || []).slice(0, 4);
  const previewDoctors = (doctors || []).slice(0, 3);
  const previewTestimonials = (testimonials || []).slice(0, 3);

  const whyItems = content
    ? [
        { title: content.why_title_1, body: content.why_body_1 },
        { title: content.why_title_2, body: content.why_body_2 },
        { title: content.why_title_3, body: content.why_body_3 },
        { title: content.why_title_4, body: content.why_body_4 },
      ]
    : [];

  const trustLines = content ? [content.trust_line_1, content.trust_line_2, content.trust_line_3] : [];

  return (
    <div>
      <section className="bg-gradient-to-br from-teal-600 to-teal-800 text-white">
        <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6">
          <h1 className="text-4xl font-bold sm:text-5xl">{content?.hero_title}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-teal-50">{content?.hero_subtitle}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link to="/book" className="rounded-full bg-amber-500 px-8 py-3 font-semibold text-white shadow-lg hover:bg-amber-600">
              Book Appointment
            </Link>
            <Link to="/services" className="rounded-full border border-white/60 px-8 py-3 font-semibold text-white hover:bg-white/10">
              Our Services
            </Link>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-100 bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-8 text-center sm:grid-cols-3 sm:px-6">
          {trustLines.map((line, i) => (
            <p key={i} className="text-sm font-semibold text-slate-600">
              {line}
            </p>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <SectionHeading title={content?.home_services_heading} />
        {previewServices.length === 0 ? (
          <EmptyState label="Services" />
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {previewServices.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        )}
        <div className="mt-8 text-center">
          <Link to="/services" className="font-semibold text-teal-600 hover:text-teal-700">
            View All Services →
          </Link>
        </div>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading title={content?.home_about_heading} subtitle={content?.home_about_body} />
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {whyItems.map((item, i) => (
              <div key={i} className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-teal-100 text-teal-600">
                  {whyIcons[i]}
                </div>
                <h3 className="mt-4 font-semibold text-slate-800">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-500">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <SectionHeading title={content?.home_doctors_heading} />
        {previewDoctors.length === 0 ? (
          <EmptyState label="Doctor profiles" />
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {previewDoctors.map((doctor) => (
              <DoctorCard key={doctor.id} doctor={doctor} />
            ))}
          </div>
        )}
        <div className="mt-8 text-center">
          <Link to="/doctors" className="font-semibold text-teal-600 hover:text-teal-700">
            Meet All Doctors →
          </Link>
        </div>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading title={content?.home_testimonials_heading} />
          {previewTestimonials.length === 0 ? (
            <EmptyState label="Patient testimonials" />
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              {previewTestimonials.map((testimonial) => (
                <TestimonialCard key={testimonial.id} testimonial={testimonial} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <SectionHeading title={content?.home_contact_heading} />
        <GoogleMapEmbed address={settings?.address} className="mb-6 h-64 w-full rounded-xl border border-slate-200" />
        <div className="grid grid-cols-1 gap-6 rounded-xl bg-teal-600 p-8 text-white sm:grid-cols-2">
          <div className="space-y-2">
            {settings?.address && <p>{settings.address}</p>}
            {settings?.phone && <p>{settings.phone}</p>}
            {settings?.opening_hours && <p>{settings.opening_hours}</p>}
          </div>
          <div className="flex flex-col items-start gap-3 sm:items-end">
            {settings?.google_map_link && (
              <a
                href={settings.google_map_link}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-white px-6 py-2.5 font-semibold text-teal-700 hover:bg-teal-50"
              >
                Get Directions
              </a>
            )}
            <Link to="/contact" className="rounded-full border border-white/60 px-6 py-2.5 font-semibold hover:bg-white/10">
              Contact Us
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
