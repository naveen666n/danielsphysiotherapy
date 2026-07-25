import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as contentService from '../services/contentService.js';

export function useContent() {
  return useQuery({ queryKey: ['content'], queryFn: contentService.getContent });
}

export function useUpdateContent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: contentService.updateContent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content'] });
    },
  });
}
