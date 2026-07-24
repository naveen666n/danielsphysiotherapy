import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../../contexts/AuthContext.jsx';
import { useDoctors, useDeleteDoctor } from '../../../hooks/useDoctors.js';
import { getPhotoUrl } from '../../../utils/photoUrl.js';
import ConfirmDialog from '../../../components/ConfirmDialog.jsx';

export default function DoctorList() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { data: doctors, isLoading } = useDoctors();
  const deleteDoctor = useDeleteDoctor();
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  async function confirmDelete() {
    try {
      await deleteDoctor.mutateAsync(pendingDeleteId);
      toast.success('Doctor deleted');
    } catch (err) {
      toast.error(err.message || 'Failed to delete doctor.');
    } finally {
      setPendingDeleteId(null);
    }
  }

  if (isLoading) {
    return <div className="text-slate-500">Loading...</div>;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-800">Doctors</h1>
        {isAdmin && (
          <Link
            to="/admin/doctors/new"
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Add Doctor
          </Link>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">Photo</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Specialization</th>
              <th className="px-4 py-3">Experience</th>
              <th className="px-4 py-3">Fee</th>
              <th className="px-4 py-3">Working Days</th>
              <th className="px-4 py-3">Status</th>
              {isAdmin && <th className="px-4 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {doctors?.map((doctor) => (
              <tr key={doctor.id}>
                <td className="px-4 py-3">
                  {doctor.photo_url ? (
                    <img
                      src={getPhotoUrl(doctor.photo_url)}
                      alt={doctor.name}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-slate-200" />
                  )}
                </td>
                <td className="px-4 py-3 font-medium text-slate-800">{doctor.name}</td>
                <td className="px-4 py-3 text-slate-600">{doctor.specialization || '-'}</td>
                <td className="px-4 py-3 text-slate-600">
                  {doctor.experience_years != null ? `${doctor.experience_years} yrs` : '-'}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {doctor.consultation_fee != null ? `₹${doctor.consultation_fee}` : '-'}
                </td>
                <td className="px-4 py-3 text-slate-600">{doctor.working_days || '-'}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      doctor.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {doctor.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                {isAdmin && (
                  <td className="space-x-3 px-4 py-3">
                    <Link to={`/admin/doctors/${doctor.id}/edit`} className="text-blue-600 hover:underline">
                      Edit
                    </Link>
                    <button onClick={() => setPendingDeleteId(doctor.id)} className="text-red-600 hover:underline">
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {doctors?.length === 0 && <p className="p-6 text-center text-slate-500">No doctors added yet.</p>}
      </div>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Delete Doctor"
        message="Are you sure you want to delete this doctor? This cannot be undone."
        onConfirm={confirmDelete}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
}
