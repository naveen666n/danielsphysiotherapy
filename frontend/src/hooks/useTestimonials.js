import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as testimonialService from '../services/testimonialService.js';

export function useTestimonials() {
  return useQuery({ queryKey: ['testimonials'], queryFn: testimonialService.listTestimonials });
}

export function useTestimonial(id) {
  return useQuery({
    queryKey: ['testimonials', id],
    queryFn: () => testimonialService.getTestimonial(id),
    enabled: Boolean(id),
  });
}

export function useCreateTestimonial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: testimonialService.createTestimonial,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['testimonials'] }),
  });
}

export function useUpdateTestimonial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, formData }) => testimonialService.updateTestimonial(id, formData),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['testimonials'] }),
  });
}

export function useDeleteTestimonial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: testimonialService.deleteTestimonial,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['testimonials'] }),
  });
}
