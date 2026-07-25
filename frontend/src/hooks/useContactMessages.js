import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as contactMessageService from '../services/contactMessageService.js';

export function useContactMessages(filters = {}) {
  return useQuery({
    queryKey: ['contactMessages', filters],
    queryFn: () => contactMessageService.listMessages(filters),
  });
}

export function useMarkMessageRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isRead }) => contactMessageService.markMessageRead(id, isRead),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contactMessages'] }),
  });
}

export function useDeleteMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: contactMessageService.deleteMessage,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contactMessages'] }),
  });
}
