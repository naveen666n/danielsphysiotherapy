import { renderShell, detailRow, detailsTable, ctaButton, escapeHtml, COLORS } from './layout.js';

export function videoAppointmentCustomerEmail({
  patientName,
  doctorName,
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
    detailRow('🩺', 'Doctor', escapeHtml(doctorName)),
    detailRow('📅', 'Date', escapeHtml(date)),
    detailRow('⏰', 'Time', escapeHtml(time)),
    detailRow('📝', 'Reason for visit', problemDescription ? escapeHtml(problemDescription) : ''),
  ].filter(Boolean);

  const bodyHtml = `
    ${detailsTable(rows)}
    ${ctaButton('Join Video Consultation', zoomLink, COLORS.accent)}
    <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;color:${COLORS.softInk};line-height:1.6;margin:16px 0 0;">
      Tips for your video visit: join 5 minutes early, use a quiet well-lit room, and keep any prior reports handy to share on screen.
    </p>`;

  const html = renderShell({
    badgeText: 'Video Consultation Confirmed',
    badgeColor: COLORS.accent,
    heading: `Your video visit is booked, ${escapeHtml(patientName)}!`,
    introHtml: `<p style="margin:0 0 4px;">Hi ${escapeHtml(patientName)},</p><p style="margin:0;">Payment received — your video consultation is confirmed. Here are the details:</p>`,
    bodyHtml,
    logoUrl,
    clinicName,
    clinicAddress,
    clinicPhone,
    clinicEmail,
  });

  return {
    subject: `Video Consultation Confirmed — ${date} at ${time}`,
    html,
  };
}
