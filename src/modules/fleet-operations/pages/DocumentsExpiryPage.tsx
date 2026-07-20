import { memo, useState, useCallback, useMemo } from 'react';
import { useDocumentsData } from '../hooks/useDocumentsData';
import { DOCUMENT_TYPES, DOCUMENT_LABELS } from '../utils/constants';
import ErrorBoundary from '../../../components/common/ErrorBoundary';
import DocumentSummaryTiles from '../components/documents/DocumentSummaryTiles';
import DocumentMatrix from '../components/documents/DocumentMatrix';
import DocumentEditModal from '../components/documents/DocumentEditModal';
import { useSafeNotification } from '../../../hooks/useSafeNotification';
import { RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 10;

const DocumentsExpiryPage = () => {
  const { expiringCounts, matrix, getStatusColor, refetch } = useDocumentsData();
  const { showNotification } = useSafeNotification();

  const [editData, setEditData] = useState<{ vehicle: any; docMap: any } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const sortedMatrix = useMemo(() => {
    return [...matrix].sort((a, b) => {
      const getNearestExpiry = (row: any) => {
        const dates = Object.values(row.docMap)
          .filter((doc: any) => doc && doc.expiryDate)
          .map((doc: any) => new Date(doc.expiryDate).getTime());
        if (dates.length === 0) return Infinity;
        return Math.min(...dates);
      };
      return getNearestExpiry(a) - getNearestExpiry(b);
    });
  }, [matrix]);

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
      showNotification('Documents data refreshed successfully', 'success');
    } catch (error) {
      showNotification('Failed to refresh data', 'error');
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch, isRefreshing, showNotification]);

  const handleEdit = useCallback((vehicle: any, docMap: any) => {
    setEditData({ vehicle, docMap });
  }, []);

  const handleCloseEdit = useCallback(() => setEditData(null), []);

  // ✅ Fix: prefix unused params with underscore to silence warnings
  const handleSaveEdit = useCallback(async (_vehicleId: string, _updates: Record<string, string | null>) => {
    try {
      showNotification('Document updated successfully', 'success');
      await refetch?.();
      setEditData(null);
    } catch (error) {
      showNotification('Failed to update documents', 'error');
    }
  }, [refetch, showNotification]);

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

  return (
    <ErrorBoundary>
      <div className="px-1 md:px-3 py-6 md:py-8 space-y-6 max-w-7xl mx-auto bg-slate-50 min-h-screen">
        <DocumentSummaryTiles counts={expiringCounts} docLabels={DOCUMENT_LABELS} />

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Vehicle Document Status</h3>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-all shadow-sm active:scale-95"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          <DocumentMatrix
            matrix={paginatedMatrix}
            docTypes={[...DOCUMENT_TYPES]}
            docLabels={DOCUMENT_LABELS}
            getStatusColor={getStatusColor}
            onEdit={handleEdit}
          />

          {renderPagination()}
        </div>

        {editData && (
          <DocumentEditModal
            vehicle={editData.vehicle}
            docMap={editData.docMap}
            onClose={handleCloseEdit}
            onSave={handleSaveEdit}
          />
        )}
      </div>
    </ErrorBoundary>
  );
};

export default memo(DocumentsExpiryPage);