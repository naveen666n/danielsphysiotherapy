import { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { usePublicDoctors } from '../hooks/useDoctors.js';
import { usePublicServices } from '../hooks/useServices.js';
import { useBookAppointment } from '../hooks/useAppointments.js';
import { usePageTitle } from '../hooks/usePageTitle.js';
import SectionHeading from '../components/public/SectionHeading.jsx';

function formatTime12Hour(time24) {
  const [hoursStr, minutes] = time24.split(':');
  let hours = parseInt(hoursStr, 10);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${suffix}`;
}

const today = new Date().toISOString().slice(0, 10);

const fieldClass =
  'w-full rounded-[var(--radius-button)] border border-brand-line px-3.5 py-3 text-[14.5px] text-brand-ink focus:border-brand-sage focus:outline-2 focus:outline-brand-sage focus:outline-offset-1';
const labelClass = 'mb-2 block font-mono-brand text-[11.5px] tracking-[0.06em] text-brand-ink-soft uppercase';

export default function PublicBooking() {
  usePageTitle('Book Appointment');
  const { data: doctors } = usePublicDoctors();
  const { data: services } = usePublicServices();
  const bookAppointment = useBookAppointment();
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      patient_name: '',
      mobile: '',
      email: '',
      gender: '',
      age: '',
      doctor_id: '',
      service_id: '',
      appointment_date: today,
      appointment_time: '',
      problem_description: '',
    },
  });

  async function onSubmit(values) {
    const payload = {
      patient_name: values.patient_name,
      mobile: values.mobile,
      appointment_date: values.appointment_date,
      appointment_time: formatTime12Hour(values.appointment_time),
    };
    if (values.email) payload.email = values.email;
    if (values.gender) payload.gender = values.gender;
    if (values.age !== '') payload.age = values.age;
    if (values.doctor_id) payload.doctor_id = values.doctor_id;
    if (values.service_id) payload.service_id = values.service_id;
    if (values.problem_description) payload.problem_description = values.problem_description;

    try {
      await bookAppointment.mutateAsync(payload);
      setSubmitted(true);
    } catch (err) {
      toast.error(err.message || 'Failed to book appointment.');
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center sm:px-6">
        <h1 className="font-display mb-2 text-2xl font-normal text-brand-navy">Appointment Requested</h1>
        <p className="text-brand-ink-soft">
          Thank you! We've received your request and will contact you shortly to confirm.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-20 sm:px-6 sm:py-24">
      <SectionHeading
        eyebrow="Get In Touch"
        title="Book an Appointment"
        subtitle="Fill in your details and we'll confirm your slot shortly."
      />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4.5 rounded-[var(--radius-card)] border border-[var(--card-border)] bg-[var(--card-bg)] [backdrop-filter:var(--card-blur)] p-6 sm:p-8">
        <div>
          <label className={labelClass}>Full Name</label>
          <input
            type="text"
            className={fieldClass}
            {...register('patient_name', {
              required: 'Name is required',
              minLength: { value: 2, message: 'Name must be at least 2 characters' },
            })}
          />
          {errors.patient_name && <p className="mt-1.5 text-sm text-red-600">{errors.patient_name.message}</p>}
        </div>

        <div>
          <label className={labelClass}>Mobile Number</label>
          <input
            type="tel"
            className={fieldClass}
            {...register('mobile', {
              required: 'Mobile number is required',
              minLength: { value: 7, message: 'Enter a valid mobile number' },
            })}
          />
          {errors.mobile && <p className="mt-1.5 text-sm text-red-600">{errors.mobile.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Email (optional)</label>
            <input type="email" className={fieldClass} {...register('email')} />
          </div>
          <div>
            <label className={labelClass}>Age (optional)</label>
            <input type="number" min="0" className={fieldClass} {...register('age')} />
          </div>
        </div>

        <div>
          <label className={labelClass}>Gender (optional)</label>
          <select className={fieldClass} {...register('gender')}>
            <option value="">Prefer not to say</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div>
          <label className={labelClass}>Doctor</label>
          <select className={fieldClass} {...register('doctor_id')}>
            <option value="">General Inquiry / Not sure</option>
            {doctors?.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                {doctor.name} ({doctor.specialization || 'General'})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Service Needed</label>
          <select className={fieldClass} {...register('service_id')}>
            <option value="">Not sure / General</option>
            {services?.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Preferred Date</label>
            <input type="date" min={today} className={fieldClass} {...register('appointment_date', { required: 'Date is required' })} />
            {errors.appointment_date && <p className="mt-1.5 text-sm text-red-600">{errors.appointment_date.message}</p>}
          </div>
          <div>
            <label className={labelClass}>Preferred Time</label>
            <input type="time" className={fieldClass} {...register('appointment_time', { required: 'Time is required' })} />
            {errors.appointment_time && <p className="mt-1.5 text-sm text-red-600">{errors.appointment_time.message}</p>}
          </div>
        </div>

        <div>
          <label className={labelClass}>Problem Description (optional)</label>
          <textarea rows="3" className={fieldClass} {...register('problem_description')} />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-[var(--radius-button)] bg-brand-navy px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-brand-navy-hover)] disabled:opacity-50"
        >
          {isSubmitting ? 'Booking...' : 'Book Appointment'}
        </button>
      </form>
    </div>
  );
}
