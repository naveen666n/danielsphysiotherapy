import { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useSubmitContactMessage } from '../../hooks/useContactMessages.js';

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
      <div className="rounded-xl bg-teal-50 p-8 text-center">
        <h3 className="text-lg font-semibold text-teal-700">Message Sent</h3>
        <p className="mt-2 text-sm text-teal-600">Thank you for reaching out. We'll get back to you shortly.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Full Name</label>
        <input
          type="text"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none"
          {...register('name', {
            required: 'Name is required',
            minLength: { value: 2, message: 'Name must be at least 2 characters' },
          })}
        />
        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Phone (optional)</label>
          <input
            type="tel"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none"
            {...register('phone')}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Email (optional)</label>
          <input
            type="email"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none"
            {...register('email')}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Message</label>
        <textarea
          rows="4"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none"
          {...register('message', {
            required: 'Message is required',
            minLength: { value: 5, message: 'Message must be at least 5 characters' },
          })}
        />
        {errors.message && <p className="mt-1 text-sm text-red-600">{errors.message.message}</p>}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-full bg-teal-600 px-4 py-2.5 font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
      >
        {isSubmitting ? 'Sending...' : 'Send Message'}
      </button>
    </form>
  );
}
