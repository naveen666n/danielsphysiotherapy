import { usePublicContent } from '../../hooks/usePublicContent.js';
import { usePublicDoctors } from '../../hooks/useDoctors.js';
import { usePageTitle } from '../../hooks/usePageTitle.js';
import SectionHeading from '../../components/public/SectionHeading.jsx';
import DoctorCard from '../../components/public/DoctorCard.jsx';
import EmptyState from '../../components/public/EmptyState.jsx';

export default function Doctors() {
  usePageTitle('Doctors');
  const { data: content } = usePublicContent();
  const { data: doctors, isLoading } = usePublicDoctors();

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <SectionHeading title={content?.doctors_page_heading} subtitle={content?.doctors_page_subheading} />
      {isLoading ? (
        <p className="text-center text-slate-400">Loading doctors...</p>
      ) : (doctors || []).length === 0 ? (
        <EmptyState label="Doctor profiles" />
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {doctors.map((doctor) => (
            <DoctorCard key={doctor.id} doctor={doctor} />
          ))}
        </div>
      )}
    </div>
  );
}
