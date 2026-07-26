import { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useSubmitContactMessage } from '../../hooks/useContactMessages.js';

const fieldClass =
  'w-full rounded-[3px] border border-brand-line px-3.5 py-3 text-[14.5px] text-brand-ink focus:border-brand-sage focus:outline-2 focus:outline-brand-sage focus:outline-offset-1';
const labelClass = 'mb-2 block font-mono-brand text-[11.5px] tracking-[0.06em] text-brand-ink-soft uppercase';

export default function ContactForm() {
  const submitMessage = useSubmitContactMessage();
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { name: '', phone: '', email: '', message: '' } });

  async function onSubmit(values) {
    const payload = { name: values.name, message: values.message };
    if (values.phone) payload.phone = values.phone;
    if (values.email) payload.email = values.email;

    try {
      await submitMessage.mutateAsync(payload);
      setSubmitted(true);
    } catch (err) {
      toast.error(err.message || 'Failed to send message.');
    }
  }

  if (submitted) {
    return (
      <div className="rounded-[4px] border border-brand-line bg-white p-8 text-center">
        <h3 className="font-display text-xl text-brand-navy">Message Sent</h3>
        <p className="mt-2 text-sm text-brand-ink-soft">Thank you for reaching out. We'll get back to you shortly.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="rounded-[4px] border border-brand-line bg-white p-9">
      <h3 className="font-display mb-6 text-2xl font-normal text-brand-navy">Send a Message</h3>

      <div className="mb-4.5">
        <label className={labelClass}>Full Name</label>
        <input
          type="text"
          className={fieldClass}
          {...register('name', {
            required: 'Name is required',
            minLength: { value: 2, message: 'Name must be at least 2 characters' },
          })}
        />
        {errors.name && <p className="mt-1.5 text-sm text-red-600">{errors.name.message}</p>}
      </div>

      <div className="mb-4.5 grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Phone (optional)</label>
          <input type="tel" className={fieldClass} {...register('phone')} />
        </div>
        <div>
          <label className={labelClass}>Email (optional)</label>
          <input type="email" className={fieldClass} {...register('email')} />
        </div>
      </div>

      <div className="mb-1.5">
        <label className={labelClass}>Message</label>
        <textarea
          rows="4"
          className={fieldClass}
          {...register('message', {
            required: 'Message is required',
            minLength: { value: 5, message: 'Message must be at least 5 characters' },
          })}
        />
        {errors.message && <p className="mt-1.5 text-sm text-red-600">{errors.message.message}</p>}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-5 w-full rounded-[3px] bg-brand-navy px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#0d3a63] disabled:opacity-50"
      >
        {isSubmitting ? 'Sending...' : 'Send Message'}
      </button>
    </form>
  );
}
