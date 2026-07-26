import { Link } from 'react-router-dom';
import { useScrolledPast } from '../../../hooks/useScrolledPast.js';

export default function StickyBookCta() {
  const visible = useScrolledPast(480);

  return (
    <Link
      to="/book"
      className={`fixed right-5 bottom-5 z-30 rounded-[var(--radius-button)] bg-brand-navy px-6 py-3.5 text-sm font-semibold text-white shadow-[var(--shadow-card)] transition-all duration-300 hover:bg-[var(--color-brand-navy-hover)] ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'
      }`}
    >
      Book Now
    </Link>
  );
}
