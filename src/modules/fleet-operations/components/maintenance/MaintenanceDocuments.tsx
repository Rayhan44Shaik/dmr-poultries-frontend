import { memo, useState } from 'react';
import { Paperclip, Download, FileText } from 'lucide-react';
import type { MaintenanceDocument } from '../../types';
import { maintenanceApi } from '../../services/maintenanceApi';
import DocumentViewerModal from './DocumentViewerModal';

interface MaintenanceDocumentsProps {
  maintenanceId: string;
  documents: MaintenanceDocument[];
}

const formatFileSize = (bytes?: number): string => {
  if (!bytes) return '';
  if (bytes > 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

/** Read-only grid of documents attached to a maintenance record. Images show a
 * thumbnail; PDFs show an icon. Click opens the viewer; download fetches the
 * binary from the backend (never from localStorage). */
const MaintenanceDocuments = ({ maintenanceId, documents }: MaintenanceDocumentsProps) => {
  const [viewerDoc, setViewerDoc] = useState<MaintenanceDocument | null>(null);

  const docs = Array.isArray(documents) ? documents : [];

  if (docs.length === 0) {
    return (
      <p className="text-sm text-slate-400 italic">
        No documents attached.
      </p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {docs.map((doc) => {
          const isImage = (doc.mimeType || '').startsWith('image/');
          const url = maintenanceApi.documentUrl(maintenanceId, doc.id);
          return (
            <div
              key={doc.id}
              className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 hover:border-blue-300 hover:shadow-sm transition group cursor-pointer"
              onClick={() => setViewerDoc(doc)}
            >
              <div className="h-24 w-full bg-slate-100 flex items-center justify-center overflow-hidden">
                {isImage ? (
                  <img
                    src={url}
                    alt={doc.fileName}
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="flex flex-col items-center text-slate-400">
                    <FileText size={26} />
                    <span className="text-[10px] mt-1 uppercase text-slate-400">PDF</span>
                  </div>
                )}
              </div>
              <div className="p-2">
                <p className="text-xs font-medium text-slate-700 truncate flex items-center gap-1" title={doc.fileName}>
                  <Paperclip size={11} className="text-slate-400 shrink-0" />
                  <span className="truncate">{doc.fileName}</span>
                </p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-slate-400">{formatFileSize(doc.fileSize)}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      maintenanceApi.downloadDocument(maintenanceId, doc);
                    }}
                    className="text-slate-400 hover:text-blue-600 transition"
                    title="Download"
                  >
                    <Download size={13} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <DocumentViewerModal
        open={Boolean(viewerDoc)}
        maintenanceId={maintenanceId}
        doc={viewerDoc}
        onClose={() => setViewerDoc(null)}
      />
    </>
  );
};

export default memo(MaintenanceDocuments);
