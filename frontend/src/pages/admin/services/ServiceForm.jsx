import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useService, useCreateService, useUpdateService } from '../../../hooks/useServices.js';
import { getPhotoUrl } from '../../../utils/photoUrl.js';

export default function ServiceForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { data: service, isLoading: isLoadingService } = useService(id);
  const createService = useCreateService();
  const updateService = useUpdateService();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      name: '',
      description: '',
      display_order: '',
    },
  });

  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  useEffect(() => {
    if (service) {
      reset({
        name: service.name ?? '',
        description: service.description ?? '',
        display_order: service.display_order ?? '',
      });
      setPhotoPreview(getPhotoUrl(service.image_url));
    }
  }, [service, reset]);

  function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  }

  async function onSubmit(values) {
    const formData = new FormData();
    formData.append('name', values.name);
    if (values.description) formData.append('description', values.description);
    if (values.display_order !== '') formData.append('display_order', values.display_order);
    if (photoFile) formData.append('image', photoFile);

    try {
      if (isEdit) {
        await updateService.mutateAsync({ id, formData });
        toast.success('Service updated');
      } else {
        await createService.mutateAsync(formData);
        toast.success('Service created');
      }
      navigate('/admin/services');
    } catch (err) {
      toast.error(err.message || 'Failed to save service.');
    }
  }

  if (isEdit && isLoadingService) {
    return <div className="text-slate-500">Loading...</div>;
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold text-slate-800">{isEdit ? 'Edit Service' : 'Add Service'}</h1>
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

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
          <textarea
            rows="3"
            className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            {...register('description')}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Display Order</label>
          <input
            type="number"
            min="0"
            className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            {...register('display_order')}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Photo</label>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} />
          {photoPreview && (
            <img src={photoPreview} alt="Service preview" className="mt-2 h-24 w-24 rounded object-cover" />
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : isEdit ? 'Update Service' : 'Create Service'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/services')}
            className="rounded border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
