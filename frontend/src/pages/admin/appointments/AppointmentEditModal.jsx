import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useUpdateAppointment } from '../../../hooks/useAppointments.js';

const STATUSES = ['pending', 'approved', 'cancelled', 'completed'];

function formatTime12Hour(time24) {
  const [hoursStr, minutes] = time24.split(':');
  let hours = parseInt(hoursStr, 10);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${suffix}`;
}

export default function AppointmentEditModal({ appointment, doctors, services, onClose }) {
  const updateAppointment = useUpdateAppointment();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      patient_name: appointment.patient_name ?? '',
      mobile: appointment.mobile ?? '',
      email: appointment.email ?? '',
      gender: appointment.gender ?? '',
      age: appointment.age ?? '',
      doctor_id: appointment.doctor_id ?? '',
      service_id: appointment.service_id ?? '',
      appointment_date: appointment.appointment_date?.slice(0, 10) ?? '',
      appointment_time: '',
      problem_description: appointment.problem_description ?? '',
      status: appointment.status,
    },
  });

  async function onSubmit(values) {
    const payload = {
      patient_name: values.patient_name,
      mobile: values.mobile,
      appointment_date: values.appointment_date,
      status: values.status,
      email: values.email || null,
      gender: values.gender || null,
      age: values.age !== '' ? values.age : null,
      doctor_id: values.doctor_id ? values.doctor_id : null,
      service_id: values.service_id ? values.service_id : null,
      problem_description: values.problem_description || null,
    };
    if (values.appointment_time) payload.appointment_time = formatTime12Hour(values.appointment_time);

    try {
      await updateAppointment.mutateAsync({ id: appointment.id, payload });
      toast.success('Appointment updated');
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to update appointment.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">Edit Appointment</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Patient Name</label>
            <input
              type="text"
              className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              {...register('patient_name', { required: 'Name is required' })}
            />
            {errors.patient_name && <p className="mt-1 text-sm text-red-600">{errors.patient_name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Mobile</label>
              <input
                type="tel"
                className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                {...register('mobile', { required: 'Mobile is required' })}
              />
              {errors.mobile && <p className="mt-1 text-sm text-red-600">{errors.mobile.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                {...register('email')}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Gender</label>
              <select
                className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                {...register('gender')}
              >
                <option value="">—</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Age</label>
              <input
                type="number"
                min="0"
                className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                {...register('age')}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Doctor</label>
            <select
              className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              {...register('doctor_id')}
            >
              <option value="">General Inquiry / Not sure</option>
              {doctors?.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Service</label>
            <select
              className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
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
              <label className="mb-1 block text-sm font-medium text-slate-700">Date</label>
              <input
                type="date"
                className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                {...register('appointment_date', { required: 'Date is required' })}
              />
              {errors.appointment_date && (
                <p className="mt-1 text-sm text-red-600">{errors.appointment_date.message}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Time <span className="font-normal text-slate-400">(current: {appointment.appointment_time})</span>
              </label>
              <input
                type="time"
                className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                {...register('appointment_time')}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
            <select
              className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              {...register('status')}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Problem Description</label>
            <textarea
              rows="3"
              className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              {...register('problem_description')}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
