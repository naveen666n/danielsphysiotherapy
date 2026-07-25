import AppError from '../utils/AppError.js';
import * as appointmentRepository from '../repositories/appointmentRepository.js';

function referencedRowError(err) {
  const detail = err.sqlMessage || err.message || '';
  if (detail.includes('service_id')) return 'Selected service does not exist.';
  return 'Selected doctor does not exist.';
}

function toCreateRow(data) {
  return {
    patient_name: data.patient_name,
    mobile: data.mobile,
    email: data.email ?? null,
    gender: data.gender ?? null,
    age: data.age ?? null,
    doctor_id: data.doctor_id ?? null,
    service_id: data.service_id ?? null,
    appointment_date: data.appointment_date,
    appointment_time: data.appointment_time,
    problem_description: data.problem_description ?? null,
    status: 'pending',
  };
}

export async function listAppointments(filters) {
  return appointmentRepository.findAll(filters);
}

export async function getAppointment(id) {
  const appointment = await appointmentRepository.findById(id);
  if (!appointment) {
    throw new AppError('Appointment not found.', 404);
  }
  return appointment;
}

export async function createPublicAppointment(data) {
  const appointment = toCreateRow(data);
  let id;
  try {
    id = await appointmentRepository.create(appointment);
  } catch (err) {
    if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_NO_REFERENCED_ROW') {
      throw new AppError(referencedRowError(err), 400);
    }
    throw err;
  }
  return getAppointment(id);
}

export async function updateAppointment(id, data) {
  await getAppointment(id);
  try {
    await appointmentRepository.update(id, data);
  } catch (err) {
    if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_NO_REFERENCED_ROW') {
      throw new AppError(referencedRowError(err), 400);
    }
    throw err;
  }
  return getAppointment(id);
}

export async function deleteAppointment(id) {
  await getAppointment(id);
  await appointmentRepository.remove(id);
}
