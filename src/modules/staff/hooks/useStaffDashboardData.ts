// src/modules/staff/hooks/useStaffDashboardData.ts

import { useState, useEffect, useCallback } from 'react';
import { getStaffDashboardData, clearStaffDashboardCache } from '../services/staffService'; // ✅ fixed import
import type { StaffDashboardData, StaffDashboardFilters } from '../types/staffDashboard';

export function useStaffDashboardData(
  filters: StaffDashboardFilters
): {
  data: StaffDashboardData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const [data, setData] = useState<StaffDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(() => {
    setIsLoading(true);
    setError(null);
    try {
      const result = getStaffDashboardData(
        filters.fromDate,
        filters.toDate,
        filters.department
      );
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const refetch = useCallback(() => {
    clearStaffDashboardCache();
    loadData();
  }, [loadData]);

  return { data, isLoading, error, refetch };
}