import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../../contexts/AuthContext.jsx';
import { useTestimonials, useDeleteTestimonial } from '../../../hooks/useTestimonials.js';
import { getPhotoUrl } from '../../../utils/photoUrl.js';
import ConfirmDialog from '../../../components/ConfirmDialog.jsx';

export default function TestimonialList() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { data: testimonials, isLoading } = useTestimonials();
  const deleteTestimonial = useDeleteTestimonial();
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  async function confirmDelete() {
    try {
      await deleteTestimonial.mutateAsync(pendingDeleteId);
      toast.success('Testimonial deleted');
    } catch (err) {
      toast.error(err.message || 'Failed to delete testimonial.');
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
        <h1 className="text-2xl font-semibold text-slate-800">Testimonials</h1>
        {isAdmin && (
          <Link
            to="/admin/testimonials/new"
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Add Testimonial
          </Link>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">Photo</th>
              <th className="px-4 py-3">Patient</th>
              <th className="px-4 py-3">Review</th>
              <th className="px-4 py-3">Rating</th>
              {isAdmin && <th className="px-4 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {testimonials?.map((testimonial) => (
              <tr key={testimonial.id}>
                <td className="px-4 py-3">
                  {testimonial.photo_url ? (
                    <img
                      src={getPhotoUrl(testimonial.photo_url)}
                      alt={testimonial.patient_name}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-slate-200" />
                  )}
                </td>
                <td className="px-4 py-3 font-medium text-slate-800">{testimonial.patient_name}</td>
                <td className="max-w-xs truncate px-4 py-3 text-slate-600">{testimonial.review}</td>
                <td className="px-4 py-3 text-slate-600">{testimonial.rating} / 5</td>
                {isAdmin && (
                  <td className="space-x-3 px-4 py-3">
                    <Link to={`/admin/testimonials/${testimonial.id}/edit`} className="text-blue-600 hover:underline">
                      Edit
                    </Link>
                    <button onClick={() => setPendingDeleteId(testimonial.id)} className="text-red-600 hover:underline">
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {testimonials?.length === 0 && <p className="p-6 text-center text-slate-500">No testimonials added yet.</p>}
      </div>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Delete Testimonial"
        message="Are you sure you want to delete this testimonial? This cannot be undone."
        onConfirm={confirmDelete}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
}
