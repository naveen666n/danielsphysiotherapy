import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as settingsService from '../services/settingsService.js';

export function useSettings() {
  return useQuery({ queryKey: ['settings'], queryFn: settingsService.getSettings });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: settingsService.updateSettings,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }),
  });
}
