import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useStaffMember, useCreateStaff, useUpdateStaff } from '../../../hooks/useStaff.js';

export default function StaffForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { data: staffMember, isLoading: isLoadingStaff } = useStaffMember(id);
  const createStaff = useCreateStaff();
  const updateStaff = useUpdateStaff();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      name: '',
      mobile: '',
      email: '',
      username: '',
      password: '',
      active: true,
    },
  });

  useEffect(() => {
    if (staffMember) {
      reset({
        name: staffMember.name ?? '',
        mobile: staffMember.mobile ?? '',
        email: staffMember.email ?? '',
        username: staffMember.username ?? '',
        password: '',
        active: Boolean(staffMember.active),
      });
    }
  }, [staffMember, reset]);

  async function onSubmit(values) {
    const payload = {
      name: values.name,
      username: values.username,
      active: values.active,
    };
    if (values.mobile) payload.mobile = values.mobile;
    if (values.email) payload.email = values.email;
    if (values.password) payload.password = values.password;

    try {
      if (isEdit) {
        await updateStaff.mutateAsync({ id, payload });
        toast.success('Staff member updated');
      } else {
        await createStaff.mutateAsync(payload);
        toast.success('Staff member created');
      }
      navigate('/admin/staff');
    } catch (err) {
      toast.error(err.message || 'Failed to save staff member.');
    }
  }

  if (isEdit && isLoadingStaff) {
    return <div className="text-slate-500">Loading...</div>;
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold text-slate-800">
        {isEdit ? 'Edit Staff Member' : 'Add Staff Member'}
      </h1>
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
            <label className="mb-1 block text-sm font-medium text-slate-700">Mobile</label>
            <input
              type="text"
              className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              {...register('mobile')}
            />
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

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Username</label>
          <input
            type="text"
            className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            {...register('username', {
              required: 'Username is required',
              minLength: { value: 3, message: 'Username must be at least 3 characters' },
            })}
          />
          {errors.username && <p className="mt-1 text-sm text-red-600">{errors.username.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            {isEdit ? 'New Password (leave blank to keep current)' : 'Password'}
          </label>
          <input
            type="password"
            className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            {...register(
              'password',
              isEdit
                ? {}
                : {
                    required: 'Password is required',
                    minLength: { value: 6, message: 'Password must be at least 6 characters' },
                  }
            )}
          />
          {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>}
        </div>

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
            {isSubmitting ? 'Saving...' : isEdit ? 'Update Staff Member' : 'Create Staff Member'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/staff')}
            className="rounded border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
