import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as videoConsultationService from '../services/videoConsultationService.js';

export function useVideoConsultations(filters = {}) {
  return useQuery({
    queryKey: ['video-consultations', filters],
    queryFn: () => videoConsultationService.listConsultations(filters),
  });
}

export function useCreateVideoConsultationOrder() {
  return useMutation({ mutationFn: videoConsultationService.createOrder });
}

export function useVerifyVideoConsultationPayment() {
  return useMutation({
    mutationFn: ({ id, payload }) => videoConsultationService.verifyPayment(id, payload),
  });
}

export function useUpdateVideoConsultation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => videoConsultationService.updateConsultation(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['video-consultations'] }),
  });
}
