import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useTestimonial, useCreateTestimonial, useUpdateTestimonial } from '../../../hooks/useTestimonials.js';
import { getPhotoUrl } from '../../../utils/photoUrl.js';
import ImageUploadField from '../../../components/admin/ImageUploadField.jsx';

export default function TestimonialForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { data: testimonial, isLoading: isLoadingTestimonial } = useTestimonial(id);
  const createTestimonial = useCreateTestimonial();
  const updateTestimonial = useUpdateTestimonial();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      patient_name: '',
      review: '',
      rating: '5',
    },
  });

  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  useEffect(() => {
    if (testimonial) {
      reset({
        patient_name: testimonial.patient_name ?? '',
        review: testimonial.review ?? '',
        rating: String(testimonial.rating ?? 5),
      });
      setPhotoPreview(getPhotoUrl(testimonial.photo_url));
    }
  }, [testimonial, reset]);

  function handlePhotoChange(file) {
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function handlePhotoClear() {
    setPhotoFile(null);
    setPhotoPreview(getPhotoUrl(testimonial?.photo_url) ?? null);
  }

  async function onSubmit(values) {
    const formData = new FormData();
    formData.append('patient_name', values.patient_name);
    formData.append('review', values.review);
    formData.append('rating', values.rating);
    if (photoFile) formData.append('photo', photoFile);

    try {
      if (isEdit) {
        await updateTestimonial.mutateAsync({ id, formData });
        toast.success('Testimonial updated');
      } else {
        await createTestimonial.mutateAsync(formData);
        toast.success('Testimonial created');
      }
      navigate('/admin/testimonials');
    } catch (err) {
      toast.error(err.message || 'Failed to save testimonial.');
    }
  }

  if (isEdit && isLoadingTestimonial) {
    return <div className="text-slate-500">Loading...</div>;
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold text-slate-800">{isEdit ? 'Edit Testimonial' : 'Add Testimonial'}</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-lg bg-white p-6 shadow">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Patient Name</label>
          <input
            type="text"
            className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            {...register('patient_name', { required: 'Name is required' })}
          />
          {errors.patient_name && <p className="mt-1 text-sm text-red-600">{errors.patient_name.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Review</label>
          <textarea
            rows="4"
            className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            {...register('review', {
              required: 'Review is required',
              minLength: { value: 5, message: 'Review must be at least 5 characters' },
            })}
          />
          {errors.review && <p className="mt-1 text-sm text-red-600">{errors.review.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Rating</label>
          <select
            className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            {...register('rating', { required: true })}
          >
            {[5, 4, 3, 2, 1].map((r) => (
              <option key={r} value={r}>
                {r} star{r > 1 ? 's' : ''}
              </option>
            ))}
          </select>
        </div>

        <ImageUploadField
          label="Photo"
          preview={photoPreview}
          onChange={handlePhotoChange}
          onClear={photoFile ? handlePhotoClear : undefined}
          shape="circle"
          hint="A friendly headshot works best. JPG, PNG or WEBP, up to 5MB."
        />

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : isEdit ? 'Update Testimonial' : 'Create Testimonial'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/testimonials')}
            className="rounded border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
