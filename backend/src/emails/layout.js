const COLORS = {
  navy: '#0b2e4e',
  navyDark: '#082238',
  accent: '#6d5ae6',
  orange: '#f2994a',
  ink: '#142430',
  softInk: '#4a5c68',
  hairline: '#e3e7ec',
  page: '#eef1f5',
};

const HEADING_FONT = "Georgia, 'Times New Roman', serif";
const BODY_FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function detailRow(icon, label, value) {
  if (!value) return '';
  return `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid ${COLORS.hairline};font-size:20px;width:32px;vertical-align:top;">${icon}</td>
      <td style="padding:12px 0 12px 12px;border-bottom:1px solid ${COLORS.hairline};vertical-align:top;">
        <div style="font-family:${BODY_FONT};font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${COLORS.softInk};margin:0 0 2px;">${escapeHtml(label)}</div>
        <div style="font-family:${BODY_FONT};font-size:15px;color:${COLORS.ink};line-height:1.4;">${value}</div>
      </td>
    </tr>`;
}

export function detailsTable(rowsHtml) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:20px 0;">
      ${rowsHtml.join('')}
    </table>`;
}

export function ctaButton(label, href, color = COLORS.accent) {
  if (!href) return '';
  const safeHref = escapeHtml(href);
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto;">
      <tr>
        <td style="border-radius:8px;background-color:${color};">
          <a href="${safeHref}" target="_blank"
             style="display:inline-block;padding:14px 32px;font-family:${BODY_FONT};font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
            ${escapeHtml(label)}
          </a>
        </td>
      </tr>
    </table>
    <p style="text-align:center;font-family:${BODY_FONT};font-size:12px;color:${COLORS.softInk};word-break:break-all;margin:0 0 8px;">
      Or copy this link into your browser:<br /><a href="${safeHref}" target="_blank" style="color:${COLORS.accent};">${safeHref}</a>
    </p>`;
}

export function renderShell({
  badgeText,
  badgeColor = COLORS.accent,
  heading,
  introHtml,
  bodyHtml,
  logoUrl,
  clinicName,
  clinicAddress,
  clinicPhone,
  clinicEmail,
}) {
  const safeClinicName = escapeHtml(clinicName || "Daniel's Physiotherapy Clinic");
  const logoBlock = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${safeClinicName}" height="44" style="height:44px;width:auto;display:block;margin:0 auto 14px;" />`
    : '';

  const footerLines = [clinicAddress, [clinicPhone, clinicEmail].filter(Boolean).join(' &nbsp;&bull;&nbsp; ')]
    .filter(Boolean)
    .map((line) => `<p style="margin:0 0 4px;font-family:${BODY_FONT};font-size:12px;color:${COLORS.softInk};">${line}</p>`)
    .join('');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeClinicName}</title>
  </head>
  <body style="margin:0;padding:0;background-color:${COLORS.page};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLORS.page};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:14px;overflow:hidden;border:1px solid ${COLORS.hairline};">
            <tr>
              <td style="background-color:${COLORS.navy};background-image:linear-gradient(135deg, ${COLORS.navy}, ${COLORS.navyDark});padding:36px 32px;text-align:center;">
                ${logoBlock}
                <div style="font-family:${BODY_FONT};display:inline-block;padding:5px 14px;border-radius:999px;background-color:${badgeColor};color:#ffffff;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:12px;">
                  ${escapeHtml(badgeText)}
                </div>
                <h1 style="margin:0;font-family:${HEADING_FONT};font-size:24px;font-weight:700;color:#ffffff;">${escapeHtml(heading)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <div style="font-family:${BODY_FONT};font-size:15px;line-height:1.6;color:${COLORS.ink};">
                  ${introHtml}
                </div>
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px;background-color:${COLORS.page};border-top:1px solid ${COLORS.hairline};text-align:center;">
                <p style="margin:0 0 8px;font-family:${HEADING_FONT};font-size:15px;font-weight:700;color:${COLORS.navy};">${safeClinicName}</p>
                ${footerLines}
                <p style="margin:12px 0 0;font-family:${BODY_FONT};font-size:11px;color:${COLORS.softInk};">This is an automated notification — please do not reply directly to this email.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export { COLORS, HEADING_FONT, BODY_FONT };
