import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as serviceService from '../services/serviceService.js';

export function useServices() {
  return useQuery({ queryKey: ['services'], queryFn: serviceService.listServices });
}

export function useService(id) {
  return useQuery({
    queryKey: ['services', id],
    queryFn: () => serviceService.getService(id),
    enabled: Boolean(id),
  });
}

export function useCreateService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: serviceService.createService,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['services'] }),
  });
}

export function useUpdateService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, formData }) => serviceService.updateService(id, formData),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['services'] }),
  });
}

export function useDeleteService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: serviceService.deleteService,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['services'] }),
  });
}

export function usePublicServices() {
  return useQuery({ queryKey: ['services', 'public'], queryFn: serviceService.listPublicServices });
}
