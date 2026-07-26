import { getPhotoUrl } from '../../utils/photoUrl.js';
import StarRating from './StarRating.jsx';

export default function TestimonialCard({ testimonial, dark = false }) {
  return (
    <div
      className={`rounded-[4px] p-6 ${
        dark ? 'border border-white/14 bg-white/4' : 'border border-brand-line bg-white'
      }`}
    >
      <StarRating rating={testimonial.rating} dark={dark} />
      <p className={`font-display mt-4 text-lg leading-[1.45] italic ${dark ? 'text-white' : 'text-brand-navy'}`}>
        &ldquo;{testimonial.review}&rdquo;
      </p>
      <div className={`mt-5 flex items-center gap-3 border-t pt-4 ${dark ? 'border-white/14' : 'border-brand-line'}`}>
        {testimonial.photo_url ? (
          <img
            src={getPhotoUrl(testimonial.photo_url)}
            alt={testimonial.patient_name}
            className="h-9 w-9 rounded-full object-cover"
          />
        ) : (
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-full font-mono-brand text-sm ${
              dark ? 'bg-white/10 text-white' : 'bg-brand-ice text-brand-blue'
            }`}
          >
            {testimonial.patient_name.charAt(0)}
          </div>
        )}
        <span className={`font-mono-brand text-xs tracking-[0.05em] uppercase ${dark ? 'text-white' : 'text-brand-navy'}`}>
          {testimonial.patient_name}
        </span>
      </div>
    </div>
  );
}
