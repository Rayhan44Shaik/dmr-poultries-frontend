import { memo } from 'react';
import { useDocumentsData } from '../hooks/useDocumentsData';
import { DOCUMENT_TYPES, DOCUMENT_LABELS } from '../utils/constants';
import ErrorBoundary from '../components/common/ErrorBoundary';
import DocumentSummaryTiles from '../components/documents/DocumentSummaryTiles';
import DocumentMatrix from '../components/documents/DocumentMatrix';

const DocumentsExpiryPage = () => {
  const { expiringCounts, matrix, getStatusColor } = useDocumentsData();

  return (
    <ErrorBoundary>
      <div className="p-4 md:p-6 space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Documents & Expiry Alerts</h1>

        {/* Summary Tiles */}
        <DocumentSummaryTiles counts={expiringCounts} docLabels={DOCUMENT_LABELS} />

        {/* Document Matrix Table */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Vehicle Document Status</h3>
          <DocumentMatrix
            matrix={matrix}
            docTypes={[...DOCUMENT_TYPES]} // Convert readonly to mutable array
            docLabels={DOCUMENT_LABELS}
            getStatusColor={getStatusColor}
          />
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default memo(DocumentsExpiryPage);