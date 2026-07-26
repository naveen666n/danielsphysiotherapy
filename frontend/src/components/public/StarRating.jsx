export default function StarRating({ rating, dark = false }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          viewBox="0 0 20 20"
          className={`h-4 w-4 ${star <= rating ? 'fill-amber-400' : dark ? 'fill-white/15' : 'fill-slate-200'}`}
        >
          <path d="M10 1.5l2.6 5.4 5.9.7-4.3 4.1 1.1 5.8L10 14.7l-5.3 2.8 1.1-5.8L1.5 7.6l5.9-.7L10 1.5z" />
        </svg>
      ))}
    </div>
  );
}
