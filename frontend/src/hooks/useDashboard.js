import { useQuery } from '@tanstack/react-query';
import * as dashboardService from '../services/dashboardService.js';

export function useDashboard() {
  return useQuery({ queryKey: ['dashboard'], queryFn: dashboardService.getDashboard });
}
