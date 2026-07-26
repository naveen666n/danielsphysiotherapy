import { usePublicContent } from '../../hooks/usePublicContent.js';
import { usePublicTestimonials } from '../../hooks/useTestimonials.js';
import { usePageTitle } from '../../hooks/usePageTitle.js';
import SectionHeading from '../../components/public/SectionHeading.jsx';
import TestimonialCard from '../../components/public/TestimonialCard.jsx';
import EmptyState from '../../components/public/EmptyState.jsx';

export default function Testimonials() {
  usePageTitle('Testimonials');
  const { data: content } = usePublicContent();
  const { data: testimonials, isLoading } = usePublicTestimonials();

  return (
    <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
      <SectionHeading eyebrow="Patient Stories" title={content?.testimonials_page_heading} subtitle={content?.testimonials_page_subheading} />
      {isLoading ? (
        <p className="text-center text-brand-ink-soft">Loading testimonials...</p>
      ) : (testimonials || []).length === 0 ? (
        <EmptyState label="Patient testimonials" />
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((testimonial) => (
            <TestimonialCard key={testimonial.id} testimonial={testimonial} />
          ))}
        </div>
      )}
    </div>
  );
}
