import { getPhotoUrl } from '../../utils/photoUrl.js';
import StarRating from './StarRating.jsx';

export default function TestimonialCard({ testimonial }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
      <StarRating rating={testimonial.rating} />
      <p className="mt-4 text-sm text-slate-600">&ldquo;{testimonial.review}&rdquo;</p>
      <div className="mt-5 flex items-center gap-3">
        {testimonial.photo_url ? (
          <img
            src={getPhotoUrl(testimonial.photo_url)}
            alt={testimonial.patient_name}
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 text-sm font-semibold text-teal-700">
            {testimonial.patient_name.charAt(0)}
          </div>
        )}
        <span className="text-sm font-medium text-slate-800">{testimonial.patient_name}</span>
      </div>
    </div>
  );
}
