import { renderShell, detailRow, detailsTable, escapeHtml, COLORS } from './layout.js';

export function appointmentDoctorEmail({
  doctorName,
  patientName,
  mobile,
  patientEmail,
  serviceName,
  date,
  time,
  problemDescription,
  clinicName,
  clinicAddress,
  clinicPhone,
  clinicEmail,
  logoUrl,
}) {
  const rows = [
    detailRow('🙍', 'Patient', escapeHtml(patientName)),
    detailRow('📱', 'Mobile', escapeHtml(mobile)),
    detailRow('✉️', 'Email', patientEmail ? escapeHtml(patientEmail) : ''),
    detailRow('💆', 'Service', serviceName ? escapeHtml(serviceName) : ''),
    detailRow('📅', 'Date', escapeHtml(date)),
    detailRow('⏰', 'Time', escapeHtml(time)),
    detailRow('📝', 'Reason for visit', problemDescription ? escapeHtml(problemDescription) : ''),
  ].filter(Boolean);

  const bodyHtml = detailsTable(rows);

  const html = renderShell({
    badgeText: 'New Appointment',
    badgeColor: COLORS.orange,
    heading: 'A new appointment has been booked',
    introHtml: `<p style="margin:0;">Hi ${escapeHtml(doctorName || 'there')}, a patient just booked an appointment. Details below.</p>`,
    bodyHtml,
    logoUrl,
    clinicName,
    clinicAddress,
    clinicPhone,
    clinicEmail,
  });

  return {
    subject: `New Appointment — ${patientName} on ${date} at ${time}`,
    html,
  };
}
