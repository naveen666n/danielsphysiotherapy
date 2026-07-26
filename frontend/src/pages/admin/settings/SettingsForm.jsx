import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useSettings, useUpdateSettings } from '../../../hooks/useSettings.js';
import { getPhotoUrl } from '../../../utils/photoUrl.js';
import ImageUploadField from '../../../components/admin/ImageUploadField.jsx';

export default function SettingsForm() {
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      hospital_name: '',
      address: '',
      phone: '',
      email: '',
      google_map_link: '',
      opening_hours: '',
      instagram: '',
      facebook: '',
      twitter: '',
    },
  });

  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);

  useEffect(() => {
    if (settings) {
      reset({
        hospital_name: settings.hospital_name ?? '',
        address: settings.address ?? '',
        phone: settings.phone ?? '',
        email: settings.email ?? '',
        google_map_link: settings.google_map_link ?? '',
        opening_hours: settings.opening_hours ?? '',
        instagram: settings.social_links?.instagram ?? '',
        facebook: settings.social_links?.facebook ?? '',
        twitter: settings.social_links?.twitter ?? '',
      });
      setLogoPreview(getPhotoUrl(settings.logo_url));
    }
  }, [settings, reset]);

  function handleLogoChange(file) {
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  function handleLogoClear() {
    setLogoFile(null);
    setLogoPreview(getPhotoUrl(settings?.logo_url) ?? null);
  }

  async function onSubmit(values) {
    const formData = new FormData();
    formData.append('hospital_name', values.hospital_name);
    formData.append('address', values.address);
    formData.append('phone', values.phone);
    if (values.email) formData.append('email', values.email);
    formData.append('google_map_link', values.google_map_link);
    formData.append('opening_hours', values.opening_hours);
    formData.append(
      'social_links',
      JSON.stringify({
        instagram: values.instagram,
        facebook: values.facebook,
        twitter: values.twitter,
      })
    );
    if (logoFile) formData.append('logo', logoFile);

    try {
      await updateSettings.mutateAsync(formData);
      toast.success('Settings updated');
    } catch (err) {
      toast.error(err.message || 'Failed to save settings.');
    }
  }

  if (isLoading) {
    return <div className="text-slate-500">Loading...</div>;
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold text-slate-800">Hospital Settings</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-lg bg-white p-6 shadow">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Hospital Name</label>
          <input
            type="text"
            className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            {...register('hospital_name')}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Address</label>
          <input
            type="text"
            className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            {...register('address')}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Phone</label>
            <input
              type="text"
              className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              {...register('phone')}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              {...register('email', {
                pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email' },
              })}
            />
            {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Google Map Link</label>
          <input
            type="text"
            className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            {...register('google_map_link')}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Opening Hours</label>
          <input
            type="text"
            placeholder="e.g. Mon-Sat: 9:00 AM - 7:00 PM"
            className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            {...register('opening_hours')}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Instagram</label>
            <input
              type="text"
              className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              {...register('instagram')}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Facebook</label>
            <input
              type="text"
              className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              {...register('facebook')}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Twitter</label>
            <input
              type="text"
              className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              {...register('twitter')}
            />
          </div>
        </div>

        <ImageUploadField
          label="Logo"
          preview={logoPreview}
          onChange={handleLogoChange}
          onClear={logoFile ? handleLogoClear : undefined}
          hint="Square logo works best. JPG, PNG or WEBP, up to 5MB."
        />

        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
