import React, { useState, useEffect, useMemo } from 'react';
import { useSafeNotification } from '../../../hooks/useSafeNotification';
import { FarmPaymentTable } from '../components/farm-payment/FarmPaymentTable';
import { FarmerPaymentFilters } from '../components/farm-payment/FarmerPaymentFilters';
import { tripService } from '../../operations/vehicle-trips/services/tripService';
import { FarmPaymentService } from '../services/FarmPaymentService';
import type { Trip } from '../../operations/vehicle-trips/types/trip';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type FarmerPaymentPageProps = { embedded?: boolean };

export function FarmerPaymentPage({ embedded = false }: FarmerPaymentPageProps) {
  const { showNotification } = useSafeNotification();

  // ----- state -----
  const [allTrips, setAllTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedFarm, setSelectedFarm] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // ----- load data -----
  const loadCompletedTrips = () => {
    setLoading(true);
    try {
      const all = tripService.getAll();
      const completed = all.filter((t) => t.status === 'Completed' && !t.deleted);
      setAllTrips(completed);
    } catch (error) {
      console.error('Failed to load trips:', error);
      showNotification('Failed to load trips', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompletedTrips();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [dateFrom, dateTo, selectedFarm, statusFilter, searchQuery]);

  // ----- compute unique farms -----
  const farms = useMemo(() => {
    const farmSet = new Set(allTrips.map((t) => t.sourceFarm).filter(Boolean));
    return ['All', ...Array.from(farmSet)];
  }, [allTrips]);

  // ----- filter trips -----
  const filteredTrips = useMemo(() => {
    return allTrips.filter((trip) => {
      // Date range
      if (dateFrom && trip.tripDate < dateFrom) return false;
      if (dateTo && trip.tripDate > dateTo) return false;

      // Farm
      if (selectedFarm !== 'All' && trip.sourceFarm !== selectedFarm) return false;

      // Status filter: uses payment status from saved payments, not trip status
      const hasPayment = FarmPaymentService.getByTripId(trip.id) !== undefined;
      if (statusFilter === 'Pending' && hasPayment) return false;
      if (statusFilter === 'Saved' && !hasPayment) return false;

      // Global search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          trip.tripNo.toLowerCase().includes(q) ||
          trip.vehicleNo.toLowerCase().includes(q) ||
          trip.sourceFarm.toLowerCase().includes(q) ||
          trip.driverName.toLowerCase().includes(q) ||
          trip.supervisorName.toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [allTrips, dateFrom, dateTo, selectedFarm, statusFilter, searchQuery]);

  // ----- pagination -----
  const totalPages = Math.ceil(filteredTrips.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTrips = filteredTrips.slice(startIndex, startIndex + itemsPerPage);
  const startEntry = filteredTrips.length === 0 ? 0 : startIndex + 1;
  const endEntry = Math.min(startIndex + itemsPerPage, filteredTrips.length);

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  const getPageNumbers = (): (number | 'ellipsis')[] => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('ellipsis');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }
    return pages;
  };

  // ----- handlers -----
  const handlePaymentSaved = () => {
    loadCompletedTrips();
  };

  const handleRefresh = () => {
    loadCompletedTrips();
    showNotification('Refreshed', 'info');
  };

  const handleApplyFilters = () => {
    setCurrentPage(1);
    showNotification('Filters applied', 'info');
  };

  const handleClearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setSelectedFarm('All');
    setStatusFilter('All');
    setSearchQuery('');
    setCurrentPage(1);
    showNotification('Filters cleared', 'info');
  };

  // ----- render -----
  const content = (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto bg-slate-50 min-h-screen">
      {/* Header removed - only filters and table remain */}
      
      {/* Filters */}
      <FarmerPaymentFilters
        dateFrom={dateFrom}
        dateTo={dateTo}
        selectedFarm={selectedFarm}
        statusFilter={statusFilter}
        searchQuery={searchQuery}
        farms={farms}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onFarmChange={setSelectedFarm}
        onStatusChange={setStatusFilter}
        onSearchChange={setSearchQuery}
        onApply={handleApplyFilters}
        onClear={handleClearFilters}
      />

      {/* Table */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">Loading trips...</div>
      ) : (
        <>
          <FarmPaymentTable
            trips={paginatedTrips}
            onPaymentSaved={handlePaymentSaved}
            onRefresh={handleRefresh}
            showNotification={showNotification}
          />

          {/* Pagination footer */}
          {filteredTrips.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="text-xs text-slate-500">
                Showing {startEntry} to {endEntry} of {filteredTrips.length} entries
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-1"
                >
                  <ChevronLeft size={14} /> Prev
                </button>

                {getPageNumbers().map((page, idx) =>
                  page === 'ellipsis' ? (
                    <span key={`ellipsis-${idx}`} className="px-2 text-xs text-slate-400">…</span>
                  ) : (
                    <button
                      key={page}
                      onClick={() => goToPage(page)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        currentPage === page
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'border border-slate-300 text-slate-700 bg-white hover:bg-slate-100'
                      }`}
                    >
                      {page}
                    </button>
                  )
                )}

                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-1"
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  return embedded ? content : content;
}