import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as doctorService from '../services/doctorService.js';

export function useDoctors() {
  return useQuery({ queryKey: ['doctors'], queryFn: doctorService.listDoctors });
}

export function usePublicDoctors() {
  return useQuery({ queryKey: ['doctors', 'public'], queryFn: doctorService.listPublicDoctors });
}

export function useDoctor(id) {
  return useQuery({
    queryKey: ['doctors', id],
    queryFn: () => doctorService.getDoctor(id),
    enabled: Boolean(id),
  });
}

export function useCreateDoctor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: doctorService.createDoctor,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['doctors'] }),
  });
}

export function useUpdateDoctor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, formData }) => doctorService.updateDoctor(id, formData),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['doctors'] }),
  });
}

export function useDeleteDoctor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: doctorService.deleteDoctor,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['doctors'] }),
  });
}
