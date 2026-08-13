import { Link } from 'react-router-dom';
import { usePublicContent } from '../../hooks/usePublicContent.js';
import { usePublicServices } from '../../hooks/useServices.js';
import { usePublicDoctors } from '../../hooks/useDoctors.js';
import { usePublicTestimonials } from '../../hooks/useTestimonials.js';
import { usePublicSettings } from '../../hooks/useSettings.js';
import { usePageTitle } from '../../hooks/usePageTitle.js';
import { useTheme } from '../../contexts/ThemeContext.jsx';
import { getPhotoUrl } from '../../utils/photoUrl.js';
import SectionHeading from '../../components/public/SectionHeading.jsx';
import ServiceCard from '../../components/public/ServiceCard.jsx';
import DoctorCard from '../../components/public/DoctorCard.jsx';
import TestimonialCard from '../../components/public/TestimonialCard.jsx';
import EmptyState from '../../components/public/EmptyState.jsx';
import GoogleMapEmbed from '../../components/public/GoogleMapEmbed.jsx';
import StatsStrip from '../../components/public/home/StatsStrip.jsx';
import StickyBookCta from '../../components/public/home/StickyBookCta.jsx';
import CredentialsTicker from '../../components/public/home/CredentialsTicker.jsx';
import fallbackDoctorPhoto from '../../assets/doctor-daniel.jpg';

const whyIcons = [
  <svg key="1" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-7 w-7">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>,
  <svg key="2" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-7 w-7">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>,
  <svg key="3" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-7 w-7">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4z"
    />
  </svg>,
  <svg key="4" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-7 w-7">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>,
];

const processSteps = [
  {
    title: 'Assessment & Diagnosis',
    body: 'A full physical evaluation, movement screening, and diagnostic review to identify the root cause — not just the symptom.',
  },
  {
    title: 'Personalised Treatment Plan',
    body: 'A tailored plan combining manual therapy, targeted exercises, and measurable recovery milestones.',
  },
  {
    title: 'Active Rehabilitation',
    body: 'Guided in-clinic sessions with progress tracked against range-of-motion and strength benchmarks.',
  },
  {
    title: 'Maintenance & Prevention',
    body: 'A long-term movement plan to prevent re-injury and maintain full function.',
  },
];

const seeMoreLinkClass =
  'inline-flex items-center gap-1.5 font-mono-brand text-xs tracking-[0.08em] text-brand-navy uppercase transition-colors hover:text-brand-sage';

