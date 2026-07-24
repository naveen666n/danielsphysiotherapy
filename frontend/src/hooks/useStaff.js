import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as staffService from '../services/staffService.js';

export function useStaffList() {
  return useQuery({ queryKey: ['staff'], queryFn: staffService.listStaff });
}

export function useStaffMember(id) {
  return useQuery({
    queryKey: ['staff', id],
    queryFn: () => staffService.getStaffMember(id),
    enabled: Boolean(id),
  });
}

export function useCreateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: staffService.createStaffMember,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff'] }),
  });
}

export function useUpdateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => staffService.updateStaffMember(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff'] }),
  });
}
