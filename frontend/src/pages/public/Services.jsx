import { usePublicContent } from '../../hooks/usePublicContent.js';
import { usePublicServices } from '../../hooks/useServices.js';
import { usePageTitle } from '../../hooks/usePageTitle.js';
import SectionHeading from '../../components/public/SectionHeading.jsx';
import ServiceCard from '../../components/public/ServiceCard.jsx';
import EmptyState from '../../components/public/EmptyState.jsx';

export default function Services() {
  usePageTitle('Services');
  const { data: content } = usePublicContent();
  const { data: services, isLoading } = usePublicServices();

  return (
    <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
      <SectionHeading eyebrow="What We Treat" title={content?.services_page_heading} subtitle={content?.services_page_subheading} />
      {isLoading ? (
        <p className="text-center text-brand-ink-soft">Loading services...</p>
      ) : (services || []).length === 0 ? (
        <EmptyState label="Services" />
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </div>
      )}
    </div>
  );
}