export default function Home() {
  usePageTitle('Home');
  const { data: content } = usePublicContent();
  const { data: services } = usePublicServices();
  const { data: doctors } = usePublicDoctors();
  const { data: testimonials } = usePublicTestimonials();
  const { data: settings } = usePublicSettings();
  const theme = useTheme();

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
      {theme === 'bright' && <StickyBookCta />}

      {/* ---------- Hero ---------- */}
      <section
        className="relative flex min-h-[calc(100vh-77px)] items-center overflow-hidden border-b border-brand-line"
        style={{ backgroundImage: 'var(--hero-bg)' }}
      >
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <span className="mb-4 flex items-center gap-2.5 font-mono-brand text-xs tracking-[0.14em] text-brand-blue uppercase">
              <span className="h-px w-7 bg-brand-blue" aria-hidden="true" />
              Trusted Physiotherapy Care
            </span>
            <h1 className="font-display text-[clamp(34px,4.4vw,50px)] leading-[1.08] font-normal text-brand-navy">{content?.hero_title}</h1>
            <p className="mt-4 max-w-[470px] text-[16.5px] text-brand-ink-soft">{content?.hero_subtitle}</p>
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <Link
                to="/book"
                className="rounded-[var(--radius-button)] bg-brand-navy px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-brand-navy-hover)]"
              >
                Book a Consultation
              </Link>
              <Link
                to="/services"
                className="rounded-[var(--radius-button)] border border-brand-navy px-6 py-3.5 text-sm font-semibold text-brand-navy transition-colors hover:bg-brand-navy hover:text-white"
              >
                View Services
              </Link>
            </div>
          </div>

          <div className="relative flex flex-col items-center gap-4 lg:flex-row lg:justify-end">
            <div className="relative aspect-4/5 w-full max-w-[360px] overflow-hidden rounded-[var(--radius-card)] border border-brand-line bg-brand-ice shadow-[var(--shadow-card)]">
              <img
                src={content?.hero_image_url ? getPhotoUrl(content.hero_image_url) : fallbackDoctorPhoto}
                alt="Dr. Chenna Daniel"
                className="h-full w-full object-cover"
              />
              <svg className="absolute top-4.5 right-4.5 opacity-90" width="46" height="30" viewBox="0 0 46 30">
                <path d="M3 28 A20 20 0 0 1 43 28" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.4" />
              </svg>
              <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-(--color-brand-navy)/90 to-(--color-brand-navy)/5 px-5.5 pt-5 pb-4.5">
                <div className="font-display text-[22px] leading-[1.1] text-white italic">Dr. Chenna Daniel</div>
                <div className="mt-1.5 font-mono-brand text-[10.5px] tracking-[0.1em] text-white/70 uppercase">
                  Founder &amp; Lead Physiotherapist
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 self-start rounded-[var(--radius-card)] border border-brand-line bg-white px-4.5 py-3.5 shadow-[var(--shadow-card)] lg:absolute lg:bottom-8 lg:left-[-40px] lg:self-auto">
              <div className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-full bg-brand-ice">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 text-brand-sage">
                  <path d="M9 12l2 2 4-4" />
                  <circle cx="12" cy="12" r="9" />
                </svg>
              </div>
              <div>
                <div className="font-display text-[19px] leading-none text-brand-navy">10+ yrs</div>
                <div className="mt-1 font-mono-brand text-[9.5px] tracking-[0.05em] text-brand-ink-soft uppercase">Certified &amp; Trusted</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {theme === 'warm' && <StatsStrip />}
      {theme === 'premium' && <CredentialsTicker />}

      {/* ---------- Trust strip ---------- */}
      <section className="border-b border-brand-line bg-white">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-8 sm:grid-cols-3 sm:px-6">
          {trustLines.map((line, i) => (
            <p key={i} className="flex items-center gap-2.5 font-mono-brand text-[13px] text-brand-ink-soft">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-sage" aria-hidden="true" />
              {line}
            </p>
          ))}
        </div>
      </section>

      {/* ---------- Services ---------- */}
      <section className="border-y border-brand-line bg-brand-ice py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading eyebrow="What We Treat" title={content?.home_services_heading} align="left" />
          {previewServices.length === 0 ? (
            <EmptyState label="Services" />
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {previewServices.map((service) => (
                <ServiceCard key={service.id} service={service} />
              ))}
            </div>
          )}
          <div className="mt-10 text-center">
            <Link to="/services" className={seeMoreLinkClass}>
              See all services →
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- Why us / About ---------- */}
      <section className="bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading eyebrow="About Us" title={content?.home_about_heading} subtitle={content?.home_about_body} />
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[var(--radius-card)] border border-brand-line bg-brand-line sm:grid-cols-2 lg:grid-cols-4">
            {whyItems.map((item, i) => (
              <div key={i} className="bg-white p-8">
                <div className="flex h-13 w-13 items-center justify-center rounded-full bg-brand-ice text-brand-blue">{whyIcons[i]}</div>
                <h3 className="mt-5 font-display text-lg font-normal text-brand-navy">{item.title}</h3>
                <p className="mt-2 text-sm text-brand-ink-soft">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Doctors ---------- */}
      <section className="border-b border-brand-line bg-brand-ice py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading eyebrow="Meet the Team" title={content?.home_doctors_heading} align="left" />
          {previewDoctors.length === 0 ? (
            <EmptyState label="Doctor profiles" />
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {previewDoctors.map((doctor) => (
                <DoctorCard key={doctor.id} doctor={doctor} />
              ))}
            </div>
          )}
          <div className="mt-10 text-center">
            <Link to="/doctors" className={seeMoreLinkClass}>
              Meet all doctors →
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- Patient Stories ---------- */}
      <section className="bg-brand-navy py-20 text-white sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-12 max-w-2xl">
            <span className="mb-4 flex items-center gap-2.5 font-mono-brand text-xs tracking-[0.14em] text-white/60 uppercase">
              <span className="h-px w-7 bg-white/60" aria-hidden="true" />
              Patient Stories
            </span>
            <h2 className="font-display text-3xl leading-[1.15] font-normal text-white sm:text-4xl">{content?.home_testimonials_heading}</h2>
          </div>
          {previewTestimonials.length === 0 ? (
            <div className="rounded-[var(--radius-card)] border border-dashed border-white/20 bg-white/4 px-6 py-14 text-center">
              <p className="text-white/60">Patient testimonials coming soon — check back shortly.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-7 sm:grid-cols-3">
              {previewTestimonials.map((testimonial) => (
                <TestimonialCard key={testimonial.id} testimonial={testimonial} dark />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ---------- Process ---------- */}
      <section className="bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading
            eyebrow="The Approach"
            title="Your recovery, mapped out."
            subtitle="A structured process from first visit to full function — because guesswork has no place in rehabilitation."
            align="left"
          />
          <div className="relative flex flex-col">
            {theme === 'premium' && (
              <div className="absolute top-0 bottom-0 left-[27px] w-px bg-brand-blue sm:left-[44px]" aria-hidden="true" />
            )}
            {processSteps.map((step, i) => (
              <div key={step.title} className="grid grid-cols-[56px_1fr] gap-6 border-t border-brand-line py-7 last:border-b sm:grid-cols-[90px_1fr] sm:gap-7">
                <div className="font-mono-brand text-[13px] text-brand-sage">
                  <svg width="34" height="22" viewBox="0 0 34 22" className="mb-2">
                    <path d="M2 20 A15 15 0 0 1 32 20" fill="none" style={{ stroke: 'var(--color-brand-sage)' }} strokeWidth="1.6" />
                  </svg>
                  {String(i + 1).padStart(2, '0')}
                </div>
                <div>
                  <h3 className="font-display text-2xl font-normal text-brand-navy">{step.title}</h3>
                  <p className="mt-1.5 max-w-[560px] text-[15px] text-brand-ink-soft">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Contact ---------- */}
      <section className="bg-brand-ice py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionHeading eyebrow="Get In Touch" title={content?.home_contact_heading} align="left" />
          <GoogleMapEmbed
            address={settings?.address}
            embedUrl={settings?.map_embed_url}
            className="mb-6 h-64 w-full rounded-[var(--radius-card)] border border-brand-line"
          />
          <div className="grid grid-cols-1 gap-6 rounded-[var(--radius-card)] border border-brand-line bg-white p-8 sm:grid-cols-2">
            <div className="space-y-2 text-brand-ink-soft">
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
                  className="rounded-[var(--radius-button)] bg-brand-navy px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-brand-navy-hover)]"
                >
                  Get Directions
                </a>
              )}
              <Link
                to="/contact"
                className="rounded-[var(--radius-button)] border border-brand-navy px-6 py-2.5 text-sm font-semibold text-brand-navy transition-colors hover:bg-brand-navy hover:text-white"
              >
                Contact Us
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
