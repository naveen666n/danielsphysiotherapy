import { useState } from 'react';
import toast from 'react-hot-toast';
import { useVideoConsultations, useUpdateVideoConsultation } from '../../../hooks/useVideoConsultations.js';
import { useDoctors } from '../../../hooks/useDoctors.js';

const STATUSES = ['pending_payment', 'paid', 'failed', 'cancelled'];

const STATUS_STYLES = {
  pending_payment: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-200 text-slate-600',
};

export default function VideoConsultationList() {
  const [statusFilter, setStatusFilter] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const filters = {
    status: statusFilter || undefined,
    doctorId: doctorFilter || undefined,
    date: dateFilter || undefined,
  };

  const { data: consultations, isLoading } = useVideoConsultations(filters);
  const { data: doctors } = useDoctors();
  const updateConsultation = useUpdateVideoConsultation();

  async function handleStatusChange(id, status) {
    try {
      await updateConsultation.mutateAsync({ id, payload: { status } });
      toast.success('Status updated');
    } catch (err) {
      toast.error(err.message || 'Failed to update status.');
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
      <h1 className="mb-6 text-2xl font-semibold text-slate-800">Video Consultations</h1>

      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All Statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace('_', ' ')}
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
              <th className="px-4 py-3">Zoom Link</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {consultations?.map((consultation) => {
              const doctor = doctors?.find((d) => d.id === consultation.doctor_id);
              return (
                <tr key={consultation.id}>
                  <td className="px-4 py-3 font-medium text-slate-800">{consultation.patient_name}</td>
                  <td className="px-4 py-3 text-slate-600">{consultation.mobile}</td>
                  <td className="px-4 py-3 text-slate-600">{doctor?.name || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{consultation.consultation_date?.slice(0, 10)}</td>
                  <td className="px-4 py-3 text-slate-600">{consultation.consultation_time}</td>
                  <td className="px-4 py-3">
                    <select
                      value={consultation.status}
                      onChange={(e) => handleStatusChange(consultation.id, e.target.value)}
                      className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLES[consultation.status]}`}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s.replace('_', ' ')}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    {consultation.zoom_link ? (
                      <a href={consultation.zoom_link} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                        Open
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {consultations?.length === 0 && <p className="p-6 text-center text-slate-500">No video consultations found.</p>}
      </div>
    </div>
  );
}
