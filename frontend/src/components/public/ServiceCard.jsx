import { getPhotoUrl } from '../../utils/photoUrl.js';

export default function ServiceCard({ service }) {
  return (
    <div className="overflow-hidden rounded-[4px] border border-brand-line bg-white transition-shadow hover:shadow-[inset_0_-3px_0_var(--color-brand-sage)]">
      <div className="h-44 w-full bg-brand-ice">
        {service.image_url ? (
          <img src={getPhotoUrl(service.image_url)} alt={service.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-brand-blue/40">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-12 w-12" strokeWidth="1.4">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 21c-4.4-2.7-8-6.6-8-11a8 8 0 0116 0c0 4.4-3.6 8.3-8 11z"
              />
            </svg>
          </div>
        )}
      </div>
      <div className="p-6">
        <h3 className="font-display text-xl font-normal text-brand-navy">{service.name}</h3>
        {service.description && <p className="mt-2.5 text-sm text-brand-ink-soft">{service.description}</p>}
      </div>
    </div>
  );
}
