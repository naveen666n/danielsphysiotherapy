import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../../contexts/AuthContext.jsx';
import { useAppointments, useUpdateAppointment, useDeleteAppointment } from '../../../hooks/useAppointments.js';
import { useDoctors } from '../../../hooks/useDoctors.js';
import ConfirmDialog from '../../../components/ConfirmDialog.jsx';
import AppointmentEditModal from './AppointmentEditModal.jsx';

const STATUSES = ['pending', 'approved', 'cancelled', 'completed'];

const STATUS_STYLES = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-700',
  completed: 'bg-green-100 text-green-700',
};

export default function AppointmentList() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [statusFilter, setStatusFilter] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const filters = {
    status: statusFilter || undefined,
    doctorId: doctorFilter || undefined,
    date: dateFilter || undefined,
  };

  const { data: appointments, isLoading } = useAppointments(filters);
  const { data: doctors } = useDoctors();
  const updateAppointment = useUpdateAppointment();
  const deleteAppointment = useDeleteAppointment();

  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [editingAppointment, setEditingAppointment] = useState(null);

  async function handleStatusChange(id, status) {
    try {
      await updateAppointment.mutateAsync({ id, payload: { status } });
      toast.success('Status updated');
    } catch (err) {
      toast.error(err.message || 'Failed to update status.');
    }
  }

  async function confirmDelete() {
    try {
      await deleteAppointment.mutateAsync(pendingDeleteId);
      toast.success('Appointment deleted');
    } catch (err) {
      toast.error(err.message || 'Failed to delete appointment.');
    } finally {
      setPendingDeleteId(null);
    }
  }

  function clearFilters() {
    setStatusFilter('');
    setDoctorFilter('');
    setDateFilter('');
  }

  if (isLoading) {
    return <div className="text-slate-500">Loading...</div>;
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-slate-800">Appointments</h1>

      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All Statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
        <select
          value={doctorFilter}
          onChange={(e) => setDoctorFilter(e.target.value)}
          className="rounded border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All Doctors</option>
          {doctors?.map((doctor) => (
            <option key={doctor.id} value={doctor.id}>
              {doctor.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="rounded border border-slate-300 px-3 py-2 text-sm"
        />
        {(statusFilter || doctorFilter || dateFilter) && (
          <button
            onClick={clearFilters}
            className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Clear Filters
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">Patient</th>
              <th className="px-4 py-3">Mobile</th>
              <th className="px-4 py-3">Doctor</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {appointments?.map((appointment) => {
              const doctor = doctors?.find((d) => d.id === appointment.doctor_id);
              return (
                <tr key={appointment.id}>
                  <td className="px-4 py-3 font-medium text-slate-800">{appointment.patient_name}</td>
                  <td className="px-4 py-3 text-slate-600">{appointment.mobile}</td>
                  <td className="px-4 py-3 text-slate-600">{doctor?.name || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{appointment.appointment_date?.slice(0, 10)}</td>
                  <td className="px-4 py-3 text-slate-600">{appointment.appointment_time}</td>
                  <td className="px-4 py-3">
                    <select
                      value={appointment.status}
                      onChange={(e) => handleStatusChange(appointment.id, e.target.value)}
                      className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLES[appointment.status]}`}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="space-x-3 px-4 py-3">
                    <button onClick={() => setEditingAppointment(appointment)} className="text-blue-600 hover:underline">
                      Edit
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => setPendingDeleteId(appointment.id)}
                        className="text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {appointments?.length === 0 && <p className="p-6 text-center text-slate-500">No appointments found.</p>}
      </div>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Delete Appointment"
        message="Are you sure you want to delete this appointment? This cannot be undone."
        onConfirm={confirmDelete}
        onCancel={() => setPendingDeleteId(null)}
      />

      {editingAppointment && (
        <AppointmentEditModal
          appointment={editingAppointment}
          doctors={doctors}
          onClose={() => setEditingAppointment(null)}
        />
      )}
    </div>
  );
}
