import { getPhotoUrl } from '../../utils/photoUrl.js';

export default function ServiceCard({ service }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm transition hover:shadow-md">
      <div className="h-44 w-full bg-teal-50">
        {service.image_url ? (
          <img src={getPhotoUrl(service.image_url)} alt={service.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-teal-300">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-12 w-12">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 21c-4.4-2.7-8-6.6-8-11a8 8 0 0116 0c0 4.4-3.6 8.3-8 11z"
              />
            </svg>
          </div>
        )}
      </div>
      <div className="p-5">
        <h3 className="text-lg font-semibold text-slate-800">{service.name}</h3>
        {service.description && <p className="mt-2 text-sm text-slate-500">{service.description}</p>}
      </div>
    </div>
  );
}
