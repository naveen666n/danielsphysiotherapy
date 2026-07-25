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
        <h1 className="mb-2 text-2xl font-semibold text-teal-700">Appointment Requested</h1>
        <p className="text-slate-600">
          Thank you! We've received your request and will contact you shortly to confirm.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
      <SectionHeading title="Book an Appointment" subtitle="Fill in your details and we'll confirm your slot shortly." />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Full Name</label>
          <input
            type="text"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none"
            {...register('patient_name', {
              required: 'Name is required',
              minLength: { value: 2, message: 'Name must be at least 2 characters' },
            })}
          />
          {errors.patient_name && <p className="mt-1 text-sm text-red-600">{errors.patient_name.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Mobile Number</label>
          <input
            type="tel"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none"
            {...register('mobile', {
              required: 'Mobile number is required',
              minLength: { value: 7, message: 'Enter a valid mobile number' },
            })}
          />
          {errors.mobile && <p className="mt-1 text-sm text-red-600">{errors.mobile.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email (optional)</label>
            <input
              type="email"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none"
              {...register('email')}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Age (optional)</label>
            <input
              type="number"
              min="0"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none"
              {...register('age')}
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Gender (optional)</label>
          <select
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none"
            {...register('gender')}
          >
            <option value="">Prefer not to say</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Doctor</label>
          <select
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none"
            {...register('doctor_id')}
          >
            <option value="">General Inquiry / Not sure</option>
            {doctors?.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                {doctor.name} ({doctor.specialization || 'General'})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Service Needed</label>
          <select
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none"
            {...register('service_id')}
          >
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
            <label className="mb-1 block text-sm font-medium text-slate-700">Preferred Date</label>
            <input
              type="date"
              min={today}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none"
              {...register('appointment_date', { required: 'Date is required' })}
            />
            {errors.appointment_date && <p className="mt-1 text-sm text-red-600">{errors.appointment_date.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Preferred Time</label>
            <input
              type="time"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none"
              {...register('appointment_time', { required: 'Time is required' })}
            />
            {errors.appointment_time && <p className="mt-1 text-sm text-red-600">{errors.appointment_time.message}</p>}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Problem Description (optional)</label>
          <textarea
            rows="3"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none"
            {...register('problem_description')}
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-full bg-teal-600 px-4 py-2.5 font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Booking...' : 'Book Appointment'}
        </button>
      </form>
    </div>
  );
}
