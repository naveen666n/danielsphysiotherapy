import { getPhotoUrl } from '../../utils/photoUrl.js';

export default function DoctorCard({ doctor }) {
  return (
    <div className="overflow-hidden border transition-shadow rounded-[var(--radius-card)] border-[var(--card-border)] bg-[var(--card-bg)] [backdrop-filter:var(--card-blur)] hover:shadow-[var(--shadow-card)]">
      <div className="aspect-4/5 bg-brand-ice">
        {doctor.photo_url ? (
          <img src={getPhotoUrl(doctor.photo_url)} alt={doctor.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center bg-brand-navy">
            <span className="font-display text-5xl text-white italic">{doctor.name.charAt(0)}</span>
          </div>
        )}
      </div>
      <div className="p-6">
        <h3 className="font-display text-xl text-brand-navy italic">{doctor.name}</h3>
        {doctor.specialization && (
          <p className="mt-1.5 font-mono-brand text-[10.5px] tracking-[0.08em] text-brand-blue uppercase">{doctor.specialization}</p>
        )}
        {doctor.qualification && <p className="mt-3 text-sm text-brand-ink-soft">{doctor.qualification}</p>}
        {(doctor.experience_years != null || doctor.working_days || doctor.available_time) && (
          <div className="mt-4 space-y-1 border-t border-brand-line pt-4 text-[13px] text-brand-ink-soft">
            {doctor.experience_years != null && <p>{doctor.experience_years}+ years experience</p>}
            {(doctor.working_days || doctor.available_time) && (
              <p>
                {doctor.working_days}
                {doctor.working_days && doctor.available_time ? ' · ' : ''}
                {doctor.available_time}
              </p>
            )}
          </div>
        )}
        {doctor.consultation_fee != null && <p className="mt-3 text-sm font-medium text-brand-navy">Consultation: ₹{doctor.consultation_fee}</p>}
      </div>
    </div>
  );
}
