export function sendResponse(res, { status = 200, message = '', data = null } = {}) {
  return res.status(status).json({ success: status < 400, message, data });
}
