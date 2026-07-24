import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as appointmentService from '../services/appointmentService.js';

export function useAppointments(filters = {}) {
  return useQuery({
    queryKey: ['appointments', filters],
    queryFn: () => appointmentService.listAppointments(filters),
  });
}

export function useAppointment(id) {
  return useQuery({
    queryKey: ['appointments', id],
    queryFn: () => appointmentService.getAppointment(id),
    enabled: Boolean(id),
  });
}

export function useBookAppointment() {
  return useMutation({ mutationFn: appointmentService.bookAppointmentPublic });
}

export function useUpdateAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => appointmentService.updateAppointment(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['appointments'] }),
  });
}

export function useDeleteAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: appointmentService.deleteAppointment,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['appointments'] }),
  });
}
