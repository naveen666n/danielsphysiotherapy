import { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { usePublicDoctors } from '../hooks/useDoctors.js';
import { useCreateVideoConsultationOrder, useVerifyVideoConsultationPayment } from '../hooks/useVideoConsultations.js';
import { getPaymentAdapter } from '../payments/index.js';
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

export default function PublicVideoConsultation() {
  usePageTitle('Video Consultation');
  const { data: doctors } = usePublicDoctors();
  const videoDoctors = doctors?.filter((doctor) => doctor.video_consultation_fee != null) ?? [];
  const createOrder = useCreateVideoConsultationOrder();
  const verifyPayment = useVerifyVideoConsultationPayment();
  const [confirmation, setConfirmation] = useState(null);
  const [isPaying, setIsPaying] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      patient_name: '',
      mobile: '',
      email: '',
      doctor_id: '',
      consultation_date: today,
      consultation_time: '',
      problem_description: '',
    },
  });

  const selectedDoctor = videoDoctors.find((doctor) => String(doctor.id) === String(watch('doctor_id')));

  async function onSubmit(values) {
    const payload = {
      patient_name: values.patient_name,
      mobile: values.mobile,
      doctor_id: values.doctor_id,
      consultation_date: values.consultation_date,
      consultation_time: formatTime12Hour(values.consultation_time),
    };
    if (values.email) payload.email = values.email;
    if (values.problem_description) payload.problem_description = values.problem_description;

    setIsPaying(true);
    try {
      const order = await createOrder.mutateAsync(payload);
      const adapter = getPaymentAdapter('razorpay');
      const result = await adapter.openCheckout({
        keyId: order.keyId,
        gatewayOrderId: order.gatewayOrderId,
        amount: order.amount,
        currency: order.currency,
        name: "Daniel's Physiotherapy Hospital",
        description: `Video consultation with ${order.doctorName}`,
        prefill: { name: values.patient_name, contact: values.mobile, email: values.email || undefined },
      });

      const consultation = await verifyPayment.mutateAsync({
        id: order.consultationId,
        payload: result,
      });

      setConfirmation(consultation);
    } catch (err) {
      toast.error(err.message || 'Payment could not be completed.');
    } finally {
      setIsPaying(false);
    }
  }

  if (confirmation) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center sm:px-6">
        <h1 className="font-display mb-2 text-2xl font-normal text-brand-navy">Payment Successful</h1>
        <p className="text-brand-ink-soft">
          Your video consultation is confirmed for {confirmation.consultation_date?.slice(0, 10)} at{' '}
          {confirmation.consultation_time}.
        </p>
        <a
          href={confirmation.zoom_link}
          target="_blank"
          rel="noreferrer"
          className="mt-6 inline-block rounded-[var(--radius-button)] bg-brand-navy px-6 py-3 text-sm font-semibold text-white hover:bg-[var(--color-brand-navy-hover)]"
        >
          Join Zoom Meeting
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-20 sm:px-6 sm:py-24">
      <SectionHeading
        eyebrow="Consult Online"
        title="Book a Video Consultation"
        subtitle="Pick a doctor and time, pay securely, and get your Zoom link instantly."
      />
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4.5 rounded-[var(--radius-card)] border border-[var(--card-border)] bg-[var(--card-bg)] [backdrop-filter:var(--card-blur)] p-6 sm:p-8"
      >
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

        <div>
          <label className={labelClass}>Email (optional)</label>
          <input type="email" className={fieldClass} {...register('email')} />
        </div>

        <div>
          <label className={labelClass}>Doctor</label>
          <select className={fieldClass} {...register('doctor_id', { required: 'Please select a doctor' })}>
            <option value="">Select a doctor</option>
            {videoDoctors.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                {doctor.name} ({doctor.specialization || 'General'}) — ₹{doctor.video_consultation_fee}
              </option>
            ))}
          </select>
          {errors.doctor_id && <p className="mt-1.5 text-sm text-red-600">{errors.doctor_id.message}</p>}
          {videoDoctors.length === 0 && (
            <p className="mt-1.5 text-sm text-brand-ink-soft">No doctors are currently offering video consultations.</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Preferred Date</label>
            <input
              type="date"
              min={today}
              className={fieldClass}
              {...register('consultation_date', { required: 'Date is required' })}
            />
            {errors.consultation_date && <p className="mt-1.5 text-sm text-red-600">{errors.consultation_date.message}</p>}
          </div>
          <div>
            <label className={labelClass}>Preferred Time</label>
            <input type="time" className={fieldClass} {...register('consultation_time', { required: 'Time is required' })} />
            {errors.consultation_time && <p className="mt-1.5 text-sm text-red-600">{errors.consultation_time.message}</p>}
          </div>
        </div>

        <div>
          <label className={labelClass}>Problem Description (optional)</label>
          <textarea rows="3" className={fieldClass} {...register('problem_description')} />
        </div>

        <button
          type="submit"
          disabled={isPaying || videoDoctors.length === 0}
          className="w-full rounded-[var(--radius-button)] bg-brand-navy px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-brand-navy-hover)] disabled:opacity-50"
        >
          {isPaying ? 'Processing...' : selectedDoctor ? `Pay ₹${selectedDoctor.video_consultation_fee} & Book` : 'Pay & Book'}
        </button>
      </form>
    </div>
  );
}
