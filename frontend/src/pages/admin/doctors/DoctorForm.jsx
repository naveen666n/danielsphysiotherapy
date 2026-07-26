import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useDoctor, useCreateDoctor, useUpdateDoctor } from '../../../hooks/useDoctors.js';
import { getPhotoUrl } from '../../../utils/photoUrl.js';
import ImageUploadField from '../../../components/admin/ImageUploadField.jsx';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function DoctorForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { data: doctor, isLoading: isLoadingDoctor } = useDoctor(id);
  const createDoctor = useCreateDoctor();
  const updateDoctor = useUpdateDoctor();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      name: '',
      qualification: '',
      specialization: '',
      experience_years: '',
      consultation_fee: '',
      available_time: '',
      active: true,
    },
  });

  const [selectedDays, setSelectedDays] = useState([]);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  useEffect(() => {
    if (doctor) {
      reset({
        name: doctor.name ?? '',
        qualification: doctor.qualification ?? '',
        specialization: doctor.specialization ?? '',
        experience_years: doctor.experience_years ?? '',
        consultation_fee: doctor.consultation_fee ?? '',
        available_time: doctor.available_time ?? '',
        active: Boolean(doctor.active),
      });
      setSelectedDays(doctor.working_days ? doctor.working_days.split(',') : []);
      setPhotoPreview(getPhotoUrl(doctor.photo_url));
    }
  }, [doctor, reset]);

  function toggleDay(day) {
    setSelectedDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  function handlePhotoChange(file) {
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function handlePhotoClear() {
    setPhotoFile(null);
    setPhotoPreview(getPhotoUrl(doctor?.photo_url) ?? null);
  }

  async function onSubmit(values) {
    const formData = new FormData();
    formData.append('name', values.name);
    if (values.qualification) formData.append('qualification', values.qualification);
    if (values.specialization) formData.append('specialization', values.specialization);
    if (values.experience_years !== '') formData.append('experience_years', values.experience_years);
    if (values.consultation_fee !== '') formData.append('consultation_fee', values.consultation_fee);
    if (selectedDays.length > 0) formData.append('working_days', selectedDays.join(','));
    if (values.available_time) formData.append('available_time', values.available_time);
    formData.append('active', values.active ? 'true' : 'false');
    if (photoFile) formData.append('photo', photoFile);

    try {
      if (isEdit) {
        await updateDoctor.mutateAsync({ id, formData });
        toast.success('Doctor updated');
      } else {
        await createDoctor.mutateAsync(formData);
        toast.success('Doctor created');
      }
      navigate('/admin/doctors');
    } catch (err) {
      toast.error(err.message || 'Failed to save doctor.');
    }
  }

  if (isEdit && isLoadingDoctor) {
    return <div className="text-slate-500">Loading...</div>;
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold text-slate-800">{isEdit ? 'Edit Doctor' : 'Add Doctor'}</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-lg bg-white p-6 shadow">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
          <input
            type="text"
            className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            {...register('name', { required: 'Name is required' })}
          />
          {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Qualification</label>
            <input
              type="text"
              className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              {...register('qualification')}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Specialization</label>
            <input
              type="text"
              className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              {...register('specialization')}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Experience (years)</label>
            <input
              type="number"
              min="0"
              className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              {...register('experience_years')}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Consultation Fee</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              {...register('consultation_fee')}
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Working Days</label>
          <div className="flex flex-wrap gap-3">
            {DAYS.map((day) => (
              <label key={day} className="flex items-center gap-1 text-sm text-slate-700">
                <input type="checkbox" checked={selectedDays.includes(day)} onChange={() => toggleDay(day)} />
                {day}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Available Time</label>
          <input
            type="text"
            placeholder="e.g. 9:00 AM - 5:00 PM"
            className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            {...register('available_time')}
          />
        </div>

        <ImageUploadField
          label="Photo"
          preview={photoPreview}
          onChange={handlePhotoChange}
          onClear={photoFile ? handlePhotoClear : undefined}
          hint="A clear, professional headshot works best. JPG, PNG or WEBP, up to 5MB."
        />

        <div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" {...register('active')} />
            Active
          </label>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : isEdit ? 'Update Doctor' : 'Create Doctor'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/doctors')}
            className="rounded border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
