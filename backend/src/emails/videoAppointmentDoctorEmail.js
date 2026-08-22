import { renderShell, detailRow, detailsTable, ctaButton, escapeHtml, COLORS } from './layout.js';

export function videoAppointmentDoctorEmail({
  doctorName,
  patientName,
  mobile,
  patientEmail,
  date,
  time,
  problemDescription,
  zoomLink,
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
    detailRow('📅', 'Date', escapeHtml(date)),
    detailRow('⏰', 'Time', escapeHtml(time)),
    detailRow('📝', 'Reason for visit', problemDescription ? escapeHtml(problemDescription) : ''),
  ].filter(Boolean);

  const bodyHtml = `
    ${detailsTable(rows)}
    ${ctaButton('Open Your Zoom Room', zoomLink, COLORS.orange)}`;

  const html = renderShell({
    badgeText: 'New Video Consultation',
    badgeColor: COLORS.orange,
    heading: 'A patient has booked a video consultation',
    introHtml: `<p style="margin:0;">Hi ${escapeHtml(doctorName || 'there')}, a patient just paid for a video consultation. Details below.</p>`,
    bodyHtml,
    logoUrl,
    clinicName,
    clinicAddress,
    clinicPhone,
    clinicEmail,
  });

  return {
    subject: `New Video Consultation — ${patientName} on ${date} at ${time}`,
    html,
  };
}
