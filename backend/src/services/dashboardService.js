import * as dashboardRepository from '../repositories/dashboardRepository.js';

const STATUSES = ['pending', 'approved', 'completed', 'cancelled'];

function normalizeCounts(rows) {
  const counts = Object.fromEntries(STATUSES.map((status) => [status, 0]));
  let total = 0;
  for (const row of rows) {
    counts[row.status] = row.count;
    total += row.count;
  }
  return { ...counts, total };
}

export async function getDashboard() {
  const [
    countRows,
    activeDoctorCount,
    activeStaffCount,
    unreadMessageCount,
    recentAppointments,
    recentUnreadMessages,
  ] = await Promise.all([
    dashboardRepository.getAppointmentCounts(),
    dashboardRepository.getActiveDoctorCount(),
    dashboardRepository.getActiveStaffCount(),
    dashboardRepository.getUnreadMessageCount(),
    dashboardRepository.getRecentAppointments(5),
    dashboardRepository.getRecentUnreadMessages(5),
  ]);

  return {
    appointmentCounts: normalizeCounts(countRows),
    activeDoctorCount,
    activeStaffCount,
    unreadMessageCount,
    recentAppointments,
    recentUnreadMessages,
  };
}
