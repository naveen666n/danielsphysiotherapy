import AppError from '../utils/AppError.js';
import * as appointmentRepository from '../repositories/appointmentRepository.js';

function toCreateRow(data) {
  return {
    patient_name: data.patient_name,
    mobile: data.mobile,
    email: data.email ?? null,
    gender: data.gender ?? null,
    age: data.age ?? null,
    doctor_id: data.doctor_id ?? null,
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
  const id = await appointmentRepository.create(appointment);
  return getAppointment(id);
}

export async function updateAppointment(id, data) {
  await getAppointment(id);
  await appointmentRepository.update(id, data);
  return getAppointment(id);
}

export async function deleteAppointment(id) {
  await getAppointment(id);
  await appointmentRepository.remove(id);
}
