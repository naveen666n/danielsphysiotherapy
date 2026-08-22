import { renderShell, detailRow, detailsTable, escapeHtml, COLORS } from './layout.js';

export function appointmentCustomerEmail({
  patientName,
  doctorName,
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
    detailRow('🩺', 'Doctor', doctorName ? escapeHtml(doctorName) : 'To be assigned'),
    detailRow('💆', 'Service', serviceName ? escapeHtml(serviceName) : ''),
    detailRow('📅', 'Date', escapeHtml(date)),
    detailRow('⏰', 'Time', escapeHtml(time)),
    detailRow('📍', 'Location', clinicAddress ? escapeHtml(clinicAddress) : ''),
    detailRow('📝', 'Reason for visit', problemDescription ? escapeHtml(problemDescription) : ''),
  ].filter(Boolean);

  const bodyHtml = `
    ${detailsTable(rows)}
    <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;color:${COLORS.softInk};line-height:1.6;margin:0;">
      Please arrive 10 minutes early with any prior prescriptions or scan reports. Need to reschedule? Just call us at the number below.
    </p>`;

  const html = renderShell({
    badgeText: 'Appointment Confirmed',
    badgeColor: COLORS.accent,
    heading: `See you soon, ${escapeHtml(patientName)}!`,
    introHtml: `<p style="margin:0 0 4px;">Hi ${escapeHtml(patientName)},</p><p style="margin:0;">Your appointment has been booked. Here are the details:</p>`,
    bodyHtml,
    logoUrl,
    clinicName,
    clinicAddress,
    clinicPhone,
    clinicEmail,
  });

  return {
    subject: `Appointment Confirmed — ${date} at ${time}`,
    html,
  };
}
