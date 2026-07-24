import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../../contexts/AuthContext.jsx';
import { useServices, useDeleteService } from '../../../hooks/useServices.js';
import { getPhotoUrl } from '../../../utils/photoUrl.js';
import ConfirmDialog from '../../../components/ConfirmDialog.jsx';

export default function ServiceList() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { data: services, isLoading } = useServices();
  const deleteService = useDeleteService();
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  async function confirmDelete() {
    try {
      await deleteService.mutateAsync(pendingDeleteId);
      toast.success('Service deleted');
    } catch (err) {
      toast.error(err.message || 'Failed to delete service.');
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
        <h1 className="text-2xl font-semibold text-slate-800">Services</h1>
        {isAdmin && (
          <Link
            to="/admin/services/new"
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Add Service
          </Link>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">Photo</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Order</th>
              {isAdmin && <th className="px-4 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {services?.map((service) => (
              <tr key={service.id}>
                <td className="px-4 py-3">
                  {service.image_url ? (
                    <img
                      src={getPhotoUrl(service.image_url)}
                      alt={service.name}
                      className="h-10 w-10 rounded object-cover"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded bg-slate-200" />
                  )}
                </td>
                <td className="px-4 py-3 font-medium text-slate-800">{service.name}</td>
                <td className="px-4 py-3 text-slate-600">{service.description || '-'}</td>
                <td className="px-4 py-3 text-slate-600">{service.display_order}</td>
                {isAdmin && (
                  <td className="space-x-3 px-4 py-3">
                    <Link to={`/admin/services/${service.id}/edit`} className="text-blue-600 hover:underline">
                      Edit
                    </Link>
                    <button onClick={() => setPendingDeleteId(service.id)} className="text-red-600 hover:underline">
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {services?.length === 0 && <p className="p-6 text-center text-slate-500">No services added yet.</p>}
      </div>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Delete Service"
        message="Are you sure you want to delete this service? This cannot be undone."
        onConfirm={confirmDelete}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
}
