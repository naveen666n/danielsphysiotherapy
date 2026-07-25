import { getPhotoUrl } from '../../utils/photoUrl.js';

export default function DoctorCard({ doctor }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-100 bg-white text-center shadow-sm transition hover:shadow-md">
      <div className="mx-auto mt-6 h-28 w-28 overflow-hidden rounded-full bg-teal-50">
        {doctor.photo_url ? (
          <img src={getPhotoUrl(doctor.photo_url)} alt={doctor.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-2xl font-bold text-teal-300">
            {doctor.name.charAt(0)}
          </div>
        )}
      </div>
      <div className="p-5">
        <h3 className="text-lg font-semibold text-slate-800">{doctor.name}</h3>
        {doctor.specialization && <p className="text-sm text-teal-600">{doctor.specialization}</p>}
        {doctor.qualification && <p className="mt-1 text-sm text-slate-500">{doctor.qualification}</p>}
        {doctor.experience_years != null && (
          <p className="mt-1 text-xs text-slate-400">{doctor.experience_years}+ years experience</p>
        )}
        {(doctor.working_days || doctor.available_time) && (
          <p className="mt-3 text-xs text-slate-500">
            {doctor.working_days}
            {doctor.working_days && doctor.available_time ? ' · ' : ''}
            {doctor.available_time}
          </p>
        )}
        {doctor.consultation_fee != null && (
          <p className="mt-2 text-sm font-medium text-slate-700">Consultation: ₹{doctor.consultation_fee}</p>
        )}
      </div>
    </div>
  );
}
