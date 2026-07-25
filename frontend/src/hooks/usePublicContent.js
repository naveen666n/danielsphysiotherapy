import { useQuery } from '@tanstack/react-query';
import * as contentService from '../services/contentService.js';

export function usePublicContent() {
  return useQuery({
    queryKey: ['content', 'public'],
    queryFn: contentService.getPublicContent,
    staleTime: 5 * 60 * 1000,
  });
}
