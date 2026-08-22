import env from '../config/env.js';
import { sendMail } from '../lib/mailer.js';
import * as doctorRepository from '../repositories/doctorRepository.js';
import * as serviceRepository from '../repositories/serviceRepository.js';
import * as settingsRepository from '../repositories/settingsRepository.js';
import { appointmentCustomerEmail } from '../emails/appointmentCustomerEmail.js';
import { appointmentDoctorEmail } from '../emails/appointmentDoctorEmail.js';
import { videoAppointmentCustomerEmail } from '../emails/videoAppointmentCustomerEmail.js';
import { videoAppointmentDoctorEmail } from '../emails/videoAppointmentDoctorEmail.js';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function toAbsoluteUrl(pathOrUrl) {
  if (!pathOrUrl) return null;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${env.BACKEND_URL}${pathOrUrl}`;
}

async function getBranding() {
  const settings = await settingsRepository.find();
  return {
    clinicName: settings?.hospital_name || "Daniel's Physiotherapy Clinic",
    clinicAddress: settings?.address || null,
    clinicPhone: settings?.phone || null,
    clinicEmail: settings?.email || null,
    logoUrl: toAbsoluteUrl(settings?.logo_url),
  };
}

export async function sendAppointmentEmails(appointment) {
  const [doctor, service, branding] = await Promise.all([
    appointment.doctor_id ? doctorRepository.findById(appointment.doctor_id) : null,
    appointment.service_id ? serviceRepository.findById(appointment.service_id) : null,
    getBranding(),
  ]);

  const date = formatDate(appointment.appointment_date);
  const shared = {
    date,
    time: appointment.appointment_time,
    problemDescription: appointment.problem_description,
    ...branding,
  };

  const sends = [];

  if (appointment.email) {
    const { subject, html } = appointmentCustomerEmail({
      ...shared,
      patientName: appointment.patient_name,
      doctorName: doctor?.name,
      serviceName: service?.name,
    });
    sends.push(sendMail({ to: appointment.email, fromName: branding.clinicName, subject, html }));
  }

  const staffRecipients = [doctor?.email, branding.clinicEmail].filter(Boolean);
  if (staffRecipients.length > 0) {
    const { subject, html } = appointmentDoctorEmail({
      ...shared,
      doctorName: doctor?.name,
      patientName: appointment.patient_name,
      mobile: appointment.mobile,
      patientEmail: appointment.email,
      serviceName: service?.name,
    });
    sends.push(sendMail({ to: staffRecipients, fromName: branding.clinicName, subject, html }));
  }

  await Promise.all(sends);
}

export async function sendVideoConsultationEmails(consultation, doctor) {
  const branding = await getBranding();
  const date = formatDate(consultation.consultation_date);
  const shared = {
    date,
    time: consultation.consultation_time,
    problemDescription: consultation.problem_description,
    zoomLink: consultation.zoom_link,
    doctorName: doctor?.name,
    ...branding,
  };

  const sends = [];

  if (consultation.email) {
    const { subject, html } = videoAppointmentCustomerEmail({
      ...shared,
      patientName: consultation.patient_name,
    });
    sends.push(sendMail({ to: consultation.email, fromName: branding.clinicName, subject, html }));
  }

  const staffRecipients = [doctor?.email, branding.clinicEmail].filter(Boolean);
  if (staffRecipients.length > 0) {
    const { subject, html } = videoAppointmentDoctorEmail({
      ...shared,
      patientName: consultation.patient_name,
      mobile: consultation.mobile,
      patientEmail: consultation.email,
    });
    sends.push(sendMail({ to: staffRecipients, fromName: branding.clinicName, subject, html }));
  }

  await Promise.all(sends);
}
