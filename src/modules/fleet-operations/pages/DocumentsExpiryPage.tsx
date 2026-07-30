import { memo, useState, useCallback, useMemo, useEffect } from 'react';
import { useDocumentsData } from '../hooks/useDocumentsData';
import { DOCUMENT_LABELS, DOCUMENT_TYPE_ORDER } from '../utils/constants';
import ErrorBoundary from '../../../components/common/ErrorBoundary';
import DocumentSummaryTiles from '../components/documents/DocumentSummaryTiles';
import DocumentMatrix from '../components/documents/DocumentMatrix';
import DocumentEditModal from '../components/documents/DocumentEditModal';
import { useSafeNotification } from '../../../hooks/useSafeNotification';
import { RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 10;

const getNearestExpiry = (row: any): number => {
  const docMap = row.docMap || {};
  const dates = Object.values(docMap)
    .map((doc: any) => {
      if (doc && typeof doc === 'object') {
        return doc.expiryDate;
      }
      return undefined;
    })
    .filter((date): date is string => !!date)
    .map((date) => new Date(date).getTime());
  if (dates.length === 0) return Infinity;
  return Math.min(...dates);
};

const DocumentsExpiryPage = () => {
  const {
    totalCounts,
    statusCounts,
    matrix,
    getStatusColor,
    formatExpiryDate,
    refetch,
    updateDocument,
  } = useDocumentsData();
  const { showNotification } = useSafeNotification();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [editData, setEditData] = useState<{ vehicle: any; docMap: any } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    refetch();
  }, []);

  const filteredMatrix = useMemo(() => {
    if (!searchTerm.trim()) return matrix;
    return matrix.filter((row: any) =>
      row.vehicle.vehicleNumber.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [matrix, searchTerm]);

  const sortedMatrix = useMemo(() => {
    return [...filteredMatrix].sort((a, b) => getNearestExpiry(a) - getNearestExpiry(b));
  }, [filteredMatrix]);

  const totalPages = Math.ceil(sortedMatrix.length / PAGE_SIZE);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const paginatedMatrix = sortedMatrix.slice(startIndex, startIndex + PAGE_SIZE);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refetch?.();
      showNotification('Data refreshed successfully', 'success');
    } catch (error) {
      showNotification('Failed to refresh data', 'error');
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch, isRefreshing, showNotification]);

  // ✅ Enhanced edit handler
  const handleEdit = useCallback((vehicle: any, docMap: any) => {
    console.log('✏️ Edit clicked for vehicle:', vehicle);
    // Normalise vehicle ID to string
    const normalizedVehicle = {
      ...vehicle,
      id: String(vehicle.id),
    };
    setEditData({ vehicle: normalizedVehicle, docMap });
  }, []);

  const handleCloseEdit = useCallback(() => setEditData(null), []);

  const handleSaveEdit = useCallback(
    async (vehicleId: string, updates: Record<string, string | null>) => {
      console.log('📝 Saving changes for vehicle', vehicleId, updates);
      try {
        await updateDocument(vehicleId, updates);
        await refetch?.();
        showNotification('Document dates updated successfully', 'success');
        setEditData(null);
      } catch (error: any) {
        showNotification(error?.message || 'Failed to update documents', 'error');
      }
    },
    [refetch, updateDocument, showNotification]
  );

  const renderPagination = () => {
    if (totalPages <= 1) return null;
    const pageNumbers = [];
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) startPage = Math.max(1, endPage - maxVisible + 1);
    for (let i = startPage; i <= endPage; i++) pageNumbers.push(i);

    return (
      <div className="flex items-center gap-1 justify-end mt-4">
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        {pageNumbers.map((num) => (
          <button
            key={num}
            onClick={() => handlePageChange(num)}
            className={`px-3 py-1 rounded text-sm font-medium transition-all ${
              num === currentPage
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-gray-700 hover:bg-blue-50 hover:text-blue-600 border border-gray-300'
            }`}
          >
            {num}
          </button>
        ))}
        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    );
  };

  // ✅ Include ALL document types (including RC)
  const editableDocTypes = DOCUMENT_TYPE_ORDER as unknown as string[];

  return (
    <ErrorBoundary>
      <div className="px-1 md:px-3 py-6 md:py-8 space-y-6 max-w-7xl mx-auto bg-slate-50 min-h-screen">
        <DocumentSummaryTiles
          counts={totalCounts}
          statusCounts={statusCounts}
          docLabels={DOCUMENT_LABELS}
        />

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Vehicle Document Status</h3>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-none">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by vehicle number..."
                  className="w-full sm:w-64 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-all shadow-sm active:scale-95"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>

          <DocumentMatrix
            matrix={paginatedMatrix}
            docTypes={DOCUMENT_TYPE_ORDER as unknown as string[]}
            docLabels={DOCUMENT_LABELS}
            getStatusColor={getStatusColor}
            formatExpiryDate={formatExpiryDate}
            onEdit={handleEdit}
          />

          {renderPagination()}
        </div>

        {/* ✅ Modal conditionally rendered */}
        {editData && (
          <DocumentEditModal
            vehicle={editData.vehicle}
            docMap={editData.docMap}
            docTypes={editableDocTypes}
            onClose={handleCloseEdit}
            onSave={handleSaveEdit}
          />
        )}
      </div>
    </ErrorBoundary>
  );
};

export default memo(DocumentsExpiryPage);